/**
 * Phase 7.9.2 — Migration: 27 stat-like modifiers.
 *
 * Mirrors the structure of scripts/apply-phase79-001.ts. Same
 * idempotency: re-running produces zero changes.
 *
 * The 27 rows:
 *   - DEFENSIVE (4): 1 add + 3 grant
 *   - INTENSITY_DICE (5): all add
 *   - PRACTICE_PROGRESSION_AUGMENT (5): all grant
 *   - MOBILITY_LOCOMOTION (5): all grant
 *   - SENSORY_ARRAY (4): all grant
 *   - PERCEPTION_QUALIFIER (4): all grant
 *
 * All 27 use non-`set` ops → all become mirrorable. The migration
 * flips `is_mirrorable=false → true` for the 27 to match derived.
 *
 * Run: pnpm exec tsx scripts/apply-phase79-002.ts
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
// The 27 proposed primitives.
// =============================================================================

type ProposedModifier = Omit<HardModifier, "condition"> & {
  readonly forkHint: string;
};

const PROPOSED: ReadonlyArray<{
  id: number;
  modifier: ProposedModifier;
}> = [
  // ---- DEFENSIVE (4) ----
  {
    id: 385, // Universal Aegis
    modifier: {
      kind: "modify",
      target: "defense_dc.physical",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "This is a SEED that adds +1 to Physical defense. To apply +1 to ALL three defenses (the canonical Universal Aegis), compose 3 forks (one per defense_dc slot) in a Capability, or compose 3 separate primitives (one for each defense) in your build. The seed alone is +1 Physical.",
    },
  },
  {
    id: 386, // Reactive Bulwark
    modifier: {
      kind: "modify",
      target: "behavior:reactive_bulwark",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine reads the 'reactive_bulwark' behavior flag at reaction-resolution time and adds +2 to the entity's defenses when targeted. Fork to scope the bonus to a specific defense (physical, magical, mental) or to a specific target type.",
    },
  },
  {
    id: 387, // Structural Hardening (Domain Resistance)
    modifier: {
      kind: "modify",
      target: "behavior:domain_resistance",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
      forkHint:
        "The engine halves damage from one specified domain. Fork to add a condition specifying the domain (fire, cold, etc.). The behavior flag itself is domain-agnostic — the engine reads the condition to know which domain the resistance applies to.",
    },
  },
  {
    id: 388, // Absolute Insulation (Domain Immunity)
    modifier: {
      kind: "modify",
      target: "behavior:domain_immunity",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
      forkHint:
        "The engine zeroes damage from one specified domain. Fork to add a condition specifying the domain. Like Structural Hardening but the mitigation is total instead of half.",
    },
  },
  // ---- INTENSITY_DICE (5) ----
  {
    id: 389, // Standard Die Block (1d6)
    modifier: {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: "1d6",
      stacking: "stack",
      forkHint:
        "Adds 1d6 to damage. Stacks with other die blocks. Mirror: subtract 1d6 from damage (a damage-reduction pattern, the canonical Vulnerability Inverse). Fork to change the damage domain (fire, cold, etc.) via a condition.",
    },
  },
  {
    id: 390, // Heavy Die Block (1d8)
    modifier: {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: "1d8",
      stacking: "stack",
      forkHint:
        "Adds 1d8 to damage. Stacks. Mirror: subtract 1d8 (damage reduction). Fork to change the damage domain.",
    },
  },
  {
    id: 391, // Impact Die Block (1d10)
    modifier: {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: "1d10",
      stacking: "stack",
      forkHint:
        "Adds 1d10 to damage. Stacks. Mirror: subtract 1d10. Fork to change the damage domain.",
    },
  },
  {
    id: 392, // Calamity Die Block (1d12)
    modifier: {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: "1d12",
      stacking: "stack",
      forkHint:
        "Adds 1d12 to damage. Stacks. Mirror: subtract 1d12. Fork to change the damage domain.",
    },
  },
  {
    id: 393, // Existential Tear (1d20)
    modifier: {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: "1d20",
      stacking: "stack",
      forkHint:
        "Adds 1d20 to damage — the mythic scale. Stacks. Mirror: subtract 1d20. Fork to change the damage domain.",
    },
  },
  // ---- PRACTICE_PROGRESSION_AUGMENT (5) ----
  {
    id: 56, // Broad Familiarity
    modifier: {
      kind: "modify",
      target: "behavior:broad_familiarity",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine reads the 'broad_familiarity' flag and adds half Proficiency Bonus (rounded down) to all non-proficient checks. Prereq: no active Practice Proficiencies. This flag is auto-revoked when the entity gains a Practice Proficiency.",
    },
  },
  {
    id: 57, // Focused Edge
    modifier: {
      kind: "modify",
      target: "behavior:focused_edge",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine reads the 'focused_edge' flag and grants Narrow Advantage on one chosen Narrative Focus. SEED — fork to specify the focus (e.g. 'Awareness when tracking by scent') in the modifier's condition. Prereq: Practice Proficiency in the parent Practice.",
    },
  },
  {
    id: 58, // Practice Proficiency
    modifier: {
      kind: "modify",
      target: "behavior:practice_proficiency",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine reads the 'practice_proficiency' flag and adds full Proficiency Bonus (+PB) to all checks matching a single Named Practice. SEED — fork to specify the practice (e.g. '+PB on Awareness', '+PB on Reason') in the modifier's condition.",
    },
  },
  {
    id: 59, // Expertise Upgrade
    modifier: {
      kind: "modify",
      target: "behavior:expertise_upgrade",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine reads the 'expertise_upgrade' flag and doubles the Proficiency Bonus (+2x PB) for one Named Practice. SEED — fork to specify the practice in the modifier's condition. Prereq: Practice Proficiency in the same practice.",
    },
  },
  {
    id: 60, // Reliable Practice (Mastery)
    modifier: {
      kind: "modify",
      target: "behavior:reliable_practice",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine reads the 'reliable_practice' flag and establishes a natural d20 floor of 10 for one Named Practice (any roll of 9 or lower is treated as 10). SEED — fork to specify the practice in the modifier's condition. Prereq: Expertise Upgrade in the same practice.",
    },
  },
  // ---- MOBILITY_LOCOMOTION (5) ----
  {
    id: 219, // Aquatic Unlock
    modifier: {
      kind: "modify",
      target: "behavior:swim_speed",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants swim speed equal to the entity's baseline land speed. Provides natural buoyancy, no drowning or underwater penalties. One grant is enough — re-rolling gives the same flag.",
    },
  },
  {
    id: 220, // Subterranean Bore
    modifier: {
      kind: "modify",
      target: "behavior:burrow_speed_15ft",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants 15 ft burrow speed through soft earth and sand. Cannot pierce solid stone or reinforced metal without further upgrades.",
    },
  },
  {
    id: 221, // Aero Unlock
    modifier: {
      kind: "modify",
      target: "behavior:fly_speed",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants fly speed equal to the entity's baseline land speed. Full 3D movement. Requires constant forward momentum to stay aloft (no hover). Fork to a higher-tier primitive (e.g. Hover Precision) for stationary flight.",
    },
  },
  {
    id: 222, // Phase Slip
    modifier: {
      kind: "modify",
      target: "behavior:incorporeal_movement",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine treats solid barriers (non-magical) as difficult terrain. Ending a turn inside solid matter inflicts immediate heavy Strain. Note: this is the mobility form of incorporeal — for full incorporeality, see Polymorphic Overwrite in METAMORPHOSIS.",
    },
  },
  {
    id: 223, // Hover Precision
    modifier: {
      kind: "modify",
      target: "behavior:hover_precision",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine grants 60 ft fly speed plus a hover state — the entity can remain perfectly stationary in mid-air. Apex aerial mobility. Subsumes the Aero Unlock flag if both are present.",
    },
  },
  // ---- SENSORY_ARRAY (4) ----
  {
    id: 214, // Umbral Sight I (Darkvision 60ft)
    modifier: {
      kind: "modify",
      target: "behavior:darkvision_60ft",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine converts total physical darkness into dim light within 60 feet. Cannot discern color in pitch black.",
    },
  },
  {
    id: 215, // Substrate Echo (Tremorsense 30ft)
    modifier: {
      kind: "modify",
      target: "behavior:tremorsense_30ft",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine pinpoints exact coordinates of any entity making physical contact with contiguous ground, bypassing blindness, heavy smoke, and physical walls (up to 30 ft).",
    },
  },
  {
    id: 216, // Umbral Sight II (Darkvision 120ft)
    modifier: {
      kind: "modify",
      target: "behavior:darkvision_120ft",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Extended deep-scout sensory array — 120 ft darkvision. Pierces natural and synthesized darkness. Subsumes Umbral Sight I if both are present.",
    },
  },
  {
    id: 217, // Tactile Echo (Blindsight 30ft)
    modifier: {
      kind: "modify",
      target: "behavior:blindsight_30ft",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine provides absolute localized awareness within 30 ft via acoustic, olfactory, and ambient pressure currents — no eyes needed. The supreme form of the sensory array.",
    },
  },
  // ---- PERCEPTION_QUALIFIER (4) ----
  {
    id: 171, // Environmental Translation
    modifier: {
      kind: "modify",
      target: "behavior:perception_environmental",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine allows the entity to track physical anomalies that exist within the material world but sit outside ordinary human baseline spectrums — thermal signatures, substrate vibrations, illumination deficits. Permission to perceive; Awareness checks still resolve uncertainty.",
    },
  },
  {
    id: 172, // Systemic Resonance
    modifier: {
      kind: "modify",
      target: "behavior:perception_systemic",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine allows the entity to discern structural, chemical, and operational properties woven into matter or local space — active energy currents, chemical signatures, physiological spikes. Permission to perceive; Awareness checks still resolve.",
    },
  },
  {
    id: 173, // Non-Material Translation
    modifier: {
      kind: "modify",
      target: "behavior:perception_non_material",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine allows the entity to track intangible vectors that possess no physical weight — thoughts, emotional currents, phase-shifted anomalies. Permission to perceive non-physical data; Awareness checks still resolve.",
    },
  },
  {
    id: 174, // Existential Clarity
    modifier: {
      kind: "modify",
      target: "behavior:perception_existential",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine provides direct, unfiltered observation of the scene's underlying systemic truth. Bypasses all layers of intentional concealment, spatial folds, or altered identities. The supreme form of perception.",
    },
  },
];

// =============================================================================
// Helpers (shared with apply-phase79-001.ts)
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
  console.log("Phase 7.9.2 — Migration: 27 stat-like modifiers");
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
