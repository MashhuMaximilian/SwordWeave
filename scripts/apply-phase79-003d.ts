/**
 * Phase 7.9.3d — Migration: 8 heavy modifiers.
 *
 *   METAMORPHOSIS (4) — body modification primitives
 *   AGENCY_OVERRIDE (4) — mind control / social override primitives
 *
 * Pattern: all 8 use `grant behavior:*` capability flags. These
 * primitives describe multi-effect transformations (template swap,
 * mind control, body modification) that don't fit cleanly into the
 * 1-modifier-per-primitive constraint as direct numerical ops. The
 * capability-flag pattern lets the engine apply the multi-step
 * effect at cast time.
 *
 * All 8 use non-`set` ops, so all 8 are mirrorable. Mirrors are
 * `revoke` (the entity no longer has the capability to apply the
 * effect — clean Vulnerability Inverse from the target's POV).
 *
 * Idempotent: re-running produces zero changes.
 *
 * Run: pnpm exec tsx scripts/apply-phase79-003d.ts
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
// The 8 proposed primitives.
// =============================================================================

type ProposedModifier = Omit<HardModifier, "condition"> & {
  readonly forkHint: string;
};

const PROPOSED: ReadonlyArray<{
  id: number;
  modifier: ProposedModifier;
}> = [
  // ---- METAMORPHOSIS (4) ----
  {
    id: 183, // Composition Tuning
    modifier: {
      kind: "modify",
      target: "behavior:composition_tuning",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — at cast, applies cosmetic material changes (skin texture, surface calcification, biological camouflage, minor elemental resilience). One-shot engine effect. SEED — fork to specify the specific material change in a Capability. Mirror: revoke (no cosmetic material change capability).",
    },
  },
  {
    id: 184, // Volumetric Scale Shift
    modifier: {
      kind: "modify",
      target: "behavior:volumetric_scale_shift",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — at cast, shifts the entity's size category by ±1-2 steps. Engine derives movement/reach/mass adjustments from the size category change. SEED — fork to specify direction (growth vs shrinking) and magnitude in a Capability. Mirror: revoke (no size shift capability, rigid form).",
    },
  },
  {
    id: 185, // State Transmutation
    modifier: {
      kind: "modify",
      target: "behavior:state_transmutation",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — at cast, phase-shifts the entity's matter into Gaseous, Liquid, Crystalline, or Energetic state while retaining entity control. SEED — fork to specify the target state in a Capability. Mirror: revoke (no phase shift capability, fixed material state).",
    },
  },
  {
    id: 186, // Polymorphic Template Overwrite
    modifier: {
      kind: "modify",
      target: "behavior:template_overwrite",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex body modification. Engine flag — at cast, suppresses the target's physical sheet and enforces a completely new physical template. Target retains their original mind. SEED — fork to specify the new template form in a Capability. Mirror: revoke (entity cannot body-swap others). Note: target-side immunity to body-swap is a separate defensive primitive, NOT a mirror of this one.",
    },
  },
  // ---- AGENCY_OVERRIDE (4) ----
  {
    id: 179, // Impulse Nudge / Point Transmission
    modifier: {
      kind: "modify",
      target: "behavior:impulse_injection",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — at cast, injects a temporary emotional state/reaction vector (paranoia, curiosity, sudden interest) OR transmits a single secure stream of thought between two conscious entities. SEED — fork to specify which in a Capability. Mirror: revoke (no mind-injection capability). Note: target-side immunity to impulse injection is a separate defensive primitive.",
    },
  },
  {
    id: 180, // Behavioral Directive / Data Trace Masking
    modifier: {
      kind: "modify",
      target: "behavior:behavioral_directive",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Engine flag — at cast, compels a sustained course of action that does not violate immediate survival protocols, OR entirely conceals/reveals localized data traces. SEED — fork to specify which in a Capability. Mirror: revoke (no compulsion capability).",
    },
  },
  {
    id: 181, // Direct Executive Override / Matrix Redaction
    modifier: {
      kind: "modify",
      target: "behavior:executive_override",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex mind control. Engine flag — at cast, takes complete execution control over an entity's mental/physical choices (proxy control), OR permanently rewrites/erases an isolated memory block. SEED — fork to specify which in a Capability. Mirror: revoke (no proxy control capability).",
    },
  },
  {
    id: 182, // Existential Allegiance Bind / Informational Absolutism
    modifier: {
      kind: "modify",
      target: "behavior:allegiance_bind",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex identity control. Engine flag — at cast, permanently rewrites an entity's baseline loyalty architecture (identity re-anchor), OR establishes total structural information blackout (no data enters or exits a network zone). SEED — fork to specify which in a Capability. Mirror: revoke (no loyalty rewrite capability).",
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
  console.log("Phase 7.9.3d — Migration: 8 heavy modifiers");
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
