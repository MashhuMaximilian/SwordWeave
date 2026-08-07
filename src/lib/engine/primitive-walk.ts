/**
 * Primitive modifier walk helpers — Phase 8.I i2 finish (Mashu 2026-08-06).
 *
 * Given a character's primitiveLinks, walk each primitive's
 * hardModifiers and sum the contributions for a given target axis.
 *
 * Used by aggregateCharacterSheet to:
 *   - Resolve attribute modifiers (target: attribute.<attr>)
 *   - Resolve defense_dc modifiers (target: defense_dc.<attr>)
 *   - Resolve saving_throw modifiers (target: saving_throw.<attr>)
 *   - Resolve save_dc modifiers (target: save_dc.<attr>)
 *   - Resolve speed modifiers (target: speed.<locomotion>)
 *   - Resolve carry_capacity, load, equip_slot, size, etc.
 *
 * The walk is generic — pass any axis prefix like "attribute" or
 * "defense_dc" and the helper returns a per-sub-target contribution
 * map. Mirror flag inverts the sign per the canonical mirror spec.
 *
 * Phase 8.I i2.6 (Mashu 2026-08-06): the condition context flows
 * through so per-practice dynamic predicates (like `actor:not_proficient`)
 * resolve correctly. For non-practice axes, the condition is
 * evaluated once at the character's level.
 */
import type { ConditionContext } from "@/lib/engine/condition-evaluator";
import { evaluateCondition } from "@/lib/engine/condition-evaluator";

/**
 * The shapes we read off each hardModifier. We don't import the full
 * Modifier type to keep this file's dependency footprint small — the
 * sheet's primitiveLinks carry raw `hardModifiers` from the DB.
 */
interface RawHardModifier {
  readonly target?: unknown;
  readonly targetAxis?: unknown;
  readonly targetKey?: unknown;
  readonly operation?: unknown;
  readonly value?: unknown;
  readonly condition?: unknown;
  readonly metadata?: unknown;
}

interface PrimitiveLinkInput {
  readonly primitive: {
    readonly id?: unknown;
    readonly name?: unknown;
    readonly category?: unknown;
    readonly buCost?: unknown;
    readonly hardModifiers?: readonly unknown[];
  };
  readonly isMirrored?: unknown;
}

export interface AxisContribution {
  /** Numeric total (after mirror sign inversion + condition filter). */
  readonly total: number;
  /** Per-modifier contributions for the modal's "primitive contributions" trace. */
  readonly contributions: ReadonlyArray<{
    readonly primitiveId: number;
    readonly primitiveName: string;
    readonly delta: number;
    readonly operation: string;
    readonly target: string;
    readonly mirrored: boolean;
  }>;
}

/**
 * Walk every primitiveLink's hardModifiers and sum contributions
 * that target the given axis + sub-target.
 *
 * @param primitiveLinks  the character's primitiveLinks
 * @param axis            target axis prefix (e.g. "attribute", "defense_dc")
 * @param subTarget       sub-target value (e.g. "physical", "mental", "magical")
 *                        Pass `null` to match any sub-target on that axis.
 * @param conditionContext optional condition context for evaluating
 *                         per-modifier conditions (i2.6).
 */
export function walkPrimitiveContributionsForAxis(
  primitiveLinks: readonly PrimitiveLinkInput[],
  axis: string,
  subTarget: string | null,
  conditionContext?: ConditionContext,
): AxisContribution {
  let total = 0;
  const contributions: Array<{
    primitiveId: number;
    primitiveName: string;
    delta: number;
    operation: string;
    target: string;
    mirrored: boolean;
  }> = [];

  for (const link of primitiveLinks) {
    const mods = Array.isArray(link.primitive?.hardModifiers)
      ? (link.primitive.hardModifiers as readonly RawHardModifier[])
      : [];
    const isMirrored = link.isMirrored === true;

    for (const rawMod of mods) {
      const target = String(rawMod.target ?? "");
      const targetAxis = String(rawMod.targetAxis ?? "");
      const targetKey = String(rawMod.targetKey ?? "");
      const op = String(rawMod.operation ?? "");
      const value = Number(rawMod.value);
      if (!Number.isFinite(value)) continue;

      // Match the axis prefix.
      // E.g. axis="attribute" matches targets like "attribute.physical",
      // "attribute.mental", "attribute.magical".
      // The axis comes from either `target` (legacy "attribute.physical")
      // or `targetAxis` + `targetKey` (i2.7 split form).
      let matchedSub: string | null = null;
      const dotIdx = target.indexOf(".");
      if (dotIdx > 0) {
        const candidateAxis = target.slice(0, dotIdx);
        const candidateSub = target.slice(dotIdx + 1);
        if (candidateAxis === axis) matchedSub = candidateSub;
      }
      if (matchedSub === null && targetAxis === axis && targetKey.length > 0) {
        matchedSub = targetKey;
      }
      if (matchedSub === null) continue;
      if (subTarget !== null && matchedSub !== subTarget) continue;

      // Operations we sum into numeric contributions.
      let delta = 0;
      if (op === "add") delta = value;
      else if (op === "subtract") delta = -value;
      else if (op === "set") delta = value - 0; // sets override; caller handles
      else continue;

      // Mirror sign inversion per canonical mirror spec.
      if (isMirrored) delta = -delta;

      // Condition filter (i2.6 — per-modifier condition).
      if (
        conditionContext !== undefined &&
        rawMod.condition !== undefined &&
        rawMod.condition !== null
      ) {
        const ok = evaluateCondition(
          rawMod.condition as Parameters<typeof evaluateCondition>[0],
          conditionContext,
        );
        if (!ok) continue;
      }

      total += delta;
      contributions.push({
        primitiveId: Number(link.primitive?.id ?? 0),
        primitiveName: String(link.primitive?.name ?? "Unknown"),
        delta,
        operation: op,
        target,
        mirrored: isMirrored,
      });
    }
  }

  return { total, contributions };
}

/**
 * Convenience: walk primitive modifiers for a specific target and
 * return just the total number (no provenance).
 */
export function sumPrimitiveContributions(
  primitiveLinks: readonly PrimitiveLinkInput[],
  axis: string,
  subTarget: string | null,
  conditionContext?: ConditionContext,
): number {
  return walkPrimitiveContributionsForAxis(
    primitiveLinks,
    axis,
    subTarget,
    conditionContext,
  ).total;
}
