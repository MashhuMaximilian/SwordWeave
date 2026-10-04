// Verify every migrated public object before removing catalog files from deployment.
// Usage: node scripts/verify-public-art.mjs [https://swordweave-public-art.ionmariusc97.workers.dev]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const origin = new URL(process.argv[2] ?? process.env.SW_PUBLIC_ART_ORIGIN ?? "https://swordweave-public-art.ionmariusc97.workers.dev");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/") {
  throw new Error("Expected an HTTPS asset origin");
}
const { assets } = JSON.parse(readFileSync(new URL("../data/public-art-catalog.json", import.meta.url), "utf8"));
let next = 0, verified = 0;
const failures = [];
async function worker() {
  while (next < assets.length) {
    const asset = assets[next++];
    try {
      const response = await fetch(new URL(asset.key, origin), { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
        throw new Error("Uploaded bytes differ from the source archive");
      }
      const expectedType = asset.key.endsWith(".webp") ? "image/webp" : "image/png";
      if (!response.headers.get("content-type")?.startsWith(expectedType)) throw new Error("Incorrect image content type");
      verified++;
    } catch (error) { failures.push({ key: asset.key, error: error.message }); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(JSON.stringify({ origin: origin.origin, total: assets.length, verified, failures }, null, 2));
if (failures.length) process.exitCode = 1;
