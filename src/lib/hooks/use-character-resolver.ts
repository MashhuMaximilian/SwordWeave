/**
 * use-character-resolver.ts — Phase 8.3f S4 (Mashu 2026-07-28)
 *
 * Memoized character modifier resolver hook. Builds a
 * `ResolvedCharacterInput` from the sheet's primitiveLinks +
 * heritageLinks + character metadata, runs the S1 resolver, and
 * returns the totals + per-target attribution.
 *
 * Replaces the presentation-time approximation in
 * `attribute-modifier-delta.ts`. The hook is used by:
 *   - BottomStickyBar (attr modifiers + saves)
 *   - VitalityCard (max vitality)
 *   - ProvenanceModal (per-target attribution)
 *
 * Memoization: depends on the prop refs. When the sheet re-renders
 * with new data, the resolver re-runs. Stable across re-renders
 * when props are stable (Next.js server props should be stable).
 */

import { useMemo } from "react";
import type { HardModifier } from "@/types/swordweave";
import {
  type ResolvedCharacterInput,
  type ResolvedModifiers,
  type ResolvedPrimitiveSlot,
  resolveModifiers,
} from "@/lib/engine/resolve-modifiers";
import type { ConditionContext } from "@/lib/engine/condition-evaluator";

// =============================================================================
// Public types
// =============================================================================

export interface UseCharacterResolverInput {
  characterId: string;
  level: number;
  pb: number;
  proficientAttribute: "physical" | "mental" | "magical" | null;
  attributes: {
    physical: number;
    mental: number;
    magical: number;
  };
  primitiveLinks: ReadonlyArray<{
    primitiveId: number;
    isMirrored: boolean;
    originHeritageId: string | null;
    originCapabilityId: string | null;
    originEffectId: string | null;
    isToggledOff: boolean;
    primitive: {
      id: number;
      name: string;
      category: string;
      isMirrorable: boolean;
      mirrorVector: string | null;
      hardModifiers: readonly unknown[];
    };
  }>;
  /** Phase 8.I i3: optional runtime context for condition evaluation. */
  conditionContext?: ConditionContext | null;
  /**
   * Optional lookup for provenance display. Maps primitiveId
   * → { heritageName, capabilityName, effectName }. Used to
   * humanize the per-target attribution list in the provenance
   * modal.
   */
  sourceNames?: ReadonlyMap<
    number,
    {
      heritageName: string | null;
      capabilityName: string | null;
      effectName: string | null;
      accordion: string | null;
    }
  >;
}

export interface UseCharacterResolverResult {
  /** Resolved totals per target. */
  totals: ResolvedModifiers["totals"];
  /** Per-target attribution list. */
  byTarget: ResolvedModifiers["byTarget"];
  /** Mirror cost attribution (e.g. extra strain). */
  mirrorCosts: ResolvedModifiers["mirrorCosts"];
  /** ISO timestamp of when the resolver ran (used for cache key
   * debugging + the "computed" footer in the ProvenanceModal). */
  computedAt: ResolvedModifiers["computedAt"];
}

// =============================================================================
// Hook
// =============================================================================

export function useCharacterResolver(
  input: UseCharacterResolverInput,
): UseCharacterResolverResult {
  return useMemo(() => {
    const slots: ResolvedPrimitiveSlot[] = input.primitiveLinks.map((link) => ({
      primitiveId: link.primitive.id,
      name: link.primitive.name,
      category: link.primitive.category,
      hardModifiers: (link.primitive.hardModifiers ?? []) as readonly HardModifier[],
      isMirrored: link.isMirrored,
      isMirrorable: link.primitive.isMirrorable,
      mirrorVector: link.primitive.mirrorVector,
      originHeritageId: link.originHeritageId,
      originCapabilityId: link.originCapabilityId,
      originEffectId: link.originEffectId,
      isToggledOff: link.isToggledOff ?? false,
    }));

    const resolverInput: ResolvedCharacterInput = {
      characterId: input.characterId,
      level: input.level,
      pb: input.pb,
      proficientAttribute: input.proficientAttribute,
      attributes: input.attributes,
      slots,
      conditionContext: input.conditionContext ?? null,
    };

    const r = resolveModifiers(resolverInput, input.sourceNames);
    return {
      totals: r.totals,
      byTarget: r.byTarget,
      mirrorCosts: r.mirrorCosts,
      computedAt: r.computedAt,
    };
  }, [
    input.characterId,
    input.level,
    input.pb,
    input.proficientAttribute,
    input.attributes.physical,
    input.attributes.mental,
    input.attributes.magical,
    input.primitiveLinks,
    input.sourceNames,
  ]);
}