import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { applicationTestTargetV1, assertTestDatabaseUrl } from "../lib/operations/contracts";

const hex = z.string().regex(/^[0-9a-f]{64}$/);
const attestationV1 = z.object({
  schemaVersion: z.literal(1),
  root: z.string().min(1),
  configSha256: hex,
  databaseUrlSha256: hex,
}).strict();

export function assertIsolatedApplicationTestTarget() {
  try {
    const root = realpathSync(process.cwd());
    const markerPath = join(root, ".sw-test-attestation.json");
    if (
      process.env["NODE_ENV"] !== "test" ||
      process.env["SW_TEST_ATTESTATION"] !== markerPath ||
      readdirSync(root).some(name => name.startsWith(".env"))
    ) {
      throw new Error("Unexpected test environment.");
    }
    const file = lstatSync(markerPath);
    if (!file.isFile() || (file.mode & 0o777) !== 0o600) throw new Error("Unsafe attestation.");

    const marker = attestationV1.parse(JSON.parse(readFileSync(markerPath, "utf8")));
    const config = readFileSync(join(root, ".sw-test-target.json"));
    const target = applicationTestTargetV1.parse(JSON.parse(config.toString("utf8")));
    const url = assertTestDatabaseUrl(target, process.env["DATABASE_URL"]);
    if (
      marker.root !== root ||
      marker.configSha256 !== createHash("sha256").update(config).digest("hex") ||
      marker.databaseUrlSha256 !== createHash("sha256").update(url).digest("hex")
    ) {
      throw new Error("Attestation mismatch.");
    }
    return {
      sourceRevision: target.sourceRevision,
      testProjectId: target.test.projectId,
      testBranchId: target.test.branchId,
      databaseName: target.test.databaseName,
      endpointHost: target.test.endpointHost,
    };
  } catch {
    throw new Error("Application tests require a verified isolated target. Run pnpm test --target-config FILE.");
  }
}
