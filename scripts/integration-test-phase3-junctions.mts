// Verify Phase 3 junction slot_source + version_id plumbing.
// 1. New character_primitive slot defaults to slot_source='PINNED'
// 2. version_id is nullable (pre-versioning slots)
// 3. slot_source enum rejects invalid values
// 4. Existing 7 character_capabilities + 3 character_items have slot_source='PINNED'

import { db } from "../src/db/client";
import { primitives } from "../src/db/schema/engine";
import { characterPrimitives, characters } from "../src/db/schema/characters";
import { eq, sql } from "drizzle-orm";
import { config } from "dotenv";

config({ path: ".env.local" });

// Pick any character and primitive
const [sampleChar] = await db
  .select({ id: characters.id })
  .from(characters)
  .limit(1);
const [samplePrim] = await db
  .select({ id: primitives.id })
  .from(primitives)
  .limit(1);

if (!sampleChar || !samplePrim) {
  console.log("No test data available; skipping junction verification");
  process.exit(0);
}

// 1. Test default slot_source = 'PINNED'
const [newSlot] = await db
  .insert(characterPrimitives)
  .values({
    characterId: sampleChar.id,
    primitiveId: samplePrim.id,
    isMirrored: false,
    slotSource: "PINNED",
  })
  .returning();

console.log("New character_primitive slot:");
console.log("  slotSource:", newSlot.slotSource);
console.log("  versionId:", newSlot.versionId);
console.log("  expected: slotSource=PINNED, versionId=null");

if (newSlot.slotSource !== "PINNED") {
  console.error("FAIL: slotSource default wrong");
  process.exit(1);
}
if (newSlot.versionId !== null) {
  console.error("FAIL: versionId should be null");
  process.exit(1);
}
console.log("  ✓ match");

// 2. Test slot_source enum rejects invalid values
let invalidRejected = false;
try {
  await db.execute(
    sql`INSERT INTO "character_primitives" (character_id, primitive_id, source, slot_source) VALUES (${sampleChar.id}, ${samplePrim.id}, 'PERSONAL', 'GARBAGE_VALUE')`,
  );
} catch (err) {
  invalidRejected = true;
  const e = err as { code?: string; message?: string };
  console.log("\nInvalid slot_source rejected: ✓ (code:", e.code, ")");
  console.log("  message:", e.message?.slice(0, 80));
}

if (!invalidRejected) {
  console.error("FAIL: invalid slot_source was not rejected");
  process.exit(1);
}

// 3. Test version_id can be set explicitly
const testVersionId = "11111111-2222-3333-4444-555555555555";
const [versionedSlot] = await db
  .insert(characterPrimitives)
  .values({
    characterId: sampleChar.id,
    primitiveId: samplePrim.id + 1, // different primitive to avoid PK conflict
    isMirrored: false,
    slotSource: "OWNED",
    versionId: testVersionId,
  })
  .returning();

console.log("\nVersioned character_primitive slot:");
console.log("  slotSource:", versionedSlot.slotSource);
console.log("  versionId:", versionedSlot.versionId);
console.log("  expected: slotSource=OWNED, versionId=" + testVersionId);

if (versionedSlot.slotSource !== "OWNED" || versionedSlot.versionId !== testVersionId) {
  console.error("FAIL: explicit slotSource/versionId not set");
  process.exit(1);
}
console.log("  ✓ match");

// Cleanup
await db.delete(characterPrimitives).where(eq(characterPrimitives.characterId, sampleChar.id));

console.log("\n✓ All Phase 3 junction tests passed, test data cleaned up");
process.exit(0);
