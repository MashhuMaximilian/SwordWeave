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

import { useCallback } from "react";

const PROF_OPTIONS = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
export type Prof = (typeof PROF_OPTIONS)[number];

export type AttributesState = {
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: Prof | null;
  level: number;
  startingBu: number;
};

export const ATTRIBUTES_EMPTY: AttributesState = {
  attrPhysical: 0,
  attrMental: 0,
  attrMagical: 0,
  attrProficient: null,
  level: 1,
  startingBu: 25,
};

export const ATTRIBUTES_STORAGE_KEY =
  "swordweave:character-modal:draft:attributes";

export function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

export function clampBu(n: number): number {
  if (!Number.isFinite(n)) return 25;
  return Math.min(1000, Math.max(0, Math.floor(n)));
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
        <input
          type="number"
          inputMode="numeric"
          min={-1}
          max={5}
          step={1}
          value={Number.isFinite(v) ? v : ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              // Allow the field to be empty mid-edit. Park at -1 (the
              // legal minimum) so the validity badge is honest, but
              // don't write back to the parent yet — wait for blur.
              e.currentTarget.dataset["dirty"] = "1";
              return;
            }
            const parsed = Number.parseInt(raw, 10);
            if (Number.isFinite(parsed)) {
              setField(valueKey, parsed);
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.dataset["dirty"] === "1") {
              // User cleared the field and tabbed out without typing
              // a new value. Reset to 0.
              setField(valueKey, 0);
              e.currentTarget.dataset["dirty"] = "0";
            }
          }}
          className={
            "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none " +
            (valid
              ? "border-border focus:border-primary"
              : "border-destructive text-destructive")
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

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Level</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            step={1}
            value={Number.isFinite(state.level) ? state.level : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                e.currentTarget.dataset["dirty"] = "1";
                return;
              }
              const parsed = Number.parseInt(raw, 10);
              if (Number.isFinite(parsed)) {
                setField("level", clampLevel(parsed));
              }
            }}
            onBlur={(e) => {
              if (e.currentTarget.dataset["dirty"] === "1") {
                setField("level", 1);
                e.currentTarget.dataset["dirty"] = "0";
              }
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Starting BU
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            step={1}
            value={Number.isFinite(state.startingBu) ? state.startingBu : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                e.currentTarget.dataset["dirty"] = "1";
                return;
              }
              const parsed = Number.parseInt(raw, 10);
              if (Number.isFinite(parsed)) {
                setField("startingBu", clampBu(parsed));
              }
            }}
            onBlur={(e) => {
              if (e.currentTarget.dataset["dirty"] === "1") {
                setField("startingBu", 25);
                e.currentTarget.dataset["dirty"] = "0";
              }
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

void ATTRIBUTES_EMPTY; // re-exported above