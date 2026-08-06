"use client";

// =============================================================================
// condition-picker-sections.tsx — Phase 8.I i2.6 (Mashu 2026-08-06)
//
// Shared chip-rendering sections for the condition picker. Used by:
//   - src/components/sandbox/condition-picker.tsx
//       (the inline picker below the build modal's "Triggers when…")
//   - src/components/sandbox/expression-editor-modal.tsx
//       (the "Edit trigger expression" modal — same chip UX)
//
// Sections provided (one per pill kind):
//   - PickerStatSection          actor-only; stat refs + numeric builder
//   - PickerProficiencySection   actor-only; dynamic + per-practice pills
//   - PickerStatusFlagsSection   actor-only; boolean flags
//
// All three sections only render when the category is "actor"
// (self-axis conditions). Target/scene categories use the legacy
// preset chip list (unchanged).
// =============================================================================

import { useState, useCallback, type ReactElement } from "react";
import type { ConditionAuthoring, ConditionPresetCategory } from "@/types/condition";
import { ALL_PRACTICES, ALL_ATTRIBUTES } from "@/types/modifier";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

// Canonical stat references.
export const SELF_STAT_REFS: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
  readonly tone: string;
}> = [
  { value: "vitality", label: "vitality", tone: "violet" },
  { value: "vitality_pct", label: "vitality %", tone: "violet" },
  { value: "save_dc", label: "save DC", tone: "violet" },
  { value: "block_value", label: "block value", tone: "amber" },
  { value: "physical", label: "physical", tone: "blue" },
  { value: "mental", label: "mental", tone: "blue" },
  { value: "magical", label: "magical", tone: "blue" },
  // Grouped attribute refs (all 3 / per attribute).
  { value: "any_attribute", label: "any attribute", tone: "blue" },
  { value: "all_attributes", label: "all attributes", tone: "blue" },
  { value: "physical_save", label: "save physical", tone: "violet" },
  { value: "mental_save", label: "save mental", tone: "violet" },
  { value: "magical_save", label: "save magical", tone: "violet" },
  { value: "any_save", label: "save any attribute", tone: "violet" },
  { value: "all_saves", label: "save all attributes", tone: "violet" },
  // Attack bonus (single number).
  { value: "attack_bonus", label: "attack bonus", tone: "amber" },
  // Practice-by-practice (10).
  ...ALL_PRACTICES.map((p) => ({ value: p, label: p, tone: "emerald" })),
  // Grouped practice refs.
  { value: "any_practice", label: "any practice", tone: "emerald" },
  { value: "all_practices", label: "all practices", tone: "emerald" },
];

export const STATUS_FLAGS: readonly string[] = [
  "is_prone",
  "is_stunned",
  "is_bleeding",
  "is_frightened",
  "is_blinded",
  "is_charmed",
  "is_grappled",
  "is_restrained",
  "is_sick",
  "is_wounded",
  "is_damaged_last_round",
];

const COMPARE_OPERATORS: ReadonlyArray<{
  readonly value: "<" | "<=" | "=" | "!=" | ">=" | ">" | "between";
  readonly label: string;
}> = [
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: ">=", label: "≥" },
  { value: ">", label: ">" },
  { value: "between", label: "between" },
];

// =============================================================================
// PickerStatSection — actor-only stat refs with numeric builder
// =============================================================================

export function PickerStatSection({
  category,
  pills,
  onAddStat,
}: {
  readonly category: ConditionPresetCategory;
  readonly pills: ConditionAuthoring["pills"];
  readonly onAddStat: (
    stat: string,
    op: "<" | "<=" | "=" | "!=" | ">=" | ">" | "between",
    value: number,
    valueHigh: number,
  ) => void;
}): ReactElement | null {
  if (category !== "actor") return null;
  const [chosenStat, setChosenStat] = useState<string | null>(null);
  const [chosenOp, setChosenOp] = useState<
    (typeof COMPARE_OPERATORS)[number]["value"]
  >("<");
  const [val, setVal] = useState("0.5");
  const [valHigh, setValHigh] = useState("1");
  const onAddClick = () => {
    if (!chosenStat) return;
    const v = parseFloat(val);
    const vh = parseFloat(valHigh);
    if (Number.isNaN(v)) return;
    onAddStat(chosenStat, chosenOp, v, Number.isNaN(vh) ? v : vh);
  };
  return (
    <CollapsibleSection
      title="Stat references"
      count={SELF_STAT_REFS.length}
      defaultOpen
    >
      {chosenStat ? (
        <div className="mb-2 rounded-md border-2 border-primary/40 bg-primary/5 p-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-primary">
            <span>Building:</span>
            <code className="font-mono text-foreground">
              actor:{chosenStat} {chosenOp} {val}
              {chosenOp === "between" ? ` - ${valHigh}` : ""}
            </code>
            <button
              type="button"
              onClick={() => setChosenStat(null)}
              className="ml-auto rounded p-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              title="Clear selection"
            >
              ×
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {COMPARE_OPERATORS.map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => setChosenOp(op.value)}
                className={
                  "rounded-full border px-2 py-0.5 text-xs " +
                  (chosenOp === op.value
                    ? "border-primary bg-primary/15 text-primary font-semibold"
                    : "border-border bg-background text-foreground hover:bg-accent")
                }
              >
                {op.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">value:</span>
            <input
              type="text"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddClick();
              }}
              className="w-20 rounded-md border border-input bg-background px-2 py-0.5 font-mono text-xs"
            />
            {chosenOp === "between" ? (
              <>
                <span className="text-muted-foreground">high:</span>
                <input
                  type="text"
                  value={valHigh}
                  onChange={(e) => setValHigh(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onAddClick();
                  }}
                  className="w-20 rounded-md border border-input bg-background px-2 py-0.5 font-mono text-xs"
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={onAddClick}
              className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              + add pill
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {SELF_STAT_REFS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setChosenStat(s.value)}
            className={
              "rounded-full border px-2 py-0.5 text-xs " +
              (chosenStat === s.value
                ? "border-primary bg-primary/15 text-primary font-semibold"
                : "border-border bg-background text-foreground hover:bg-accent")
            }
          >
            + {s.label}
          </button>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// =============================================================================
// PickerProficiencySection — actor-only
// =============================================================================

export function PickerProficiencySection({
  category,
  pills,
  onAdd,
}: {
  readonly category: ConditionPresetCategory;
  readonly pills: ConditionAuthoring["pills"];
  readonly onAdd: (
    label: string,
    practice: string | undefined,
    axis: "practice" | "attribute",
  ) => void;
}): ReactElement | null {
  if (category !== "actor") return null;
  return (
    <CollapsibleSection
      title="Proficiency"
      count={ALL_PRACTICES.length + ALL_ATTRIBUTES.length + 2}
    >
      <div className="mt-1 space-y-1.5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dynamic (uses currentPractice at evaluate time)
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onAdd("not_proficient", undefined, "practice")}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
            >
              not_proficient
            </button>
            <button
              type="button"
              onClick={() => onAdd("proficient", undefined, "practice")}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              proficient
            </button>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Static — per practice
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {ALL_PRACTICES.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAdd(`proficient_in(${p})`, p, "practice");
                  }}
                  className="rounded-l-full px-1 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                  title={`Proficient in ${p}`}
                >
                  +
                </button>
                <span className="font-mono">{p}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAdd(`not_proficient_in(${p})`, p, "practice");
                  }}
                  className="rounded-r-full px-1 text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
                  title={`Not proficient in ${p}`}
                >
                  −
                </button>
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Static — per attribute (proficient_in_attribute)
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {ALL_ATTRIBUTES.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAdd(`proficient_in_attribute(${a})`, a, "attribute");
                  }}
                  className="rounded-l-full px-1 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                  title={`Proficient in attribute ${a}`}
                >
                  +
                </button>
                <span className="font-mono">{a}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAdd(`not_proficient_in_attribute(${a})`, a, "attribute");
                  }}
                  className="rounded-r-full px-1 text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
                  title={`Not proficient in attribute ${a}`}
                >
                  −
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// =============================================================================
// PickerStatusFlagsSection — actor-only
// =============================================================================

export function PickerStatusFlagsSection({
  category,
  pills,
  onAdd,
}: {
  readonly category: ConditionPresetCategory;
  readonly pills: ConditionAuthoring["pills"];
  readonly onAdd: (flag: string) => void;
}): ReactElement | null {
  if (category !== "actor") return null;
  const [customFlag, setCustomFlag] = useState("");
  const onAddCustom = () => {
    const v = customFlag.trim();
    if (v.length === 0) return;
    onAdd(v);
    setCustomFlag("");
  };
  return (
    <CollapsibleSection title="Status flags" count={STATUS_FLAGS.length + 1}>
      <div className="mt-1 flex flex-wrap gap-1">
        {STATUS_FLAGS.map((flag) => (
          <button
            key={flag}
            type="button"
            onClick={() => onAdd(flag)}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
          >
            + {flag}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">custom:</span>
        <input
          type="text"
          value={customFlag}
          onChange={(e) => setCustomFlag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAddCustom();
          }}
          placeholder="e.g. thieves_tools"
          className="w-32 rounded-md border border-input bg-background px-2 py-0.5 font-mono text-xs"
        />
        <button
          type="button"
          onClick={onAddCustom}
          className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          + add flag
        </button>
      </div>
    </CollapsibleSection>
  );
}

// =============================================================================
// useConditionPillAdder — shared hook for both picker and modal
// =============================================================================

/**
 * Hook returning the three structured-pill builders. Picker and
 * modal both consume this hook so the wiring logic lives in one
 * place.
 */
export function useConditionPillAdder(
  value: ConditionAuthoring,
  onChange: (next: ConditionAuthoring) => void,
) {
  const addStructuredStatPill = useCallback(
    (
      cat: ConditionPresetCategory,
      stat: string,
      op: "<" | "<=" | "=" | "!=" | ">=" | ">" | "between",
      statValue: number,
      statValueHigh: number,
    ) => {
      const basePill = {
        category: cat,
        label: stat,
        kind: "stat" as const,
        stat,
        operator: op,
        value: statValue,
      };
      const newPill =
        op === "between"
          ? { ...basePill, valueHigh: statValueHigh }
          : basePill;
      const nextPills = [...value.pills, newPill];
      const nextOperators: ("AND" | "OR")[] =
        value.pills.length === 0 ? [] : [...value.operators, "OR"];
      onChange({ ...value, pills: nextPills, operators: nextOperators });
    },
    [value, onChange],
  );

  const addStructuredProficiencyPill = useCallback(
    (
      cat: ConditionPresetCategory,
      label: string,
      practice: string | undefined,
      _axis: "practice" | "attribute",
    ) => {
      const basePill = {
        category: cat,
        label,
        kind: "proficiency" as const,
      };
      const newPill =
        practice !== undefined ? { ...basePill, practice } : basePill;
      const nextPills = [...value.pills, newPill];
      const nextOperators: ("AND" | "OR")[] =
        value.pills.length === 0 ? [] : [...value.operators, "OR"];
      onChange({ ...value, pills: nextPills, operators: nextOperators });
    },
    [value, onChange],
  );

  const addStructuredFlagPill = useCallback(
    (cat: ConditionPresetCategory, flag: string) => {
      const newPill = {
        category: cat,
        label: flag,
        kind: "flag" as const,
        flag,
      };
      const nextPills = [...value.pills, newPill];
      const nextOperators: ("AND" | "OR")[] =
        value.pills.length === 0 ? [] : [...value.operators, "OR"];
      onChange({ ...value, pills: nextPills, operators: nextOperators });
    },
    [value, onChange],
  );

  return {
    addStructuredStatPill,
    addStructuredProficiencyPill,
    addStructuredFlagPill,
  };
}


// =============================================================================
// Pill display helpers — friendly rendering of structured pills
// =============================================================================

/**
 * Produce a user-friendly label for a structured pill. Hides the
 * internal `stat|stat|op|value` token shape and shows the author
 * what they actually authored.
 *
 *   - 'stat' kind       → "<stat> <op> <value>[ - <valueHigh>]"
 *   - 'proficiency'     → "<label>" (already includes parens / _in)
 *   - 'flag' / 'tag'    → "<label>"
 */
export function pillLabel(pill: ConditionAuthoring["pills"][number]): string {
  const k = pill.kind ?? "tag";
  switch (k) {
    case "stat": {
      const op = pill.operator ?? "=";
      const v = pill.value ?? 0;
      if (op === "between") {
        const vh = pill.valueHigh ?? v;
        return `${pill.stat ?? pill.label} ${op} ${v} - ${vh}`;
      }
      return `${pill.stat ?? pill.label} ${op} ${v}`;
    }
    case "proficiency":
    case "flag":
    case "tag":
    default:
      return pill.label;
  }
}
