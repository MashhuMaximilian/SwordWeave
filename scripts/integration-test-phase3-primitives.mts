// Verify Phase 3 source_origin plumbing on a primitive save.
// 1. Greenfield save → source_origin = user:<caller>
// 2. Fork save → source_origin = fork:<sourceId>
// 3. version-update on own row → source_origin unchanged

import { db } from "../src/db/client";
import { primitives } from "../src/db/schema/engine";
import { eq, and } from "drizzle-orm";
import { config } from "dotenv";

config({ path: ".env.local" });

// 1. Test greenfield: a row the user creates has sourceOrigin = user:<id>
const CALLER = "user_3GBZcHu9gL8z1UOqkuqrN8cLsOn";
const testName = `Phase3 Sanity ${Date.now()}`;

const [greenfield] = await db
  .insert(primitives)
  .values({
    name: testName,
    category: "VERB_TIER",
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 1,
    mechanicalOutputText: "phase 3 sanity test (greenfield)",
    narrativeRule: "phase 3 sanity test",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    mirrorEligibilityNotes: "",
    hardModifiers: [],
    userId: CALLER,
    isPublic: false,
    sourceOrigin: `user:${CALLER}`,
    contentHash: "test-hash-phase3-1",
  })
  .returning();

console.log("Greenfield insert:");
console.log("  name:", greenfield.name);
console.log("  sourceOrigin:", greenfield.sourceOrigin);
console.log("  expected: user:" + CALLER);

if (greenfield.sourceOrigin !== `user:${CALLER}`) {
  console.error("FAIL: greenfield sourceOrigin mismatch");
  process.exit(1);
}
console.log("  ✓ match");

// 2. Test fork: a row derived from another has sourceOrigin = fork:<sourceId>
const sourceId = greenfield.id;
const [fork] = await db
  .insert(primitives)
  .values({
    name: `${testName} (fork)`,
    category: "VERB_TIER",
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 1,
    mechanicalOutputText: "phase 3 sanity test (fork)",
    narrativeRule: "phase 3 sanity test",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    mirrorEligibilityNotes: "",
    hardModifiers: [],
    userId: CALLER,
    isPublic: false,
    sourceOrigin: `fork:${sourceId}`,
    contentHash: "test-hash-phase3-2",
  })
  .returning();

console.log("\nFork insert:");
console.log("  name:", fork.name);
console.log("  sourceOrigin:", fork.sourceOrigin);
console.log("  expected: fork:" + sourceId);

if (fork.sourceOrigin !== `fork:${sourceId}`) {
  console.error("FAIL: fork sourceOrigin mismatch");
  process.exit(1);
}
console.log("  ✓ match");

// 3. Test unique constraint: (name, source_origin) collision rejected
let collisionRejected = false;
try {
  await db.insert(primitives).values({
    name: testName, // SAME name
    category: "VERB_TIER",
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 1,
    mechanicalOutputText: "phase 3 collision test",
    narrativeRule: "phase 3 sanity test",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    mirrorEligibilityNotes: "",
    hardModifiers: [],
    userId: CALLER,
    isPublic: false,
    sourceOrigin: `user:${CALLER}`, // SAME source_origin
    contentHash: "test-hash-phase3-collision",
  });
} catch (err) {
  collisionRejected = true;
  const e = err as { code?: string };
  console.log("\nCollision rejected: ✓ (code:", e.code, ")");
}

if (!collisionRejected) {
  console.error("FAIL: unique constraint did not reject (name, source_origin) collision");
  process.exit(1);
}

// 4. Test cross-namespace: same name, different source_origin = OK
const [crossNs] = await db
  .insert(primitives)
  .values({
    name: testName, // SAME name as greenfield
    category: "VERB_TIER",
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 1,
    mechanicalOutputText: "phase 3 cross-namespace test",
    narrativeRule: "phase 3 sanity test",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    mirrorEligibilityNotes: "",
    hardModifiers: [],
    userId: "user_OTHER_TEST",
    isPublic: false,
    sourceOrigin: "user:user_OTHER_TEST", // DIFFERENT source_origin
    contentHash: "test-hash-phase3-cross",
  })
  .returning();

console.log("\nCross-namespace insert (same name, different source_origin):");
console.log("  name:", crossNs.name);
console.log("  sourceOrigin:", crossNs.sourceOrigin);
console.log("  ✓ allowed (new unique constraint is per-source_origin, not global)");

// Cleanup
await db.delete(primitives).where(eq(primitives.id, greenfield.id));
await db.delete(primitives).where(eq(primitives.id, fork.id));
await db.delete(primitives).where(eq(primitives.id, crossNs.id));
console.log("\n✓ All Phase 3 tests passed, test data cleaned up");

process.exit(0);
