"use client";

/**
 * modifier-builder.tsx — Phase 8.L round 52 (Mashu 2026-08-14)
 *
 * SHARED modifier card editor. Used by:
 *  - condition-composer.tsx (Play Session Scratchpad conditions)
 *  - primitive-form.tsx (atelier sandbox primitive composer)
 *  - primitive-registry.tsx (workshop primitive composer)
 *
 * The component renders the full modifier UI:
 *   Section 1 — Target (dropdown + dynamic target value widget)
 *   Section 2 — Change (operation dropdown + chirality/mirror swap)
 *   Section 3 — Value (value type + chip-stack or equation picker)
 *   Section 4 — Stacking Rule
 *   Section 5 — Triggers when... (ConditionPicker)
 *
 * It owns NO state. The parent passes a `modifier` (ModifierDraft)
 * and `onChange` (called with a patch) callbacks. The parent
 * manages the array of modifiers and crate/removal.
 *
 * Section visibility is controlled via props (e.g. showTriggersWhen)
 * so primitive-registry can omit the Triggers when section without
 * surgery on the component.
 *
 * IMPORTANT: This component does NOT call toHardModifier — it only
 * edits the ModifierDraft. The parent owns the conversion to
 * HardModifier. This keeps the component decoupled from the
 * engine save path.
 */

import type { ReactElement } from "react";
import type {
  ModifierOperation,
  ModifierStackingMode,
} from "@/types/swordweave";
import {
  type ModifierTarget,
  type SkillPracticeGranularity,
  MODIFIER_TARGETS,
  MODIFIER_TARGET_SPEC,
} from "@/lib/primitives/modifier-scope";
import type {
  ValueToken,
  Operand,
} from "@/types/modifier";
import { OP_SPECS, serializeValueField } from "@/types/modifier";
import type { ValueType } from "@/types/modifier";
import {
  allowedTokenKinds,
  allowedValueTypes,
  effectiveMirrorable,
  hidesValueTypeSelect,
  valueTypeLabel,
} from "@/lib/primitives/form-helpers";
import type { ConditionAuthoring } from "@/types/condition";
import {
  ConditionPicker,
  legacyFieldsFromAuthoring,
} from "@/components/sandbox/condition-picker";
import { TokenChipStack } from "@/components/sandbox/token-chip-stack";
import { EquationPicker } from "@/components/sandbox/equation-picker";

// =============================================================================
// ModifierDraft — shared shape used by both primitive-form and primitive-registry
// matches the canonical shape from primitive-form.tsx (with all fields).
// =============================================================================
export interface ModifierDraft {
  id: string;
  target: ModifierTarget | string;
  operation: ModifierOperation;
  tokens: ValueToken[];
  value: string;
  valueKind: ValueType;
  operands: Operand[];
  targetValues: string[];
  granularity: SkillPracticeGranularity;
  freeTextNarrowFocus: string;
  conditionMode: "always" | "custom";
  conditionKey: string;
  conditionOperator:
    | "equals"
    | "not-equals"
    | "greater-than"
    | "greater-than-or-equal"
    | "less-than"
    | "less-than-or-equal"
    | "includes"
    | "exists";
  conditionValue: string;
  stacking: ModifierStackingMode;
  v1Condition: ConditionAuthoring;
}

const blankV1Condition: ConditionAuthoring = {
  categories: [],
  pills: [],
  operators: [],
  narrative: "",
  includeTags: false,
};

export function blankModifierDraft(id: string): ModifierDraft {
  return {
    id,
    target: "attribute",
    operation: "add",
    tokens: [],
    value: "",
    valueKind: "number",
    operands: [],
    targetValues: [],
    granularity: "broad",
    freeTextNarrowFocus: "",
    conditionMode: "always",
    conditionKey: "",
    conditionOperator: "equals",
    conditionValue: "",
    stacking: "stack",
    v1Condition: blankV1Condition,
  };
}

// =============================================================================
// Operation / target / stacking options — exported so callers can use them
// =============================================================================
export const operations: Array<{
  label: string;
  value: ModifierOperation;
}> = [
  { label: "Add (+)", value: "add" },
  { label: "Subtract (−)", value: "subtract" },
  { label: "Set To (=)", value: "set" },
  { label: "Multiply (×)", value: "multiply" },
  { label: "Divide (÷)", value: "divide" },
  { label: "Minimum (⌊)", value: "min" },
  { label: "Maximum (⌈)", value: "max" },
  { label: "Grant", value: "grant" },
  { label: "Revoke", value: "revoke" },
];

export const targetOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: ModifierTarget;
}> = MODIFIER_TARGETS.map((t) => ({
  label: MODIFIER_TARGET_SPEC[t].label,
  value: t,
}));

export const stackingOptions: ModifierStackingMode[] = [
  "stack",
  "highest-only",
  "lowest-only",
  "unique-by-primitive",
  "unique-by-target",
  "replace",
];

// =============================================================================
// ModifierBuilder component
// =============================================================================
export interface ModifierBuilderProps {
  readonly modifier: ModifierDraft;
  readonly index: number;
  readonly onUpdate: (id: string, patch: Partial<ModifierDraft>) => void;
  readonly onRemove: (id: string) => void;
  readonly onMirror: (id: string) => void;
  /** Toggle a target value (e.g. PHYS check in the target checklist). */
  readonly onToggleTargetValue: (id: string, value: string, checked: boolean) => void;
  /** Show the Triggers when... (ConditionPicker) section. Default true. */
  readonly showTriggersWhen?: boolean;
  /** Show the Stacking Rule dropdown. Default true. */
  readonly showStacking?: boolean;
  /** Show the chirality/mirror swap card. Default true. */
  readonly showChirality?: boolean;
  /** Show the "Remove" button (set false for atomic primitives). */
  readonly removable?: boolean;
}

export function ModifierBuilder({
  modifier,
  index,
  onUpdate,
  onRemove,
  onMirror,
  onToggleTargetValue,
  showTriggersWhen = true,
  showStacking = true,
  showChirality = true,
  removable = true,
}: ModifierBuilderProps): ReactElement {
  // Resolve current target (defensive against legacy dotted targets)
  const currentTargetRaw = String(modifier.target);
  const currentTarget: ModifierTarget =
    (MODIFIER_TARGETS as readonly string[]).includes(currentTargetRaw)
      ? (currentTargetRaw as ModifierTarget)
      : "attribute";
  const spec = MODIFIER_TARGET_SPEC[currentTarget];

  return (
    <div
      className="grid gap-3 rounded-md border border-border bg-card p-3"
      data-testid={`modifier-card-${modifier.id}`}
    >
      {/* Header: "Modifier N" + Remove button */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Modifier {index + 1}</p>
        {removable && (
          <button
            className="h-8 rounded-md border border-border px-2 text-xs text-muted-foreground disabled:opacity-40"
            onClick={() => onRemove(modifier.id)}
            type="button"
          >
            Remove
          </button>
        )}
      </div>

      {/* SECTION 1 — TARGET */}
      <fieldset className="space-y-3 rounded-md border border-border bg-background p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Target
        </legend>

        <label className="block text-sm font-medium">
          What changes?
          <select
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
            value={
              (MODIFIER_TARGETS as readonly string[]).includes(
                String(modifier.target),
              )
                ? String(modifier.target)
                : "attribute"
            }
            onChange={(event) =>
              onUpdate(modifier.id, { target: event.target.value })
            }
          >
            {targetOptions.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
          </select>
        </label>

        {/* Dynamic Target Value widget — "none" / "free-text" / "checklist" */}
        {spec.widget === "none" && (
          <div className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
            {spec.layer
              ? `Affects all ${spec.label.toLowerCase()} instances by default — use the Value field below to set the magnitude.`
              : `${spec.label} has no scope axis; the Value field carries the full effect.`}
          </div>
        )}

        {spec.widget === "free-text" && (
          <label className="block text-sm font-medium">
            <span className="text-xs text-muted-foreground">
              Behavior name (key)
            </span>
            <input
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
              value={modifier.freeTextNarrowFocus}
              onChange={(event) =>
                onUpdate(modifier.id, {
                  freeTextNarrowFocus: event.target.value,
                })
              }
              placeholder={spec.freeTextPlaceholder ?? ""}
            />
          </label>
        )}

        {(spec.widget === "checklist" ||
          spec.widget === "checklist-with-free-text") && (
          <div className="space-y-2 rounded-md border border-dashed border-border bg-background p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {spec.label} — leave empty for "any"
            </p>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
              {(spec.options ?? []).map((opt) => {
                const checked = modifier.targetValues.includes(opt);
                const label = spec.optionLabels?.[opt] ?? opt;
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        onToggleTargetValue(
                          modifier.id,
                          opt,
                          event.target.checked,
                        )
                      }
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            {spec.widget === "checklist-with-free-text" && (
              <label className="block text-sm font-medium">
                Other (describe)
                <input
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                  value={modifier.freeTextNarrowFocus}
                  onChange={(event) =>
                    onUpdate(modifier.id, {
                      freeTextNarrowFocus: event.target.value,
                    })
                  }
                  placeholder={spec.freeTextPlaceholder ?? "Describe custom value"}
                />
              </label>
            )}
          </div>
        )}
      </fieldset>

      {/* SECTION 2 — CHANGE */}
      <fieldset className="space-y-3 rounded-md border border-border bg-background p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Change
        </legend>
        <label className="block text-sm font-medium">
          Operation
          <select
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
            value={modifier.operation}
            onChange={(event) =>
              onUpdate(modifier.id, { operation: event.target.value as ModifierOperation })
            }
          >
            {operations.map((operation) => (
              <option key={operation.value} value={operation.value}>
                {operation.label}
              </option>
            ))}
          </select>
        </label>

        {showChirality && (
          <MirrorSwapCard
            op={modifier.operation}
            onSwap={() => onMirror(modifier.id)}
          />
        )}
      </fieldset>

      {/* SECTION 3 — VALUE */}
      <fieldset className="space-y-2 rounded-md border border-border bg-background p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Value
        </legend>

        {!hidesValueTypeSelect(modifier.operation) && (
          <label className="block text-sm font-medium">
            Value Type
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
              value={modifier.valueKind}
              onChange={(event) =>
                onUpdate(modifier.id, { valueKind: event.target.value as ValueType })
              }
            >
              {allowedValueTypes(modifier.operation).map((vt) => (
                <option key={vt} value={vt}>
                  {valueTypeLabel(vt)}
                </option>
              ))}
            </select>
          </label>
        )}

        {modifier.valueKind === "equation" ? (
          <div className="mt-1.5">
            <EquationPicker
              operands={modifier.operands}
              onChange={(next) => onUpdate(modifier.id, { operands: next })}
            />
          </div>
        ) : (
          <div className="mt-1.5">
            <TokenChipStack
              tokens={modifier.tokens}
              op={modifier.operation}
              valueKind={modifier.valueKind}
              onChange={(next) => {
                onUpdate(modifier.id, { tokens: next });
                // Keep the derived `value` cache in sync
                const serialized = serializeValueField(next);
                const first = serialized[0];
                const derived =
                  typeof first === "string"
                    ? first
                    : typeof first === "number"
                      ? String(first)
                      : typeof first === "boolean"
                        ? first
                          ? "true"
                          : "false"
                        : "";
                onUpdate(modifier.id, { value: derived });
              }}
              allowedKinds={allowedTokenKinds(modifier.operation, modifier.valueKind).kinds}
            />
          </div>
        )}
      </fieldset>

      {/* SECTION 4 — STACKING */}
      {showStacking && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium">
            Stacking Rule
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
              value={modifier.stacking}
              onChange={(event) =>
                onUpdate(modifier.id, {
                  stacking: event.target.value as ModifierStackingMode,
                })
              }
            >
              {stackingOptions.map((stacking) => (
                <option key={stacking} value={stacking}>
                  {stacking}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md border border-dashed border-border bg-background p-3 text-[10px] text-muted-foreground">
            <p className="font-semibold uppercase tracking-wide">
              How does this compose?
            </p>
            <p className="mt-1">
              <strong>stack</strong> = sum. <strong>highest-only</strong> = keep max.{" "}
              <strong>lowest-only</strong> = keep min.{" "}
              <strong>unique-by-primitive</strong> = first wins per source.{" "}
              <strong>unique-by-target</strong> = first wins per target.{" "}
              <strong>replace</strong> = last wins.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 5 — TRIGGERS WHEN */}
      {showTriggersWhen && (
        <div className="rounded-md border border-border bg-background p-3">
          <ConditionPicker
            value={modifier.v1Condition}
            onChange={(next: ConditionAuthoring) => {
              const legacy = legacyFieldsFromAuthoring(next);
              onUpdate(modifier.id, {
                v1Condition: next,
                conditionMode: legacy.conditionMode,
                conditionKey: legacy.conditionKey,
                conditionOperator: legacy.conditionOperator,
                conditionValue: legacy.conditionValue,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MirrorSwapCard — chirality badge + mirror swap button
// Was extracted from primitive-form.tsx as part of the L52 refactor.
// =============================================================================
function MirrorSwapCard({
  op,
  onSwap,
}: {
  readonly op: ModifierOperation;
  readonly onSwap: () => void;
}): ReactElement {
  const mirrorable = effectiveMirrorable(op);
  const mirrorOp = mirrorable ? OP_SPECS[op].mirrorOp : null;
  const mirrorLabel = mirrorOp ? OP_SPECS[mirrorOp].label : null;

  return (
    <div
      data-testid="mirror-swap-card"
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
    >
      <div className="flex flex-col gap-1.5">
        <ChiralityBadge op={op} mirrorable={mirrorable} />
        <p className="text-[10px] text-muted-foreground">
          {mirrorable && mirrorOp && mirrorLabel
            ? `Mirrorable — flips to ${mirrorLabel} when inverted (sign/reciprocal flipped per OP_SPECS).`
            : "Not mirrorable (permission-locked). Set To has no meaningful inverse."}
        </p>
      </div>
      {mirrorable && mirrorOp && mirrorLabel && (
        <button
          type="button"
          data-testid="mirror-toggle"
          onClick={onSwap}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
          title={`Swap operation to ${mirrorLabel}`}
        >
          ↔ Mirror to {mirrorLabel}
        </button>
      )}
    </div>
  );
}

function ChiralityBadge({
  op,
  mirrorable,
}: {
  readonly op: ModifierOperation;
  readonly mirrorable: boolean;
}): ReactElement {
  const isSetTo = op === "set";
  if (isSetTo) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-sm border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
        title="Set To is permission-locked; cannot be inverted."
      >
        🏛 Permission
      </span>
    );
  }
  if (mirrorable) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
        title="Variable Vector — mirrorable per OP_SPECS."
      >
        📊 Variable
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
    >
      🏛 Permission
    </span>
  );
}
