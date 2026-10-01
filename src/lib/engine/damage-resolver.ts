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
import { evaluateCondition, isConditionComputable, type ConditionContext } from "./condition-evaluator";
import type { ModifierCondition } from "@/types/condition";
import { hasMeaningfulCondition } from "./condition-dictionary";

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
  let multiplier = 1;
  const contributions: Array<{
    primitiveId: number;
    primitiveName: string;
    multiplier: number;
    target: string;
  }> = [];

  type Link = {
    primitive?: { id?: number; name?: string; hardModifiers?: unknown };
    isMirrored?: boolean;
    isToggledOff?: boolean;
  };
  const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
  for (const link of input.primitiveLinks as readonly Link[]) {
    if (link.isToggledOff) continue;
    const mods = Array.isArray(link.primitive?.hardModifiers) ? link.primitive.hardModifiers : [];
    for (const raw of mods) {
      const mod = record(raw);
      const target = String(mod["target"] ?? mod["targetAxis"] ?? "");
      const [axis, ...suffix] = target.split(".");
      const meta = record(mod["metadata"]);
      const scope = record(meta["targetScope"]);
      const scopes = suffix.length ? [suffix.join(".")] :
        Array.isArray(scope["values"]) && scope["values"].length ? scope["values"] :
        [meta["scopeName"] ?? mod["targetKey"] ?? ""];
      // Missing scope must never turn a named resistance into universal immunity.
      if (!scopes.some(value => [input.type.trim().toLowerCase(), "all", "*"].includes(String(value).trim().toLowerCase()))) continue;

      const token = record(mod["value"]);
      let value: number | undefined;
      if (axis === "damage_modifier" && mod["operation"] === "multiply") {
        const rawValue = token["kind"] === "number" ? token["value"] : mod["value"];
        if (typeof rawValue === "number" || (typeof rawValue === "string" && rawValue.trim() !== "")) value = Number(rawValue);
      } else if (axis === "damage_type" && mod["operation"] === "grant" && (token["kind"] === "keyword" || token["kind"] === "behavior")) {
        // Compatibility for older resistance grants; ordinary damage-type access is not resistance.
        const keyword = String(token["text"] ?? token["value"] ?? token["name"] ?? "").replace(/^\[+|\]+$/g, "").trim().toLowerCase();
        value = ({ resistance: 0.5, vulnerability: 2, immunity: 0 } as Record<string, number>)[keyword];
      }
      if (value === undefined || !Number.isFinite(value) || value < 0) continue;
      const condition = mod["condition"] as ModifierCondition | undefined;
      if (hasMeaningfulCondition(condition)) {
        if (!input.conditionContext || !isConditionComputable(condition, input.conditionContext) || !evaluateCondition(condition, input.conditionContext)) continue;
      }
      const mirror = record(meta["mirror"]);
      const modMultiplier = link.isMirrored && !mirror["optedOut"] && value !== 0 ? 1 / value : value;
      multiplier *= modMultiplier;
      contributions.push({
        primitiveId: Number(link.primitive?.id ?? 0),
        primitiveName: String(link.primitive?.name ?? "Unknown"),
        multiplier: modMultiplier,
        target: `damage_modifier.${input.type.trim().toLowerCase()}`,
      });
    }
  }

  const final = Math.ceil(input.amount * multiplier);
  return { final, multiplier, contributions };
}
