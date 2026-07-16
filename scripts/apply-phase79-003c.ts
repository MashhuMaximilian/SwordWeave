/**
 * Phase 7.9.3c — Migration: 11 time/space modifiers.
 *
 *   KINETIC_CONTROL (4) — displacement/lock primitives
 *   TEMPORAL_CHRONOLOGICAL (7) — delay/duration/stasis primitives
 *
 * Pattern: 1 `add character.movement.land -15` (the only persistent
 * slot here) + 10 `grant behavior:*` flags. Most of these primitives
 * describe one-shot engine effects (push, pull, lock, stasis) that
 * the modifier model captures via a "capability available" flag.
 * The engine reads the flag and applies the one-shot at cast time.
 *
 * All 11 use non-`set` ops, so all 11 are mirrorable.
 *
 * Idempotent: re-running produces zero changes.
 *
 * Run: pnpm exec tsx scripts/apply-phase79-003c.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "@/db/client";
import { primitives } from "@/db/schema/engine";
import { primitiveVersions } from "@/db/schema/versions";
import { eq, and, desc } from "drizzle-orm";
import {
  buildCanonicalPrimitivePayload,
  hashPrimitiveContent,
} from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import type { HardModifier } from "@/types/swordweave";

// =============================================================================
// The 11 proposed primitives.
// =============================================================================

type ProposedModifier = Omit<HardModifier, "condition"> & {
  readonly forkHint: string;
};

const PROPOSED: ReadonlyArray<{
  id: number;
  modifier: ProposedModifier;
}> = [
  // ---- KINETIC_CONTROL (4) ----
  {
    id: 175, // Minor Linear Displacement
    modifier: {
      kind: "modify",
      target: "character.movement.land",
      operation: "add",
      value: -15,
      stacking: "stack",
      forkHint:
        "Adds -15ft to land movement speed (persistent slow). The 10ft displacement is a one-shot engine effect applied at cast time and is not modeled as a modifier — the engine's knockback handler reads this primitive's flag and applies the push. Mirror: add +15 (Sprint — gain 15ft speed, the canonical Vulnerability Inverse). Fork to attach to a specific target via a Capability.",
    },
  },
  {
    id: 176, // Velocity Arrest / Standard Vector
    modifier: {
      kind: "modify",
      target: "behavior:velocity_lock",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine flag marks this as 'able to apply a velocity lock' — at cast time, sets the target's movement speed to 0. The 20ft displacement is a one-shot engine effect. Mirror: revoke (no velocity lock capability).",
    },
  },
  {
    id: 177, // Advanced Vector Manipulation
    modifier: {
      kind: "modify",
      target: "behavior:kinetic_lock_absolute",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex kinetic lock — entity can enforce absolute kinetic lock on a target (no movement from any vector). The 40ft complex displacement is a one-shot engine effect (mid-travel trajectory shifts). Mirror: revoke (apex lock capability removed).",
    },
  },
  {
    id: 178, // Systemic Kinetic Override
    modifier: {
      kind: "modify",
      target: "behavior:kinetic_override_capable",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex kinetic control — entity can draw all targets within an area to a single focal point, or completely invert incoming physical momentum. Both are one-shot engine effects at cast time. Mirror: revoke (apex kinetic control removed).",
    },
  },
  // ---- TEMPORAL_CHRONOLOGICAL (7) ----
  {
    id: 207, // Chronological Echo
    modifier: {
      kind: "modify",
      target: "behavior:delayed_resolution",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine flag marks this capability as 'delayed resolution' — the cast executes normally but its physical entry into reality is suspended, bursting forth at the start of a designated future Council Phase. SEED — fork to specify the delay amount (up to 2 rounds) via a Capability. Mirror: revoke (no delay capability).",
    },
  },
  {
    id: 208, // Dormant Trigger Hook
    modifier: {
      kind: "modify",
      target: "behavior:capability_dormant",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine flag converts an instant capability into a dormant mine — the capability is planted at a spatial coordinate and stays hidden until an environmental catalyst triggers its release. SEED — fork to specify the wakeup event in a Capability. Mirror: revoke (no dormant conversion).",
    },
  },
  {
    id: 209, // Timeline Tether
    modifier: {
      kind: "modify",
      target: "behavior:chronological_immunity",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants immunity to forced chronological delays, slows, or pushes to a future round. The holder's declared intent can never be forcibly deferred by enemy chronomancy. Mirror: revoke (vulnerable to chronological delays).",
    },
  },
  {
    id: 210, // Duration Anchor
    modifier: {
      kind: "modify",
      target: "behavior:duration_freeze",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine flag freezes the duration countdown of a decaying zone, barrier, or transformation for 2 rounds. SEED — fork to specify the target capability. Mirror: revoke (no duration freeze capability).",
    },
  },
  {
    id: 211, // Perpetual Lock
    modifier: {
      kind: "modify",
      target: "behavior:duration_persistent",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine flag converts a Scene duration into a Persistent effect — the capability no longer expires when the combat round loop terminates. Mirror: revoke (no perpetual conversion, Scene durations still expire).",
    },
  },
  {
    id: 212, // Kinetic Stasis
    modifier: {
      kind: "modify",
      target: "behavior:kinetic_stasis_object",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine flag marks this as 'able to apply kinetic stasis to inanimate objects' — catches an item or projectile mid-flight, locking all kinetic energy in place until dismissed. Mirror: revoke (no object stasis capability).",
    },
  },
  {
    id: 213, // Temporal Isolate
    modifier: {
      kind: "modify",
      target: "behavior:temporal_stasis_entity",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex stasis. The engine flag marks this as 'able to lock a target entity in absolute timeline stasis for 1 round' — the target cannot act, move, or think, but is also completely immune to damage until stasis shatters. Mirror: revoke (no entity stasis capability).",
    },
  },
];

// =============================================================================
// Helpers (shared with previous migrations)
// =============================================================================

function derivedMirrorable(op: string): boolean {
  return op !== "set";
}

function appendForkHint(existingNarrative: string, hint: string): string {
  if (existingNarrative.includes(hint.slice(0, 30))) {
    return existingNarrative;
  }
  const divider = "\n\n---\n\n**Fork guidance:** ";
  return existingNarrative + divider + hint;
}

function modifiersMatch(
  a: readonly HardModifier[] | unknown,
  b: HardModifier,
): boolean {
  if (!Array.isArray(a) || a.length !== 1) return false;
  const m = a[0] as HardModifier;
  return (
    m.kind === b.kind &&
    m.target === b.target &&
    m.operation === b.operation &&
    JSON.stringify(m.value) === JSON.stringify(b.value) &&
    (m.stacking ?? "stack") === (b.stacking ?? "stack")
  );
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(72));
  console.log("Phase 7.9.3c — Migration: 11 time/space modifiers");
  console.log("=".repeat(72));
  console.log(`Proposed: ${PROPOSED.length} rows\n`);

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const { id, modifier } of PROPOSED) {
    const [row] = await db
      .select()
      .from(primitives)
      .where(eq(primitives.id, id))
      .limit(1);

    if (!row) {
      console.error(`  [${id}] NOT FOUND in DB`);
      failed++;
      continue;
    }

    const currentMods = row.hardModifiers ?? [];
    const currentHasMod = currentMods.length > 0;
    const currentIsMirrorable = row.isMirrorable;
    const derived = derivedMirrorable(modifier.operation);

    const modAlready = currentHasMod && modifiersMatch(currentMods, modifier);
    const flagAlready = currentIsMirrorable === derived;
    const forkHintInNarrative = row.narrativeRule?.includes(
      modifier.forkHint.slice(0, 30),
    );
    if (modAlready && flagAlready && forkHintInNarrative) {
      console.log(`  [${id}] ${row.name} — already applied, skip`);
      skipped++;
      continue;
    }

    const newNarrative = appendForkHint(
      row.narrativeRule ?? "",
      modifier.forkHint,
    );
    const newHardModifiers: HardModifier[] = [modifier];
    const newIsMirrorable = derived;
    const newMirrorVector = derived ? "VARIABLE_VECTOR" : "STANDARD_ONLY";
    const newMirrorBuCredit = derived ? row.buCost : 0;

    const payload = buildCanonicalPrimitivePayload({
      name: row.name,
      category: row.category,
      costTier: row.costTier,
      buCost: row.buCost,
      mechanicalOutputText: row.mechanicalOutputText,
      narrativeRule: newNarrative,
      isPublic: row.isPublic,
      isMirrorable: newIsMirrorable,
      mirrorVector: newMirrorVector,
      mirrorBuCredit: newMirrorBuCredit,
      mirrorEligibilityNotes: row.mirrorEligibilityNotes ?? "",
      hardModifiers: newHardModifiers,
      iconSource: row.iconSource,
      iconKey: row.iconKey,
      iconUrl: row.iconUrl,
      iconColor: row.iconColor ?? "#ffffff",
    });
    const newHash = await hashPrimitiveContent(payload);

    await db
      .update(primitiveVersions)
      .set({ isLatest: false })
      .where(
        and(
          eq(primitiveVersions.primitiveId, id),
          eq(primitiveVersions.isLatest, true),
        ),
      );

    const lastVersion = await db
      .select({ v: primitiveVersions.versionNumber })
      .from(primitiveVersions)
      .where(eq(primitiveVersions.primitiveId, id))
      .orderBy(desc(primitiveVersions.versionNumber))
      .limit(1);
    const nextVersionNumber = (lastVersion[0]?.v ?? 0) + 1;

    const newVersionId = resolveContentVersionId("primitive", id, newHash);
    const snapshot = {
      id,
      sourceOrigin: row.sourceOrigin,
      data: {
        name: row.name,
        category: row.category,
        costTier: row.costTier,
        buCost: row.buCost,
        mechanicalOutputText: row.mechanicalOutputText,
        narrativeRule: newNarrative,
        isPublic: row.isPublic,
        isMirrorable: newIsMirrorable,
        mirrorVector: newMirrorVector,
        mirrorBuCredit: newMirrorBuCredit,
        mirrorEligibilityNotes: row.mirrorEligibilityNotes ?? "",
        hardModifiers: newHardModifiers,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor ?? "#ffffff",
      },
    };

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(primitives)
          .set({
            hardModifiers: newHardModifiers,
            isMirrorable: newIsMirrorable,
            mirrorVector: newMirrorVector,
            mirrorBuCredit: newMirrorBuCredit,
            narrativeRule: newNarrative,
            contentHash: newHash,
            updatedAt: new Date(),
          })
          .where(eq(primitives.id, id));

        await tx.insert(primitiveVersions).values({
          id: newVersionId,
          primitiveId: id,
          versionNumber: nextVersionNumber,
          isLatest: true,
          deltaKind: "FULL",
          snapshot,
          publishedByUserId: null,
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const mirrorNote = newIsMirrorable
        ? `is_mirrorable=true (op=${modifier.operation})`
        : `is_mirrorable=false (op=${modifier.operation})`;
      console.log(
        `  [${id}] modifier added — ${row.name} (v${nextVersionNumber}, ${mirrorNote})`,
      );
      applied++;
    } catch (e) {
      console.error(`  [${id}] FAILED:`, e);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Done. applied=${applied} skipped=${skipped} failed=${failed}`);
  console.log("=".repeat(72));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
