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
   * Phase 8.L round 38 (Mashu 2026-08-13): capability + effect
   * toggles. Primitives originating under an OFF capability (or
   * OFF effect) are suppressed. Direct primitives (no origin
   * capability / effect) are unaffected.
   */
  offCapabilityIds?: ReadonlySet<string>;
  offEffectIds?: ReadonlySet<string>;
  /**
   * Phase 8.L round 49 (Mashu 2026-08-14): runtime conditions
   * (FAB scratchpad). Each active condition contributes its
   * modifiers as a synthetic primitive link so the resolver
   * sees them. The provenance will show the condition title
   * + origin = 'condition' so the user knows it came from the
   * scratchpad.
   */
  runtimeConditions?: ReadonlyArray<{
    readonly title: string;
    readonly active: boolean;
    readonly modifiers: readonly HardModifier[];
  }>;
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
  /** Phase 8.L round 57: behavior variables (set/add ops on
   * `behavior` free-text targets). Surfaced to the bottom card
   * so values like legendary_resistance render in the UI. */
  behaviorVariables: ResolvedModifiers["behaviorVariables"];
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
    const offCap = input.offCapabilityIds ?? new Set<string>();
    const offEff = input.offEffectIds ?? new Set<string>();

    // Phase 8.L round 49: runtime conditions become virtual slots.
    const conditionSlots: ResolvedPrimitiveSlot[] = (input.runtimeConditions ?? [])
      .filter((c) => c.active)
      .map((c, i) => ({
        primitiveId: -100000 - i,
        name: c.title || "Untitled condition",
        category: "RUNTIME_CONDITION",
        hardModifiers: (c.modifiers ?? []) as readonly HardModifier[],
        isMirrored: false,
        isMirrorable: false,
        mirrorVector: null,
        originHeritageId: null,
        originCapabilityId: null,
        originEffectId: null,
        isToggledOff: false,
      }));

    const slots: ResolvedPrimitiveSlot[] = input.primitiveLinks.map((link) => {
      // Phase 8.L round 38: derive live toggle state from the
      // localStorage-fed sets. A primitive is OFF when:
      //   - its parent capability is OFF, OR
      //   - its parent effect is OFF (effect toggle independent
      //     of capability toggle, per Q4)
      // Direct primitives (no origin capability/effect) are
      // always ON.
      const fromCapOff =
        link.originCapabilityId !== null &&
        offCap.has(link.originCapabilityId);
      const fromEffOff =
        link.originEffectId !== null &&
        offEff.has(link.originEffectId);
      const toggledOff = fromCapOff || fromEffOff;
      return {
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
        isToggledOff: (link.isToggledOff ?? false) || toggledOff,
      };
    });

    // Phase 8.L round 49: append the condition slots AFTER the
    // user-authored primitive links. The resolver sees them as
    // ordinary contributions.
    const allSlots: ResolvedPrimitiveSlot[] = [...slots, ...conditionSlots];

    const resolverInput: ResolvedCharacterInput = {
      characterId: input.characterId,
      level: input.level,
      pb: input.pb,
      proficientAttribute: input.proficientAttribute,
      attributes: input.attributes,
      slots: allSlots,
      conditionContext: input.conditionContext ?? null,
    };

    const r = resolveModifiers(resolverInput, input.sourceNames);
    return {
      totals: r.totals,
      byTarget: r.byTarget,
      mirrorCosts: r.mirrorCosts,
      behaviorVariables: r.behaviorVariables,
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
    input.offCapabilityIds,
    input.offEffectIds,
    input.runtimeConditions,
  ]);
}