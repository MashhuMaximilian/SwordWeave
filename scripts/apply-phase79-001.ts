/**
 * Phase 7.9.4 — Migration: apply 13 mirrorable modifiers + 2 chirality fixes.
 *
 *   - 13 mirrorable NEEDS_MOD rows: get a 1-modifier definition with
 *     a non-`set` op (mirrorability auto-derived from op per OP_SPECS).
 *   - 2 DONE rows (Vector Split, Minor Die Block): chirality drift fix.
 *     Op is already `add` (mirrorable) but stored `is_mirrorable=false`.
 *     Set stored flag to true to match derived.
 *   - 15 rows: append a fork-disclaimer to `narrative_rule` so the
 *     author sees "This is a seed. Fork to specify X" guidance.
 *   - 15 rows: recompute `content_hash` (uses buildCanonicalPrimitivePayload
 *     + hashPrimitiveContent from src/lib/publishing/hash-content.ts).
 *   - 15 rows: demote existing `primitive_versions.is_latest=true` to
 *     false, INSERT a new FULL snapshot row with `is_latest=true`.
 *
 * Idempotent: if the row's `hard_modifiers` already matches the proposed
 * modifier (and `is_mirrorable` matches), skip. Run as many times as you
 * want, the result is the same.
 *
 * Run: pnpm exec tsx scripts/apply-phase79-001.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "@/db/client";
import { primitives } from "@/db/schema/engine";
import { primitiveVersions } from "@/db/schema/versions";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  buildCanonicalPrimitivePayload,
  hashPrimitiveContent,
} from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import type { HardModifier } from "@/types/swordweave";
import { OP_SPECS } from "@/types/modifier";

// =============================================================================
// The 15 proposed primitives — IDs, target, op, value, fork guidance.
// Each primitive gets at most 1 modifier (DB CHECK constraint).
// =============================================================================

type ModifierSpec = Omit<HardModifier, "condition"> & {
  /** Fork guidance appended to narrative_rule. */
  readonly forkHint: string;
};

const PROPOSED: ReadonlyArray<{
  id: number;
  modifier: ModifierSpec;
}> = [
  // ---- 13 mirrorable carryover ----
  {
    id: 61, // Vitality Core Augment I
    modifier: {
      kind: "modify",
      target: "max_vitality",
      operation: "add",
      value: 5,
      stacking: "stack",
      forkHint:
        "This is a seed for +5 Max Vitality. Fork it for +5/+10/+15/etc. magnitudes, or to gate the increase behind a condition.",
    },
  },
  {
    id: 62, // Vitality Core Augment II
    modifier: {
      kind: "modify",
      target: "max_vitality",
      operation: "add",
      value: 12,
      stacking: "stack",
      forkHint:
        "This is a seed for +12 Max Vitality (mid-tier). Fork it for other magnitudes, or to gate behind a condition.",
    },
  },
  {
    id: 63, // Vitality Core Augment III
    modifier: {
      kind: "modify",
      target: "max_vitality",
      operation: "add",
      value: 20,
      stacking: "stack",
      forkHint:
        "This is a seed for +20 Max Vitality (peak). Fork it for other magnitudes, or to gate behind a condition.",
    },
  },
  {
    id: 53, // Attribute Increment
    modifier: {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "This is a SEED. Fork it to specify which attribute: '+1 to Physical', '+1 to Mental', '+1 to Magic-Abstract'. The base seed is engine-agnostic and requires a fork to be usable at runtime.",
    },
  },
  {
    id: 54, // Attack Bonus Increment
    modifier: {
      kind: "modify",
      target: "action_roll.attack_bonus",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "This is a SEED for +1 to all attack rolls. Fork it to scope to a specific source: '+1 to melee attacks', '+1 to ranged attacks', or to gate behind a condition (e.g. only against a particular target type).",
    },
  },
  {
    id: 382, // Kinetic Hardening (DEFENSIVE)
    modifier: {
      kind: "modify",
      target: "defense_dc.physical",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Stacks. Fork to scope (e.g. only against bludgeoning, only against a specific weapon type) or to gate behind a condition.",
    },
  },
  {
    id: 383, // Warding Shell (DEFENSIVE)
    modifier: {
      kind: "modify",
      target: "defense_dc.magical",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Stacks. Fork to scope (e.g. only against fire domain, only against a specific spell school) or to gate behind a condition.",
    },
  },
  {
    id: 384, // Psychic Firewall (DEFENSIVE)
    modifier: {
      kind: "modify",
      target: "defense_dc.mental",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Stacks. Fork to scope (e.g. only against fear effects, only against memory manipulation) or to gate behind a condition.",
    },
  },
  {
    id: 201, // Vitality Shielding (EVALUATION_STRAIN)
    modifier: {
      kind: "modify",
      target: "behavior:vitality_shielding",
      operation: "grant",
      value: 1, // grant takes a number value (per OP_VALUE_TYPE_MATRIX) — value is ignored at runtime, the behavior flag is what matters
      stacking: "unique-by-primitive",
      forkHint:
        "This is a SEED that grants the 'vitality_shielding' behavior flag. The engine checks for this flag at strain-resolution time and halves any upfront Vitality cost. Fork to add conditions (e.g. 'only when current_vitality < 50%') or to grant different magnitudes of shielding.",
    },
  },
  {
    id: 218, // Stride Extension (MOBILITY_LOCOMOTION)
    modifier: {
      kind: "modify",
      target: "speed.walk",
      operation: "add",
      value: 10,
      stacking: "stack",
      forkHint:
        "Stacks infinitely unless restricted. Fork to scope to a different speed (burrow, climb, fly, swim) or to gate behind a condition (e.g. 'only while unarmored').",
    },
  },
  {
    id: 161, // Negative Bias I — Narrative Focus
    modifier: {
      kind: "modify",
      target: "behavior:disadvantage",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
      forkHint:
        "This is a SEED. The base grants the 'disadvantage' behavior with scope=NARRATIVE_FOCUS. Fork to specify the focus (e.g. 'Awareness via scent only', 'Stealth in rain only'). The scope is encoded in the condition; the seed's condition is empty for general use.",
    },
  },
  {
    id: 163, // Negative Bias II — Named Practice
    modifier: {
      kind: "modify",
      target: "behavior:disadvantage",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
      forkHint:
        "This is a SEED. The base grants the 'disadvantage' behavior with scope=NAMED_PRACTICE. Fork to specify the practice (e.g. 'Negative Bias on Awareness', 'Negative Bias on Reason'). The scope is encoded in the condition.",
    },
  },
  {
    id: 165, // Negative Bias III — Core Attribute
    modifier: {
      kind: "modify",
      target: "behavior:disadvantage",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
      forkHint:
        "This is a SEED. The base grants the 'disadvantage' behavior with scope=CORE_ATTRIBUTE. Fork to specify the attribute (e.g. 'Negative Bias on all Mental checks', 'Negative Bias on all Physical checks'). The scope is encoded in the condition.",
    },
  },
  // ---- 2 DONE chirality fixes ----
  // These rows already have an `add` modifier. We DON'T replace the
  // modifier — we just flip the stored `is_mirrorable` to true and
  // append a fork hint. The hash will recompute to reflect the flag
  // change.
  {
    id: 18, // Vector Split (TARGETING, 4 BU)
    modifier: {
      kind: "modify",
      target: "action.targetCount",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Stacks. Fork to scope (e.g. only on a specific target type) or to gate behind a condition.",
    },
  },
  {
    id: 19, // Minor Die Block (INTENSITY_DICE, 1 BU)
    modifier: {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: "1d4",
      stacking: "stack",
      forkHint:
        "Stacks. Fork to scope to a specific damage type (fire, cold, etc.) or to gate behind a condition.",
    },
  },
];

// =============================================================================
// Helpers
// =============================================================================

function derivedMirrorable(op: string): boolean {
  return op !== "set";
}

function appendForkHint(existingNarrative: string, hint: string): string {
  if (existingNarrative.includes(hint.slice(0, 30))) {
    // Already has a similar hint — don't double up.
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
  console.log("Phase 7.9.4 — Migration: 13 mirrorable + 2 chirality fix");
  console.log("=".repeat(72));
  console.log(`Proposed: ${PROPOSED.length} rows\n`);

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const { id, modifier } of PROPOSED) {
    // 1. Read current row.
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

    // 2. Skip check: modifier already matches + is_mirrorable matches +
    //    narrative already has the fork hint.
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

    // 3. Compute new values.
    const newNarrative = appendForkHint(
      row.narrativeRule ?? "",
      modifier.forkHint,
    );
    // For DONE rows (18, 19): preserve their existing modifier. For
    // NEEDS_MOD rows: replace with the proposed modifier.
    const newHardModifiers: HardModifier[] = currentHasMod
      ? [currentMods[0] as HardModifier]
      : [modifier];
    const newIsMirrorable = derived;
    const newMirrorVector = derived ? "VARIABLE_VECTOR" : "STANDARD_ONLY";
    const newMirrorBuCredit = derived ? row.buCost : 0;

    // 4. Recompute content hash.
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

    // 5. Demote existing is_latest version, insert new FULL snapshot.
    await db
      .update(primitiveVersions)
      .set({ isLatest: false })
      .where(
        and(
          eq(primitiveVersions.primitiveId, id),
          eq(primitiveVersions.isLatest, true),
        ),
      );

    // Compute the next version number (max + 1 for this primitive).
    const lastVersion = await db
      .select({ v: primitiveVersions.versionNumber })
      .from(primitiveVersions)
      .where(eq(primitiveVersions.primitiveId, id))
      .orderBy(desc(primitiveVersions.versionNumber))
      .limit(1);
    const nextVersionNumber = (lastVersion[0]?.v ?? 0) + 1;

    const newVersionId = resolveContentVersionId(
      "primitive",
      id,
      newHash,
    );
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

    // 6. Apply all changes in a transaction.
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

      const opDesc = currentHasMod ? "chirality fix" : "modifier added";
      const mirrorNote = newIsMirrorable
        ? `is_mirrorable=true (op=${modifier.operation})`
        : `is_mirrorable=false (op=${modifier.operation})`;
      console.log(
        `  [${id}] ${opDesc} — ${row.name} (v${nextVersionNumber}, ${mirrorNote})`,
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
