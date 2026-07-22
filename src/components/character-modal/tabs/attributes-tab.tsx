"use client";

// =============================================================================
// AttributesTab — Tab 3 of the 7-tab character modal.
//
// Fields:
//   - attrPhysical/Mental/Magical — three int fields, must sum to 10,
//     each in [-1, +5] per the DB check constraint.
//   - attrProficient — which attribute grants the proficiency bonus.
//   - level — 1..20.
//   - startingBu — base BU pool (default 25, can be higher if the
//     DM granted bonus BU).
//
// On save, these map to the existing characters row columns
// (attr_physical, attr_mental, attr_magical, attr_proficient,
// level, starting_bu). The schema enforces the constraint via
// characters_attr_sum_check.
//
// === Phase 8.1 fix-up: state lifted to parent ===
// Originally the tab owned its own state (hydrated from localStorage).
// That caused a footgun: the footer ATTR counter is rendered in the
// parent, but it only read state once on mount, so any typing in the
// tab never reached the footer — it stayed at the initial 0/0 sum
// until the user clicked to a different tab. Lifting state up to
// TabbedCharacterForm keeps the footer honest.
//
// The number inputs use local display state (a string) so the user
// can clear the field with Backspace and type a new number without
// it snapping back to 0. The parent state holds the parsed number.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cumulativeBuForLevel,
  impliedLevelForBudget,
  levelForBuBudget,
  maxBuDebtForLevel,
} from "@/lib/engine/bu";

const PROF_OPTIONS = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
export type Prof = (typeof PROF_OPTIONS)[number];

export interface AttributesState {
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: Prof | null;
  /** Phase 8.1 batch 10: how the user is sizing their build.
   *  - "level": drives the BU budget via cumulativeBuForLevel()
   *  - "buBudget": user types a custom BU pool directly (level is
   *    derived for display only via levelForBuBudget()). */
  mode: "level" | "buBudget";
  /** Always present, even when mode="buBudget" — used to derive level
   * for debt ceiling + display ("≈ level 10"). Mutually consistent
   * with buBudget: changing one updates the other on commit. */
  level: number;
  /** Custom BU budget (only meaningful when mode="buBudget"). Always
   * 25 when mode="level" because the canon fixes starting BU at 25
   * and level drives the cumulative pool. */
  buBudget: number;
}

export const ATTRIBUTES_EMPTY: AttributesState = {
  attrPhysical: 0,
  attrMental: 0,
  attrMagical: 0,
  attrProficient: null,
  mode: "level",
  level: 1,
  buBudget: 25,
};

export const ATTRIBUTES_STORAGE_KEY =
  "swordweave:character-modal:draft:attributes";

export function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  // Phase 8.1 batch 11: no upper cap. Levels continue indefinitely
  // and the BU formula extrapolates (L100 = 2315 BU).
  return Math.max(1, Math.floor(n));
}

export function clampBu(n: number): number {
  if (!Number.isFinite(n)) return 25;
  return Math.min(100000, Math.max(0, Math.floor(n)));
}

/** Resolve the active BU budget for the current attributes state.
 *  Returns 0 if neither mode has a meaningful value yet. */
export function activeBuBudget(state: AttributesState): number {
  if (state.mode === "buBudget") {
    return clampBu(state.buBudget);
  }
  return cumulativeBuForLevel(clampLevel(state.level));
}

interface AttributesTabProps {
  state: AttributesState;
  onChange: (next: AttributesState) => void;
}

export function AttributesTab({ state, onChange }: AttributesTabProps) {
  const setField = useCallback(
    <K extends keyof AttributesState>(key: K, value: AttributesState[K]) => {
      onChange({ ...state, [key]: value });
    },
    [state, onChange],
  );

  const attrSum = state.attrPhysical + state.attrMental + state.attrMagical;
  const attrValid = attrSum === 10;
  const attrEachValid = (val: number) => val >= -1 && val <= 5;

  const AttrInput = ({
    label,
    valueKey,
  }: {
    label: string;
    valueKey: "attrPhysical" | "attrMental" | "attrMagical";
  }) => {
    const v = state[valueKey];
    const valid = attrEachValid(v);
    return (
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <IntegerField
          state={v}
          setState={(n) => setField(valueKey, n)}
          commitDefault={0}
          min={-1}
          max={5}
          maxLength={2}
          allowNegative
          className={
            valid
              ? "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none border-border focus:border-primary"
              : "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none border-destructive text-destructive"
          }
        />
      </label>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Attributes</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Physical / Mental / Magical — three attributes, each in [-1, +5].
          They must sum to exactly 10. Pick one as Proficient for the
          Proficiency Bonus to apply to all practices under that attribute.
        </p>
      </div>

      <div
        className={
          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm " +
          (attrValid
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-destructive/30 bg-destructive/10 text-destructive")
        }
      >
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Sum
        </span>
        <span className="font-mono font-bold">{attrSum} / 10</span>
        <span className="text-xs text-muted-foreground">
          {attrValid ? "✓" : "(must equal 10)"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AttrInput label="Physical" valueKey="attrPhysical" />
        <AttrInput label="Mental" valueKey="attrMental" />
        <AttrInput label="Magical" valueKey="attrMagical" />
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Proficient Attribute
        </span>
        <select
          value={state.attrProficient ?? ""}
          onChange={(e) =>
            setField(
              "attrProficient",
              e.target.value === "" ? null : (e.target.value as Prof),
            )
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">— None —</option>
          {PROF_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <BuildSizingControl
          state={state}
          onChange={onChange}
        />
    </div>
  );
}

/**
 * Build sizing control (Phase 8.1 batch 10): lets the user size
 * their build via EITHER character level OR a custom BU budget. The
 * two fields stay mutually consistent:
 *
 *   - Switching to "level" mode shows Level 1..20. The displayed BU
 *     budget derives from cumulativeBuForLevel(level).
 *   - Switching to "buBudget" mode shows a free integer BU pool.
 *     A "≈ level N" hint appears when the budget matches a canon
 *     threshold exactly.
 *
 * Level is still kept in state when in buBudget mode (it's derived
 * for display + debt ceiling computation). Starting BU is no longer
 * a user-editable field — per Mashu 2026-07-21 it's canonically fixed
 * at 25; the cumulative pool grows via level.
 */
function BuildSizingControl({
  state,
  onChange,
}: {
  state: AttributesState;
  onChange: (next: AttributesState) => void;
}) {
  const derivedLevel =
    state.mode === "buBudget" ? levelForBuBudget(state.buBudget) : null;
  const derivedBudget =
    state.mode === "level" ? cumulativeBuForLevel(state.level) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Size by
        </span>
        <div
          role="tablist"
          aria-label="Build sizing mode"
          className="inline-flex overflow-hidden rounded-md border border-border bg-card text-xs"
        >
          {(["level", "buBudget"] as const).map((m) => {
            const active = state.mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange({ ...state, mode: m })}
                className={
                  "px-3 py-1.5 font-medium transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted")
                }
              >
                {m === "level" ? "By Level" : "By BU"}
              </button>
            );
          })}
        </div>
      </div>

      {state.mode === "level" ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Level (no upper cap)
          </span>
          <IntegerField
            state={state.level}
            setState={(v) => {
              const next = clampLevel(v);
              // Phase 8.1 batch 11 fix: a single onChange call must
              // mutate BOTH level AND buBudget atomically. Calling
              // setField twice in sequence overwrites the first
              // update because each setField spreads the same stale
              // `state` closure. The fix is to compute the merged
              // state once and call onChange exactly once.
              onChange({
                ...state,
                level: next,
                buBudget: cumulativeBuForLevel(next),
              });
            }}
            commitDefault={1}
            min={1}
            maxLength={4}
          />
          <span className="block text-xs text-muted-foreground">
            BU budget:{" "}
            <span className="font-mono font-semibold text-foreground">
              {derivedBudget}
            </span>
            {derivedBudget != null &&
              ` (debt ceiling −${maxBuDebtForLevel(state.level)})`}
          </span>
        </label>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            BU budget
          </span>
          <IntegerField
            state={state.buBudget}
            setState={(v) => {
              const next = clampBu(v);
              // Same atomic-update fix as the level field above.
              // Single onChange call merges level + buBudget.
              // Phase 8.1 batch 11: in BU mode the footer reads
              // attributes.level directly, so we need to update it
              // to the IMPLIED level (highest L where cumulative
              // budget <= typed budget). For budgets that exactly
              // match a canon threshold both are the same value.
              const implied = impliedLevelForBudget(next);
              onChange({
                ...state,
                buBudget: next,
                level: implied,
              });
            }}
            commitDefault={25}
            min={0}
            maxLength={6}
          />
          <span className="block text-xs text-muted-foreground">
            {derivedLevel != null
              ? `Matches level ${derivedLevel} (debt ceiling −${maxBuDebtForLevel(derivedLevel)})`
              : `Between canon thresholds — using implied level ${state.level} (debt ceiling −${maxBuDebtForLevel(state.level)})`}
          </span>
        </label>
      )}
    </div>
  );
}

void ATTRIBUTES_EMPTY; // re-exported above

// =============================================================================
// IntegerField — shared numeric input used by Level + Starting BU.
// Behavior:
//   - Uncontrolled display: the input holds its own `draft` string so
//     the user can freely backspace / clear / type without React
//     fighting them. Parent state is updated on every keystroke for
//     live footer mirrors, but the visible text is the user's literal
//     input until blur (where parse + normalize happens).
//   - On blur: empty / partial → reset to commitDefault. Non-digit
//     input is filtered out by the regex during typing.
// =============================================================================

interface IntegerFieldProps {
  state: number;
  setState: (v: number) => void;
  commitDefault: number;
  min: number;
  /**
   * Maximum allowed value. Optional — omit when there's no upper
   * cap (Phase 8.1 batch 11 made the level field unbounded).
   */
  max?: number;
  maxLength: number;
  /** Allow leading minus sign (used for attributes which can be -1). */
  allowNegative?: boolean;
  className?: string;
}

function IntegerField({
  state,
  setState,
  commitDefault,
  min,
  max,
  maxLength,
  allowNegative = false,
  className,
}: IntegerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string>(
    Number.isFinite(state) ? String(state) : "",
  );
  // Re-sync when parent state changes from outside (localStorage
  // hydration, tab reset). Skipped while the input has focus.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setDraft(Number.isFinite(state) ? String(state) : "");
  }, [state]);
  const pattern = allowNegative ? /^-?\d*$/ : /^\d*$/;
  const defaultClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none";
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern={allowNegative ? "-?\\d*" : "\\d*"}
      maxLength={maxLength}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        if (!pattern.test(raw)) return;
        setDraft(raw);
        if (raw === "" || raw === "-") {
          // mid-edit empty / lone-minus — don't commit a number yet.
          return;
        }
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
          const clamped =
            max != null
              ? Math.min(max, Math.max(min, parsed))
              : Math.max(min, parsed);
          setState(clamped);
        }
      }}
      onBlur={(e) => {
        const raw = e.target.value.trim();
        if (raw === "" || raw === "-") {
          setState(commitDefault);
          setDraft(String(commitDefault));
          e.target.value = String(commitDefault);
          return;
        }
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
          // Phase 8.1 batch 11: max is optional. When omitted, only
          // the min clamp applies (used for level which has no cap).
          const clamped =
            max != null
              ? Math.min(max, Math.max(min, parsed))
              : Math.max(min, parsed);
          setState(clamped);
          setDraft(String(clamped));
          e.target.value = String(clamped);
        } else {
          setState(commitDefault);
          setDraft(String(commitDefault));
          e.target.value = String(commitDefault);
        }
      }}
      className={className ?? defaultClass}
    />
  );
}