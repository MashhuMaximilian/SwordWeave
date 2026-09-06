"use client";

/**
 * Phase 9.1 (Mashu 2026-09-06): /characters/new form.
 *
 * Single-page character creator. Captures the foundation:
 *   - Name (required)
 *   - Size (TINY/SMALL/MEDIUM/LARGE/HUGE)
 *   - Level (1+)
 *   - Three attributes (Physical / Mental / Magical; -1 to 5; sum = 10)
 *   - Proficient attribute (PHYSICAL / MENTAL / MAGICAL / none)
 *   - Backstory freeform (origin / motivation / ties / flaw — all optional)
 *
 * On save, POST /api/characters with the foundation payload and a
 * `mode: BUILD` hint (the API persists `mode: BUILD` via the column
 * we added in migration 0053). Then router.push to the new
 * character's sheet URL with `?mode=BUILD` so the page renders the
 * BUILD-mode affordances.
 *
 * Why a client component: form state is local, controlled inputs need
 * real-time validation (attr sum = 10), and router.push is the way to
 * land on /characters/[id] without a full page reload.
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const SIZE_OPTIONS = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
] as const;
type Size = (typeof SIZE_OPTIONS)[number];

const PROF_OPTIONS = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
type Prof = (typeof PROF_OPTIONS)[number];

interface FormState {
  name: string;
  size: Size;
  level: number;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: Prof | null;
  backstory: {
    origin: string;
    motivation: string;
    ties: string;
    flaw: string;
  };
}

const INITIAL_STATE: FormState = {
  name: "",
  size: "MEDIUM",
  level: 1,
  attrPhysical: 4,
  attrMental: 3,
  attrMagical: 3,
  attrProficient: "PHYSICAL",
  backstory: { origin: "", motivation: "", ties: "", flaw: "" },
};

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function NewCharacterForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const attrSum = useMemo(
    () =>
      state.attrPhysical + state.attrMental + state.attrMagical,
    [state.attrPhysical, state.attrMental, state.attrMagical],
  );
  const attrSumValid = attrSum === 10;
  const eachValid =
    state.attrPhysical >= -1 &&
    state.attrPhysical <= 5 &&
    state.attrMental >= -1 &&
    state.attrMental <= 5 &&
    state.attrMagical >= -1 &&
    state.attrMagical <= 5;
  const nameValid = state.name.trim().length > 0;
  const levelValid = state.level >= 1 && Number.isFinite(state.level);
  const formValid =
    nameValid && levelValid && attrSumValid && eachValid && !isPending;

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setState((s) => ({ ...s, [key]: value }));
    },
    [],
  );

  const setAttr = useCallback(
    (which: "attrPhysical" | "attrMental" | "attrMagical", raw: string) => {
      const parsed = parseInt(raw, 10);
      const next = Number.isNaN(parsed) ? 0 : parsed;
      setState((s) => ({ ...s, [which]: next }));
    },
    [],
  );

  const setBackstory = useCallback(
    (key: keyof FormState["backstory"], value: string) => {
      setState((s) => ({ ...s, backstory: { ...s.backstory, [key]: value } }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!formValid) {
        setError(
          attrSumValid
            ? "Please fill all required fields."
            : `Attributes must sum to 10 (currently ${attrSum}).`,
        );
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch("/api/characters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: state.name.trim(),
              size: state.size,
              level: state.level,
              attrPhysical: state.attrPhysical,
              attrMental: state.attrMental,
              attrMagical: state.attrMagical,
              attrProficient: state.attrProficient,
              startingBu: 25,
              buSpent: 0,
              dmBonusBu: 0,
              backstory: {
                origin: state.backstory.origin.trim(),
                motivation: state.backstory.motivation.trim(),
                ties: state.backstory.ties.trim(),
                flaw: state.backstory.flaw.trim(),
              },
              sourceOrigin: "manual",
              primitiveInstances: [],
              capabilityInstanceIds: [],
              itemInstanceIds: [],
              practiceSlices: {},
            }),
          });
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
              details?: unknown;
            };
            const detail = payload.details
              ? `: ${JSON.stringify(payload.details)}`
              : "";
            setError(payload.error ?? `Failed to create character.${detail}`);
            return;
          }
          const created = (await res.json()) as {
            character?: { id: string };
          };
          const id = created.character?.id;
          if (!id) {
            setError("Server did not return a character id.");
            return;
          }
          // Phase 9.1: switch to BUILD mode and navigate to the sheet.
          // Two-step: POST /api/characters/[id]/mode is fire-and-forget;
          // the router push uses ?mode=BUILD as a hint, but the page
          // reads the persisted column on render.
          await fetch(`/api/characters/${id}/mode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "BUILD" }),
          }).catch(() => {
            // Mode flip is best-effort; the page will still load.
          });
          router.push(`/characters/${id}?mode=BUILD`);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unexpected error. Please try again.",
          );
        }
      });
    },
    [
      formValid,
      attrSumValid,
      attrSum,
      state,
      router,
    ],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-10 space-y-8 rounded-2xl border border-border bg-card/60 p-6 shadow-sm sm:p-8"
      aria-describedby={error ? "new-character-error" : undefined}
    >
      {/* Name + size + level */}
      <section className="grid gap-5 sm:grid-cols-3">
        <Field label="Name" required className="sm:col-span-2">
          <input
            type="text"
            value={state.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Lyra the Cartographer"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Size">
          <select
            value={state.size}
            onChange={(e) =>
              setField("size", e.target.value as Size)
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* Attributes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Attributes
          </h2>
          <span
            className={
              attrSumValid
                ? "text-xs font-semibold text-emerald-500"
                : "text-xs font-semibold text-rose-500"
            }
          >
            Sum: {attrSum} / 10
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Three attributes, each between -1 and 5, summing to 10. Pick
          one to be your proficiency (gains +PB on its saving throw and
          one practice).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <AttrInput
            label="Physical"
            value={state.attrPhysical}
            onChange={(v) => setAttr("attrPhysical", v)}
            proficient={state.attrProficient === "PHYSICAL"}
            onProficient={() =>
              setField(
                "attrProficient",
                state.attrProficient === "PHYSICAL" ? null : "PHYSICAL",
              )
            }
          />
          <AttrInput
            label="Mental"
            value={state.attrMental}
            onChange={(v) => setAttr("attrMental", v)}
            proficient={state.attrProficient === "MENTAL"}
            onProficient={() =>
              setField(
                "attrProficient",
                state.attrProficient === "MENTAL" ? null : "MENTAL",
              )
            }
          />
          <AttrInput
            label="Magical"
            value={state.attrMagical}
            onChange={(v) => setAttr("attrMagical", v)}
            proficient={state.attrProficient === "MAGICAL"}
            onProficient={() =>
              setField(
                "attrProficient",
                state.attrProficient === "MAGICAL" ? null : "MAGICAL",
              )
            }
          />
        </div>
      </section>

      {/* Level */}
      <section className="grid gap-5 sm:grid-cols-3">
        <Field label="Level">
          <input
            type="number"
            min={1}
            step={1}
            value={state.level}
            onChange={(e) =>
              setField(
                "level",
                clampInt(parseInt(e.target.value, 10), 1, Number.MAX_SAFE_INTEGER),
              )
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <div className="sm:col-span-2 self-end text-sm text-muted-foreground">
          Level drives the canon BU budget (cumulative formula: L4 = 59,
          L10 = 196). No upper cap.
        </div>
      </section>

      {/* Backstory */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Backstory (optional)
        </h2>
        <p className="text-sm text-muted-foreground">
          Freeform notes — only you will see them. Useful for keeping
          track of who this character is.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <BackstoryField
            label="Origin"
            value={state.backstory.origin}
            onChange={(v) => setBackstory("origin", v)}
            placeholder="Where they came from"
          />
          <BackstoryField
            label="Motivation"
            value={state.backstory.motivation}
            onChange={(v) => setBackstory("motivation", v)}
            placeholder="What drives them forward"
          />
          <BackstoryField
            label="Ties"
            value={state.backstory.ties}
            onChange={(v) => setBackstory("ties", v)}
            placeholder="Who they care about"
          />
          <BackstoryField
            label="Flaw"
            value={state.backstory.flaw}
            onChange={(v) => setBackstory("flaw", v)}
            placeholder="Their weakness or contradiction"
          />
        </div>
      </section>

      {error && (
        <p
          id="new-character-error"
          role="alert"
          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Saving lands you in BUILD mode on /characters/[id]. You can
          always switch back to PLAY mode from the sheet.
        </p>
        <button
          type="submit"
          disabled={!formValid}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? "Saving…" : "Forge character"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}

function AttrInput({
  label,
  value,
  onChange,
  proficient,
  onProficient,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  proficient: boolean;
  onProficient: () => void;
}) {
  return (
    <div
      className={
        proficient
          ? "rounded-md border-2 border-primary/70 bg-primary/5 p-3"
          : "rounded-md border border-border bg-background p-3"
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={onProficient}
          className={
            proficient
              ? "rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground"
              : "rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          }
          aria-pressed={proficient}
        >
          {proficient ? "Proficient" : "Set proficient"}
        </button>
      </div>
      <input
        type="number"
        min={-1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function BackstoryField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
