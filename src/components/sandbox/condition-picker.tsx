"use client";

/**
 * ConditionPicker — Phase 7 Q-B v1 + Q-B-m4 (compound AND/OR)
 *
 * 2-section picker:
 *
 *   1. Categories (multi-select). Drives which per-category
 *      pill sections render.
 *   2. Trigger expression chain — an ORDERED list of pills
 *      joined by AND/OR operators. Editing happens in a
 *      dedicated modal so drag-and-drop reorder and operator
 *      toggling have room to breathe. The trigger card
 *      surfaces a compact, real-time summary of the chain.
 *
 * UX shape (Phase 7 Q-B m4):
 *
 *   Triggers when…
 *   ┌────────────────────────────────────────────────────────┐
 *   │ Categories                                              │
 *   │   [Target] [Self] [Scene]                               │
 *   │                                                         │
 *   │ Current expression                                      │
 *   │   Prone OR Grappled AND Stance          [edit]          │
 *   │                                                         │
 *   │ ▾ Target pills (tap to add to end of chain)             │
 *   │   [Bleeding] [Prone] [Grappled]                         │
 *   │ ▸ Self pills                                            │
 *   │ ▸ Scene pills                                           │
 *   │                                                         │
 *   │ Or describe it yourself                                 │
 *   │ [_______________________________________________________]│
 *   └────────────────────────────────────────────────────────┘
 *
 * Edit modal: vertical drag-and-drop list of pills, AND/OR
 * chips between adjacent pairs, × to remove. New pills
 * default to OR before them.
 *
 * Storage shape (no DB migration):
 *   { kind: "compound", tokens: ["target:Prone", "OR",
 *     "target:Grappled", "AND", "actor:Stance"] }
 * Single-pill chains stay as { kind: "tags", customTags: [...] }
 * for backwards compat.
 */

import { useState, type ReactElement } from "react";
import {
  CONDITION_PRESETS,
  type ConditionAuthoring,
  type ConditionPresetCategory,
  type ConditionPresetEntry,
} from "@/types/condition";
import {
  ALL_PRACTICES,
} from "@/types/modifier";
import { ExpressionEditorModal } from "./expression-editor-modal";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

const CATEGORY_LABELS: Record<ConditionPresetCategory, string> = {
  target: "Target",
  // The canonical category key is "actor" (matches presetKey
  // prefixes like actor-stance, actor-below-half-hp). The display
  // label is "Self" per the user's UX rule.
  actor: "Self",
  scene: "Scene",
};

const CATEGORY_ORDER: ConditionPresetCategory[] = ["target", "actor", "scene"];

interface ConditionPickerProps {
  readonly value: ConditionAuthoring;
  readonly onChange: (next: ConditionAuthoring) => void;
}

// =============================================================================
// i2.6 — Structured-pill chip sections
// =============================================================================

const SELF_STAT_REFS: Array<{ value: string; label: string; tone: string }> = [
  { value: "vitality",      label: "vitality",     tone: "violet" },
  { value: "vitality_pct",  label: "vitality %",   tone: "violet" },
  { value: "save_dc",       label: "save DC",      tone: "violet" },
  { value: "block_value",   label: "block value",  tone: "amber"  },
  { value: "physical",      label: "physical",     tone: "blue"    },
  { value: "mental",        label: "mental",       tone: "blue"    },
  { value: "magical",       label: "magical",      tone: "blue"    },
  ...ALL_PRACTICES.map((p) => ({ value: p, label: p, tone: "emerald" })),
];

const STATUS_FLAGS = [
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

const COMPARE_OPERATORS: Array<{ value: "<" | "<=" | "=" | "!=" | ">=" | ">" | "between"; label: string }> = [
  { value: "<",  label: "<"  },
  { value: "<=", label: "≤" },
  { value: "=",  label: "="  },
  { value: "!=", label: "≠" },
  { value: ">=", label: "≥" },
  { value: ">",  label: ">"  },
  { value: "between", label: "between" },
];

function PickerStatSection({
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
}) {
  // Only show stat chips for the actor (self) axis — target/scene
  // stat refs aren't a meaningful UI affordance (the target/scene
  // tags are descriptive).
  if (category !== "actor") return null;
  const [chosenStat, setChosenStat] = useState<string | null>(null);
  const [chosenOp, setChosenOp] = useState<typeof COMPARE_OPERATORS[number]["value"]>("<");
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
      {chosenStat ? (
        <div className="mt-2 rounded-md border border-dashed border-border bg-background/30 p-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Build:</span>
            <code className="font-mono text-foreground">
              actor:{chosenStat} &lt;op&gt; {val}
              {chosenOp === "between" ? ` - ${valHigh}` : ""}
            </code>
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
              className="w-20 rounded-md border border-input bg-background px-2 py-0.5 font-mono text-xs"
            />
            {chosenOp === "between" ? (
              <>
                <span className="text-muted-foreground">high:</span>
                <input
                  type="text"
                  value={valHigh}
                  onChange={(e) => setValHigh(e.target.value)}
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
    </CollapsibleSection>
  );
}

function PickerProficiencySection({
  category,
  pills,
  onAdd,
}: {
  readonly category: ConditionPresetCategory;
  readonly pills: ConditionAuthoring["pills"];
  readonly onAdd: (label: string, practice?: string) => void;
}) {
  if (category !== "actor") return null;
  return (
    <CollapsibleSection
      title="Proficiency"
      count={ALL_PRACTICES.length * 2 + 2}
    >
      <div className="mt-1 space-y-1.5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dynamic (uses currentPractice at evaluate time)
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onAdd("not_proficient")}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700 dark:text-orange-300 hover:bg-orange-500/20"
            >
              not_proficient
            </button>
            <button
              type="button"
              onClick={() => onAdd("proficient")}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
            >
              proficient
            </button>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Static (per practice)
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {ALL_PRACTICES.map((p) => (
              <span key={p} className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => onAdd(`proficient_in(${p})`, p)}
                  className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
                  title={`Proficient in ${p}`}
                >
                  +
                </button>
                <span className="font-mono">{p}</span>
                <button
                  type="button"
                  onClick={() => onAdd(`not_proficient_in(${p})`, p)}
                  className="text-orange-700 hover:text-orange-900 dark:text-orange-300"
                  title={`Not proficient in ${p}`}
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

function PickerStatusFlagsSection({
  category,
  pills,
  onAdd,
}: {
  readonly category: ConditionPresetCategory;
  readonly pills: ConditionAuthoring["pills"];
  readonly onAdd: (flag: string) => void;
}) {
  if (category !== "actor") return null;
  return (
    <CollapsibleSection
      title="Status flags"
      count={STATUS_FLAGS.length}
    >
      <div className="mt-1 flex flex-wrap gap-1">
        {STATUS_FLAGS.map((flag) => (
          <button
            key={flag}
            type="button"
            onClick={() => onAdd(flag)}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
          >
            + {flag}
          </button>
        ))}
      </div>
    </CollapsibleSection>
  );
}

export function ConditionPicker({
  value,
  onChange,
}: ConditionPickerProps): ReactElement {
  const [editorOpen, setEditorOpen] = useState(false);

  const toggleCategory = (cat: ConditionPresetCategory) => {
    const has = value.categories.includes(cat);
    // If removing the category, drop pills in it too. Pills carry
    // their own category, so they're routable — but if the user
    // unchecks Target, it's surprising to keep Target pills around.
    const nextPills = has
      ? value.pills.filter((p) => p.category !== cat)
      : value.pills;
    // Operators array stays length = pills.length - 1. After
    // removing pills, re-index the operators by truncating to
    // the new pill count - 1.
    const nextOperators: ("AND" | "OR")[] = nextPills.length > 0
      ? (value.operators.slice(0, nextPills.length - 1) as ("AND" | "OR")[])
      : [];
    onChange({
      ...value,
      categories: has
        ? value.categories.filter((c) => c !== cat)
        : [...value.categories, cat],
      pills: nextPills,
      operators: nextOperators,
    });
  };

  const setNarrative = (text: string) => {
    onChange({ ...value, narrative: text });
  };

  const setIncludeTags = (checked: boolean) => {
    onChange({ ...value, includeTags: checked });
  };

  const addPillAtEnd = (category: ConditionPresetCategory, label: string) => {
    const trimmed = label.trim();
    if (trimmed.length === 0) return;
    const dup = value.pills.some(
      (p) => p.category === category && p.label === trimmed,
    );
    if (dup) return;
    const nextPills = [...value.pills, { category, label: trimmed }];
    // Add OR operator before the new pill (unless chain was empty).
    const nextOperators: ("AND" | "OR")[] = value.pills.length === 0
      ? []
      : [...value.operators, "OR"];
    onChange({
      ...value,
      pills: nextPills,
      operators: nextOperators,
    });
  };

  const removeCustomPill = (category: ConditionPresetCategory, label: string) => {
    const idx = value.pills.findIndex(
      (p) => p.category === category && p.label === label,
    );
    if (idx === -1) return;
    // Remove the pill. Also remove the operator that PRECEDED it
    // (at index idx-1) — operators array stays length = pills - 1.
    const nextPills = value.pills.filter(
      (p) => !(p.category === category && p.label === label),
    );
    // If we removed the pill at idx, we need to drop the operator
    // at idx-1 (the one BEFORE the removed pill). Pills at indices
    // ≥ idx shift down by 1, but operators at indices < idx stay,
    // and operators at indices ≥ idx also shift down by 1.
    const nextOperators: ("AND" | "OR")[] = [];
    for (let i = 0; i < nextPills.length - 1; i++) {
      // Operator at NEW index i corresponds to OLD index i if i < idx,
      // else OLD index i + 1.
      const oldIdx = i < idx ? i : i + 1;
      nextOperators.push(value.operators[oldIdx] ?? "OR");
    }
    onChange({
      ...value,
      pills: nextPills,
      operators: nextOperators,
    });
  };

  // i2.6 — structured-pill helpers. Each builds a pill with the
  // right `kind` field and the right metadata for its kind.
  const addStructuredStatPill = (
    cat: ConditionPresetCategory,
    stat: string,
    op: '<' | '<=' | '=' | '!=' | '>=' | '>' | 'between',
    statValue: number,
    statValueHigh: number,
  ) => {
    const label = stat;
    const basePill = {
      category: cat,
      label,
      kind: 'stat' as const,
      stat,
      operator: op,
      value: statValue,
    };
    const newPill = op === 'between'
      ? { ...basePill, valueHigh: statValueHigh }
      : basePill;
    const nextPills = [...value.pills, newPill];
    const nextOperators: ('AND' | 'OR')[] = value.pills.length === 0
      ? []
      : [...value.operators, 'OR'];
    onChange({ ...value, pills: nextPills, operators: nextOperators });
  };

  const addStructuredProficiencyPill = (
    cat: ConditionPresetCategory,
    label: string,
    practice: string | undefined,
  ) => {
    const basePill = {
      category: cat,
      label,
      kind: 'proficiency' as const,
    };
    const newPill = practice !== undefined
      ? { ...basePill, practice }
      : basePill;
    const nextPills = [...value.pills, newPill];
    const nextOperators: ('AND' | 'OR')[] = value.pills.length === 0
      ? []
      : [...value.operators, 'OR'];
    onChange({ ...value, pills: nextPills, operators: nextOperators });
  };

  const addStructuredFlagPill = (
    cat: ConditionPresetCategory,
    flag: string,
  ) => {
    const newPill = {
      category: cat,
      label: flag,
      kind: 'flag' as const,
      flag,
    };
    const nextPills = [...value.pills, newPill];
    const nextOperators: ('AND' | 'OR')[] = value.pills.length === 0
      ? []
      : [...value.operators, 'OR'];
    onChange({ ...value, pills: nextPills, operators: nextOperators });
  };

  const showIncludeTagsCheckbox = value.pills.length === 0;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      {/* ── Header ── */}
      <span className="text-sm font-medium">Triggers when…</span>

      {/* ── Section 1: category multi-select ── */}
      <div className="mt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Categories
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const selected = value.categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={selected}
                className={
                  selected
                    ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent"
                }
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: current expression summary + edit button ── */}
      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current expression
          </div>
          {value.pills.length > 0 ? (
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:bg-accent"
            >
              edit
            </button>
          ) : null}
        </div>
        {value.pills.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No expression yet — tap pills below to start, or write a
            narrative below.
          </p>
        ) : (
          <p
            className="mt-1.5 cursor-pointer rounded-md border border-dashed border-border bg-background/30 px-2 py-1 text-xs hover:bg-accent"
            onClick={() => setEditorOpen(true)}
            title="Click to edit the full trigger expression"
          >
            <ExpressionSummaryLine
              pills={value.pills}
              operators={value.operators}
            />
          </p>
        )}
      </div>

      {/* ── Section 3: per-category custom pill authoring ── */}
      {value.categories.length > 0 ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {value.categories.map((cat) => {
            // Per-category sections are now the "add to end" affordance.
            // The actual chain editing happens in the modal.
            const pillsInCat = value.pills.filter(
              (p) => p.category === cat,
            );
            const suggestions = CONDITION_PRESETS.filter(
              (p) => p.category === cat,
            );
            return (
              <div key={cat}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[cat]} pills ({pillsInCat.length})
                </div>
                {pillsInCat.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {pillsInCat.map((p) => (
                      <span
                        key={`${p.category}:${p.label}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                      >
                        {p.label}
                        <button
                          type="button"
                          onClick={() => removeCustomPill(p.category, p.label)}
                          aria-label={`Remove pill ${p.label}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <CustomPillInput
                  onAdd={(label) => addPillAtEnd(cat, label)}
                />
                {suggestions.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {suggestions.map((s) => {
                      const alreadyAdded = pillsInCat.some(
                        (p) => p.label === s.label,
                      );
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => addPillAtEnd(cat, s.label)}
                          disabled={alreadyAdded}
                          title={s.hint ?? s.label}
                          className={
                            alreadyAdded
                              ? "rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground line-through"
                              : "rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                          }
                        >
                          + {s.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* i2.6 structured-pill chip sections — stat refs,
                    proficiency pills, status flags. Each chip
                    click creates a structured pill (kind: 'stat' |
                    'proficiency' | 'flag') instead of a plain
                    text label. */}
                <PickerStatSection
                  category={cat}
                  pills={value.pills}
                  onAddStat={(stat, op, val, valHigh) =>
                    addStructuredStatPill(cat, stat, op, val, valHigh)
                  }
                />
                <PickerProficiencySection
                  category={cat}
                  pills={value.pills}
                  onAdd={(label, practice) =>
                    addStructuredProficiencyPill(cat, label, practice)
                  }
                />
                <PickerStatusFlagsSection
                  category={cat}
                  pills={value.pills}
                  onAdd={(flag) => addStructuredFlagPill(cat, flag)}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Section 4: free-text narrative escape hatch ── */}
      <div className="mt-3 border-t border-border pt-3">
        <label
          htmlFor="condition-narrative"
          className="block text-xs font-medium text-muted-foreground"
        >
          Or describe it yourself
        </label>
        <textarea
          id="condition-narrative"
          value={value.narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={2}
          placeholder="e.g. when tracking by smell or in fog"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none ring-ring focus:ring-2"
        />
        {showIncludeTagsCheckbox ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={value.includeTags}
              onChange={(e) => setIncludeTags(e.target.checked)}
              className="size-3.5"
            />
            Show custom pills as separate badges on the character sheet
          </label>
        ) : null}
      </div>

      {/* ── Modal editor (drag-and-drop reorder + operator toggling) ── */}
      <ExpressionEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

// =============================================================================
// Expression summary line — compact real-time rendering of the chain
// =============================================================================

function ExpressionSummaryLine({
  pills,
  operators,
}: {
  readonly pills: readonly { category: ConditionPresetCategory; label: string }[];
  readonly operators: readonly ("AND" | "OR")[];
}): ReactElement {
  if (pills.length === 0) return <span>—</span>;
  const parts: ReactElement[] = [];
  for (let i = 0; i < pills.length; i++) {
    const pill = pills[i]!;
    parts.push(
      <span
        key={`p${i}`}
        className="inline-flex items-center rounded-sm border border-border bg-secondary/40 px-1.5 py-0.5 text-[11px] font-medium"
      >
        {pill.label}
      </span>,
    );
    if (i < operators.length) {
      const op = operators[i]!;
      parts.push(
        <span
          key={`op${i}`}
          className={
            op === "AND"
              ? "mx-1 text-[10px] font-bold uppercase text-amber-600"
              : "mx-1 text-[10px] font-bold uppercase text-blue-600"
          }
        >
          {op}
        </span>,
      );
    }
  }
  return <span className="inline-flex flex-wrap items-center gap-0.5">{parts}</span>;
}

// =============================================================================
// Custom pill input (per-category)
// =============================================================================

function CustomPillInput({
  onAdd,
}: {
  readonly onAdd: (label: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const t = draft.trim();
    if (t.length === 0) return;
    onAdd(t);
    setDraft("");
  };

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="add a pill…"
        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none ring-ring focus:ring-2"
      />
      <button
        type="button"
        onClick={submit}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs hover:bg-accent"
      >
        + add
      </button>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

export type { ConditionPresetEntry };

/**
 * Convert a legacy `{key, operator, value}` triple into a
 * `ConditionAuthoring` value. Used by `fromHardModifier` to populate
 * the new `v1Condition` field when loading old rows.
 */
export function conditionAuthoringFromLegacy(
  conditionKey: string,
  conditionOperator: string,
  conditionValue: string,
): ConditionAuthoring {
  if (!conditionKey && !conditionOperator && !conditionValue) {
    return {
      categories: [],
      pills: [],
      operators: [],
      narrative: "",
      includeTags: false,
    };
  }
  void conditionOperator;
  // Legacy keys like "target-prone" carry a category prefix in v1.
  // Map that prefix back to a category so the picker lights up the
  // correct bucket on load.
  let categories: ConditionPresetCategory[] = [];
  if (conditionKey.startsWith("target-")) categories = ["target"];
  else if (conditionKey.startsWith("scene-")) categories = ["scene"];
  else if (conditionKey.startsWith("actor-")) categories = ["actor"];
  return {
    categories,
    pills: [],
    operators: [],
    narrative: conditionValue || conditionKey,
    includeTags: false,
  };
}

/**
 * Convert the picker's `ConditionAuthoring` back to the legacy
 * triple fields, so the existing `toHardModifier` path keeps working
 * during the migration window.
 */
export function legacyFieldsFromAuthoring(
  authoring: ConditionAuthoring,
): {
  conditionMode: "always" | "custom";
  conditionKey: string;
  conditionOperator: "equals";
  conditionValue: string;
} {
  const isEmpty =
    authoring.categories.length === 0 &&
    authoring.pills.length === 0 &&
    authoring.narrative.trim().length === 0;
  if (isEmpty) {
    return {
      conditionMode: "always",
      conditionKey: "",
      conditionOperator: "equals",
      conditionValue: "",
    };
  }
  const firstPill = authoring.pills[0];
  const conditionKey = firstPill
    ? `${firstPill.category}:${firstPill.label}`
    : "";
  return {
    conditionMode: "custom",
    conditionKey,
    conditionOperator: "equals",
    conditionValue:
      authoring.narrative.trim() ||
      authoring.pills
        .map((p) => `${p.category}:${p.label}`)
        .join(", ") ||
      "",
  };
}