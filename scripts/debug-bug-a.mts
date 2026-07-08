import { db } from "../src/db/client";
import { effects, effectPrimitives } from "../src/db/schema/engine";
import { eq, asc } from "drizzle-orm";
import { buildCanonicalEffectPayload, computeEffectContentHash, isEffectDraftEmpty } from "../src/lib/publishing/hash-content";
import { dispatchEntitySave, loadEntityOwner } from "../src/lib/publishing/dispatch-save";

// Get the current state of the source row.
const source = await db.query.effects.findFirst({
  where: eq(effects.id, "8b27f420-b541-495d-92fe-872cc5127c9b"),
  with: { primitiveLinks: { orderBy: asc(effectPrimitives.sortOrder) } },
});

console.log("Source row from DB:");
console.log("  contentHash:", source?.contentHash);
console.log("  primitiveLinks:", source?.primitiveLinks.map(l => ({
  primitiveId: l.primitiveId, quantity: l.quantity, notes: l.notes
})));

// Re-compute what the backfill would have written.
const links = source!.primitiveLinks.map(l => ({
  primitiveId: l.primitiveId, quantity: l.quantity, notes: l.notes ?? "",
}));
const backfillPayload = buildCanonicalEffectPayload({
  name: source!.name,
  narrativeDescription: source!.narrativeDescription,
  tags: source!.tags,
  isPublic: source!.isPublic,
  primitiveSlots: links,
});
const backfillHash = await computeEffectContentHash({
  name: source!.name,
  narrativeDescription: source!.narrativeDescription,
  tags: source!.tags,
  isPublic: source!.isPublic,
  primitiveSlots: links,
});
console.log("\nBackfill would have written:");
console.log("  hash:", backfillHash);
console.log("  source.contentHash === backfill hash:", source?.contentHash === backfillHash);

// Now simulate what the form would send.
// The form's isPublic comes from the VisibilitySelect: it sends `isPublic: false`
// for PRIVATE/FOLLOWERS_ONLY, and `isPublic: true` for PUBLIC.
// But the user might have set the visibility dropdown to PRIVATE in the form.
// Let me check if the form's isPublic is sent as true or false.
console.log("\nForm sent isPublic: true. Source isPublic:", source?.isPublic);

// Let's test with the form's exact payload.
const formPayload = buildCanonicalEffectPayload({
  name: source!.name,
  narrativeDescription: source!.narrativeDescription,
  tags: source!.tags,
  isPublic: true, // form's value
  primitiveSlots: links,
});
const formHash = await computeEffectContentHash({
  name: source!.name,
  narrativeDescription: source!.narrativeDescription,
  tags: source!.tags,
  isPublic: true,
  primitiveSlots: links,
});
console.log("\nForm payload hash:", formHash);
console.log("Form hash == backfill hash:", formHash === backfillHash);
console.log("Form hash == source.contentHash:", formHash === source?.contentHash);
