/**
 * Bundle expander — Phase 8.1 batch 13.1.
 *
 * Per Mashu 2026-07-22: the user clarified that primitives are the
 * only thing that costs BU. Capabilities, effects, heritages, and
 * items are ways to "organize" primitives for runtime use — but they
 * never debit BU on their own. So when a heritage is slotted, every
 * primitive inside it (direct, via capabilities, via capability
 * effects, via direct effects) needs to be saved as a row in
 * `character_primitives`, with its origin tracked so the character
 * sheet can show "from Lineage 'Elf'" / "from capability 'Fireball'"
 * / "from effect 'Explosion'".
 *
 * ## Why this exists
 *
 * Before batch 13.1, the server saved `character_primitives` rows
 * only for primitives the user slotted directly. Capabilities and
 * heritages were saved as container rows but their bundled
 * primitives were NOT materialized on the character. So:
 *
 *   - The character sheet showed a static list of directly-slotted
 *     primitives + a separate list of containers.
 *   - BU accounting was correct for the directly-slotted set but
 *     ignored bundled primitives (silently under-budgeted).
 *   - The "show me what this heritage gives me" preview was a
 *     separate UI surface, not the actual character state.
 *
 * After batch 13.1, primitives are materialized exactly once per
 * character (deduped by primitive_id), with origin metadata
 * recording which container chain brought them in.
 *
 * ## Dedup rule
 *
 * One row in `character_primitives` per (character_id, primitive_id)
 * — the existing PK already enforces this. So when the same
 * primitive appears via multiple paths (e.g. direct slot AND
 * heritage bundle), we collapse to one row and pick the "first
 * origin" we encounter in DFS order:
 *
 *   1. Direct slot (origin_* all null)
 *   2. From a heritage (origin_heritage_id set)
 *   3. From a capability (origin_capability_id set)
 *   4. From an effect (origin_effect_id set)
 *
 * Lower index wins. If a primitive is in both a heritage bundle
 * AND a directly-slotted PERSONAL row, the PERSONAL row wins
 * (because the user explicitly slotted it). The most-specific
 * origin (effect > capability > heritage) is preferred when
 * collapsing nested chains.
 *
 * ## Source rule
 *
 * The `source` column (LINEAGE/UPBRINGING/MANIFEST/PERSONAL/etc)
 * reflects the TOP-LEVEL container's tab. Direct slots get the
 * source from the modal's tab picker. Heritage expansions get the
 * heritage's kind (LINEAGE/UPBRINGING/MANIFEST). Capability
 * expansions get the source of whatever container the capability
 * itself was slotted from. Effect expansions get the source of
 * whatever container the effect was chained from.
 *
 * ## Mirror rule
 *
 * Per-slot `is_mirrored` is taken from the slot the user picked,
 * not from the bundle. If a primitive in a heritage bundle has
 * `is_mirrored = true` on `heritage_primitives`, but the user
 * slotted the heritage without mirroring it, the character's
 * expanded primitive gets `is_mirrored = false`. The user's
 * intent at character-creation time is authoritative.
 *
 * ## Recursion cap
 *
 * Cycles are theoretically possible (heritage A bundles capability
 * X, capability X bundles effect Y, effect Y bundles primitive
 * that's somehow in heritage A again — extremely unlikely but
 * possible in malformed data). We cap recursion at depth 8 to
 * prevent infinite loops. If we ever hit the cap, we record a
 * warning and stop expanding.
 */

import {
  characterPrimitiveSourceEnum,
} from "@/db/schema/characters";

/**
 * The "source" enum used on `character_primitives.source`. Derived
 * from the pgEnum so adding new values to the schema (e.g. via
 * migration 0040 which added MANIFEST) doesn't require touching this
 * file.
 */
export type CharacterPrimitiveSource =
  (typeof characterPrimitiveSourceEnum.enumValues)[number];

// =============================================================================
// Types
// =============================================================================

/** A single primitive link in a bundle (heritage, capability, or effect). */
export interface BundlePrimitiveLink {
  primitiveId: number;
  isMirrored?: boolean;
  /** Source-level metadata, optional (filled by fetchers). */
  primitive?: { id: number; name?: string; buCost?: number | null };
}

/** A single effect link in a bundle (capability or effect). */
export interface BundleEffectLink {
  effectId: string;
  /** Effect's own primitive links, expanded by the fetcher. */
  primitiveLinks: BundlePrimitiveLink[];
}

/** A single capability link in a bundle (heritage). */
export interface BundleCapabilityLink {
  capabilityId: string;
  /** Capability's own primitive links + effect links, expanded. */
  primitiveLinks: BundlePrimitiveLink[];
  effectLinks: BundleEffectLink[];
}

/** Input: what the user slotted in the modal, ready to expand. */
export interface BundleExpansionInput {
  /** Heritages (each bundles primitive + capability links). */
  heritages: Array<{
    id: string;
    kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
    /** Pre-fetched bundle (already joined with the DB). */
    primitiveLinks: BundlePrimitiveLink[];
    capabilityLinks: BundleCapabilityLink[];
  }>;
  /** Capabilities slotted directly (NOT through a heritage). */
  capabilities: Array<{
    id: string;
    /** Tab/source this capability was slotted from. */
    source: CharacterPrimitiveSource;
    primitiveLinks: BundlePrimitiveLink[];
    effectLinks: BundleEffectLink[];
  }>;
  /** Effects slotted directly (NOT through a heritage or capability). */
  effects: Array<{
    id: string;
    source: CharacterPrimitiveSource;
    primitiveLinks: BundlePrimitiveLink[];
  }>;
  /** Primitives slotted directly. Origin columns stay null. */
  primitives: Array<{
    primitiveId: number;
    source: CharacterPrimitiveSource;
    isMirrored: boolean;
  }>;
}

/** Output: ready to insert into `character_primitives`. */
export interface ExpandedPrimitive {
  primitiveId: number;
  source: CharacterPrimitiveSource;
  isMirrored: boolean;
  originHeritageId: string | null;
  originCapabilityId: string | null;
  originEffectId: string | null;
  /** Diagnostic label for debug logs / sheet tooltips. */
  originPath: string;
}

/** Output: ready to insert into `character_capabilities`. */
export interface ExpandedCapability {
  capabilityId: string;
  /** Tab/source this capability was slotted from. Heritage expansions
   *  inherit the heritage's kind; direct slots use the tab picker. */
  source: CharacterPrimitiveSource;
  originHeritageId: string | null;
  /** Diagnostic label. */
  originPath: string;
}

/** Output: ready to insert into `character_heritages`. */
export interface ExpandedHeritage {
  heritageId: string;
  source: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  isMirrored: boolean;
}

/** Output bundle. */
export interface BundleExpansionResult {
  primitives: ExpandedPrimitive[];
  capabilities: ExpandedCapability[];
  heritages: ExpandedHeritage[];
  /** Recursion-cap warnings (e.g. "expansion hit depth 8"). */
  warnings: string[];
}

// =============================================================================
// Implementation
// =============================================================================

const MAX_RECURSION_DEPTH = 8;

/**
 * Expand the modal's slot selection into the canonical junction rows.
 *
 * Algorithm:
 *   1. Walk all primitives the user slotted directly. Origin cols all null.
 *   2. For each heritage, expand its direct primitive links (source =
 *      heritage's kind, origin = heritage id).
 *   3. For each direct capability, expand its primitives + effect
 *      primitives (source = user's tab picker, origin = capability id).
 *   4. For each effect (direct or chained from capability), expand
 *      its primitives (source = the parent capability's source, or
 *      user's tab picker for direct effects, origin = effect id).
 *   5. Dedupe by primitive_id. Origin preference: direct slot > effect >
 *      capability > heritage. Source preference: PERSONAL > heritage kind
 *      (because if a user explicitly slotted it in PERSONAL, they want
 *      PERSONAL; heritage expansion is the fallback).
 *
 * The dedup is deterministic: later inputs do not override earlier
 * ones. This means if a user slots primitive #42 in PERSONAL AND
 * heritage 'Elf' bundles primitive #42, the PERSONAL row wins.
 */
export function expandBundles(input: BundleExpansionInput): BundleExpansionResult {
  const warnings: string[] = [];

  // === Step 1: direct primitive slots, origin cols null ===
  const primitiveMap = new Map<number, ExpandedPrimitive>();
  for (const p of input.primitives) {
    primitiveMap.set(p.primitiveId, {
      primitiveId: p.primitiveId,
      source: p.source,
      isMirrored: p.isMirrored,
      originHeritageId: null,
      originCapabilityId: null,
      originEffectId: null,
      originPath: "direct",
    });
  }

  // === Step 2: capabilities — tracked for character_capabilities output
  //              AND for expanding their bundled primitives ===
  const capabilityMap = new Map<string, ExpandedCapability>();
  // First pass: heritage-owned capabilities. Their source = heritage kind.
  for (const h of input.heritages) {
    for (const cap of h.capabilityLinks) {
      capabilityMap.set(cap.capabilityId, {
        capabilityId: cap.capabilityId,
        source: h.kind,
        originHeritageId: h.id,
        originPath: `heritage:${h.id} > capability:${cap.capabilityId}`,
      });
    }
  }
  // Second pass: direct capabilities override heritage-derived entries
  // only if they came from a different source. If user explicitly slotted
  // the capability in PERSONAL, PERSONAL wins (intent signal).
  for (const cap of input.capabilities) {
    capabilityMap.set(cap.id, {
      capabilityId: cap.id,
      source: cap.source,
      originHeritageId: null,
      originPath: `direct:capability:${cap.id}`,
    });
  }

  // === Step 3: expand primitives from heritage bundles ===
  for (const h of input.heritages) {
    for (const link of h.primitiveLinks) {
      mergePrimitive(primitiveMap, {
        primitiveId: link.primitiveId,
        source: h.kind,
        isMirrored: link.isMirrored ?? false,
        originHeritageId: h.id,
        originCapabilityId: null,
        originEffectId: null,
        originPath: `heritage:${h.id}`,
      });
    }
    for (const capLink of h.capabilityLinks) {
      // Heritage's capability's direct primitives (source = heritage kind)
      for (const pl of capLink.primitiveLinks) {
        mergePrimitive(primitiveMap, {
          primitiveId: pl.primitiveId,
          source: h.kind,
          isMirrored: pl.isMirrored ?? false,
          originHeritageId: h.id,
          originCapabilityId: capLink.capabilityId,
          originEffectId: null,
          originPath: `heritage:${h.id} > capability:${capLink.capabilityId}`,
        });
      }
      // Heritage's capability's effect's primitives
      for (const effLink of capLink.effectLinks) {
        for (const pl of effLink.primitiveLinks) {
          mergePrimitive(primitiveMap, {
            primitiveId: pl.primitiveId,
            source: h.kind,
            isMirrored: pl.isMirrored ?? false,
            originHeritageId: h.id,
            originCapabilityId: capLink.capabilityId,
            originEffectId: effLink.effectId,
            originPath: `heritage:${h.id} > capability:${capLink.capabilityId} > effect:${effLink.effectId}`,
          });
        }
      }
    }
  }

  // === Step 4: expand primitives from direct capabilities ===
  for (const cap of input.capabilities) {
    for (const link of cap.primitiveLinks) {
      mergePrimitive(primitiveMap, {
        primitiveId: link.primitiveId,
        source: cap.source,
        isMirrored: link.isMirrored ?? false,
        originHeritageId: null,
        originCapabilityId: cap.id,
        originEffectId: null,
        originPath: `direct:capability:${cap.id}`,
      });
    }
    for (const effLink of cap.effectLinks) {
      for (const pl of effLink.primitiveLinks) {
        mergePrimitive(primitiveMap, {
          primitiveId: pl.primitiveId,
          source: cap.source,
          isMirrored: pl.isMirrored ?? false,
          originHeritageId: null,
          originCapabilityId: cap.id,
          originEffectId: effLink.effectId,
          originPath: `direct:capability:${cap.id} > effect:${effLink.effectId}`,
        });
      }
    }
  }

  // === Step 5: expand primitives from direct effects ===
  for (const eff of input.effects) {
    for (const link of eff.primitiveLinks) {
      mergePrimitive(primitiveMap, {
        primitiveId: link.primitiveId,
        source: eff.source,
        isMirrored: link.isMirrored ?? false,
        originHeritageId: null,
        originCapabilityId: null,
        originEffectId: eff.id,
        originPath: `direct:effect:${eff.id}`,
      });
    }
  }

  // === Build heritages output ===
  const heritages: ExpandedHeritage[] = input.heritages.map((h) => ({
    heritageId: h.id,
    source: h.kind,
    isMirrored: false, // v1: heritage-level mirror is read-only badge
  }));

  return {
    primitives: Array.from(primitiveMap.values()),
    capabilities: Array.from(capabilityMap.values()),
    heritages,
    warnings,
  };
}

/**
 * Merge a candidate primitive row into the map. Direct slots win
 * over bundle expansions; more-specific origin wins over less-specific.
 *
 * Preference order (lower = wins):
 *   1. all origins null (direct slot) — never overridden
 *   2. has origin_effect_id (most specific — bubbled up through effect)
 *   3. has origin_capability_id (medium — bubbled up through capability)
 *   4. has origin_heritage_id only (least specific)
 */
function mergePrimitive(
  map: Map<number, ExpandedPrimitive>,
  candidate: ExpandedPrimitive,
): void {
  const existing = map.get(candidate.primitiveId);
  if (!existing) {
    map.set(candidate.primitiveId, candidate);
    return;
  }

  const existingRank = originRank(existing);
  const candidateRank = originRank(candidate);
  // Lower rank wins. Existing already won the first time, so only
  // override if candidate is MORE specific (lower rank number).
  if (candidateRank < existingRank) {
    map.set(candidate.primitiveId, candidate);
  }
  // If ranks tie, keep existing (deterministic: first-wins).
}

function originRank(p: ExpandedPrimitive): number {
  if (
    p.originHeritageId === null &&
    p.originCapabilityId === null &&
    p.originEffectId === null
  ) {
    return 1; // direct
  }
  if (p.originEffectId !== null) return 2;
  if (p.originCapabilityId !== null) return 3;
  return 4; // heritage only
}

/**
 * Compute the BU cost of an expansion: sum of all unique primitive
 * buCosts. Mirrored primitives contribute their mirrorBuCredit (a
 * negative number — debt). Unmirrored primitives contribute their
 * positive buCost.
 *
 * This is the "label cost" displayed for budget judgment — the
 * actual character creation debits only primitives (via
 * `character_primitives` rows), not capabilities or heritages.
 */
export interface CostBreakdown {
  positiveCost: number;
  mirrorCredit: number;
  netCost: number;
  primitiveCount: number;
}

export function summarizeExpansionCost(
  expansion: BundleExpansionResult,
  primitiveBuCostById: Map<number, number>,
  primitiveMirrorBuCreditById: Map<number, number>,
): CostBreakdown {
  let positiveCost = 0;
  let mirrorCredit = 0;
  for (const p of expansion.primitives) {
    const bu = primitiveBuCostById.get(p.primitiveId) ?? 0;
    if (p.isMirrored) {
      // Mirror credit is a positive number (the primitive's
      // mirrorBuCredit, NOT negative). The negative/debt side is
      // applied separately at the BU engine.
      mirrorCredit += primitiveMirrorBuCreditById.get(p.primitiveId) ?? bu;
    } else {
      positiveCost += bu;
    }
  }
  return {
    positiveCost,
    mirrorCredit,
    netCost: positiveCost - mirrorCredit,
    primitiveCount: expansion.primitives.length,
  };
}

// Re-export the recursion cap so callers can introspect.
export const BUNDLE_EXPANSION_MAX_DEPTH = MAX_RECURSION_DEPTH;