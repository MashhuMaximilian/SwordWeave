/** Dry run by default. Apply ONLY after deploying all assets; presentation-only update. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import { heritage } from "@/db/schema";
import { curatedLineageArt } from "@/lib/heritage/lineage-art";

const apply = process.argv.includes("--apply");
async function main() {
  const rows = await db.select().from(heritage);
  const plan = curatedLineageArt.map(art => {
    if (!existsSync(resolve(process.cwd(), "public" + art.imageUrl))) throw new Error(`Missing local asset ${art.imageUrl}`);
    const matching = rows.filter(row => row.kind === "LINEAGE" && row.name === art.name && (row.sourceOrigin === art.sourceOrigin || row.sourceOrigin === "SRD") && row.userId === null && row.isPublic);
    if (matching.length !== 1) throw new Error(`Expected one public curated identity: ${art.name}; found ${matching.length}`);
    return { ...art, row: matching[0]! };
  });
  const pending = plan.filter(x => !x.row.imageUrl?.trim());
  console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY RUN", verifiedIdentities: plan.length, pending: pending.map(x => ({id:x.row.id,name:x.name,imageUrl:x.imageUrl})), explicitImagesPreserved: plan.length - pending.length }, null, 2));
  if (!apply || !pending.length) return;
  // Check every asset before any write. Never point the live DB at undeployed files.
  for (const art of plan) {
    const url = `https://www.swordweave.quest${art.imageUrl}`;
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const header = new TextDecoder().decode(bytes.slice(0,12));
    if (!response.ok || !response.headers.get("content-type")?.includes("image/webp") || header.slice(0,4) !== "RIFF" || header.slice(8,12) !== "WEBP") throw new Error(`Deployment gate failed: ${url}`);
  }
  await withDatabaseTransaction(async () => {
    for (const entry of pending) await db.update(heritage).set({imageUrl:entry.imageUrl,updatedAt:new Date()}).where(and(eq(heritage.id,entry.row.id),eq(heritage.kind,"LINEAGE"),eq(heritage.name,entry.name),eq(heritage.sourceOrigin,entry.row.sourceOrigin!),isNull(heritage.userId),eq(heritage.isPublic,true),entry.row.imageUrl === null ? isNull(heritage.imageUrl) : eq(heritage.imageUrl,entry.row.imageUrl)));
  });
  console.log(`Attached ${pending.length} presentation images; hashes and version snapshots unchanged.`);
}
main().catch(error => { console.error(error); process.exitCode=1; }).finally(() => pool.end());
