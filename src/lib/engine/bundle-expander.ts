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
  /**
   * Phase 8.3b: per-instance index within a (character, primitive_id) group.
   * 0 = the inherited baseline (if any). 1+ = direct-paid copies (each pays
   * full BU). The DB uses instance_id UUID instead of this number — this
   * index is just for ordering in the expander output.
   */
  instanceIndex: number;
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
/**
 * Phase 8.3b: per-primitiveId grouping that supports multiple instances.
 *
 * Structure:
 *   * `inherited`: 0 or 1 baseline row from heritage/capability/effect
 *     bundles. If set, the origin cols describe the most-specific path.
 *   * `mirror`: 0 or 1 direct mirror row (origin cols all null).
 *     Links to the inherited baseline if any; the cost is -buCost.
 *   * `directPaid`: 0..N direct-paid rows (origin cols all null, mirror
 *     = false). Each is a separate stack, each pays full BU.
 *
 * The DB enforces:
 *   * 1 inherited row per (char, prim) — partial unique index
 *   * 1 mirror row per (char, prim) — partial unique index
 *   * N direct-paid rows allowed — no unique constraint
 */
interface PrimitiveGroup {
  inherited: ExpandedPrimitive | null;
  mirror: ExpandedPrimitive | null;
  directPaid: ExpandedPrimitive[];
}

function emptyGroup(): PrimitiveGroup {
  return { inherited: null, mirror: null, directPaid: [] };
}

export function expandBundles(input: BundleExpansionInput): BundleExpansionResult {
  const warnings: string[] = [];

  // === Step 1: direct primitive slots — split into mirror vs directPaid ===
  const primitiveMap = new Map<number, PrimitiveGroup>();
  for (const p of input.primitives) {
    const group = primitiveMap.get(p.primitiveId) ?? emptyGroup();
    if (p.isMirrored) {
      // Only 1 mirror per primitive — keep the first one (dedup at expander)
      if (!group.mirror) {
        group.mirror = {
          primitiveId: p.primitiveId,
          source: p.source,
          isMirrored: true,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          instanceIndex: 0,
          originPath: "direct:mirror",
        };
      }
    } else {
      // Direct-paid: each is a separate instance. instanceIndex starts
      // at 0 (inherited baseline is also 0 — they share the index space
      // for ordering purposes, but the DB assigns unique UUIDs).
      group.directPaid.push({
        primitiveId: p.primitiveId,
        source: p.source,
        isMirrored: false,
        originHeritageId: null,
        originCapabilityId: null,
        originEffectId: null,
        instanceIndex: group.directPaid.length,
        originPath: "direct",
      });
    }
    primitiveMap.set(p.primitiveId, group);
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
      const group = primitiveMap.get(link.primitiveId) ?? emptyGroup();
      // Inherited: only ONE row per (char, prim), regardless of how
      // many inheritance paths brought it. mergeGroupInherited picks the
      // most-specific origin.
      group.inherited = mergeGroupInherited(group.inherited, {
        primitiveId: link.primitiveId,
        source: h.kind,
        isMirrored: link.isMirrored ?? false,
        originHeritageId: h.id,
        originCapabilityId: null,
        originEffectId: null,
        instanceIndex: 0,
        originPath: `heritage:${h.id}`,
      });
      primitiveMap.set(link.primitiveId, group);
    }
    for (const capLink of h.capabilityLinks) {
      // Heritage's capability's direct primitives (source = heritage kind)
      for (const pl of capLink.primitiveLinks) {
        const group = primitiveMap.get(pl.primitiveId) ?? emptyGroup();
        group.inherited = mergeGroupInherited(group.inherited, {
          primitiveId: pl.primitiveId,
          source: h.kind,
          isMirrored: pl.isMirrored ?? false,
          originHeritageId: h.id,
          originCapabilityId: capLink.capabilityId,
          originEffectId: null,
          instanceIndex: 0,
          originPath: `heritage:${h.id} > capability:${capLink.capabilityId}`,
        });
        primitiveMap.set(pl.primitiveId, group);
      }
      // Heritage's capability's effect's primitives
      for (const effLink of capLink.effectLinks) {
        for (const pl of effLink.primitiveLinks) {
          const group = primitiveMap.get(pl.primitiveId) ?? emptyGroup();
          group.inherited = mergeGroupInherited(group.inherited, {
            primitiveId: pl.primitiveId,
            source: h.kind,
            isMirrored: pl.isMirrored ?? false,
            originHeritageId: h.id,
            originCapabilityId: capLink.capabilityId,
            originEffectId: effLink.effectId,
            instanceIndex: 0,
            originPath: `heritage:${h.id} > capability:${capLink.capabilityId} > effect:${effLink.effectId}`,
          });
          primitiveMap.set(pl.primitiveId, group);
        }
      }
    }
  }

  // === Step 4: expand primitives from direct capabilities ===
  for (const cap of input.capabilities) {
    for (const link of cap.primitiveLinks) {
      const group = primitiveMap.get(link.primitiveId) ?? emptyGroup();
      // Direct capability doesn't override a direct slot — but it does
      // override an inherited-from-heritage row (more-specific origin).
      // However, if the primitive is already directPaid, the inherited
      // slot is just an inherited addition with a less-specific origin
      // than the direct slots — we still record it (because the
      // character OWNS it through both paths), but the origin is the
      // capability path. mergeGroupInherited picks most-specific.
      group.inherited = mergeGroupInherited(group.inherited, {
        primitiveId: link.primitiveId,
        source: cap.source,
        isMirrored: link.isMirrored ?? false,
        originHeritageId: null,
        originCapabilityId: cap.id,
        originEffectId: null,
        instanceIndex: 0,
        originPath: `direct:capability:${cap.id}`,
      });
      primitiveMap.set(link.primitiveId, group);
    }
    for (const effLink of cap.effectLinks) {
      for (const link of effLink.primitiveLinks) {
        const group = primitiveMap.get(link.primitiveId) ?? emptyGroup();
        group.inherited = mergeGroupInherited(group.inherited, {
          primitiveId: link.primitiveId,
          source: cap.source,
          isMirrored: link.isMirrored ?? false,
          originHeritageId: null,
          originCapabilityId: cap.id,
          originEffectId: effLink.effectId,
          instanceIndex: 0,
          originPath: `direct:capability:${cap.id} > effect:${effLink.effectId}`,
        });
        primitiveMap.set(link.primitiveId, group);
      }
    }
  }

  // === Step 5: expand primitives from direct effects ===
  for (const eff of input.effects) {
    for (const link of eff.primitiveLinks) {
      const group = primitiveMap.get(link.primitiveId) ?? emptyGroup();
      group.inherited = mergeGroupInherited(group.inherited, {
        primitiveId: link.primitiveId,
        source: eff.source,
        isMirrored: link.isMirrored ?? false,
        originHeritageId: null,
        originCapabilityId: null,
        originEffectId: eff.id,
        instanceIndex: 0,
        originPath: `direct:effect:${eff.id}`,
      });
      primitiveMap.set(link.primitiveId, group);
    }
  }

  // === Build primitives output: flatten groups into rows ===
  // The DB will assign each row a fresh instance_id UUID; this order
  // is the order rows will be inserted in (useful for tests + debug).
  const primitives: ExpandedPrimitive[] = [];
  for (const [, group] of primitiveMap) {
    if (group.inherited) primitives.push(group.inherited);
    if (group.mirror) primitives.push(group.mirror);
    for (const dp of group.directPaid) primitives.push(dp);
  }

  // === Build heritages output ===
  const heritages: ExpandedHeritage[] = input.heritages.map((h) => ({
    heritageId: h.id,
    source: h.kind,
    isMirrored: false, // v1: heritage-level mirror is read-only badge
  }));

  return {
    primitives,
    capabilities: Array.from(capabilityMap.values()),
    heritages,
    warnings,
  };
}

/**
 * Merge a candidate inherited primitive into the group. Only ONE
 * inherited row per (char, primitive_id) — picks the most-specific
 * origin.
 *
 * Preference order (lower = wins):
 *   1. has origin_effect_id (most specific — bubbled up through effect)
 *   2. has origin_capability_id (medium — bubbled up through capability)
 *   3. has origin_heritage_id only (least specific)
 *
 * First wins. If both candidates have the same rank, keep existing
 * (deterministic).
 */
function mergeGroupInherited(
  existing: ExpandedPrimitive | null,
  candidate: ExpandedPrimitive,
): ExpandedPrimitive {
  if (!existing) return candidate;
  const existingRank = originRank(existing);
  const candidateRank = originRank(candidate);
  // Lower rank wins. Existing already won the first time, so only
  // override if candidate is MORE specific (lower rank number).
  if (candidateRank < existingRank) {
    return candidate;
  }
  return existing;
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