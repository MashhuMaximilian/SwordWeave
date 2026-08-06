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
/**
 * Phase 8.I i2.7 (Mashu 2026-08-06): tag-enum stats compare as
 * strings (e.g. source_type == "magical"). The picker renders a
 * text input for these stats so the author can type the enum
 * value (physical / magical / mental for source_type, tiny /
 * small / medium / large / huge / gargantuan for size, etc).
 *
 * The numeric stat list is everything else.
 */
export const TAG_ENUM_STAT_VALUES: ReadonlySet<string> = new Set([
  "source_type",
  "damage_type",
  "equip_slot",
  // author-named sub-target refs follow the same path
]);

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

  // ===========================================================
  // Phase 8.I i2.7 — new atoms from the canonical PDFs.
  // These appear in the 'Stat references' section so authors
  // can build conditions like 'vitality < 50%' the same way
  // they'd build 'speed > 30' or 'carry_capacity >= 50'.
  // Engine-side readCharacterStat resolves them against
  // character.custom until the FAB layer wires real math.
  // ===========================================================
  { value: "speed", label: "speed", tone: "emerald" },
  { value: "carry_capacity", label: "carry capacity", tone: "amber" },
  { value: "load", label: "load", tone: "amber" },
  { value: "complexity", label: "complexity", tone: "violet" },
  { value: "upkeep_cost", label: "upkeep cost", tone: "violet" },
  { value: "size", label: "size", tone: "blue" },
  { value: "source_type", label: "source type", tone: "blue" },
  // equip_slot, damage_type, maintained_capability are
  // sub-target {key} pills — authors type the key after
  // picking the chip. The picker exposes them via the
  // free-text input pattern (same as behavior other).
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
  // Phase 8.I i2.7 — new boolean flags from canonical PDFs.
  // The character sheet FAB layer populates these at appropriate
  // events (combat round start, item equip, damage taken, etc).
  "combat_action",
  "is_equipped",
  "is_encumbered",
  "is_in_cover_total",
  "is_in_cover_half",
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
    value: number | string,
    valueHigh: number | string,
  ) => void;
}): ReactElement | null {
  if (category !== "actor") return null;
  const [chosenStat, setChosenStat] = useState<string | null>(null);
  const [chosenOp, setChosenOp] = useState<
    (typeof COMPARE_OPERATORS)[number]["value"]
  >("<");
  const [val, setVal] = useState("0.5");
  const [valHigh, setValHigh] = useState("1");
  const isTagEnumStat =
    chosenStat !== null && TAG_ENUM_STAT_VALUES.has(chosenStat);
  const onAddClick = () => {
    if (!chosenStat) return;
    if (isTagEnumStat) {
      // String comparison path — pass the raw string value.
      const v = val.trim();
      if (v.length === 0) return;
      const vh = valHigh.trim();
      onAddStat(chosenStat, chosenOp, v, vh.length > 0 ? vh : v);
      return;
    }
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
              placeholder={isTagEnumStat ? "enum value (e.g. magical)" : "0.5"}
              className="w-32 rounded-md border border-input bg-background px-2 py-0.5 font-mono text-xs"
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
        <div className="text-[10px] text-muted-foreground italic">
          Click <span className="font-bold text-emerald-600">+</span> to add
          proficient, <span className="font-bold text-orange-600">−</span> to add
          not_proficient. The single-axis chips
          ("any practice", "any attribute") resolve at evaluate time; the
          grouped chips ("all practices", "all saves") require every
          member to match.
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dynamic (uses currentPractice at evaluate time)
          </div>
          {/* Dynamic (any axis) — single click per axis, engine resolves
              against currentPractice / currentAttribute at evaluate time */}
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onAdd("not_proficient", "any_practice", "practice")}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
              title="Fires for any practice the character is not proficient in"
            >
              not_proficient(any practice)
            </button>
            <button
              type="button"
              onClick={() => onAdd("proficient", "any_practice", "practice")}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              title="Fires for any practice the character IS proficient in"
            >
              proficient(any practice)
            </button>
            <button
              type="button"
              onClick={() => onAdd("not_proficient_in_attribute(any)", "any_attribute", "attribute")}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
              title="Fires for any attribute the character is not proficient in"
            >
              not_proficient(any attribute)
            </button>
            <button
              type="button"
              onClick={() => onAdd("proficient_in_attribute(any)", "any_attribute", "attribute")}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              title="Fires for any attribute the character IS proficient in"
            >
              proficient(any attribute)
            </button>
          </div>

          {/* Static grouped (all-of) — fires only when the character
              is/isn't proficient in EVERY member of the axis */}
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onAdd("proficient_in(all_practices)", "all_practices", "practice")}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              title="Fires when the character is proficient in EVERY practice"
            >
              proficient(all practices)
            </button>
            <button
              type="button"
              onClick={() => onAdd("not_proficient_in(all_practices)", "all_practices", "practice")}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
              title="Fires when the character is not proficient in EVERY practice"
            >
              not_proficient(all practices)
            </button>
            <button
              type="button"
              onClick={() => onAdd("proficient_in(all_saves)", "all_saves", "practice")}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              title="Fires when the character is proficient in EVERY save"
            >
              proficient(all saves)
            </button>
            <button
              type="button"
              onClick={() => onAdd("not_proficient_in(all_saves)", "all_saves", "practice")}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
              title="Fires when the character is not proficient in EVERY save"
            >
              not_proficient(all saves)
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

        {/* Custom proficiency input — e.g. 'painting', 'thieves_tools' */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Custom (anything not in the canonical list)
          </div>
          <CustomProficiencyInput
            onAdd={(label, mode) => onAdd(label, label, mode as "practice" | "attribute")}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

/**
 * Custom proficiency input — author types any tag name
 * (e.g. 'painting', 'thieves_tools') and clicks the matching
 * +/− button to emit a structured pill.
 */
function CustomProficiencyInput({
  onAdd,
}: {
  readonly onAdd: (
    label: string,
    practice: string,
    mode: "practice" | "attribute",
  ) => void;
}): ReactElement {
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const submit = (mode: "practice" | "attribute") => {
    if (trimmed.length === 0) return;
    onAdd(`${mode === "practice" ? "proficient_in" : "proficient_in_attribute"}(${trimmed})`, trimmed, mode);
    setDraft("");
  };
  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit("practice");
        }}
        placeholder="e.g. painting, thieves_tools"
        className="w-44 rounded-md border border-input bg-background px-2 py-0.5 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => submit("practice")}
        disabled={trimmed.length === 0}
        className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/25 disabled:opacity-40 dark:text-emerald-300"
      >
        + Prof
      </button>
      <button
        type="button"
        onClick={() => submit("attribute")}
        disabled={trimmed.length === 0}
        className="rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-500/25 disabled:opacity-40 dark:text-orange-300"
      >
        + not_prof
      </button>
    </div>
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
      statValue: number | string,
      statValueHigh: number | string,
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
    case "proficiency": {
      // For dynamic axis-based pills the label is the bare
      // actor:not_proficient / actor:proficient / actor:not_proficient_in_attribute(any) /
      // actor:proficient_in_attribute(any). Map those to the
      // user-visible chip text.
      const label = pill.label;
      if (label === "not_proficient") return "not_proficient(any practice)";
      if (label === "proficient") return "proficient(any practice)";
      if (label === "not_proficient_in_attribute(any)")
        return "not_proficient(any attribute)";
      if (label === "proficient_in_attribute(any)")
        return "proficient(any attribute)";
      return label;
    }
    case "flag":
    case "tag":
    default:
      return pill.label;
  }
}
