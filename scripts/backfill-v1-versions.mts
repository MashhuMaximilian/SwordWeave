/**
 * Backfill v1 version snapshots for public entities that have none.
 *
 * Reuses the EXACT canonical payload builders + recordVersion() that the
 * publish/save flow uses, so the backfilled v1 is byte-identical to what a
 * real save would have produced. recordVersion() is content-addressed and
 * idempotent — re-running this script is a safe no-op for already-snapshotted
 * rows.
 *
 * Scope: PUBLIC primitives / templates / items with no existing version row.
 * publishedByUserId is left null (system snapshot) — these are seeded/public
 * canon content, not authored by a single user.
 *
 * Dry-run by default. Pass DRY_RUN=false to actually write.
 */
import { db } from "@/db/client";
import { eq, and, isNull } from "drizzle-orm";
import { primitives as primitivesTbl } from "@/db/schema/engine";
import { templates as templatesTbl, templatePrimitives, templateCapabilities } from "@/db/schema/characters";
import { items as itemsTbl, itemPrimitives, itemCapabilities, itemEffects } from "@/db/schema/items";
import { recordVersion, findLatestVersion } from "@/lib/versions/auto-snapshot";
import {
  buildCanonicalPrimitivePayload,
  buildCanonicalTemplatePayload,
  buildCanonicalItemPayload,
  computePrimitiveContentHash,
  computeTemplateContentHash,
  computeItemContentHash,
} from "@/lib/publishing/hash-content";

const DRY_RUN = process.env.DRY_RUN !== "false";

async function backfillPrimitives() {
  const rows = await db
    .select()
    .from(primitivesTbl)
    .where(eq(primitivesTbl.isPublic, true));
  let done = 0;
  let skipped = 0;
  for (const r of rows) {
    if (await findLatestVersion("primitive", r.id)) { skipped++; continue; }
    const payload = buildCanonicalPrimitivePayload({
      name: r.name,
      category: r.category,
      costTier: r.costTier,
      buCost: r.buCost,
      mechanicalOutputText: r.mechanicalOutputText,
      narrativeRule: r.narrativeRule,
      isPublic: r.isPublic,
      isMirrorable: r.isMirrorable,
      mirrorVector: r.mirrorVector,
      mirrorBuCredit: r.mirrorBuCredit,
      mirrorEligibilityNotes: r.mirrorEligibilityNotes,
      hardModifiers: r.hardModifiers ?? [],
      iconSource: r.iconSource,
      iconKey: r.iconKey,
      iconUrl: r.iconUrl,
      iconColor: r.iconColor,
    });
    const hash = await computePrimitiveContentHash({
      name: r.name,
      category: r.category,
      costTier: r.costTier,
      buCost: r.buCost,
      mechanicalOutputText: r.mechanicalOutputText,
      narrativeRule: r.narrativeRule,
      isPublic: r.isPublic,
      isMirrorable: r.isMirrorable,
      mirrorVector: r.mirrorVector,
      mirrorBuCredit: r.mirrorBuCredit,
      mirrorEligibilityNotes: r.mirrorEligibilityNotes,
      hardModifiers: r.hardModifiers ?? [],
      iconSource: r.iconSource,
      iconKey: r.iconKey,
      iconUrl: r.iconUrl,
      iconColor: r.iconColor,
    });
    if (DRY_RUN) { console.log(`[DRY] primitive ${r.id} ${r.name}`); done++; continue; }
    await recordVersion({ entityKind: "primitive", entityId: r.id, contentHash: hash, snapshot: payload as unknown as Record<string, unknown>, publishedByUserId: null });
    done++;
  }
  console.log(`PRIMITIVE: backfilled ${done}, skipped ${skipped}`);
}

async function backfillTemplates() {
  const rows = await db
    .select()
    .from(templatesTbl)
    .where(eq(templatesTbl.isPublic, true));
  let done = 0;
  let skipped = 0;
  for (const r of rows) {
    if (await findLatestVersion("template", r.id)) { skipped++; continue; }
    const primSlots = await db
      .select({ primitiveId: templatePrimitives.primitiveId, isMirrored: templatePrimitives.isMirrored })
      .from(templatePrimitives)
      .where(eq(templatePrimitives.templateId, r.id));
    const capRows = await db
      .select({ capabilityId: templateCapabilities.capabilityId })
      .from(templateCapabilities)
      .where(eq(templateCapabilities.templateId, r.id));
    const payload = buildCanonicalTemplatePayload({
      kind: r.kind,
      name: r.name,
      description: r.description ?? "",
      suggestedTraits: r.suggestedTraits ?? "",
      isPublic: r.isPublic,
      primitiveSlots: primSlots,
      capabilityIds: capRows.map((c) => c.capabilityId),
      iconSource: r.iconSource,
      iconKey: r.iconKey,
      iconUrl: r.iconUrl,
      iconColor: r.iconColor,
    });
    const hash = await computeTemplateContentHash({
      kind: r.kind,
      name: r.name,
      description: r.description ?? "",
      suggestedTraits: r.suggestedTraits ?? "",
      isPublic: r.isPublic,
      primitiveSlots: primSlots,
      capabilityIds: capRows.map((c) => c.capabilityId),
      iconSource: r.iconSource,
      iconKey: r.iconKey,
      iconUrl: r.iconUrl,
      iconColor: r.iconColor,
    });
    if (DRY_RUN) { console.log(`[DRY] template ${r.id} ${r.name} (${r.kind})`); done++; continue; }
    await recordVersion({ entityKind: "template", entityId: r.id, contentHash: hash, snapshot: payload as unknown as Record<string, unknown>, publishedByUserId: null });
    done++;
  }
  console.log(`TEMPLATE: backfilled ${done}, skipped ${skipped}`);
}

async function backfillItems() {
  const rows = await db
    .select()
    .from(itemsTbl)
    .where(eq(itemsTbl.isPublic, true));
  let done = 0;
  let skipped = 0;
  for (const r of rows) {
    if (await findLatestVersion("item", r.id)) { skipped++; continue; }
    const primSlots = await db
      .select({ primitiveId: itemPrimitives.primitiveId, isMirrored: itemPrimitives.isMirrored })
      .from(itemPrimitives)
      .where(eq(itemPrimitives.itemId, r.id));
    const capRows = await db
      .select({ capabilityId: itemCapabilities.capabilityId })
      .from(itemCapabilities)
      .where(eq(itemCapabilities.itemId, r.id));
    const effRows = await db
      .select({ effectId: itemEffects.effectId })
      .from(itemEffects)
      .where(eq(itemEffects.itemId, r.id));
    const payload = buildCanonicalItemPayload({
      name: r.name,
      itemType: r.itemType,
      rarity: r.rarity,
      buCost: r.buCost,
      description: r.description ?? "",
      slotCost: r.slotCost,
      quantity: r.quantity,
      isTwoHanded: r.isTwoHanded,
      isConsumable: r.isConsumable,
      actsAsFocus: r.actsAsFocus,
      isPublic: r.isPublic,
      tags: r.tags ?? [],
      primitiveSlots: primSlots,
      capabilityIds: capRows.map((c) => c.capabilityId),
      effectIds: effRows.map((e) => e.effectId),
      iconSource: r.iconSource,
      iconKey: r.iconKey,
      iconUrl: r.iconUrl,
      iconColor: r.iconColor,
    });
    const hash = await computeItemContentHash({
      name: r.name,
      itemType: r.itemType,
      rarity: r.rarity,
      buCost: r.buCost,
      description: r.description ?? "",
      slotCost: r.slotCost,
      quantity: r.quantity,
      isTwoHanded: r.isTwoHanded,
      isConsumable: r.isConsumable,
      actsAsFocus: r.actsAsFocus,
      isPublic: r.isPublic,
      tags: r.tags ?? [],
      primitiveSlots: primSlots,
      capabilityIds: capRows.map((c) => c.capabilityId),
      effectIds: effRows.map((e) => e.effectId),
      iconSource: r.iconSource,
      iconKey: r.iconKey,
      iconUrl: r.iconUrl,
      iconColor: r.iconColor,
    });
    if (DRY_RUN) { console.log(`[DRY] item ${r.id} ${r.name}`); done++; continue; }
    await recordVersion({ entityKind: "item", entityId: r.id, contentHash: hash, snapshot: payload as unknown as Record<string, unknown>, publishedByUserId: null });
    done++;
  }
  console.log(`ITEM: backfilled ${done}, skipped ${skipped}`);
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (no writes) ===" : "=== WRITING ===");
  await backfillPrimitives();
  await backfillTemplates();
  await backfillItems();
  console.log("Done.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
