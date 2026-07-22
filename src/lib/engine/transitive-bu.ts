/**
 * computeTransitiveBu — Phase 8.1 batch 13.1 follow-up
 *
 * Per Mashu 2026-07-22 (after batch 13.2 was deployed):
 * "in atelier preview as well as list I have that total BU there up
 * for all mechanics and heritages. However that is only calculated
 * from the bundled primitives (direct). It should be total of all
 * primitives nested (deduped) from effects and capabilities."
 *
 * This helper does the full transitive walk on a heritage / capability
 * / item bundle, deduplicating primitives by ID, and returns the total
 * BU plus the unique primitive list. It is the same algorithm the
 * server-side expander uses for character creation — just exposed as a
 * pure helper that can be called from any layer (server endpoints,
 * preview modals, character modal, library list cards).
 *
 * ## Dedup semantics
 *
 *   - Dedupe by primitive_id (the canonical "this is the same primitive"
 *     key). A primitive appearing in both `primitiveLinks` (direct) and
 *     `capabilityLinks[].primitiveLinks` (via a capability) counts once.
 *   - For BU purposes, the FIRST occurrence wins (its buCost is used).
 *     In practice all rows for the same primitive share the same
 *     buCost, but we don't rely on that.
 *   - Mirror flag is NOT considered — this helper returns the gross
 *     positive BU. The character-sheet / BU-accounting layer applies
 *     the mirror offset separately.
 *
 * ## Algorithm
 *
 *   1. Walk direct primitiveLinks — add to Set of seen IDs and sum.
 *   2. Walk capabilityLinks[].primitiveLinks — add to Set and sum if new.
 *   3. Walk capabilityLinks[].effectLinks[].primitiveLinks — add to Set
 *      and sum if new.
 *   4. Return { transitiveBu, transitiveCount, primitiveIds }.
 *
 * Steps 2 and 3 are independent of each other (capabilities don't
 * transitively contain other capabilities in the schema — only effects).
 * Effects also don't transitively contain other effects. So this is a
 * 3-deep walk, not recursive.
 */

// =============================================================================
// Types
// =============================================================================

export interface PrimitiveLinkShape {
  /** The primitive's numeric ID. */
  primitiveId: number;
  /** Optional per-link BU override. Falls back to primitive.buCost. */
  quantity?: number;
  /** Per-link primitive reference (carries buCost when joined). */
  primitive?: { id: number; buCost?: number | null };
}

export interface EffectLinkShape {
  effectId: string;
  /** Effect's own primitive links. */
  primitiveLinks?: PrimitiveLinkShape[];
}

export interface CapabilityLinkShape {
  capabilityId: string;
  /** Capability's direct primitive links. */
  primitiveLinks?: PrimitiveLinkShape[];
  /** Capability's effect links (each carrying primitiveLinks). */
  effectLinks?: EffectLinkShape[];
}

/**
 * Input shape for the helper. Any of the three arrays can be omitted.
 * Designed so callers can pass the raw row data from Drizzle (or the
 * sandbox library rows) without massaging.
 */
export interface TransitiveBuInput {
  primitiveLinks?: PrimitiveLinkShape[];
  capabilityLinks?: CapabilityLinkShape[];
  /** Direct effects (not inside a capability) — for items or capability-free heritage flows. */
  effectLinks?: EffectLinkShape[];
}

export interface TransitiveBuResult {
  /** Sum of buCost × quantity for every unique primitive, deduped. */
  transitiveBu: number;
  /** Count of unique primitives in the transitive closure. */
  transitiveCount: number;
  /** Unique primitive IDs in walk order (first-seen wins). */
  primitiveIds: number[];
}

// =============================================================================
// Implementation
// =============================================================================

export function computeTransitiveBu(
  input: TransitiveBuInput,
): TransitiveBuResult {
  const seen = new Set<number>();
  const primitiveIds: number[] = [];
  let transitiveBu = 0;

  function consider(link: PrimitiveLinkShape): void {
    const id = link.primitiveId;
    if (!Number.isInteger(id) || id <= 0) return;
    if (seen.has(id)) return;
    seen.add(id);
    primitiveIds.push(id);
    const unitCost = link.primitive?.buCost ?? 0;
    const qty = link.quantity ?? 1;
    // Negative buCost is allowed (some primitives are credits — e.g.
    // a "vulnerability" primitive that gives you a discount). Sum
    // signed values so credits subtract from the gross cost.
    transitiveBu += (unitCost ?? 0) * qty;
  }

  // Step 1: direct primitives.
  for (const link of input.primitiveLinks ?? []) {
    consider(link);
  }
  // Step 2: primitives from each capability.
  for (const cap of input.capabilityLinks ?? []) {
    for (const link of cap.primitiveLinks ?? []) {
      consider(link);
    }
    // Step 3: primitives from each capability's effects.
    for (const eff of cap.effectLinks ?? []) {
      for (const link of eff.primitiveLinks ?? []) {
        consider(link);
      }
    }
  }
  // Step 4: direct effects (rare; for items that bundle effects).
  for (const eff of input.effectLinks ?? []) {
    for (const link of eff.primitiveLinks ?? []) {
      consider(link);
    }
  }

  return {
    transitiveBu,
    transitiveCount: primitiveIds.length,
    primitiveIds,
  };
}