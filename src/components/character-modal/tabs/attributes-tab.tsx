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
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "swordweave:character-modal:draft:attributes";

const PROF_OPTIONS = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
type Prof = (typeof PROF_OPTIONS)[number];

type AttributesState = {
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: Prof | null;
  level: number;
  startingBu: number;
};

const EMPTY: AttributesState = {
  attrPhysical: 0,
  attrMental: 0,
  attrMagical: 0,
  attrProficient: null,
  level: 1,
  startingBu: 25,
};

function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

function clampBu(n: number): number {
  if (!Number.isFinite(n)) return 25;
  return Math.min(1000, Math.max(0, Math.floor(n)));
}

function load(): AttributesState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AttributesState>;
    return {
      ...EMPTY,
      ...parsed,
      level: clampLevel(parsed.level ?? EMPTY.level),
      startingBu: clampBu(parsed.startingBu ?? EMPTY.startingBu),
      attrProficient:
        parsed.attrProficient &&
        (PROF_OPTIONS as readonly string[]).includes(parsed.attrProficient)
          ? (parsed.attrProficient as Prof)
          : null,
    };
  } catch {
    return EMPTY;
  }
}

export function AttributesTab() {
  const [state, setState] = useState<AttributesState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [state, hydrated]);

  const setField = useCallback(
    <K extends keyof AttributesState>(key: K, value: AttributesState[K]) => {
      setState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const attrSum = useMemo(
    () => state.attrPhysical + state.attrMental + state.attrMagical,
    [state.attrPhysical, state.attrMental, state.attrMagical],
  );
  const attrValid = attrSum === 10;
  const attrEachValid = (val: number) => val >= -1 && val <= 5;

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

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
          min={-1}
          max={5}
          step={1}
          value={v}
          onChange={(e) =>
            setField(valueKey, Number.parseInt(e.target.value, 10) || 0)
          }
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
        <span className="font-mono font-bold">
          {attrSum} / 10
        </span>
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
              e.target.value === ""
                ? null
                : (e.target.value as Prof),
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
            min={1}
            max={20}
            step={1}
            value={state.level}
            onChange={(e) =>
              setField("level", clampLevel(Number.parseInt(e.target.value, 10) || 1))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Starting BU
          </span>
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={state.startingBu}
            onChange={(e) =>
              setField(
                "startingBu",
                clampBu(Number.parseInt(e.target.value, 10) || 25),
              )
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

export const ATTRIBUTES_EMPTY = EMPTY;
export const ATTRIBUTES_STORAGE_KEY = STORAGE_KEY;
export type { AttributesState };