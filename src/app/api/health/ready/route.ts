import { neon } from "@neondatabase/serverless";
import { execFile } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { checkPrivateUploadStore } from "@/lib/assets/private-upload-store";
import { deploymentMode, verifiedUploadAliases } from "@/lib/runtime/deployment";

export const runtime = "nodejs";

const manifestEntry = z.object({
  path: z.string().regex(/^assets\/character-pdf\/(?:fonts\/[A-Za-z]+\.ttf|styles\/[a-z]+\/(?:frame|bridge)\.png)$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
const manifest = z.object({
  fonts: z.array(manifestEntry).length(7),
  styles: z.array(z.object({ assets: z.array(manifestEntry).length(2) })).length(12),
});
const execute = promisify(execFile);
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest();

async function checkAssets(signal: AbortSignal): Promise<void> {
  const contents = await readFile("assets/character-pdf/manifest.json", { encoding: "utf8", signal });
  const approved = manifest.parse(JSON.parse(contents));
  for (const entry of [...approved.fonts, ...approved.styles.flatMap(style => style.assets)]) {
    const bytes = await readFile(entry.path, { signal });
    if (digest(bytes).toString("hex") !== entry.sha256) throw new Error("PDF asset check failed.");
  }
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env["SW_READINESS_SECRET"];
  const provided = request.headers.get("X-SwordWeave-Readiness-Key");
  if (!secret || secret.length < 32 || !provided || !timingSafeEqual(digest(secret), digest(provided))) {
    return new Response(null, { status: 404, headers });
  }

  const budget = AbortSignal.any([request.signal, AbortSignal.timeout(18_000)]);
  async function check(work: (signal: AbortSignal) => void | Promise<void>): Promise<"pass" | "fail"> {
    try {
      await work(AbortSignal.any([budget, AbortSignal.timeout(5_000)]));
      return "pass";
    } catch {
      return "fail";
    }
  }

  const [configuration, assets, python, database, uploads] = await Promise.all([
    check(() => {
      if (process.env["SW_HOSTING"] !== "hetzner" || process.env["SW_UPLOAD_BACKEND"] !== "r2") {
        throw new Error("This deployment does not use the Hetzner runtime.");
      }
      deploymentMode();
      verifiedUploadAliases();
    }),
    check(checkAssets),
    check(async signal => {
      const binary = process.env["SWORDWEAVE_PDF_PYTHON"];
      if (!binary || !isAbsolute(binary)) throw new Error("Missing PDF runtime.");
      await execute(binary, ["-c", "import PIL, pypdf, reportlab"], { signal, maxBuffer: 4096 });
    }),
    check(async signal => {
      const connection = process.env["DATABASE_URL"];
      if (!connection) throw new Error("Missing database configuration.");
      const sql = neon(connection, { fetchOptions: { signal, redirect: "error" } });
      await sql`SELECT 1`;
    }),
    check(checkPrivateUploadStore),
  ]);
  const checks = { configuration, assets, python, database, uploads };
  const ready = Object.values(checks).every(result => result === "pass");
  return Response.json({
    schemaVersion: 1, status: ready ? "ready" : "not_ready",
    checkedAt: new Date().toISOString(), checks,
  }, { status: ready ? 200 : 503, headers });
}
