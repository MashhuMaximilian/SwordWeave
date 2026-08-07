/**
 * Damage resolution — Phase 8.I i2 finish (Mashu 2026-08-06).
 *
 * Per the Damage & Resistance canonical PDF:
 *   resistance:0.5x, vulnerability:2x, immunity:0x
 *
 * Given an incoming damage amount + type, walk the character's
 * primitive modifiers targeting `damage_modifier.<type>` and
 * apply the multipliers (multiply all matching contributions
 * together — resistance + vulnerability on the same damage type
 * stack multiplicatively, not additively).
 *
 * The author writes the modifier as:
 *   target=damage_modifier, sub_target=fire, op=multiply, value=0.5
 *
 * The engine multiplies the incoming damage by all matching
 * modifier values. Stacking semantics: multiplicative.
 *
 * Example:
 *   Incoming: 10 fire damage
 *   Primitives: resistance:fire (0.5x) + vulnerability:fire (2x)
 *   Final: 10 * 0.5 * 2 = 10 (they cancel)
 *
 *   Incoming: 10 fire damage
 *   Primitives: resistance:fire (0.5x) + resistance:fire (0.5x)
 *   Final: 10 * 0.5 * 0.5 = 2.5 (stacking halves)
 */
import { walkPrimitiveContributionsForAxis } from "./primitive-walk";
import type { ConditionContext } from "./condition-evaluator";

export interface ResolveDamageInput {
  /** Incoming damage amount (positive integer typically). */
  readonly amount: number;
  /** Damage type — matches damage_modifier.<type> sub-target. */
  readonly type: string;
  /** Character's primitive links (for modifier walk). */
  readonly primitiveLinks: ReadonlyArray<unknown>;
  /** Optional condition context for evaluating per-modifier conditions. */
  readonly conditionContext?: ConditionContext;
}

export interface ResolveDamageResult {
  /** Final damage after multipliers (rounded down to integer). */
  readonly final: number;
  /** Total multiplier applied (1.0 = no modifiers, 0.5 = resistance, 2.0 = vulnerability, 0 = immunity). */
  readonly multiplier: number;
  /** Per-primitive contributions for traceability. */
  readonly contributions: ReadonlyArray<{
    readonly primitiveId: number;
    readonly primitiveName: string;
    readonly multiplier: number;
    readonly target: string;
  }>;
}

/**
 * Resolve incoming damage against the character's modifier chain.
 *
 * Damage modifiers multiply: 0.5x for resistance, 2x for vulnerability,
 * 0x for immunity. Multiple modifiers on the same type stack
 * multiplicatively (per the Damage PDF).
 *
 * Mirrored damage modifiers invert the multiplier (resistance → 2x,
 * vulnerability → 0.5x) — same as other modifiers' sign inversion.
 */
export function resolveDamage(input: ResolveDamageInput): ResolveDamageResult {
  const axisWalk = walkPrimitiveContributionsForAxis(
    input.primitiveLinks as Parameters<typeof walkPrimitiveContributionsForAxis>[0],
    "damage_modifier",
    input.type.toLowerCase(),
    input.conditionContext,
  );

  // Each contribution's delta is a multiplier. The walk sums them
  // but we need to multiply, not sum. Re-walk to get raw multipliers.
  let multiplier = 1;
  const contributions: Array<{
    primitiveId: number;
    primitiveName: string;
    multiplier: number;
    target: string;
  }> = [];

  for (const link of input.primitiveLinks as Parameters<typeof walkPrimitiveContributionsForAxis>[0]) {
    const isMirrored = link.isMirrored === true;
    const mods = Array.isArray(link.primitive?.hardModifiers)
      ? (link.primitive.hardModifiers as Array<{
          target?: unknown;
          operation?: unknown;
          value?: unknown;
          condition?: unknown;
        }>)
      : [];

    for (const rawMod of mods) {
      const target = String(rawMod.target ?? "");
      const op = String(rawMod.operation ?? "");
      const value = Number(rawMod.value);
      if (!Number.isFinite(value)) continue;

      // Only multiply ops on damage_modifier.<type>.
      if (op !== "multiply") continue;
      const dotIdx = target.indexOf(".");
      if (dotIdx <= 0) continue;
      const candidateAxis = target.slice(0, dotIdx);
      const candidateSub = target.slice(dotIdx + 1);
      if (candidateAxis !== "damage_modifier") continue;
      if (candidateSub.toLowerCase() !== input.type.toLowerCase()) continue;

      let modMultiplier = value;
      // Mirror: invert the multiplier. Resistance (0.5) becomes
      // vulnerability (2), vulnerability (2) becomes resistance (0.5),
      // immunity (0) stays at 0.
      if (isMirrored) {
        modMultiplier = modMultiplier === 0 ? 0 : 1 / modMultiplier;
      }

      multiplier *= modMultiplier;
      contributions.push({
        primitiveId: Number(link.primitive?.id ?? 0),
        primitiveName: String(link.primitive?.name ?? "Unknown"),
        multiplier: modMultiplier,
        target,
      });
    }
  }

  const final = Math.floor(input.amount * multiplier);
  return { final, multiplier, contributions };
}
