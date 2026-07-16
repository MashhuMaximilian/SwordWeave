/**
 * Phase 7.9.3b — Migration: 14 spatial modifiers.
 *
 *   TACTICAL (4) — cover tier primitives
 *   TARGETING_AOE (10) — area effect primitives
 *
 * Pattern: 12 of 14 use `grant behavior:*` (cover tiers, AoE templates,
 * zone modes, chain behavior, etc.). 2 use `add` (Cover I/II impose
 * numerical accuracy penalties, Volume Scaling I upgrades areaSize).
 *
 * All 14 use non-`set` ops, so all 14 are mirrorable.
 *
 * Idempotent: re-running produces zero changes.
 *
 * Run: pnpm exec tsx scripts/apply-phase79-003b.ts
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
// The 14 proposed primitives.
// =============================================================================

type ProposedModifier = Omit<HardModifier, "condition"> & {
  readonly forkHint: string;
};

const PROPOSED: ReadonlyArray<{
  id: number;
  modifier: ProposedModifier;
}> = [
  // ---- TACTICAL (4) — cover tiers ----
  {
    id: 849, // Minor Obstruction (Cover Tier I)
    modifier: {
      kind: "modify",
      target: "action.roll",
      operation: "add",
      value: -2,
      stacking: "stack",
      forkHint:
        "Imposes -2 flat accuracy penalty on attackers striking the chosen coordinate. Half-strength cover (leaves, low walls, brief conjured obstructions). Stacks if the same target benefits from multiple sources of Cover I. Mirror: add +2 (EXPOSED — attacker gains +2 vs this coord, the canonical Vulnerability Inverse). Fork to attach to a specific entity or coordinate via a capability.",
    },
  },
  {
    id: 850, // Half Cover (Cover Tier II)
    modifier: {
      kind: "modify",
      target: "action.roll",
      operation: "add",
      value: -4,
      stacking: "stack",
      forkHint:
        "Imposes -4 flat accuracy penalty on attackers striking the chosen coordinate. Standard half-cover (tree trunks, low stone walls). Stacks with Cover I. Mirror: add +4 (EXPOSED, Vulnerability Inverse).",
    },
  },
  {
    id: 851, // Total Cover (Cover Tier III)
    modifier: {
      kind: "modify",
      target: "behavior:cover_total",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine treats the protected coordinate as fully covered — projected vectors cannot target it, line of sight is severed. Direct manifestations (psychic, magical aura, informational scan) still pass. Mirror: revoke (no total cover, vectors pass).",
    },
  },
  {
    id: 852, // Spatial Anchor Cover (Cover Tier IV)
    modifier: {
      kind: "modify",
      target: "behavior:cover_spatial_anchor",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "Apex cover. The engine warps the local frame around the protected coordinate — total cover that also blocks dispositional attacks (psychic, magical, informational). The protected coord becomes a defended pocket of reality. Subsumes Cover III. Mirror: revoke (apex protection removed).",
    },
  },
  // ---- TARGETING_AOE (10) ----
  {
    id: 224, // Bouncing Vector
    modifier: {
      kind: "modify",
      target: "behavior:bouncing_vector",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine auto-chains the vector on successful resolution — it leaps to a new target within 15ft of the current one. Fork to specify the bounce cap (e.g. 'max 3 bounces'). Mirror: revoke (no chain, single-target resolution).",
    },
  },
  {
    id: 225, // Collateral Buffer
    modifier: {
      kind: "modify",
      target: "behavior:collateral_filter",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine filters allied entities out of the AoE footprint automatically — friendly fire immunity inside the template. Mirror: revoke (allies inside the AoE now take damage/effects).",
    },
  },
  {
    id: 226, // Selective Focus
    modifier: {
      kind: "modify",
      target: "behavior:selective_focus",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine allows precise entity exclusion within the AoE — choose exactly which specific entities inside the template are affected and which are bypassed. Subsumes Collateral Buffer if both are present. Mirror: revoke (no entity exclusion, all inside are affected).",
    },
  },
  {
    id: 227, // Linear / Conical Vector
    modifier: {
      kind: "modify",
      target: "behavior:shape_linear_conical",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine uses a 15ft cone OR 30ft line template radiating from the user's facing direction. SEED — fork to pick one shape (cone-only or line-only) in a Capability. Mirror: revoke (shape tag removed, the capability reverts to single-target).",
    },
  },
  {
    id: 228, // Kinetic Sphere
    modifier: {
      kind: "modify",
      target: "behavior:shape_sphere_burst",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine uses a 10ft radius burst template radiating symmetrically outward from a selected coordinate. Mirror: revoke (no spherical AoE).",
    },
  },
  {
    id: 229, // Stationary Zone
    modifier: {
      kind: "modify",
      target: "behavior:zone_stationary",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine plants an area footprint that endures across rounds based on the capability's duration. The zone does not move with the originator. Mirror: revoke (no persistent zone, effect ends with declaration).",
    },
  },
  {
    id: 230, // Mobile Aura
    modifier: {
      kind: "modify",
      target: "behavior:zone_mobile",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine attaches a moving 10ft radius field to the user — shifts dynamically as the user moves. Mirror: revoke (no mobile aura, no shifting field).",
    },
  },
  {
    id: 231, // Structural Wall
    modifier: {
      kind: "modify",
      target: "behavior:shape_wall",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine erects a 30ft long × 10ft tall flat barrier that blocks line of sight and physical passage. SEED — fork to specify the wall's composition (energy, matter, force) via a capability. Mirror: revoke (no wall erected).",
    },
  },
  {
    id: 232, // Volume Scaling I
    modifier: {
      kind: "modify",
      target: "action.areaSize",
      operation: "add",
      value: 1,
      stacking: "stack",
      forkHint:
        "Adds +1 size tier upgrade to the active AoE blueprint (e.g. 10ft radius sphere → 20ft radius). Stacks with other size upgrades. Mirror: subtract 1 (Volume Down — shrinks the AoE by 1 tier).",
    },
  },
  {
    id: 233, // Global Field
    modifier: {
      kind: "modify",
      target: "behavior:field_global",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
      forkHint:
        "The engine drops the localized boundary — the effect covers every coordinate across the active combat map. Scene-wide blanket. Mirror: revoke (effect reverts to local scope).",
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
  console.log("Phase 7.9.3b — Migration: 14 spatial modifiers");
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
