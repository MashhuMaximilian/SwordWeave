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
  /**
   * Phase 8.L round 41 (Mashu 2026-08-13): true when this
   * contribution is suppressed because its parent capability or
   * effect is toggled OFF. The contribution is still emitted
   * so the modal can render it with an inhibited badge, but
   * it does NOT contribute to the totals.
   */
  readonly inhibited: boolean;
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
  /** Phase 8.L round 57: behavior variables populated by
   *  `set` / `add` ops targeting `behavior` (free-text). Keys
   *  are the user-supplied names (e.g. "legendary_resistance").
   *  Empty when no behavior modifiers fired. */
  readonly behaviorVariables: Readonly<Record<string, number>>;
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

  // Phase 8.L round 54 (Mashu 2026-08-14): SEED BASE ATTRIBUTES into
  // totals["attribute.X"] so multiply/divide work correctly. Without
  // this, the engine's applyOperation runs on totals=0, so `0 * 2 = 0`
  // wipes the base. With the seed, `4 * 2 = 8` correctly doubles the
  // attribute. The sheets that read these totals must use them
  // directly (not `props.attrX + totals[attribute.X]`) to avoid
  // double-counting the base.
  totals["attribute.physical"] = input.attributes.physical;
  totals["attribute.mental"] = input.attributes.mental;
  totals["attribute.magical"] = input.attributes.magical;
  // Phase 8.L round 55: seed proficiency_bonus with base PB so
  // "set" operations on PB actually REPLACE the value (instead of
  // adding on top of the sheet's separate level-based PB). Callers
  // must use totals["proficiency_bonus"] directly (not
  // proficiencyBonus(level) + totals[...]).
  totals["proficiency_bonus"] = input.pb;

  // Phase 8.L round 80: SEED attack_bonus, save_dc, AND the three
  // per-attribute saving throws. Without these seeds,
  // multiply/divide on any of these axes operate on delta=0
  // and produce meaningless results (0/x = 0).
  //
  // Per Mashu R80: "We have ONE save DC. ... Each attribute has
  // its own save (saving_throw) — that's why we have physical
  // save / mental save / magical save in action_roll."
  //
  // Saving throws = the modifier the PLAYER adds when THEY
  // roll to resist (e.g. DEX save against fireball). D&D 5e
  // baseline: d20 + PB + attribute modifier. No +8 (that's
  // only for save DC, the target enemies roll against).
  const chosenAttrForSeed =
    input.chosenAttribute ?? input.proficientAttribute ?? ("physical" as const);
  // Phase 8.L round 87 (reverted L84): the seed uses the
  // FULL attribute value (not the D&D modifier). The user's
  // formula for modifier is "base attribute + primitive
  // contributions" — the modifier value shown in the BSB
  // chip and modal IS the raw attribute, NOT (attr-10)/2.
  //
  // For attack_bonus: PB + chosen_attr_value + primitives
  // For save_dc: 8 + PB + chosen_attr_value + primitives
  // For saving throws: PB + per_attr_value + primitives
  //
  // The "modifier" terminology in the UI is misleading but
  // it's the convention this system uses. The D&D (attr-10)/2
  // formula does NOT apply here.
  const attrModForSeed = (a: "physical" | "mental" | "magical") =>
    a === "physical"
      ? (input.attributes.physical ?? 0)
      : a === "mental"
        ? (input.attributes.mental ?? 0)
        : (input.attributes.magical ?? 0);
  // Attack bonus = PB + chosen attribute (full value).
  const baseAttackBonus = input.pb + attrModForSeed(chosenAttrForSeed);
  // Save DC = 8 + PB + chosen attribute (full value).
  const baseSaveDc = 8 + input.pb + attrModForSeed(chosenAttrForSeed);
  totals["attack_bonus"] = baseAttackBonus;
  totals["save_dc"] = baseSaveDc;
  // Per-attribute: each scales with its own modifier, NOT chosenAttr.
  totals["attack_bonus.physical"] = input.pb + attrModForSeed("physical");
  totals["attack_bonus.mental"] = input.pb + attrModForSeed("mental");
  totals["attack_bonus.magical"] = input.pb + attrModForSeed("magical");
  totals["save_dc.physical"] = 8 + input.pb + attrModForSeed("physical");
  totals["save_dc.mental"] = 8 + input.pb + attrModForSeed("mental");
  totals["save_dc.magical"] = 8 + input.pb + attrModForSeed("magical");
  // Saving throws = (PB if proficient in this attribute) + per-attribute modifier.
  // Phase 8.L round 129 (Mashu 2026-08-26): save proficiency is
  // ATTRIBUTE-LINKED — you only get the +PB bonus on the save of
  // the attribute you're proficient in. Other saves use only
  // the raw attribute modifier. Previously every save got PB
  // unconditionally, which inflated non-prof saves and made
  // Proficient Save (a primitive that also adds PB) cause
  // double-counting on the prof save.
  const pbForSave = (attr: "physical" | "mental" | "magical") =>
    input.proficientAttribute === attr ? input.pb : 0;
  totals["physical_saving_throw"] = pbForSave("physical") + attrModForSeed("physical");
  totals["mental_saving_throw"] = pbForSave("mental") + attrModForSeed("mental");
  totals["magical_saving_throw"] = pbForSave("magical") + attrModForSeed("magical");

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
    /** Phase 8.L round 41: true when this entry is suppressed because
     * its parent capability or effect is toggled OFF. The entry is
     * still emitted to byTarget but doesn't contribute to totals. */
    readonly inhibited: boolean;
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
      // Phase 8.L round 53 (Mashu 2026-08-14): empty scope = "any
      // of the layer" = expand to all options on the target's
      // checklist. Without this, a modifier with target="attribute"
      // and no checked sub-targets lands on `totals["attribute"]`
      // (the parent) only — but the character card reads
      // `totals["attribute.physical"]` etc. The user expectation
      // is that no checkbox selected = "all". The expansion only
      // applies to targets with a checklist spec (e.g. attribute,
      // defense_dc, speed, skill_practice_check). For free-text
      // targets (behavior, scene_pace, etc.) the empty scope is
      // left as-is — the modifier still lands on the parent target.
      if (scopedValuesList.length === 0) {
        const targetSpec =
          MODIFIER_TARGET_SPEC[target as ModifierTarget];
        if (targetSpec && Array.isArray(targetSpec.options) && targetSpec.options.length > 0) {
          scopedValuesList = targetSpec.options.map((o) =>
            String(o).toLowerCase(),
          );
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
      // Phase 8.L round 41 (Mashu 2026-08-13): cap/effect toggle
      // marks the entry as `inhibited` instead of skipping
      // entirely. The entry is still added to byTarget so the
      // modal can render it with the (capability OFF) / (effect
      // OFF) badge, but Pass 2 skips the totals update.
      const slotInhibited: boolean = slot.isToggledOff ?? false;

      // ---- Behavior variable collection (Pass 1) ---------------
      // Support BOTH forms:
      //   1. Canonical: target="behavior" + metadata.behaviorName
      //   2. Dotted:    target="behavior.<name>" (primitives)
      // Both feed into the same behaviorVariables map so the
      // downstream consumer sees the combined total.
      let behaviorKey: string | null = null;
      if (target === "behavior") {
        behaviorKey = behaviorName;
      } else if (target.startsWith("behavior.")) {
        behaviorKey = target.slice("behavior.".length);
        if (behaviorKey.length === 0) behaviorKey = null;
      }
      if (behaviorKey !== null) {
        // Apply the op to the existing variable (default 0).
        const prev = behaviorVariables[behaviorKey] ?? 0;
        const next = applyOperation(prev, mod.operation, resolvedValue);
        behaviorVariables[behaviorKey] = numericOr(
          next,
          prev,
        );
        // The byTarget key is "behavior.<name>" (not "behavior")
        // so multiple behaviors don't collide.
        entries.push({
          slot,
          mod,
          target: `behavior.${behaviorKey}`,
          effectiveValue: resolvedValue,
          preMirrorValue,
          tags: equationTags,
          scopedTargets: scopedValuesList.map((v) => `behavior.${v}`),
          conditionActive,
          hasCondition,
          conditionComputable,
          inhibited: slotInhibited,
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
          inhibited: slotInhibited,
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
    // Phase 8.L round 41: inhibited contributions still land in
    // byTarget for display, but skip the totals update.
    const entryInhibited = (entry as { inhibited?: boolean }).inhibited === true;

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
        inhibited: entryInhibited,
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
          const kwRaw = (v as { text?: string; value?: string }).text
            ?? (v as { value?: string }).value
            ?? "";
          const kw = kwRaw.replace(/^\[+|\]+$/g, "").trim();
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
              inhibited: entryInhibited,
              provenance: {
                heritageName: sourceNames?.get(slot.primitiveId)?.heritageName ?? null,
                capabilityName: sourceNames?.get(slot.primitiveId)?.capabilityName ?? null,
                effectName: sourceNames?.get(slot.primitiveId)?.effectName ?? null,
                accordion: sourceNames?.get(slot.primitiveId)?.accordion ?? null,
                kind: deriveProvenanceKind(slot),
              },
            });
            byTarget[t2] = list2;
          } else if (kw === "proficiency_bonus" || kw === "pb" || kw === "proficiency") {
            // Phase 8.L round 132/134 (Mashu): keyword grant
            // \`[proficiency_bonus]\` / \`[proficiency]\` /
            // \`[pb]\` on an attribute target adds PB to that
            // attribute's saving throw. Materialized as
            // derived(pb) modifier on the corresponding save.
            if (t.startsWith("attribute.")) {
              const attr = t.slice("attribute.".length);
              const saveTarget = `${attr}_saving_throw`;
              const list3 = byTarget[saveTarget] ?? [];
              list3.push({
                target: saveTarget,
                primitiveId: slot.primitiveId,
                primitiveName: slot.name,
                primitiveCategory: slot.category,
                op: "add",
                value: input.pb,
                rawValue: mod.value,
                preMirrorValue: null,
                tags: [],
                condition: conditionRaw,
                originCapabilityId: slot.originCapabilityId ?? null,
                conditionActive,
                hasCondition,
                conditionComputable,
                stacking: mod.stacking ?? "stack",
                inhibited: entryInhibited,
                provenance: {
                  heritageName: sourceNames?.get(slot.primitiveId)?.heritageName ?? null,
                  capabilityName: sourceNames?.get(slot.primitiveId)?.capabilityName ?? null,
                  effectName: sourceNames?.get(slot.primitiveId)?.effectName ?? null,
                  accordion: sourceNames?.get(slot.primitiveId)?.accordion ?? null,
                  kind: deriveProvenanceKind(slot),
                },
              });
              byTarget[saveTarget] = list3;
            }
          } else if (kw === "expertise") {
            // Phase 8.L round 136 (Mashu): expertise keyword
            // ONLY adds PB when the target is ALREADY
            // proficient (primary prof attr OR another PB-grant
            // already on the same target). When blocked, the
            // contribution is skipped AND a one-time warning
            // is logged so the user can see why their
            // expertise primitive had no effect.
            if (t.startsWith("attribute.")) {
              const attr = t.slice("attribute.".length);
              const saveTarget = `${attr}_saving_throw`;
              const alreadyProf =
                input.proficientAttribute?.toLowerCase() === attr ||
                (byTarget[saveTarget] ?? []).some(
                  (c) =>
                    c.op === "add"
                    && c.value === input.pb
                    && !(c.tags ?? []).includes("expertise"),
                );
              if (alreadyProf) {
                const list3 = byTarget[saveTarget] ?? [];
                list3.push({
                  target: saveTarget,
                  primitiveId: slot.primitiveId,
                  primitiveName: slot.name,
                  primitiveCategory: slot.category,
                  op: "add",
                  value: input.pb,
                  rawValue: mod.value,
                  preMirrorValue: null,
                  tags: ["expertise"],
                  condition: conditionRaw,
                  originCapabilityId: slot.originCapabilityId ?? null,
                  conditionActive,
                  hasCondition,
                  conditionComputable,
                  stacking: mod.stacking ?? "stack",
                  inhibited: entryInhibited,
                  provenance: {
                    heritageName: sourceNames?.get(slot.primitiveId)?.heritageName ?? null,
                    capabilityName: sourceNames?.get(slot.primitiveId)?.capabilityName ?? null,
                    effectName: sourceNames?.get(slot.primitiveId)?.effectName ?? null,
                    accordion: sourceNames?.get(slot.primitiveId)?.accordion ?? null,
                    kind: deriveProvenanceKind(slot),
                  },
                });
                byTarget[saveTarget] = list3;
              } else {
                // Block the contribution and log a one-time
                // warning so the user understands why it
                // didn't fire.
                if (typeof window !== "undefined") {
                  try {
                    const wkey = `sw:expertise-blocked:${attr}:${slot.primitiveId}`;
                    if (!window.sessionStorage.getItem(wkey)) {
                      window.sessionStorage.setItem(wkey, "1");
                      const historyKey = "sw:expertise-warnings";
                      const existing = window.localStorage.getItem(historyKey);
                      const list = existing ? JSON.parse(existing) : [];
                      list.push({
                        at: Date.now(),
                        primitive: slot.name ?? "?",
                        attr,
                        msg: `Expertise (${attr}) only works when already proficient. Add a proficiency grant first.`,
                      });
                      window.localStorage.setItem(historyKey, JSON.stringify(list.slice(-20)));
                    }
                    // Mark the slot with a blocked-flag for the UI.
                    (slot as unknown as Record<string, unknown>)["__expertiseBlocked"] = `Add a proficiency grant on ${attr} first.`;
                  } catch {
                    // ignore
                  }
                }
              }
            }
          }
        }
      }

      // Phase 8.L round 134 (Mashu): grant + derived(pb |
      // expertise) on attribute target adds PB.
      // \`pb\` always works. \`expertise\` requires existing
      // proficiency on the same target — when missing, the
      // contribution is skipped and a one-time history
      // warning is logged.
      if (
        mod.operation === "grant"
        && mod.value
        && typeof mod.value === "object"
        && (mod.value as { kind?: string }).kind === "derived"
      ) {
        const which = (mod.value as { which?: string }).which ?? "";
        if (which === "pb" || which === "expertise") {
          if (t.startsWith("attribute.")) {
            const attr = t.slice("attribute.".length);
            const saveTarget = `${attr}_saving_throw`;
            // Phase 8.L round 136 (Mashu): `pb` grant always
            // works. `expertise` grant requires existing
            // prof — primary attr OR another PB-grant (not
            // expertise itself) on the same target. When
            // blocked we skip + log a one-time warning.
            if (which === "expertise") {
              const alreadyProf =
                input.proficientAttribute?.toLowerCase() === attr ||
                (byTarget[saveTarget] ?? []).some(
                  (c) =>
                    c.op === "add"
                    && c.value === input.pb
                    && !(c.tags ?? []).includes("expertise"),
                );
              if (!alreadyProf) {
                if (typeof window !== "undefined") {
                  try {
                    const wkey = `sw:expertise-blocked:${attr}:${slot.primitiveId}`;
                    if (!window.sessionStorage.getItem(wkey)) {
                      window.sessionStorage.setItem(wkey, "1");
                      const historyKey = "sw:expertise-warnings";
                      const existing = window.localStorage.getItem(historyKey);
                      const list = existing ? JSON.parse(existing) : [];
                      list.push({
                        at: Date.now(),
                        primitive: slot.name ?? "?",
                        attr,
                        msg: `Expertise (${attr}) only works when already proficient. Add a proficiency grant first.`,
                      });
                      window.localStorage.setItem(historyKey, JSON.stringify(list.slice(-20)));
                    }
                    (slot as unknown as Record<string, unknown>)["__expertiseBlocked"] = `Add a proficiency grant on ${attr} first.`;
                  } catch {
                    // ignore
                  }
                }
              } else {
                const list4 = byTarget[saveTarget] ?? [];
                list4.push({
                  target: saveTarget,
                  primitiveId: slot.primitiveId,
                  primitiveName: slot.name,
                  primitiveCategory: slot.category,
                  op: "add",
                  value: input.pb,
                  rawValue: mod.value,
                  preMirrorValue: null,
                  tags: ["expertise"],
                  condition: conditionRaw,
                  originCapabilityId: slot.originCapabilityId ?? null,
                  conditionActive,
                  hasCondition,
                  conditionComputable,
                  stacking: mod.stacking ?? "stack",
                  inhibited: entryInhibited,
                  provenance: {
                    heritageName: sourceNames?.get(slot.primitiveId)?.heritageName ?? null,
                    capabilityName: sourceNames?.get(slot.primitiveId)?.capabilityName ?? null,
                    effectName: sourceNames?.get(slot.primitiveId)?.effectName ?? null,
                    accordion: sourceNames?.get(slot.primitiveId)?.accordion ?? null,
                    kind: deriveProvenanceKind(slot),
                  },
                });
                byTarget[saveTarget] = list4;
              }
            } else {
              // which === "pb" always adds PB.
              const list4 = byTarget[saveTarget] ?? [];
              list4.push({
                target: saveTarget,
                primitiveId: slot.primitiveId,
                primitiveName: slot.name,
                primitiveCategory: slot.category,
                op: "add",
                value: input.pb,
                rawValue: mod.value,
                preMirrorValue: null,
                tags: [],
                condition: conditionRaw,
                originCapabilityId: slot.originCapabilityId ?? null,
                conditionActive,
                hasCondition,
                conditionComputable,
                stacking: mod.stacking ?? "stack",
                inhibited: entryInhibited,
                provenance: {
                  heritageName: sourceNames?.get(slot.primitiveId)?.heritageName ?? null,
                  capabilityName: sourceNames?.get(slot.primitiveId)?.capabilityName ?? null,
                  effectName: sourceNames?.get(slot.primitiveId)?.effectName ?? null,
                  accordion: sourceNames?.get(slot.primitiveId)?.accordion ?? null,
                  kind: deriveProvenanceKind(slot),
                },
              });
              byTarget[saveTarget] = list4;
            }
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
      // Phase 8.L round 46 (Mashu 2026-08-13): also suppress
      // INHIBITED contributions (cap/effect toggled OFF). The
      // byTarget entry is still emitted so the modal can render
      // it with the (⛔ Inhibited) badge, but the value is
      // not summed into totals. L41 missed this — the trace
      // filter handled the visual display but the totals kept
      // counting the inhibited value. Now both are aligned.
      if (entryInhibited) {
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

    // Phase 8.L round 51 (Mashu 2026-08-14): the additive
    // re-stacking loop used to run unconditionally here, but
    // it summed byTarget values WITHOUT consulting the
    // operation — so a subtract +1 condition was being treated
    // as add +1. PASS 2 already correctly applies each
    // modifier's operation via applyOperation, so we skip the
    // re-stacking when stackingMode === "stack" (the default).
    // For other modes ("highest-only" / "lowest-only" /
    // "unique-by-target" / "unique-by-primitive"), the stacking
    // is non-additive so we still need this branch.
    //
    // Phase 8.L round 47: also skip inhibited contributions.
    if (stackingMode !== "stack") {
      // Phase 8.L round 55: preserve the seeded base when stacking
      // non-additive (highest-only, lowest-only, replace,
      // unique-by-primitive, unique-by-target). The stacked value
      // represents THE modifier contribution (not the total), so
      // we add it to the base instead of replacing everything.
      //
      // To preserve the base, we need to know what the additive
      // sum of these modifiers would be (i.e. PASS 2's running
      // total minus the seed). We approximate by using the
      // sum of `c.value` (which is contribution AFTER op) as the
      // baseline delta to undo, then re-apply the stacked value
      // as the new delta. The seed is preserved by replacing
      // only the modifier contribution portion.
      const additiveValues = contribs
        .filter((c) => c.op !== "max" && c.op !== "min" && !c.inhibited)
        .map((c) => c.value);
      if (additiveValues.length > 0) {
        const additiveSum = additiveValues.reduce<number>(
          (acc, v) => acc + numericValue(v),
          0,
        );
        const stacked = applyStacking(
          additiveValues as readonly JsonValue[],
          stackingMode,
        );
        const stackedNum = numericValue(stacked);
        if (Number.isFinite(stackedNum)) {
          // Replace just the modifier contribution portion of total
          // (undo the additive sum PASS 2 would have computed, then
          // re-apply as stackedNum). The seed base stays.
          total = total - additiveSum + stackedNum;
        }
      }
    }
    // Apply ceiling (max): total cannot exceed the max value.
    // Phase 8.L round 47: also skip inhibited ceilings.
    // Phase 8.L round 67 (Mashu 2026-08-20): for skill_practice_check.*
    // targets, min/max are ROLL constraints (UI shows ⬆/⬇), NOT
    // modifier clamps. Clamping the displayed total hides the
    // effect of conditions on practices that fall below the floor
    // (e.g. exhausted -2 only visibly affects practices whose raw
    // total exceeds the floor). Skip clamping for these targets.
    const isPracticeTarget = target.startsWith("skill_practice_check");
    if (!isPracticeTarget) {
      const maxValues = contribs
        .filter((c) => c.op === "max" && c.conditionActive && !c.inhibited)
        .map((c) => c.value);
      for (const v of maxValues) {
        total = Math.min(total, v);
      }
      const minValues = contribs
        .filter((c) => c.op === "min" && c.conditionActive && !c.inhibited)
        .map((c) => c.value);
      for (const v of minValues) {
        total = Math.max(total, v);
      }
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

  // Phase 8.L round 80: ACTION_ROLL SUB-TARGET MIRRORING.
  //
  // Per Mashu R80: action_roll has 4 named sub-targets.
  // Each maps to its own user-facing display target:
  //
  //   ATTACK_ROLL      → attack_bonus (one number, scales with chosen attr)
  //   PHYSICAL_SAVE    → physical_saving_throw (player DEX save etc.)
  //   MENTAL_SAVE      → mental_saving_throw (player WIS save etc.)
  //   MAGICAL_SAVE     → magical_saving_throw (player INT save etc.)
  //
  // save_dc is its OWN target (not a sub of action_roll). It's the
  // ONE save DC enemies roll against, scaling with chosen attr.
  //
  // We derive the mapping from MODIFIER_TARGET_SPEC at runtime so
  // adding a new sub-target to the action_roll spec automatically
  // gets mirrored without code changes here.
  const actionRollSpec = MODIFIER_TARGET_SPEC["action_roll"] as
    | { options?: readonly string[] }
    | undefined;
  const actionRollOptions = actionRollSpec?.options ?? [];
  // Map each sub-target UPPER → user-facing display target name.
  const SUB_TARGET_TO_DISPLAY: Readonly<Record<string, string>> = {
    ATTACK_ROLL: "attack_bonus",
    PHYSICAL_SAVE: "physical_saving_throw",
    MENTAL_SAVE: "mental_saving_throw",
    MAGICAL_SAVE: "magical_saving_throw",
  };
  // Display targets to mirror into. Always attack_bonus (it's a
  // SINGLE number — no per-attr split). For saves, mirror into
  // EACH per-attr saving throw (so the user can have separate
  // bonuses for physical/mental/magical saves — like in D&D where
  // a spell affects DEX save differently from WIS save).
  const displayTargetsToMerge: string[] = ["attack_bonus"];
  for (const sub of actionRollOptions) {
    const disp = SUB_TARGET_TO_DISPLAY[sub];
    if (disp && disp !== "attack_bonus") {
      displayTargetsToMerge.push(disp);
    }
  }

  // Per-target merge: for each display target, collect all
  // relevant action_roll sub-target contributions PLUS any direct
  // legacy primitives (attack_bonus.<attr>, save_dc.<attr>,
  // defense_dc.<attr>).
  //
  // Phase 8.L round 81: This mirror runs AFTER PASS 2 (which has
  // already applied per-attr contributions + direct parent
  // contributions to the SEEDED totals). The mirror rebuilds
  // derived display totals like totals[save_dc] from
  // totals[save_dc.<chosenAttr>] so the card sees the unified
  // number.
  //
  // The CRITICAL bug fixed by L81: previously the mirror said
  // "don't overwrite if byTarget[save_dc] has any entry". But
  // the user's direct divide-3 condition was in byTarget[save_dc],
  // so mirror skipped, and totals[save_dc] stayed at 6 (18/3)
  // instead of 21/3 = 7. Now we ALWAYS recompute totals[save_dc]
  // from totals[save_dc.<chosenAttr>] (the post-PASS 2 value
  // already includes the per-attr contributions) so direct
  // modifiers on the parent can be RE-APPLIED correctly in the
  // totals aggregation step below.
  for (const displayTarget of displayTargetsToMerge) {
    // Find all action_roll sub-targets that map to this display
    // target (e.g. attack_bonus ← ATTACK_ROLL,
    // physical_saving_throw ← PHYSICAL_SAVE).
    const matchingSubTargets = actionRollOptions.filter(
      (o) => SUB_TARGET_TO_DISPLAY[o] === displayTarget,
    );
    const sources: ReadonlyArray<ModifierContribution[] | undefined> = [
      // Direct primitive targets (legacy compat).
      ...(displayTarget === "attack_bonus"
        ? [byTarget[`attack_bonus.${chosenAttr}`]]
        : displayTarget === "save_dc"
          ? [
              byTarget[`save_dc.${chosenAttr}`],
              byTarget[`defense_dc.${chosenAttr}`],
            ]
          : []),
      // Direct saving_throw.<attr> primitives (legacy compat).
      ...(displayTarget === "physical_saving_throw"
        ? [byTarget["saving_throw.physical"]]
        : displayTarget === "mental_saving_throw"
          ? [byTarget["saving_throw.mental"]]
          : displayTarget === "magical_saving_throw"
            ? [byTarget["saving_throw.magical"]]
            : []),
      // action_roll sub-target contributions.
      ...matchingSubTargets.map(
        (o) => byTarget[`action_roll.${o.toLowerCase()}`],
      ),
    ];
    const merged: ModifierContribution[] = [];
    const seen = new Set<string>();
    for (const src of sources) {
      if (!src) continue;
      for (const c of src) {
        const key = `${c.target}|${c.primitiveId}|${c.value}|${c.op}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(c);
      }
    }
    if (merged.length > 0) {
      byTarget[displayTarget] = merged;
    }
  }

  // Phase 8.L round 80: spec-driven totals aggregation.
  //
  // For the user-facing totals:
  //   - totals[attack_bonus] = base + action_roll.attack_roll delta
  //   - totals[save_dc] = base + direct save_dc modifier delta
  //     (action_roll.<save_sub> is for SAVING THROWS, not save DC)
  //   - totals[<attr>_saving_throw] = base + action_roll.<save_sub>
  //     delta (one per attribute)
  //
  // We derive the action_roll sub-target list from the spec so
  // adding a new sub-target doesn't require code changes here.
  const actionRollSpec2 = MODIFIER_TARGET_SPEC["action_roll"] as
    | { options?: readonly string[] }
    | undefined;
  const SUB_TO_DISPLAY_2: Readonly<Record<string, string>> = {
    ATTACK_ROLL: "attack_bonus",
    PHYSICAL_SAVE: "physical_saving_throw",
    MENTAL_SAVE: "mental_saving_throw",
    MAGICAL_SAVE: "magical_saving_throw",
  };
  let actionRollAtkDelta = 0;
  let actionRollPhysicalSaveDelta = 0;
  let actionRollMentalSaveDelta = 0;
  let actionRollMagicalSaveDelta = 0;
  for (const opt of actionRollSpec2?.options ?? []) {
    const display = SUB_TO_DISPLAY_2[opt];
    if (!display) continue;
    const key = `action_roll.${opt.toLowerCase()}`;
    const delta = totals[key] ?? 0;
    if (display === "attack_bonus") {
      actionRollAtkDelta += delta;
    } else if (display === "physical_saving_throw") {
      actionRollPhysicalSaveDelta += delta;
    } else if (display === "mental_saving_throw") {
      actionRollMentalSaveDelta += delta;
    } else if (display === "magical_saving_throw") {
      actionRollMagicalSaveDelta += delta;
    }
  }
  // Phase 8.L round 81: Always derive parent totals from per-attr
  // + direct contributions, applying any direct parent's operation
  // on top.
  //
  // Why: the per-attr totals (totals[save_dc.physical]) were
  // already correctly populated by PASS 2 (seed + per-attr
  // contributions = 21 in user's case). Direct modifiers targeting
  // the parent (e.g. user's divide-3 condition) modified
  // totals[save_dc] independently based on the parent's bare
  // seed (18), giving 18/3 = 6. We now correct this by:
  //   1. Re-seeding the parent with the per-attr post-PASS-2
  //      value (21).
  //   2. Re-applying the parent's direct contributions (if any).
  const directAtkContribs = (byTarget["attack_bonus"] ?? []).filter(
    (c) => c.target === "attack_bonus",
  );
  const directSaveContribs = (byTarget["save_dc"] ?? []).filter(
    (c) => c.target === "save_dc",
  );
  // Phase 8.L round 92 (Mashu 2026-08-22): the per-attr base
  // uses input.pb + (raw_attr + sum_of_attribute.<chosenAttr>
  // primitive contributions). The attribute primitive
  // contributions to the chosen attribute's modifier
  // (e.g. Str Buff +5 to phys) are NOT applied to the
  // attack_bonus seed directly by PASS 2 — they're applied to
  // attribute.physical which we then add back here.
  const attrTarget = `attribute.${chosenAttr}`;
  let attrPrimitiveDelta = 0;
  for (const c of byTarget[attrTarget] ?? []) {
    if (c.op === "add" && c.conditionActive !== false && !c.inhibited) {
      attrPrimitiveDelta += c.value;
    } else if (c.op === "subtract" && c.conditionActive !== false && !c.inhibited) {
      attrPrimitiveDelta -= c.value;
    }
  }
  const rawAttr = input.attributes[chosenAttr] ?? 0;
  // Also include attack_bonus.<chosenAttr> primitive contributions
  // (e.g. Mark of the Hunt +2) which PASS 2 applied to
  // totals[attack_bonus.<chosenAttr>] but our new seed overwrites.
  let perAttrAtkPrimitiveDelta = 0;
  for (const c of byTarget[`attack_bonus.${chosenAttr}`] ?? []) {
    if (c.conditionActive !== false && !c.inhibited) {
      if (c.op === "add") perAttrAtkPrimitiveDelta += c.value;
      else if (c.op === "subtract") perAttrAtkPrimitiveDelta -= c.value;
      // multiply/divide/set/max/min handled at higher levels
    }
  }
  const perAttrAtkBase =
    input.pb + rawAttr + attrPrimitiveDelta + perAttrAtkPrimitiveDelta;
  // Phase 8.L round 92 (Mashu): same fix as attack_bonus —
  // save_dc seed includes the COMPUTED attribute primitive
  // contributions plus per-attr save_dc primitives (Defender,
  // Stone Skin, etc.).
  const saveDcAttrTarget = `attribute.${chosenAttr}`;
  let saveDcAttrPrimitiveDelta = 0;
  for (const c of byTarget[saveDcAttrTarget] ?? []) {
    if (c.op === "add" && c.conditionActive !== false && !c.inhibited) {
      saveDcAttrPrimitiveDelta += c.value;
    } else if (c.op === "subtract" && c.conditionActive !== false && !c.inhibited) {
      saveDcAttrPrimitiveDelta -= c.value;
    }
  }
  // save_dc.physical post-PASS 2 already includes its seed
  // (8 + PB + raw_attr) AND all per-attr save_dc primitives
  // (Defender, Stone Skin, Save DC Buff, etc.). We only want
  // the primitive delta here, not the seed (which is already
  // in perAttrSaveBase).
  // save_dc.physical post-PASS 2 already includes its seed
  // (8 + PB + raw_attr) AND all per-attr save_dc primitives
  // (Defender, Stone Skin, Save DC Buff, etc.). We only want
  // the primitive delta here, not the seed (which is already
  // in perAttrSaveBase).
  const saveDcSeed = 8 + input.pb + (input.attributes[chosenAttr] ?? 0);
  const saveDcPerAttrDelta =
    (totals[`save_dc.${chosenAttr}`] ?? totals[`defense_dc.${chosenAttr}`] ?? 0) - saveDcSeed;
  // Phase 8.L round 92 (Mashu): save_dc seed uses raw attribute
  // (NOT computed). The save_dc formula is:
  //   save_dc = 8 + PB + chosen_attr (raw) + save_dc_primitive_delta
  // Attribute primitive deltas are NOT included in save_dc.
  const perAttrSaveBase = saveDcSeed;
  void saveDcAttrPrimitiveDelta;
  // Re-apply direct modifiers on top of per-attr value. This
  // matters for divide/multiply/set where the per-attr value
  // IS the new base.
  // Phase 8.L round 81: per Mashu, "we never use decimals,
  // always round up". applyOperation rounds up the FINAL value
  // of every numeric op so decimals never leak through:
  // 4 + 2.5 = 7; 4 - 2.5 = 2; 4 * 0.7 = 3; 5 / 2 = 3; set 2.5 = 3.
  const roundUp = (n: number) => Math.ceil(n - 1e-9);
  function reapplyOp(base: number, op: string, value: unknown): number {
    const v = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(v)) return base;
    switch (op) {
      case "add": return roundUp(base + v);
      case "subtract": return roundUp(base - v);
      case "multiply": return roundUp(base * v);
      case "divide": return v === 0 ? base : roundUp(base / v);
      case "set": return roundUp(v);
      case "min": return Math.min(base, v);
      case "max": return Math.max(base, v);
      default: return roundUp(base + v);
    }
  }
  // Chain direct contributions left-to-right.
  let atkFinal = perAttrAtkBase + actionRollAtkDelta;
  for (const c of directAtkContribs) {
    atkFinal = reapplyOp(atkFinal, c.op, c.value);
  }
  // Phase 8.L round 92: include save_dc.<attr> primitive
  // contributions (Defender +1 to defense_dc.physical, Stone
  // Skin +2 to save_dc.physical, Save DC Buff +1, etc.) on top
  // of the per-attr seed.
  let saveFinal = perAttrSaveBase + saveDcPerAttrDelta;
  for (const c of directSaveContribs) {
    saveFinal = reapplyOp(saveFinal, c.op, c.value);
  }
  // Phase 8.L round 92 (Mashu): also write the per-attr total
  // so the BSB / sheet shows the right number too. atkFinal
  // includes the COMPUTED attribute primitive contributions
  // (was missing before — only Mark was added).
  totals[`attack_bonus.${chosenAttr}`] = perAttrAtkBase;
  totals["attack_bonus"] = atkFinal;
  totals["save_dc"] = saveFinal;

  // Phase 8.L round 85: also apply mirrored entries' ops on the
  // seeded saving throws. The mirror populates byTarget AFTER PASS 2,
  // so the entries need a reapply step here.
  // Mirrored entries for physical_saving_throw include:
  //   - saving_throw.physical (direct legacy)
  //   - action_roll.physical_save sub-target
  // The seed is already PB + per-attr mod. We apply each op on top.
  function reapplyMirror(
    base: number,
    entries: ReadonlyArray<{ op: string; value: unknown }>,
  ): number {
    let cur = base;
    for (const e of entries) {
      cur = reapplyOp(cur, e.op, e.value);
    }
    return cur;
  }
  // Apply mirrored entries for each saving throw. The mirror
  // populates byTarget[physical_saving_throw] AFTER PASS 2, so
  // we need to reapply those entries' ops here. Note: we DON'T
  // skip legacy saving_throw.<attr> — those ARE the contributions
  // we want to apply. The action_roll.<save_sub> mirror is the
  // other source.
  function mirroredExcept(
    target: string,
    skipDirectTargets: ReadonlyArray<string>,
  ): Array<{ op: string; value: unknown }> {
    return (byTarget[target] ?? []).filter(
      (c) => !skipDirectTargets.includes(c.target),
    );
  }
  // Phase 8.L round 92 (Mashu): use COMPUTED attribute (after
  // PASS 2, so primitive contributions like Str Buff + Mirrored
  // Str Buff are included) for the seed base, NOT the raw input
  // attribute. Same fix as attack_bonus in L81 reapply.
  const computedPhysAttr92 = totals["attribute.physical"] ?? (input.attributes.physical ?? 0);
  const computedMentalAttr92 = totals["attribute.mental"] ?? (input.attributes.mental ?? 0);
  const computedMagicalAttr92 = totals["attribute.magical"] ?? (input.attributes.magical ?? 0);
  // Note: saving_throw.physical contributions are NOT applied via
  // PASS 2 (because the seed is on physical_saving_throw, not
  // saving_throw.physical). So we DO want to include them here.
  //
  // Phase 8.L round 117 (Mashu): action_roll.<save_sub> entries
  // are SKIPPED here — they're applied as a final step by
  // applySubTargetToTotal below (operating on the FULL finished
  // total, not the seed). Otherwise multiply/divide would
  // double-count.
  // Phase 8.L round 129 (Mashu): only the prof attribute's
  // save gets PB in the seed (per Q2). Other saves get 0 PB.
  const physSaveSeed = (input.proficientAttribute === "physical" ? input.pb : 0) + computedPhysAttr92;
  totals["physical_saving_throw"] = reapplyMirror(
    physSaveSeed,
    mirroredExcept(
      "physical_saving_throw",
      ["action_roll.physical_save"],
    ),
  );
  const mentalSaveSeed = (input.proficientAttribute === "mental" ? input.pb : 0) + computedMentalAttr92;
  totals["mental_saving_throw"] = reapplyMirror(
    mentalSaveSeed,
    mirroredExcept(
      "mental_saving_throw",
      ["action_roll.mental_save"],
    ),
  );
  const magicalSaveSeed = (input.proficientAttribute === "magical" ? input.pb : 0) + computedMagicalAttr92;
  totals["magical_saving_throw"] = reapplyMirror(
    magicalSaveSeed,
    mirroredExcept(
      "magical_saving_throw",
      ["action_roll.magical_save"],
    ),
  );

  // Phase 8.L round 80: write back the seeded saving throws.
  // Apply each action_roll.<save_sub> contribution's operation
  // to the seeded base. action_roll.<save_sub> starts at 0
  // (no seed), so we must apply the op on the seed directly:
  //   totals[physical_saving_throw] = (PB + phys_mod) OP value
  //   totals[mental_saving_throw]   = (PB + men_mod) OP value
  //   totals[magical_saving_throw]  = (PB + mag_mod) OP value
  // This works for add/subtract/multiply/divide/set uniformly.
  function applySavingThrowSeed(
    displayTarget: string,
    baseAttr: "physical" | "mental" | "magical",
    op: string,
    rawValue: unknown,
  ): number {
    const base = input.pb + (input.attributes[baseAttr] ?? 0);
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) return base;
    switch (op) {
      case "add": return base + value;
      case "subtract": return base - value;
      case "multiply": return base * value;
      case "divide": return value === 0 ? base : base / value;
      case "set": return value;
      case "min": return Math.min(base, value);
      case "max": return Math.max(base, value);
      default: return base + value;
    }
  }
  // Helper: find the first matching contribution for a sub-target
  // and apply the op to the seed.
  function applySubTargetToSeed(
    subName: string,
    displayTarget: string,
    baseAttr: "physical" | "mental" | "magical",
  ): number {
    const key = `action_roll.${subName.toLowerCase()}`;
    const contribs = byTarget[key] ?? [];
    // L87: use raw attribute (this system's convention).
    const base = input.pb + (input.attributes[baseAttr] ?? 0);
    if (contribs.length === 0) return base;
    let cur = base;
    for (const c of contribs) {
      const value = typeof c.value === "number" ? c.value : Number(c.value);
      if (!Number.isFinite(value)) continue;
      switch (c.op) {
        case "add": cur = cur + value; break;
        case "subtract": cur = cur - value; break;
        case "multiply": cur = cur * value; break;
        case "divide": if (value !== 0) cur = cur / value; break;
        case "set": cur = value; break;
        case "min": cur = Math.min(cur, value); break;
        case "max": cur = Math.max(cur, value); break;
      }
    }
    return cur;
  }
  // Phase 8.L round 117 (Mashu 2026-08-26): apply sub-target
  // ops on top of the FULL post-PASS-2 total (already seeded
  // by reapplyMirror with PB + computed_attr + direct prims).
  // Per Mashu: "conditions I add manually are the LAST
  // calculated applied AFTER all effects". So magi x2 on
  // magical save should multiply the FULL final magical
  // save (10 = mod 4 + PB 6), giving 20 — NOT (PB + raw) × 2 = 16.
  function applySubTargetToTotal(
    subContribs: ReadonlyArray<ModifierContribution>,
    baseTotal: number,
  ): number {
    if (subContribs.length === 0) return baseTotal;
    // Filter out primitive contributions from action_roll
    // that aren't pure operations (e.g. add/sub/mul/div). Right
    // now subContribs only carries operation modifiers, but be
    // defensive.
    let cur = baseTotal;
    for (const c of subContribs) {
      const value = typeof c.value === "number" ? c.value : Number(c.value);
      if (!Number.isFinite(value)) continue;
      switch (c.op) {
        case "add": cur = cur + value; break;
        case "subtract": cur = cur - value; break;
        case "multiply": cur = cur * value; break;
        case "divide": if (value !== 0) cur = cur / value; break;
        case "set": cur = value; break;
        case "min": cur = Math.min(cur, value); break;
        case "max": cur = Math.max(cur, value); break;
      }
    }
    return cur;
  }
  const physContribs = byTarget["action_roll.physical_save"] ?? [];
  if (physContribs.length > 0) {
    totals["physical_saving_throw"] = applySubTargetToTotal(
      physContribs,
      // L129: only prof save gets PB in fallback.
      totals["physical_saving_throw"] ?? ((input.proficientAttribute === "physical" ? input.pb : 0) + (input.attributes.physical ?? 0)),
    );
  }
  const menContribs = byTarget["action_roll.mental_save"] ?? [];
  if (menContribs.length > 0) {
    totals["mental_saving_throw"] = applySubTargetToTotal(
      menContribs,
      // L129: only prof save gets PB in fallback.
      totals["mental_saving_throw"] ?? ((input.proficientAttribute === "mental" ? input.pb : 0) + (input.attributes.mental ?? 0)),
    );
  }
  const magContribs = byTarget["action_roll.magical_save"] ?? [];
  if (magContribs.length > 0) {
    totals["magical_saving_throw"] = applySubTargetToTotal(
      magContribs,
      // L129: only prof save gets PB in fallback.
      totals["magical_saving_throw"] ?? ((input.proficientAttribute === "magical" ? input.pb : 0) + (input.attributes.magical ?? 0)),
    );
  }

  // Phase 8.L round 55: when modifiers reference PB-based typed
  // tokens (pb, pb_half, pb2, etc.), their PASS 2 resolution used
  // ctx.pb = level-based PB. If something else (a condition or a
  // primitive) modified PB, the token-derived contribution is now
  // stale. Walk byTarget and rescale PB-dependent contributions
  // by the ratio (finalPb / inputPb).
  const finalPb = totals["proficiency_bonus"] ?? input.pb;
  if (finalPb !== input.pb && input.pb !== 0) {
    const ratio = finalPb / input.pb;
    if (ratio !== 1) {
      // Rescale the totals for PB-dependent target keys.
      // We don't know which targets depend on PB from totals
      // alone — but every modifier value of 0.5 * pb / pb*2 / etc.
      // is PB-dependent. For simplicity, rescale the totals for
      // any key where at least one contribution's raw value is a
      // PB-derived typed token (we can detect by re-resolving).
      // Since we don't store this, take a different approach:
      // for each byTarget entry, check if its `op` produced a
      // value containing the PB-based resolution, and rescale.
      //
      // We use a heuristic: any byTarget key whose FIRST
      // contribution's value is a non-integer fraction of
      // level_pb is PB-dependent. This catches pb_half (always
      // half), pb*2 (always double), pb/4 (always quarter).
      // Rescale totals for any byTarget key whose FIRST contribution
      // looks like it was derived from input.pb (PB Half = 0.5*pb,
      // PB*2 = 2*pb, PB = 1*pb, PB/4 = 0.25*pb, etc.). The byTarget
      // entries stay at their pre-rescale values — the provenance
      // modal reads those — but the final total reflects the FINAL pb.
      // Phase 8.L round 58: also update byTarget entries so downstream
      // consumers (sheet.ts practice walk that builds
      // primitiveBonuses) see the rescaled PB-token values.
      for (const target of Object.keys(byTarget)) {
        const contribs = byTarget[target];
        if (!contribs || contribs.length === 0) continue;
        const firstContrib = contribs[0];
        if (!firstContrib) continue;
        const baseValue = firstContrib.value;
        const expectedRatios = [0.25, 0.5, 1, 2, 4] as const;
        for (const r of expectedRatios) {
          if (Math.abs(baseValue - input.pb * r) < 0.01) {
            const newBase =
              (baseValue * ratio) >= 0
                ? Math.ceil(baseValue * ratio)
                : Math.floor(baseValue * ratio);
            // Rebuild byTarget[target] as a mutable array of
            // contributions with potentially-rescaled values.
            const newContribs = contribs.map((c) =>
              Math.abs(c.value - baseValue) < 0.01
                ? { ...c, value: newBase }
                : c,
            );
            byTarget[target] = newContribs;
            // Replace the contribution portion of totals.
            // oldSum uses the original (`contribs`) values; newSum
            // uses the rebuilt (`newContribs`) values.
            const oldSum = contribs.reduce(
              (sum, c) => sum + (Math.abs(c.value - newBase) < 0.01 ? baseValue : c.value),
              0,
            );
            const newSum = newContribs.reduce((sum, c) => sum + c.value, 0);
            totals[target] = (totals[target] ?? 0) - oldSum + newSum;
            break;
          }
        }
      }
    }
  }

  return {
    totals,
    byTarget,
    mirrorCosts,
    behaviorVariables,
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
  // Phase 8.L round 54 (Mashu 2026-08-14): empty scope = "any of
  // the layer" = pass through to the L53 expansion that fills in
  // real values. Previously the validator rejected empty scope
  // for checklist-with-free-text widgets (e.g. speed with no
  // specific WALKING_SPEED/FLYING_SPEED selected), which made
  // the modifier silently disappear. Now "any" is valid.
  // We only short-circuit for checklist widgets (where empty
  // means "any"). For free-text widgets (behavior, scene_pace,
  // duration), the user MUST provide a value — the modifier
  // still gets dropped.
  if (derivedValues.length === 0 && spec.widget !== "free-text") {
    return true;
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
