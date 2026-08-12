/**
 * resolve-modifiers.ts — Phase 8.3f (Mashu 2026-07-28)
 *
 * Canonical character modifier resolver. The single source of truth
 * for "given this character's slotted primitives, what totals apply
 * to each target, and where did each value come from?"
 *
 * This wraps the existing `evaluateModifiers()` /
 * `applyStacking()` / `resolveMirrorEffect()` primitives from
 * `modifiers.ts` and `mirror.ts` — it does NOT reimplement them.
 * The new bits are:
 *
 *   1. A flat `ResolvedCharacterInput` shape that callers build
 *      from either the DB (server side) or the sheet props
 *      (client side).
 *   2. A `ResolvedModifiers` shape that returns BOTH the totals
 *      AND a per-target attribution list (every primitive that
 *      contributed, with op + value + condition state + source).
 *      Existing code returns only totals; the attribution list
 *      powers the click-through provenance modal.
 *   3. Mirror handling for slots where `isMirrorable=false` —
 *      the mirror is a no-op (the slot passes through as if not
 *      mirrored). This is a SAFE default the existing
 *      `attribute-modifier-delta.ts` already uses.
 *
 * Algorithm (per target):
 *   1. Walk every slot's `hardModifiers[]`.
 *   2. For each modifier whose target matches:
 *      a. If `isMirrored`, call `resolveMirrorEffect` to compute
 *         the post-mirror value (sign flip for VARIABLE_VECTOR,
 *         magnitude preserved for STRUCTURAL_FAULT /
 *         COST_INSTABILITY, pass-through for STANDARD_ONLY).
 *      b. If `isMirrorable=false` AND `isMirrored=true`, treat
 *         as pass-through (the mirror is opt-out safe default).
 *      c. Evaluate the condition. If it fails, skip.
 *      d. Apply the operation to a running base. Add an
 *         attribution entry.
 *   3. If multiple modifiers hit the same target, apply the
 *     stacking mode from the first modifier (canonical default
 *     = "stack"). This matches `evaluateModifiers` so the
 *     totals are equivalent.
 *
 * For now the resolver exposes the same totals as
 * `evaluateModifiers()`. The difference is the attribution list,
 * which the existing engine does not produce.
 */

import type { HardModifier, JsonValue } from "@/types/swordweave";
import {
  type EvaluationContext,
  type AppliedModifierTrace,
  evaluateModifiers,
  applyOperation,
  applyStacking,
} from "./modifiers";
import { resolveMirrorEffect } from "./mirror";
import {
  MODIFIER_TARGET_SPEC,
  type ModifierTarget,
} from "@/lib/primitives/modifier-scope";
import {
  isModifierValid,
  type ModifierDraftForValidation,
} from "@/lib/primitives/modifier-validator";
import {
  resolveValue,
  isTypedToken,
  type ResolveContext,
} from "./runtime-resolver";
import { resolveEquation } from "./equation-resolver";
import {
  evaluateCondition,
  isConditionComputable,
  type ConditionContext,
} from "./condition-evaluator";

// =============================================================================
// Public types
// =============================================================================

/**
 * A primitive slot as the resolver needs it. Built by the caller
 * (DB query on the server, sheet-prop adapter on the client).
 *
 * Provenance fields (`originHeritageId` / `originCapabilityId` /
 * `originEffectId`) power the attribution display. Direct slots
 * have all three = null.
 */
export interface ResolvedPrimitiveSlot {
  readonly primitiveId: number;
  readonly name: string;
  readonly category: string;
  readonly hardModifiers: readonly HardModifier[];
  readonly isMirrored: boolean;
  readonly isMirrorable: boolean;
  readonly mirrorVector: string | null;
  readonly originHeritageId: string | null;
  readonly originCapabilityId: string | null;
  readonly originEffectId: string | null;
  /** Phase 8.L round 13 (Mashu): slotTab is the accordion
   *  name (Lineage / Upbringing / Manifest) of the
   *  capability this primitive belongs to. */
  readonly slotTab?: string | null;
  /** Phase 8.I i3 (Mashu): if true, this cap is toggled OFF and its
   *  modifiers are suppressed in the resolver. */
  readonly isToggledOff?: boolean;
}

export interface ResolvedCharacterInput {
  readonly characterId: string;
  readonly level: number;
  readonly pb: number;
  readonly proficientAttribute: "physical" | "mental" | "magical" | null;
  /** Phase 8.M (Mashu 2026-08-12): when set, the SINGLE attack_bonus
   *  and save_dc are computed from this attribute instead of
   *  proficientAttribute. Used by the modal selector when a
   *  character has multi-attribute proficiency. */
  readonly chosenAttribute?: "physical" | "mental" | "magical";
  readonly attributes: {
    readonly physical: number;
    readonly mental: number;
    readonly magical: number;
  };
  readonly slots: readonly ResolvedPrimitiveSlot[];
  /** Phase 8.I i3: runtime condition context for evaluating per-modifier
   *  conditions. When provided, modifiers with conditions that evaluate
   *  false are suppressed. When omitted (undefined), all modifiers fire
   *  regardless of condition (pre-i3 behavior). */
  readonly conditionContext?: ConditionContext | null;
}

/**
 * One row of attribution: which primitive contributed what to
 * which target, and what happened (op, value, condition state).
 */
export interface ModifierContribution {
  readonly target: string;
  readonly primitiveId: number;
  readonly primitiveName: string;
  readonly primitiveCategory: string;
  readonly op: HardModifier["operation"];
  /** Value AFTER the op is applied to a zero base (i.e. just the
   *  contribution, not the running total). */
  readonly value: number;
  /**
   * Phase 8.L: original mod.value (preserves keyword objects, dice, etc).
   * The `value` field above is the resolved numeric value used for
   * sums; `rawValue` is the unmodified mod.value for UI formatting.
   */
  readonly rawValue?: unknown;
  /** Value BEFORE mirror (for display when the user wants to see
   *  the standard polarity). null when not mirrored. */
  readonly preMirrorValue: number | null;
  /** Phase 8.I i2.5: preserved keyword tags from equations
   *  (e.g. [fire], [piercing]). Empty for non-equation values. */
  readonly tags: readonly string[];
  /** True if the modifier's condition was satisfied. When
   *  conditionContext was not provided, always true (pre-i3
   *  behavior — all modifiers fire unconditionally). */
  readonly conditionActive: boolean;
  /** True if the modifier HAS a condition (for the * marker on
   *  the axis card). Separable from conditionActive: a modifier
   *  can have a condition that's currently true (active=true,
   *  hasCondition=true). */
  readonly hasCondition: boolean;
  /** Phase 8.I i3e: whether the condition is computable given the
   * available context. Non-computable (true) means the bonus is
   * included with a * marker. */
  readonly conditionComputable: boolean;
  /** Phase 8.I POST C1: raw condition for human-readable display. */
  readonly condition?: unknown;
  /** Phase 8.I POST C3: originCapabilityId lets the modal grey out
   * primitives whose capability is toggled OFF. */
  readonly originCapabilityId: string | null;
  readonly stacking: HardModifier["stacking"];
  readonly provenance: {
    readonly heritageName: string | null;
    readonly capabilityName: string | null;
    readonly effectName: string | null;
    /** Phase 8.L round 13 (Mashu): accordion name (Lineage /
     *  Upbringing / Manifest) of the capability this primitive
     *  belongs to. NULL for direct primitives. Used as the
     *  OUTERMOST prefix in the inheritance chain. */
    readonly accordion: string | null;
    /** "direct" | "heritage" | "capability" | "effect" — short
     *  label for the UI. */
    readonly kind: "direct" | "heritage" | "capability" | "effect";
  };
}

export interface ResolvedModifiers {
  /** Phase 8.M (Mashu 2026-08-12): which attribute the SINGLE
   *  attack_bonus / save_dc totals were computed from. UI uses
   *  this for the selector default. */
  chosenAttribute?: "physical" | "mental" | "magical";
  /** Final total per target. Keys are ModifierTarget strings
   *  (e.g. "character.attribute.physical"). Missing keys = no
   *  modifier touched that target. */
  readonly totals: Readonly<Record<string, number>>;
  /** Per-target list of every contribution. */
  readonly byTarget: Readonly<Record<string, readonly ModifierContribution[]>>;
  /** Mirror-vector attribution: when a mirrored slot contributes,
   *  this carries the user-side cost (e.g. extra strain). Empty
   *  when no mirrors are active. */
  readonly mirrorCosts: readonly MirrorCostAttribution[];
  /** Metadata for debugging / cache busting. */
  readonly computedAt: string;
}

export interface MirrorCostAttribution {
  readonly primitiveId: number;
  readonly primitiveName: string;
  readonly vector: string;
  readonly magnitude: number;
}

// =============================================================================
// Main resolver
// =============================================================================

/**
 * Resolve every modifier in the input against the current
 * character state. Pure function: no I/O, no DB. Returns both
 * totals and attribution.
 *
 * @param input Character state + slotted primitives.
 * @param sourceNames Optional lookup map for attribution display.
 *   Keys are primitiveId; values are {heritageName, capabilityName,
 *   effectName}. The resolver reads these when building
 *   `ModifierContribution.provenance`. If omitted, all source
 *   names default to null.
 */
export function resolveModifiers(
  input: ResolvedCharacterInput,
  sourceNames?: ReadonlyMap<
    number,
    {
      heritageName: string | null;
      capabilityName: string | null;
      effectName: string | null;
      accordion: string | null;
    }
  >,
): ResolvedModifiers {
  const byTarget: Record<string, ModifierContribution[]> = {};
  const totals: Record<string, number> = {};
  const mirrorCosts: MirrorCostAttribution[] = [];

  // Build the EvaluationContext for evaluateModifiers() so we get
  // parity with the existing engine.
  const context: EvaluationContext = {
    character: {
      id: input.characterId,
      level: input.level,
      attributes: input.attributes,
    },
    // capability / effect / environment default to undefined —
    // the resolver doesn't need them for stat math.
  };

  // Phase 8.I i2.5: typed-token resolution context. The
  // behaviorVariables map is mutated during Pass 1 as `set` ops
  // populate custom variables. Other modifiers in Pass 1 read
  // from this map through the snapshot passed to resolveValue.
  const behaviorVariables: Record<string, number> = {};
  const practices: Record<string, number> = {};
  // Phase 8.I TODO: thread the engine's practice roll-ups
  // (computeAllPracticeModifiers) into this map.
  const practiceRollUps = buildPracticeRollUps(input);
  for (const [k, v] of practiceRollUps.entries()) {
    practices[k] = v;
  }
  const resolveCtx: ResolveContext = {
    level: input.level,
    pb: input.pb,
    attributes: input.attributes as ResolveContext["attributes"],
    practices: practices as ResolveContext["practices"],
    behaviorVariables: behaviorVariables as ResolveContext["behaviorVariables"],
  };

  // ───────────────────────────────────────────────────────────────────
  // PASS 1 — collect behavior variables from `set` ops on behavior
  // targets. Phase 8.I i2.5: behavior values are populated by
  // primitives that target `behavior` (free-text) and call `set`.
  // They need to land in behaviorVariables BEFORE other modifiers
  // that read them (e.g. `add 1 to /blockValue/`).
  //
  // We also collect the modifier's settled value here so we can
  // apply ops uniformly in pass 2.
  //
  // For each modifier, we resolve:
  //   1. effect of mirror (if slot is mirrored)
  //   2. typed-token value (i2.5)
  //   3. behavior target routing (i2.5)
  // ───────────────────────────────────────────────────────────────────
  interface PassEntry {
    readonly slot: ResolvedPrimitiveSlot;
    readonly mod: HardModifier;
    readonly target: string;
    readonly effectiveValue: number;
    readonly preMirrorValue: number | null;
    readonly tags: readonly string[];
    /**
     * Phase 8.I i2.5 (Mashu 2026-08-05): per-sub-target keys for
     * scoped lookups. When a modifier has metadata.targetScope.values
     * (e.g. ["PHYSICAL"]), we emit BOTH a raw entry and one entry
     * per scoped key. This lets target-registry read either the
     * bare `attribute` lookup OR the scoped
     * `attribute.PHYSICAL` lookup and get the contribution.
     */
    readonly scopedTargets: readonly string[];
    readonly hasCondition: boolean;
    readonly conditionActive: boolean;
    readonly conditionComputable: boolean;
  }
  const entries: PassEntry[] = [];

  for (const slot of input.slots) {
    for (const mod of slot.hardModifiers) {
      if (!isEngineModifierValid(mod)) continue;

      const target = String(mod.target);

      // Phase 8.I i2.5: for behavior variables, before resolving
      // we need to know WHICH variable. The metadata carries
      // `behaviorName` (canonical) or the legacy `value` field.
      let behaviorName: string | null = null;
      if (target === "behavior") {
        const meta = mod.metadata as Record<string, JsonValue> | undefined;
        const nameVal = meta?.["behaviorName"];
        if (typeof nameVal === "string" && nameVal.trim().length > 0) {
          behaviorName = nameVal.trim();
        }
      }

      // Phase 8.I i2.5: typed-value resolution. If mod.value is
      // a typed token (PB chip, /physical/, blockValue, dice),
      // resolve against character state. Plain numbers stay.
      const ctx: ResolveContext = resolveCtx;

      // Mirror handling.
      let effectiveValue: number;
      let preMirrorValue: number | null = null;
      if (slot.isMirrored && slot.isMirrorable) {
        const mirror = resolveMirrorEffect(
          slot.mirrorVector ?? "STANDARD_ONLY",
          true,
          mod.value,
        );
        effectiveValue = numericValue(mirror.targetValue);
        preMirrorValue = numericValue(mod.value);
        if (mirror.userCost?.kind === "extra_strain") {
          mirrorCosts.push({
            primitiveId: slot.primitiveId,
            primitiveName: slot.name,
            vector: mirror.vector,
            magnitude: mirror.userCost.magnitude,
          });
        }
      } else {
        effectiveValue = numericValue(mod.value);
      }

      // Phase 8.I i2.5: value resolution. Three paths:
      //   1. Equation (metadata.operands present): walk operands,
      //      resolve each token, apply operators. Returns a
      //      number + tags.
      //   2. Typed token (mod.value is a ValueToken object):
      //      resolve against character state via resolveValue.
      //   3. Plain number / string: pass through.
      const meta = mod.metadata as Record<string, unknown> | undefined;
      const operandsRaw = meta?.["operands"];
      let resolvedValue: number;
      let equationTags: readonly string[] = [];
if (Array.isArray(operandsRaw) && operandsRaw.length > 0) {
        // Equation path. The runtime resolver reads each operand
        // and applies operators recursively (handles paren
        // groups, keyword tags, mixed expressions like
        // "PB + (level / 4) [fire]".
const eq = resolveEquation(operandsRaw as never, ctx);
        resolvedValue = eq.numeric;
        equationTags = eq.tags;
      } else if (Array.isArray(mod.value) && mod.value.length > 0) {
        // Phase 8.I i3: equation stored directly in mod.value
        // (no metadata.operands wrapper). Resolve via resolveEquation.
        const eq = resolveEquation(mod.value as never, ctx);
        resolvedValue = eq.numeric;
        equationTags = eq.tags;
      } else if (
        // Phase 8.L: equation stored as {kind:"equation", operands:[...], tag:"fire"}
        // in mod.value directly. The UI form uses this canonical shape.
        // MUST come BEFORE isTypedToken check because isTypedToken
        // returns true for any object with a string kind field
        // (it doesn't filter to known ValueToken kinds).
        mod.value && typeof mod.value === "object" &&
        (mod.value as { kind?: string }).kind === "equation"
      ) {
        const eqV = mod.value as { operands?: unknown[]; tag?: string };
        const ops = Array.isArray(eqV.operands) ? eqV.operands : [];
        if (ops.length > 0) {
          const eq = resolveEquation(ops as never, ctx);
          resolvedValue = eq.numeric;
          equationTags = eqV.tag ? [eqV.tag] : eq.tags;
        } else {
          resolvedValue = effectiveValue;
        }
      } else if (isTypedToken(mod.value)) {
        resolvedValue = resolveValue(mod.value, ctx);
      } else {
        resolvedValue = effectiveValue;
      }

      // Compute scoped targets from metadata.targetScope.values
      // (Phase 8.I i2.5). The form stores targetScope with a
      // values array (e.g. ["PHYSICAL"] or ["PROWESS"]) — usually
      // uppercase. The engine's target-registry looks up scoped
      // keys in LOWERCASE (e.g. "attribute.physical", not
      // "attribute.PHYSICAL"). We normalize to lowercase here
      // so the byTarget key matches.
      const scopedValues = (mod.metadata as Record<string, unknown> | undefined);
      let scopedValuesList: string[] = [];
      if (scopedValues && typeof scopedValues === "object") {
        const scope = scopedValues["targetScope"];
        if (scope && typeof scope === "object") {
          const values = (scope as Record<string, unknown>)["values"];
          if (Array.isArray(values)) {
            scopedValuesList = values
              .filter((v): v is unknown => v !== null && v !== undefined)
              .map((v) => String(v).toLowerCase());
          }
        }
      }

      // Phase 8.I i3 (Mashu): condition evaluation + cap toggling.
      // When conditionContext is provided, evaluate the modifier's
      // condition against it. If it fails, the modifier's VALUE is
      // suppressed (not applied to totals) but the attribution entry
      // is still emitted so the modal can show "condition not met".
      // When the slot's cap is toggled off, skip entirely (no entry).
      const conditionContext = input.conditionContext;
      let conditionActive = true;
      const hasCondition = !!mod.condition;
      // i3e: distinguish computable vs non-computable conditions.
      // - Computable + true → include (active)
      // - Computable + false → suppress value, keep attribution
      // - Non-computable → include + show * (can't resolve at sheet time)
      let conditionComputable = true;
      if (conditionContext && mod.condition) {
        conditionComputable = isConditionComputable(mod.condition as import("@/types/condition").ModifierCondition, conditionContext);
        conditionActive = conditionComputable
          ? evaluateCondition(mod.condition as import("@/types/condition").ModifierCondition, conditionContext)
          : true; // non-computable → include the bonus
      }
      // Cap toggle suppresses the modifier entirely (no attribution).
      if (slot.isToggledOff) continue;

      // ---- Behavior variable collection (Pass 1) ---------------
      if (target === "behavior" && behaviorName !== null) {
        // Apply the op to the existing variable (default 0).
        const prev = behaviorVariables[behaviorName] ?? 0;
        const next = applyOperation(prev, mod.operation, resolvedValue);
        behaviorVariables[behaviorName] = numericOr(
          next,
          prev,
        );
        // The byTarget key is "behavior.<name>" (not "behavior")
        // so multiple behaviors don't collide.
        entries.push({
          slot,
          mod,
          target: `behavior.${behaviorName}`,
          effectiveValue: resolvedValue,
          preMirrorValue,
          tags: equationTags,
          scopedTargets: scopedValuesList.map((v) => `behavior.${v}`),
          conditionActive,
          hasCondition,
          conditionComputable,
        });
      } else {
        entries.push({
          slot,
          mod,
          target,
          effectiveValue: resolvedValue,
          preMirrorValue,
          tags: equationTags,
          scopedTargets: scopedValuesList.map((v) => `${target}.${v}`),
          conditionActive,
          hasCondition,
          conditionComputable,
        });
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // PASS 2 — apply the resolved values to totals + byTarget.
  // Phase 8.I i2.5 (Mashu 2026-08-05): when the modifier has
  // scoped sub-targets (metadata.targetScope.values), we emit
  // entries for BOTH the raw target AND each scoped key. The
  // fast-path lookups (resolveAttributeModifier, etc.) use the
  // scoped form; legacy callers read the raw target.
  // ----------------------------------------------------------------─
  for (const entry of entries) {
    const { slot, mod, target, effectiveValue, preMirrorValue, tags, scopedTargets, hasCondition, conditionActive, conditionComputable } = entry;
    // Phase 8.I POST C1: capture the raw condition for readable display.
    const conditionRaw = mod.condition ?? null;

    if (!Number.isFinite(effectiveValue)) continue;

    // Build the list of all byTarget keys this contribution
    // lands on: the raw target + any scoped sub-target keys.
    const allTargets = [target, ...scopedTargets];

    for (const t of allTargets) {
      const list = byTarget[t] ?? [];
      list.push({
        target: t,
        primitiveId: slot.primitiveId,
        primitiveName: slot.name,
        primitiveCategory: slot.category,
        op: mod.operation,
        value: effectiveValue,
        rawValue: mod.value,
        preMirrorValue,
        tags,
        // Phase 8.I POST C1: pass the raw condition for human-readable
        // display via condition-dictionary.
        condition: conditionRaw,
        // Phase 8.I POST C3: pass originCapabilityId for OFF-cap detection.
        originCapabilityId: slot.originCapabilityId ?? null,
        // Phase 8.I i3: condition was already evaluated above.
        // conditionActive may be false (condition computable but not
        // met — modifier value suppressed). hasCondition tracks whether
        // the modifier has a condition for the * marker.
        conditionActive,
        hasCondition,
        conditionComputable,
        stacking: mod.stacking ?? "stack",
        provenance: {
          heritageName: sourceNames?.get(slot.primitiveId)?.heritageName ?? null,
          capabilityName: sourceNames?.get(slot.primitiveId)?.capabilityName ?? null,
          effectName: sourceNames?.get(slot.primitiveId)?.effectName ?? null,
          accordion: sourceNames?.get(slot.primitiveId)?.accordion ?? null,
          kind: deriveProvenanceKind(slot),
        },
      });
      byTarget[t] = list;

      // Phase 8.K K8: keyword grants (e.g. {kind:keyword, value:advantage})
      // on per-axis targets feed into the per-axis behavior counter.
      // The marker in the UI (⇈(N)) reads from this counter.
      if (mod.operation === "grant") {
        const v = mod.value;
        if (v && typeof v === "object" && (v as { kind?: string }).kind === "keyword") {
          const kw = (v as { value?: string }).value;
          if (kw === "advantage" || kw === "disadvantage") {
            // Increment per-axis adv/disadv counter
            const advKey = kw === "advantage" ? "advantage" : "disadvantage";
            const t2 = `behavior.${advKey}.${t}`;
            const list2 = byTarget[t2] ?? [];
            list2.push({
              target: t2,
              primitiveId: slot.primitiveId,
              primitiveName: slot.name,
              primitiveCategory: slot.category,
              op: "add",
              value: 1,
              rawValue: mod.value,
              preMirrorValue: null,
              tags: [],
              condition: conditionRaw,
              originCapabilityId: slot.originCapabilityId ?? null,
              conditionActive,
              hasCondition,
              conditionComputable,
              stacking: mod.stacking ?? "stack",
              provenance: {
                heritageName: sourceNames?.get(slot.primitiveId)?.heritageName ?? null,
                capabilityName: sourceNames?.get(slot.primitiveId)?.capabilityName ?? null,
                effectName: sourceNames?.get(slot.primitiveId)?.effectName ?? null,
                accordion: sourceNames?.get(slot.primitiveId)?.accordion ?? null,
                kind: deriveProvenanceKind(slot),
              },
            });
            byTarget[t2] = list2;
          }
        }
      }

      // Phase 8.I i2.8 (Mashu): max/min operations are ceiling/floor
      // LIMITS, not additive modifiers. They are recorded in the
      // attribution (byTarget) but skipped from the running total.
      // After all additive modifiers are summed, we apply the limits
      // as Math.min(total, max) and Math.max(total, min).
      if (mod.operation === "max" || mod.operation === "min") {
        continue;
      }

      const previousBase = totals[t] ?? 0;
      const nextBase = applyOperation(
        previousBase,
        mod.operation,
        effectiveValue,
      );
      totals[t] = numericOr(nextBase, previousBase);
      // Phase 8.I i3: if the modifier's condition was not active,
      // suppress its value from the totals (undo applyOperation).
      // byTarget attribution remains for the modal.
      if (!conditionActive) {
        totals[t] = previousBase;
      }
    }
  }

  // ---- Phase 8.I i2.8: apply max/min ceiling & floor limits ----
  // After additive stacking, apply any max (ceiling) or min (floor)
  // constraints. max → Math.min(total, value) (can't exceed)
  // min → Math.max(total, value) (can't go below)
  for (const target of Object.keys(byTarget)) {
    const contribs = byTarget[target];
    if (!contribs || contribs.length === 0) continue;
    let total = totals[target] ?? 0;
    const firstContrib = contribs[0];
    if (!firstContrib) continue;
    const stackingMode = firstContrib.stacking ?? "stack";

    // Apply stacking mode to additive contributions only.
    const additiveValues = contribs
      .filter((c) => c.op !== "max" && c.op !== "min")
      .map((c) => c.value);
    if (additiveValues.length > 0) {
      const stacked = applyStacking(
        additiveValues as readonly JsonValue[],
        stackingMode,
      );
      const stackedNum = numericValue(stacked);
      if (Number.isFinite(stackedNum)) {
        total = stackedNum;
      }
    }
    // Apply ceiling (max): total cannot exceed the max value.
    const maxValues = contribs
      .filter((c) => c.op === "max" && c.conditionActive)
      .map((c) => c.value);
    for (const v of maxValues) {
      total = Math.min(total, v);
    }
    // Apply floor (min): total cannot go below the min value.
    const minValues = contribs
      .filter((c) => c.op === "min" && c.conditionActive)
      .map((c) => c.value);
    for (const v of minValues) {
      total = Math.max(total, v);
    }
    totals[target] = total;
  }

  // Phase 8.M (Mashu 2026-08-12): expose a SINGLE attack_bonus
  // and save_dc target derived from the chosen attribute (defaults
  // to proficientAttribute; can be overridden by chosenAttribute).
  // Per-attr primitives targeting attack_bonus.<attr> or
  // defense_dc.<attr> contribute to the chosen attribute's
  // single target. UI renders one number with optional selector.
  const chosenAttr =
    input.chosenAttribute ?? input.proficientAttribute ?? ("physical" as const);

  // Mirror the scoped per-attr primitives into the SINGLE targets.
  // We DON'T re-attribute the contributions — we just point the
  // single-target byTarget list at the per-attr contributions.
  if (!byTarget["attack_bonus"]) {
    byTarget["attack_bonus"] = byTarget[`attack_bonus.${chosenAttr}`] ?? [];
  }
  if (!byTarget["save_dc"]) {
    byTarget["save_dc"] = byTarget[`defense_dc.${chosenAttr}`] ?? [];
  }

  // Compute the SINGLE totals using the chosen attribute's
  // contribution delta.
  const atkBase = totals[`attack_bonus.${chosenAttr}`] ?? 0;
  const saveBase = totals[`defense_dc.${chosenAttr}`] ?? 0;
  totals["attack_bonus"] = atkBase;
  totals["save_dc"] = saveBase;

  return {
    totals,
    byTarget,
    mirrorCosts,
    computedAt: new Date().toISOString(),
    chosenAttribute: chosenAttr,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * The provenance.kind short label.
 *  - "direct" → player slotted, no heritage origin
 *  - "heritage" → inherited from heritage's direct primitives
 *  - "capability" → inherited via a bundled capability
 *  - "effect" → inherited via an effect-of-capability
 */
function deriveProvenanceKind(
  slot: ResolvedPrimitiveSlot,
): ModifierContribution["provenance"]["kind"] {
  // Check most-specific provenance first. A slot can have multiple
  // origin fields set (e.g. capability + heritage both), so we pick
  // the deepest level. effect → capability → heritage → direct.
  if (slot.originEffectId !== null) return "effect";
  if (slot.originCapabilityId !== null) return "capability";
  if (slot.originHeritageId !== null) return "heritage";
  return "direct";
}

/**
 * Phase 8.I i2.5: build a practice roll-up map keyed by the FORM's
 * practice names (lowercase, from the chip stack). The engine's
 * practice math uses different keys (uppercase, from Notion).
 * We bridge by lowercasing engine keys. When the form's
 * "+awareness" chip is authored, the engine resolves the practice
 * value via this map. i2-finish will reconcile the canonical names.
 *
 * For i2.5 this is a stub: returns 0 for every practice. We rely
 * on the existing engine paths (computePracticeModifierAtLevel)
 * to populate practice totals via the byTarget map. The runtime
 * resolver's practice lookup is only used when an equation
 * references /awareness/ as a token in a value field.
 */
function buildPracticeRollUps(
  _input: ResolvedCharacterInput,
): Map<string, number> {
  // Phase 8.I TODO: thread the engine's practice roll-ups
  // (computeAllPracticeModifiers) into this map. For now, return
  // empty so unknown practice tokens resolve to 0.
  return new Map();
}

function numericValue(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return NaN;
}

function numericOr(v: unknown, fallback: number): number {
  const n = numericValue(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Phase 8.I i1 (Mashu 2026-08-04): engine-side drop rule for
 * modifiers with null sub-targets.
 *
 * Reads the modifier's target (short axis) and sub-target scope
 * (from `metadata.targetScope.values[]` or legacy dotted targets)
 * and calls the validator. If the modifier's target doesn't have
 * a known sub-target widget OR the sub-target is unspecified, the
 * modifier is silently dropped.
 *
 * Backward compat: returns true for unknown targets (legacy
 * dotted strings, custom behavior keys) — we can't safely reject
 * what we don't understand, so we pass them through and let
 * downstream filters handle them.
 */
function isEngineModifierValid(mod: HardModifier): boolean {
  const targetRaw = String(mod.target);

  // Build the validator input. Sub-target comes from
  // metadata.targetScope.values (canonical v7-E+ shape).
  // Legacy dotted targets like "character.attribute.physical"
  // carry the sub-target in the string itself — those are always
  // valid (single-attribute scope is explicit by construction).
  const scope = mod.metadata?.["targetScope"] as
    | { layer?: unknown; values?: unknown }
    | undefined;
  const values = Array.isArray(scope?.values)
    ? (scope!.values as unknown[]).map((v) => String(v))
    : [];

  // For free-text axes, the sub-target lives in metadata.behaviorName
  // (canonical) or the value field (legacy). If neither exists, drop.
  const spec = MODIFIER_TARGET_SPEC[targetRaw as ModifierTarget];
  if (!spec) return true; // Unknown / legacy → pass-through

  const behaviorName = mod.metadata?.["behaviorName"];
  // Phase 8.L: when target is `size` or `source_type` and the value
  // is a keyword token like {kind:"keyword", value:"large"}, lift
  // that string into targetValues so the checklist validator passes.
  let derivedValues = values;
  if (
    (targetRaw === "size" || targetRaw === "source_type") &&
    mod.value &&
    typeof mod.value === "object" &&
    (mod.value as { kind?: string }).kind === "keyword" &&
    typeof (mod.value as { value?: unknown }).value === "string"
  ) {
    derivedValues = [String((mod.value as { value: string }).value).toLowerCase()];
  }
  const draft: ModifierDraftForValidation = {
    target: targetRaw,
    targetValues: derivedValues,
    freeTextNarrowFocus:
      typeof behaviorName === "string" ? String(behaviorName) : "",
  };
  return isModifierValid(draft);
}

// =============================================================================
// Convenience: parity-check with evaluateModifiers()
// =============================================================================

/**
 * Sanity check: build a `HardModifier[]` from a resolved input
 * and run `evaluateModifiers()` directly. If this returns the
 * same totals as `resolveModifiers()`, the wrapper is correct.
 *
 * Use this in tests as a regression check.
 */
export function parityCheck(input: ResolvedCharacterInput): {
  wrapper: ResolvedModifiers;
  engine: ReturnType<typeof evaluateModifiers>;
  matches: boolean;
} {
  const wrapper = resolveModifiers(input);

  // Flatten to a HardModifier[] the engine understands.
  const flat: HardModifier[] = [];
  for (const slot of input.slots) {
    console.log("[DBG_LOOP] slot:", slot.name, "mods:", slot.hardModifiers.length);
    for (const mod of slot.hardModifiers) {
      if (slot.isMirrored && slot.isMirrorable) {
        // Apply mirror to the value (and op if needed).
        const mirror = resolveMirrorEffect(
          slot.mirrorVector ?? "STANDARD_ONLY",
          true,
          mod.value,
        );
        flat.push({ ...mod, value: mirror.targetValue });
      } else {
        flat.push(mod);
      }
    }
  }

  const context: EvaluationContext = {
    character: {
      id: input.characterId,
      level: input.level,
      attributes: input.attributes,
    },
  };

  const engine = evaluateModifiers(flat, context);

  // Compare every target that either produced.
  const allTargets = new Set([
    ...Object.keys(wrapper.totals),
    ...Object.keys(engine),
  ]);
  let matches = true;
  for (const t of allTargets) {
    const w = wrapper.totals[t] ?? 0;
    const e = numericValue(engine[t]);
    if (Math.abs(w - e) > 0.0001) {
      matches = false;
      break;
    }
  }

  return { wrapper, engine, matches };
}

// Re-export AppliedModifierTrace for callers that want the
// engine's native trace type.
export type { AppliedModifierTrace };

// 2026-08-12 rebuild marker: this file was last modified to force Vercel rebuild
