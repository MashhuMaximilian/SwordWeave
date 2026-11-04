import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync, lstatSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { applicationTestTargetV1, assertTestDatabaseUrl } from "../../src/lib/operations/contracts";

const manifestV1 = z.object({
  schemaVersion: z.literal(1),
  files: z.array(z.object({ path: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict()),
  requiredCases: z.array(z.object({ file: z.string(), names: z.array(z.string()).nonempty() }).strict()).nonempty(),
}).strict();
const resultsSchema = z.object({
  testResults: z.array(z.object({
    name: z.string(),
    assertionResults: z.array(z.object({ title: z.string(), status: z.string() })),
  })),
});
const root = realpathSync(new URL("../..", import.meta.url));
const childBase = { PATH: "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin", NODE_ENV: "test", CI: "true" };
const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

function isInput(path: string): boolean {
  return !path.split("/").some(part =>
    part === "" || part === "." || part === ".." || part.startsWith(".env") ||
    [".git", "node_modules", ".next", "tmp", "output"].includes(part)
  ) && (
    /^(src|public|assets|data|api|scripts|docs|infrastructure)\//.test(path) ||
    /^(package\.json|requirements\.txt|next-env\.d\.ts|(?:next|vitest|drizzle|tailwind)\.config\.ts|tsconfig\.json|postcss\.config\.mjs)$/.test(path)
  );
}

function runVitest(args: string[], cwd: string, env: NodeJS.ProcessEnv, logFile: string): Promise<number> {
  const log = openSync(logFile, "wx", 0o600);
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, args, {
      cwd, env, stdio: args[1] === "watch" ? "inherit" : ["ignore", log, log],
    });
    closeSync(log);
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    child.once("error", fail);
    child.once("close", code => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
      done(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  const [mode, flag, configPath, focusFlag, focus, ...extra] = process.argv.slice(2);
  if (
    (mode !== "run" && mode !== "watch") || flag !== "--target-config" || !configPath ||
    extra.length || (focusFlag !== undefined && (focusFlag !== "--focus" || !focus))
  ) {
    throw new Error("Usage: pnpm test --target-config FILE [--focus src/path.test.ts]");
  }
  const configBytes = readFileSync(resolve(configPath));
  const target = applicationTestTargetV1.parse(JSON.parse(configBytes.toString("utf8")));
  const databaseUrl = assertTestDatabaseUrl(target, process.env[target.connectionEnv]);
  const tracked = new Set(execFileSync("git", ["ls-files", "-z"], {
    cwd: root, encoding: "utf8", env: childBase,
  }).split("\0").filter(Boolean));
  if (focus && (!tracked.has(focus) || !/^src\/.+\.test\.ts$/.test(focus))) {
    throw new Error("Focus must be the exact path of a tracked application test.");
  }
  execFileSync("git", ["merge-base", "--is-ancestor", target.sourceRevision, "HEAD"], {
    cwd: root, env: childBase, stdio: "ignore",
  });
  const manifestPath = "infrastructure/hetzner/test-fixtures.json";
  if (!tracked.has(manifestPath)) throw new Error("Stage the fixture manifest before running application tests.");
  const output = join(root, ".local-migration", "application-tests");
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const receipt = mkdtempSync(join(output, "run-"));
  const work = realpathSync(mkdtempSync(join(receipt, "sandbox-")));
  try {
    const inputs = [...tracked].filter(isInput);
    execFileSync("git", ["checkout-index", "--stdin", "-z", `--prefix=${work}/`], {
      cwd: root, env: childBase, input: inputs.join("\0") + "\0",
    });
    for (const path of inputs) {
      const source = join(work, path);
      if (!lstatSync(source).isFile() || relative(work, realpathSync(source)) !== path) {
        throw new Error(`Test input is not a regular repository file: ${path}`);
      }
      if (path.endsWith(".test.ts")) {
        const code = readFileSync(source, "utf8");
        if (/\boverride\s*:\s*true\b/.test(code) || /\b(?:readFile|readFileSync)\(\s*["']\/(?:tmp|private\/tmp|Users|home)\//.test(code)) {
          throw new Error(`A test attempts to override its environment or read an external fixture: ${path}`);
        }
      }
    }
    const manifest = manifestV1.parse(JSON.parse(readFileSync(join(work, manifestPath), "utf8")));
    for (const { path, sha256: expected } of manifest.files) {
      if (!tracked.has(path) || !isInput(path) || sha256(readFileSync(join(work, path))) !== expected) {
        throw new Error(`Missing or changed test fixture: ${path}`);
      }
    }
    // Verify the exact approved endpoint in a bounded read-only transaction.
    const sql = neon(databaseUrl, { fetchOptions: { signal: AbortSignal.timeout(12_000), redirect: "error" } });
    const [identity] = await sql.transaction([
      sql`select current_database() as database_name, current_setting('transaction_read_only') as read_only`,
    ], { readOnly: true });
    if (identity?.[0]?.["database_name"] !== target.test.databaseName || identity[0]["read_only"] !== "on") {
      throw new Error("The isolated database did not return the expected read-only identity.");
    }
    symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");
    writeFileSync(join(work, ".sw-test-target.json"), configBytes, { mode: 0o600 });
    const marker = join(work, ".sw-test-attestation.json");
    writeFileSync(marker, JSON.stringify({
      schemaVersion: 1, root: work, configSha256: sha256(configBytes), databaseUrlSha256: sha256(databaseUrl),
    }), { mode: 0o600 });
    const resultPath = join(receipt, "vitest.json");
    const fd = openSync(resultPath, "wx", 0o600);
    closeSync(fd);
    const args = [
      join(root, "node_modules/vitest/vitest.mjs"), mode,
      "--maxWorkers", "1", "--minWorkers", "1",
      ...(mode === "run" ? ["--reporter=json", "--outputFile", resultPath] : []),
      ...(focus ? [focus] : []),
    ];
    const status = await runVitest(args, work, {
      ...childBase, DATABASE_URL: databaseUrl, SW_TEST_ATTESTATION: marker,
    }, join(receipt, "vitest.log"));
    if (mode === "watch") {
      process.exitCode = status;
      return;
    }
    const results = resultsSchema.parse(JSON.parse(readFileSync(resultPath, "utf8")));
    const assertions = results.testResults.flatMap(result => result.assertionResults);
    console.log(`Isolated ${focus ? "focused" : "full"} run: ${assertions.filter(test => test.status === "passed").length}/${assertions.length} passed.`);
    console.log(`Private test evidence: ${receipt}`);
    if (status !== 0) throw new Error("The isolated test run reported failures.");
    for (const requirement of manifest.requiredCases) {
      if (focus && focus !== requirement.file) continue;
      const result = results.testResults.find(test => resolve(work, test.name) === join(work, requirement.file));
      for (const name of requirement.names) {
        const matches = result?.assertionResults.filter(test => test.title === name);
        if (matches?.length !== 1 || matches[0]?.status !== "passed") {
          throw new Error(`Required test did not pass: ${name}`);
        }
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch(error => {
  // Provider/JSON errors may embed connection details, so print only our own messages.
  const message = error instanceof Error && /^(Usage:|The (?:isolated|connection)|Application tests|Focus must|Stage the|Missing or changed|Test input|A test attempts|Required test)/.test(error.message)
    ? error.message : "The isolated test launcher could not validate its inputs or read the test results.";
  console.error(message);
  process.exitCode = 1;
});
