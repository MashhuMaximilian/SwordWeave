/**
 * Phase 7.9.3e+f — Migration: 15 final modifiers.
 *
 *   PROBABILITY_BIAS (4) — Positive Bias I/II/III + Causal Override
 *   EVALUATION_STRAIN (8) — Heuristic Buffer, Systemic Sink, Volatile Vent,
 *                            Condition Insulation, Domain Lock Shield,
 *                            Hazard Transmutation, Narrative Pivot, CV Matrix Trap
 *   SHEET_AUGMENT (3) — Defensive Save Upgrade, Focused Presence,
 *                        Precise Vector Alignment
 *
 * Pattern: mix of `add` (numerical strain/score slots: action.strain,
 * action.roll) and `grant behavior:*` (capability flags for probability
 * bias, strain transformation, save proficiency, global DC).
 *
 * All 15 use non-`set` ops, so all 15 are mirrorable.
 *
 * This is the FINAL migration for Phase 7.9. After this, all 146
 * canonical primitives either have modifiers (DONE) or are marked
 * SKIP as structural atoms.
 *
 * Idempotent: re-running produces zero changes.
 *
 * Run: pnpm exec tsx scripts/apply-phase79-003ef.ts
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
// The 15 proposed primitives.
// =============================================================================

type ProposedModifier = Omit<HardModifier, "condition"> & {
  readonly forkHint: string;
};

const PROPOSED: ReadonlyArray<{
  id: number;
  modifier: ProposedModifier;
}> = [
  // ---- PROBABILITY_BIAS (4) ----
  {
    id: 160, // Positive Bias I — Narrative Focus
    modifier: {
      kind: "modify",
      target: "behavior:positive_bias",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — Positive Bias (Advantage) on one ultra-specific narrative sub-trigger. Roll twice, take the higher. SEED — fork to specify the focus (e.g. 'Awareness when tracking by scent') in the modifier's condition. Mirror: revoke (no advantage on this focus).",
    },
  },
  {
    id: 162, // Positive Bias II — Named Practice
    modifier: {
      kind: "modify",
      target: "behavior:positive_bias",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — Positive Bias on a single Named Practice or singular combat interaction. SEED — fork to specify the practice (e.g. '+Advantage on Awareness', '+Advantage on Reason'). Mirror: revoke.",
    },
  },
  {
    id: 164, // Positive Bias III — Core Attribute
    modifier: {
      kind: "modify",
      target: "behavior:positive_bias",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — Positive Bias across an entire primary Attribute axis (Physical / Mental / Magic-Abstract). SEED — fork to specify the attribute. Mirror: revoke.",
    },
  },
  {
    id: 166, // Causal Override (Fate Replacement)
    modifier: {
      kind: "modify",
      target: "behavior:causal_override",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex probability. Engine flag — bypass rolling entirely, replace an upcoming d20 with a fixed value. Pre-determines a narrative outcome by substituting a guaranteed mathematical baseline. Mirror: revoke (cannot bypass rolls).",
    },
  },
  // ---- EVALUATION_STRAIN (8) ----
  {
    id: 198, // Heuristic Buffer
    modifier: {
      kind: "modify",
      target: "action.strain",
      operation: "add",
      value: -1,
      stacking: "stack",
      forkHint:
        "Adds -1 to the final Strain Score for one capability (Heavy Strain 4 cast filtered to Moderate Strain 3). Stacks. Mirror: add +1 (extra strain). Fork to scope to a specific capability.",
    },
  },
  {
    id: 199, // Systemic Sink
    modifier: {
      kind: "modify",
      target: "action.strain",
      operation: "add",
      value: -2,
      stacking: "stack",
      forkHint:
        "Adds -2 to the final Strain Score. Allows complex actions to bypass severe fallout brackets. Mirror: add +2 (significantly more strain).",
    },
  },
  {
    id: 200, // Volatile Vent
    modifier: {
      kind: "modify",
      target: "behavior:strain_vent",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — once per scene, treat an incoming Strain 1-2 cast as Strain 0. Mirror: revoke (no strain vent capability).",
    },
  },
  {
    id: 202, // Condition Insulation
    modifier: {
      kind: "modify",
      target: "behavior:strain_condition_insulation",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — negate one DM-imposed status condition (prone/blinded/staggered) arising from strain feedback. Mirror: revoke (vulnerable to strain conditions).",
    },
  },
  {
    id: 203, // Domain Lock Shield
    modifier: {
      kind: "modify",
      target: "behavior:strain_domain_lock_shield",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — immunity to strain-based Domain Burnouts / Locks. Protects active capabilities. Mirror: revoke (vulnerable to domain burnouts).",
    },
  },
  {
    id: 204, // Hazard Transmutation
    modifier: {
      kind: "modify",
      target: "behavior:strain_hazard_transmutation",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — convert all personal Vitality loss from strain into an Environmental Hazard instead. Health remains untouched. Mirror: revoke (no hazard transmutation, vitality loss is direct).",
    },
  },
  {
    id: 205, // Narrative Pivot
    modifier: {
      kind: "modify",
      target: "behavior:strain_narrative_pivot",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — convert all mechanical sheet costs (vitality, status, domains) into a severe Narrative Twist instead. DM introduces an immediate outside complication (alarm triggers, tool breaks). Mirror: revoke.",
    },
  },
  {
    id: 206, // CV Matrix Trap
    modifier: {
      kind: "modify",
      target: "behavior:strain_matrix_trap",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — convert a Strain 3+ cast into a temporary defensive threshold (barrier equal to halved Vitality lost). Mirror: revoke (no matrix trap).",
    },
  },
  // ---- SHEET_AUGMENT (3) ----
  {
    id: 55, // Defensive Save Upgrade
    modifier: {
      kind: "modify",
      target: "behavior:saving_throw_proficiency",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — gain Saving Throw Proficiency for one chosen Attribute type (adds full PB to defense/hazard saves). SEED — fork to specify the attribute. Mirror: revoke (no save proficiency).",
    },
  },
  {
    id: 64, // Focused Presence (Global DC Modifier)
    modifier: {
      kind: "modify",
      target: "behavior:global_dc_modifier",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — raises the global baseline check threshold by +1 for all saving throws forced by the character. (Used a behavior flag because the character.defense.*Dc slots are for the entity's OWN defense, not the DC they force on others.) Mirror: revoke (no global DC bonus).",
    },
  },
  {
    id: 65, // Precise Vector Alignment (Global Attack Modifier)
    modifier: {
      kind: "modify",
      target: "action.roll",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Adds +1 to all attack/accuracy resolution rolls regardless of source. Stacks with other attack bonuses. Mirror: subtract 1 (-1 to all attack rolls, Inaccuracy).",
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
  console.log("Phase 7.9.3e+f — Migration: 15 final modifiers (closes Phase 7.9)");
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
