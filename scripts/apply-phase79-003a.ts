/**
 * Phase 7.9.3a — Migration: 24 verb-like modifiers (batch 1 of 3).
 *
 *   ACTION_ECONOMY (11)
 *   BOSS_ECONOMY (5)
 *   TRIGGER_HOOK (4)
 *   SPEED_QUICKENING (4)
 *
 * Pattern: mostly `grant behavior:*` for engine flags, some `add` to
 * action-economy counter targets. All 24 use non-`set` ops, so all
 * 24 are mirrorable. Mirrors are mathematical inverses:
 *   - add +N → subtract N (Haste → Slow, Reaction → Reaction Liability)
 *   - grant behavior:flag → revoke (no flag)
 *
 * Idempotent: re-running produces zero changes.
 *
 * Run: pnpm exec tsx scripts/apply-phase79-003a.ts
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
// The 24 proposed primitives.
// =============================================================================

type ProposedModifier = Omit<HardModifier, "condition"> & {
  readonly forkHint: string;
};

const PROPOSED: ReadonlyArray<{
  id: number;
  modifier: ProposedModifier;
}> = [
  // ---- ACTION_ECONOMY (11) ----
  {
    id: 187, // Timeline Shift / Minor Window Grant
    modifier: {
      kind: "modify",
      target: "action.bonus_action_window",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Adds +1 bonus action window per round. Stacks with other bonus-action grants. Mirror: subtract 1 (Tactical Liability — you have one fewer bonus action than baseline). Fork to scope to a specific trigger (e.g. 'after killing a target').",
    },
  },
  {
    id: 188, // Reactive Expansion (Guardian Vector)
    modifier: {
      kind: "modify",
      target: "behavior:reactive_window_bonus",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants +1 reaction window per round, restricted to Trigger Hook use. Prereq: target entity has at least one Trigger Hook. Mirror: revoke (entity cannot use Trigger Hooks at all).",
    },
  },
  {
    id: 189, // Core Action Multiplication (Haste Vector)
    modifier: {
      kind: "modify",
      target: "action.standard_action_window",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Adds +1 standard action window per turn. Stacks. Mirror: subtract 1 (Slow — one fewer standard action per turn). Fork to add a condition like 'for 1 round' or 'while concentration holds'.",
    },
  },
  {
    id: 190, // Absolute Timeline Deprivation (Stun Vector)
    modifier: {
      kind: "modify",
      target: "action.standard_action_window",
      operation: "add",
      value: -1,
      stacking: "stack",
      forkHint:
        "Subtracts 1 standard action window from the target. For an entity with 1 standard action baseline, this fully suppresses action. SEED — fork with a higher magnitude to suppress more, or compose with Reactive Expansion's mirror (which is revoke) to also strip reactions. Mirror: add +1 (Haste — flips to a haste effect on the target, the canonical Vulnerability Inverse).",
    },
  },
  {
    id: 191, // Track Acceleration
    modifier: {
      kind: "modify",
      target: "behavior:track_acceleration",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine shifts one designated capability up 1 Track (e.g. Measured → Fast). SEED — fork to specify which capability (the modifier's condition is the scope). Mirror: revoke the engine flag (no track acceleration).",
    },
  },
  {
    id: 192, // Heavy Compactor
    modifier: {
      kind: "modify",
      target: "behavior:heavy_track_compress",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine compresses one designated Heavy Track capability to execute on Measured. SEED — fork to specify which capability. Mirror: revoke (Heavy capabilities take normal Heavy delay).",
    },
  },
  {
    id: 193, // Timeline Anchor
    modifier: {
      kind: "modify",
      target: "behavior:track_displacement_immunity",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants immunity to adverse Track Displacement (forced delays, slow effects, demotion). Mirror: revoke (vulnerable to track displacement).",
    },
  },
  {
    id: 194, // Reaction Pulse
    modifier: {
      kind: "modify",
      target: "action.reaction_window",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Adds +1 reaction window per round. Stacks. Mirror: subtract 1 (Reaction Liability — one fewer reaction per round).",
    },
  },
  {
    id: 195, // Reaction Reflex
    modifier: {
      kind: "modify",
      target: "action_roll.reaction_clash",
      operation: "add",
      value: 2,
      stacking: "stack",
      forkHint:
        "Adds +2 flat to all Reaction Clash rolls. Stacks with other additive bonuses. Mirror: subtract 2 (Reflex Denial — forces -2 on reaction clashes).",
    },
  },
  {
    id: 196, // Clash Dominance
    modifier: {
      kind: "modify",
      target: "behavior:positive_bias",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants Positive Bias (Advantage) on Reaction Clashes. Roll twice, take the higher. Mirror: revoke (no advantage on reaction clashes).",
    },
  },
  {
    id: 197, // Interceptive Priority
    modifier: {
      kind: "modify",
      target: "behavior:win_ties",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine auto-resolves ties on Reaction Clashes in favor of the holder. Mirror: revoke (no auto-win ties).",
    },
  },
  // ---- BOSS_ECONOMY (5) ----
  {
    id: 394, // Legendary Cadence I
    modifier: {
      kind: "modify",
      target: "action.legendary_action_window",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Adds +1 legendary action per round. Execute one designated low-cost capability at the end of another entity's turn. Mirror: subtract 1 (Minion — one fewer legendary action per round).",
    },
  },
  {
    id: 395, // Legendary Cadence II
    modifier: {
      kind: "modify",
      target: "action.legendary_action_window",
      operation: "add",
      value: 2,
      stacking: "stack",
      forkHint:
        "Adds +2 legendary actions per round. Mirror: subtract 2.",
    },
  },
  {
    id: 396, // Legendary Cadence III
    modifier: {
      kind: "modify",
      target: "action.legendary_action_window",
      operation: "add",
      value: 3,
      stacking: "stack",
      forkHint:
        "Adds +3 legendary actions per round. Apex boss baseline. The 'restores all spent action points at start of Council Phase' aspect is part of the legendary pool refresh narrative and is automatically tracked by the engine when this flag is present. Mirror: subtract 3.",
    },
  },
  {
    id: 397, // Existential Imperative (Legendary Resistance 1x/Day)
    modifier: {
      kind: "modify",
      target: "behavior:legendary_resistance",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants 1x/day Legendary Resistance: choose to overwrite a failed defensive save with an automatic success. Mirror: revoke (no legendary resistance).",
    },
  },
  {
    id: 398, // Mythic Safeguard (Legendary Resistance 3x/Day)
    modifier: {
      kind: "modify",
      target: "behavior:legendary_resistance",
      operation: "grant",
      value: 3,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants 3x/day Legendary Resistance: bypass up to 3 catastrophic debuffs or crowd-control effects per encounter. Mirror: revoke.",
    },
  },
  // ---- TRIGGER_HOOK (4) ----
  {
    id: 167, // Direct Material Trigger
    modifier: {
      kind: "modify",
      target: "behavior:trigger_material",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine wakes the hook on a basic physical/kinetic interaction within immediate proximity. Fork to specify the exact trigger event in the modifier's condition. Mirror: revoke (no material trigger).",
    },
  },
  {
    id: 168, // Systemic Threshold Trigger
    modifier: {
      kind: "modify",
      target: "behavior:trigger_systemic",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine wakes the hook on a localized state transition or quantified parameter shift (energy signature manifesting, vitality threshold, zone entry). Fork to specify the trigger. Mirror: revoke.",
    },
  },
  {
    id: 169, // Conditional Informational Trigger
    modifier: {
      kind: "modify",
      target: "behavior:trigger_informational",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine wakes the hook on complex narrative conditions, remote events, or non-obvious structural changes. Fork to specify the abstract trigger (e.g. 'a specific individual lies within earshot'). Mirror: revoke.",
    },
  },
  {
    id: 170, // Interceptive Causal Trigger
    modifier: {
      kind: "modify",
      target: "behavior:trigger_interceptive",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine intercepts reality before an incoming event resolves, pausing resolution to invoke the hook. Apex trigger. Mirror: revoke.",
    },
  },
  // ---- SPEED_QUICKENING (4) ----
  {
    id: 39, // Standard Execution
    modifier: {
      kind: "modify",
      target: "behavior:timing_standard",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine tags the capability as baseline Standard timing — the reference point all other tracks measure against. This is a SEED primitive; most capabilities will not directly compose it. Mirror: revoke (removes standard timing tag, but the engine will treat untagged capabilities as Standard by default anyway).",
    },
  },
  {
    id: 40, // Fast Execution
    modifier: {
      kind: "modify",
      target: "behavior:timing_fast",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine tags the capability as Fast Track — prioritized within the round, executes before Standard. Mirror: revoke (no fast priority).",
    },
  },
  {
    id: 41, // Instant Execution
    modifier: {
      kind: "modify",
      target: "behavior:timing_instant",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine tags the capability as Instant — immediate resolution on declaration, bypassing the round order. Mirror: revoke.",
    },
  },
  {
    id: 42, // Reaction Execution
    modifier: {
      kind: "modify",
      target: "behavior:timing_reaction",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine tags the capability as Reaction — interrupt-triggered execution, consumes a reaction window. Mirror: revoke.",
    },
  },
];

// =============================================================================
// Helpers (shared with apply-phase79-001.ts and 002.ts)
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
  console.log("Phase 7.9.3a — Migration: 24 verb-like modifiers (batch 1 of 3)");
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
