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
}

export interface ResolvedCharacterInput {
  readonly characterId: string;
  readonly level: number;
  readonly pb: number;
  readonly proficientAttribute: "physical" | "mental" | "magical" | null;
  readonly attributes: {
    readonly physical: number;
    readonly mental: number;
    readonly magical: number;
  };
  readonly slots: readonly ResolvedPrimitiveSlot[];
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
  /** Value BEFORE mirror (for display when the user wants to see
   *  the standard polarity). null when not mirrored. */
  readonly preMirrorValue: number | null;
  /** True if the modifier's condition was satisfied (always true
   *  for v1 conditions per Phase 7 design — they're hints). */
  readonly conditionActive: boolean;
  readonly stacking: HardModifier["stacking"];
  readonly provenance: {
    readonly heritageName: string | null;
    readonly capabilityName: string | null;
    readonly effectName: string | null;
    /** "direct" | "heritage" | "capability" | "effect" — short
     *  label for the UI. */
    readonly kind: "direct" | "heritage" | "capability" | "effect";
  };
}

export interface ResolvedModifiers {
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

  // Walk each slot. For each modifier in the slot's
  // hardModifiers, compute the post-mirror value and add it to
  // both byTarget and totals.
  for (const slot of input.slots) {
    const source = sourceNames?.get(slot.primitiveId);

    for (const mod of slot.hardModifiers) {
      const target = String(mod.target);

      // Phase 8.I i1 (Mashu 2026-08-04): silently drop modifiers
      // whose sub-target validation fails (e.g. an `attribute`
      // modifier with no PHYSICAL/MENTAL/MAGICAL picked). This is
      // the engine-side enforcement of A1/A2 — backwards compat
      // with existing malformed data so the engine doesn't
      // accidentally apply a wildcard. The form validator
      // (validateModifierDrafts) is the user-facing surface; this
      // is the runtime guard.
      if (!isEngineModifierValid(mod)) continue;

      // ---- Mirror handling -------------------------------------
      let effectiveValue: number;
      let preMirrorValue: number | null = null;
      if (slot.isMirrored) {
        // SAFE default: if the primitive isn't mirrorable, treat
        // the mirror as a no-op (pass-through). The DB CHECK
        // constraint should prevent this but the runtime is
        // defensive.
        if (!slot.isMirrorable) {
          effectiveValue = numericValue(mod.value);
          preMirrorValue = null;
        } else {
          const mirror = resolveMirrorEffect(
            slot.mirrorVector ?? "STANDARD_ONLY",
            true,
            mod.value,
          );
          effectiveValue = mirror.targetValue;
          preMirrorValue = numericValue(mod.value);
          // COST_INSTABILITY adds a user-side cost. Capture it.
          if (mirror.userCost?.kind === "extra_strain") {
            mirrorCosts.push({
              primitiveId: slot.primitiveId,
              primitiveName: slot.name,
              vector: mirror.vector,
              magnitude: mirror.userCost.magnitude,
            });
          }
        }
      } else {
        effectiveValue = numericValue(mod.value);
      }

      if (!Number.isFinite(effectiveValue)) continue;

      // ---- Build the attribution entry ------------------------
      const contribution: ModifierContribution = {
        target,
        primitiveId: slot.primitiveId,
        primitiveName: slot.name,
        primitiveCategory: slot.category,
        op: mod.operation,
        value: effectiveValue,
        preMirrorValue,
        // Phase 7 design: v1 conditions are hints, always active.
        // Legacy conditions are evaluated by evaluateCondition() —
        // but we treat any condition as active here to match the
        // engine's behaviour (where the legacy path is the only
        // one that actually gates). For now, we say "active" if
        // the modifier has no condition OR the condition is v1
        // shape. The engine's evaluateModifiers() handles legacy
        // gating internally and produces matching totals.
        conditionActive: !mod.condition || "kind" in (mod.condition ?? {}),
        stacking: mod.stacking ?? "stack",
        provenance: {
          heritageName: source?.heritageName ?? null,
          capabilityName: source?.capabilityName ?? null,
          effectName: source?.effectName ?? null,
          kind: deriveProvenanceKind(slot),
        },
      };

      // ---- Append to byTarget ---------------------------------
      const list = byTarget[target] ?? [];
      list.push(contribution);
      byTarget[target] = list;

      // ---- Compute the running total --------------------------
      // We mimic evaluateModifiers(): apply ops sequentially
      // starting from 0, then apply the stacking mode across
      // all contributions to the same target.
      const previousBase = totals[target] ?? 0;
      const nextBase = applyOperation(
        previousBase,
        mod.operation,
        effectiveValue,
      );
      totals[target] = numericOr(nextBase, previousBase);
    }
  }

  // ---- Apply stacking per target --------------------------------
  // Group by target, apply stacking to all contributions.
  for (const target of Object.keys(byTarget)) {
    const contribs = byTarget[target];
    if (!contribs || contribs.length <= 1) continue;

    // Use the first contribution's stacking mode (canonical).
    const firstContrib = contribs[0];
    if (!firstContrib) continue;
    const stackingMode = firstContrib.stacking ?? "stack";

    // Build the list of contribution values for stacking.
    const values = contribs.map((c) => c.value);
    const stacked = applyStacking(
      values as readonly JsonValue[],
      stackingMode,
    );
    const stackedNum = numericValue(stacked);
    if (Number.isFinite(stackedNum)) {
      totals[target] = stackedNum;
    }
  }

  return {
    totals,
    byTarget,
    mirrorCosts,
    computedAt: new Date().toISOString(),
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
  const draft: ModifierDraftForValidation = {
    target: targetRaw,
    targetValues: values,
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