"use client";

/**
 * formula-modal.tsx — Phase 8.4 v25 (Mashu 2026-07-30)
 *
 * Reusable modal for every "click the chip → see how this number
 * is calculated" use case across the bottom-sticky-bar (Save DC,
 * Vitality, Practices, Proficiency Bonus, Encumbrance) and any
 * other chip that wants to expose its math.
 *
 * Two-layer content:
 *
 *   FORMULA    — static, always-shown text describing how the
 *                number is computed. Same for every character.
 *                (e.g. "Save DC = 5 + PB + proficient Attribute
 *
 *   PROVENANCE — per-character live trace, one row per step,
 *                in evaluation order. Each row carries a label,
 *                a value, and (optionally) a `via` breadcrumb
 *                describing where it came from (heritage, cap,
 *                effect, direct, etc.). A summary line at the
 *                bottom sums to the displayed total.
 *
 *   INFO       — optional info panel for chips that need extra
 *                reference material. Currently only Encumbrance
 *                uses this (size table + pouch rule).
 *
 * The contribution rows for the provenance section are rendered
 * with the same visual treatment as `ContributionRow` in
 * `provenance-modal.tsx` so chips that have primitive-level
 * attribution (Save DC, attribute mods, practices) get the
 * existing fancy breadcrumb + mirror pill behaviour for free.
 *
 * Dismissal: X button, backdrop click, or Escape key — same as
 * the existing provenance-modal.tsx.
 *
 * Phase 8.4 v25.3 (Mashu 2026-07-30): portal to document.body.
 * When this component is rendered inside a parent that uses
 * `backdrop-filter`, `transform`, `filter`, or `will-change`,
 * CSS treats that parent as the containing block for `fixed`
 * children — breaking `fixed inset-0` and clipping the modal
 * to the parent's bounds. SheetIdentityHeader uses
 * `backdrop-blur-md`, so any FormulaModal rendered inside it
 * was clipped to the header's height. Portalling to
 * `document.body` restores full-viewport sizing.
 */

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { humanReadableCondition, humanReadableToken } from "@/lib/engine/condition-dictionary";
import type {
  ModifierContribution,
  ResolvedModifiers,
} from "@/lib/engine/resolve-modifiers";

// =============================================================================
// Types
// =============================================================================

/**
 * A single step in the provenance chain. The chip's owner
 * builds this list in evaluation order (base first, last step
 * last). The component renders the rows in the same order.
 *
 * For chips that just delegate to a single resolver target
 * (Save DC, Vitality, attribute mods) the helper `contributionsToSteps`
 * below converts the raw `byTarget` array into this shape.
 */
export interface FormulaStep {
  /** Short label for the row (e.g. "Base", "PB L5", "Physical mod", "Focused Presence"). */
  readonly label: string;
  /** Numeric contribution. Shown as +N / -N. */
  readonly value: number;
  /** Optional breadcrumb — e.g. "Heritage 'Elf' → Capability 'Keen Senses'". */
  readonly via?: string;
  /**
   * If true, this step is from a resolver contribution that
   * has the per-primitive breadcrumb + mirror pill UI rendered
   * by the existing ProvenanceModal component. When set, `label`
   * and `value` are still required (they drive the summary line)
   * but the body row uses the full ContributionRow UI instead of
   * the simple label/value row.
   */
  readonly contribution?: ModifierContribution;
}

/**
 * Optional info panel rendered below the provenance section.
 * Used for chips that need reference tables (size table,
 * pouch rule, etc.) that don't change per character.
 */
export interface FormulaInfo {
  readonly title: string;
  readonly body: ReactNode;
}

export interface FormulaModalProps {
  /** Short title for the chip (e.g. "Save DC"). */
  readonly title: string;
  /** The final value shown on the chip. */
  readonly total: number;
  /** Optional sub-label under the title (e.g. "from PHYSICAL (proficient)"). */
  readonly subtitle?: string;
  /** Static formula text — always shown, never changes per character. */
  readonly formula: string;
  /** Per-character provenance chain. Rendered in order. */
  readonly breakdown: ReadonlyArray<FormulaStep>;
  /** Optional info panel. */
  readonly info?: FormulaInfo | null;
  /** Close handler. */
  readonly onClose: () => void;
  /** Phase 8.I POST C3: needed to read OFF-capabilities from localStorage. */
  readonly characterId?: string;
  /** Phase 8.M: optional selector dropdown (for multi-attr attack_bonus
   *  / save_dc). Renders below the formula breakdown. */
  readonly selector?: {
    readonly label: string;
    readonly value: string;
    readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
    readonly onChange: (next: string) => void;
  } | null;
}

/**
 * Helper — convert a resolver's `byTarget[target]` list into a
 * FormulaStep list, preserving the resolver's contribution
 * objects so the fancy breadcrumb + mirror UI still works.
 *
 * Note: for "direct" provenance the `via` breadcrumb is omitted
 * (not set to undefined) so the result satisfies
 * `exactOptionalPropertyTypes: true`.
 */
export function contributionsToSteps(
  target: string,
  resolver: ResolvedModifiers,
  baseSteps: ReadonlyArray<FormulaStep> = [],
): FormulaStep[] {
  const contribs = resolver.byTarget[target] ?? [];
  const out: FormulaStep[] = [...baseSteps];
  for (const c of contribs) {
    const via =
      c.provenance?.kind === "direct" ? undefined : formatVia(c);
    if (via) {
      out.push({
        label: c.primitiveName,
        value: c.value,
        via,
        contribution: c,
      });
    } else {
      out.push({
        label: c.primitiveName,
        value: c.value,
        contribution: c,
      });
    }
  }
  return out;
}

function formatVia(c: ModifierContribution): string {
  const { heritageName, capabilityName, effectName, accordion } = c.provenance;
  // Phase 8.L round 28 (Mashu 2026-08-13): direct primitives with
  // a heritage accordion (LINEAGE / UPBRINGING / MANIFEST) still
  // get the accordion shown. Inherited primitives get the full
  // chain. Returning "" only when there is nothing to show.
  const parts: string[] = [];
  if (accordion) parts.push(accordion);
  if (heritageName) parts.push(heritageName);
  if (capabilityName) parts.push(capabilityName);
  if (effectName) parts.push(effectName);
  if (parts.length === 0) return "";
  return parts.join(" → ");
}

// =============================================================================
// Helpers
// =============================================================================

/** Phase 8.I i3: render the Conditions section of the modal, showing which
 *  contributions are gated and whether their condition is currently active. */
/** Phase 8.L K17: render condition tokens as styled chips with
 * AND/OR as distinct visual elements. AND = cyan chip, OR = amber chip. */
function renderConditionChips(condition: unknown): ReactNode {
  const c = condition as { kind?: string; tokens?: string[] };
  if (!c || !Array.isArray(c.tokens)) return null;
  return (
    <>
      {c.tokens.map((tok, i) => {
        if (tok === "AND" || tok === "OR") {
          const isAnd = tok === "AND";
          return (
            <span
              key={i}
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                isAnd
                  ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              }`}
            >
              {tok}
            </span>
          );
        }
        return (
          <span
            key={i}
            className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] italic text-amber-700 dark:text-amber-300"
          >
            {humanReadableToken(tok)}
          </span>
        );
      })}
    </>
  );
}
function renderConditionsSection(breakdown: ReadonlyArray<FormulaStep>, onShowRaw: (cond: unknown) => void): ReactNode {
  const gated = breakdown.filter((s) => s.contribution && (s.contribution.hasCondition || s.contribution.conditionActive === false));
  if (gated.length === 0) return null;

  return (
    <section>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Conditions
      </p>
      <ul className="space-y-1">
        {gated.map((step, i) => {
          const c = step.contribution!;
          const isActive = c.conditionActive;
          const icon = isActive === false
            ? "✗"
            : isActive === true
              ? "✓"
              : "—";
          return (
            <li
              key={`cond-${step.label}-${i}`}
              className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1">
                  <strong>{step.label}</strong>
                  <span className="font-mono text-teal-700 dark:text-teal-300">
                    {step.value >= 0 ? `+${step.value}` : step.value}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">
                    ({c.op === "add" ? "add" : c.op === "subtract" ? "subtract" : c.op})
                  </span>
                </span>
                <span className={`font-mono text-[10px] ${
                  isActive === false ? "text-red-500" : isActive === true ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground"
                }`}>
                  {isActive === false ? "⛔ Inhibited" : isActive === true ? "✓ Engaged" : "— inactive"}
                </span>
              </div>
              <span className="flex flex-wrap items-center gap-1 text-[11px] italic text-muted-foreground">
                <span className="font-semibold">when</span>
                {c.condition ? renderConditionChips(c.condition) : "no condition"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// =============================================================================
// Component
// =============================================================================

// =============================================================================
// Color-rule helpers (Phase 8.I POST A4-A6)
// =============================================================================

/**
 * "PB Half" style primitive — value is derived from PB via division.
 * Shows the number in teal only (label stays default).
 */
function isPbHalfValue(value: unknown): boolean {
  // Could be {kind:"derived", which:"pb"} with op=multiply value=0.5,
  // or a numeric primitive named "PB Half" / "PB/2" etc.
  if (
    value &&
    typeof value === "object" &&
    "kind" in value &&
    (value as { kind: string }).kind === "derived" &&
    "which" in value &&
    ((value as { which: string }).which === "pb" || (value as { which: string }).which === "pb_half")
  ) {
    return true;
  }
  return false;
}

/**
 * "Expertise ..." primitive — name prefix detected. Renders label AND
 * number in teal+bold.
 */
function isExpertiseName(name: string): boolean {
  return /^expertise/i.test(name);
}

/**
 * "Proficient ..." or any +PB-derived primitive on a non-practice axis
 * (e.g. "Proficient Save"). Renders label AND number in teal.
 */
function isProficiencyName(name: string): boolean {
  return /^proficient/i.test(name);
}

const OP_LABEL: Record<string, string> = {
  add: "+",
  subtract: "−",
  set: "=",
  min: "↑",
  max: "↓",
  multiply: "×",
  divide: "÷",
  grant: "grant",
  revoke: "revoke",
};

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function FormulaModal({
  title,
  total,
  subtitle,
  formula,
  breakdown,
  info,
  onClose,
  characterId,
  selector,
}: FormulaModalProps) {
  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Phase 8.I POST C2: click condition text to see raw tokens.
  const [rawTokensOpen, setRawTokensOpen] = useState<unknown | null>(null);

  // Phase 8.I POST C3: read OFF capabilities from localStorage.
  // Storage format: sw:cap:${characterId}:${capabilityId} = "1" when OFF.
  const [offCapabilityIds, setOffCapabilityIds] = useState<Set<string>>(
    new Set(),
  );
  useEffect(() => {
    if (typeof window === "undefined" || !characterId) return;
    try {
      const off = new Set<string>();
      const prefix = `sw:cap:${characterId}:`;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const capId = key.slice(prefix.length);
          if (window.localStorage.getItem(key) === "1") off.add(capId);
        }
      }
      setOffCapabilityIds(off);
    } catch {
      /* ignore */
    }
  }, [characterId]);

  return (
    <Fragment>
      {createPortal(

      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Formula for ${title}`}
      >
        <div
          className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Formula
              </h2>
              <p className="mt-0.5 text-base font-semibold">{title}</p>
              {subtitle && (
                <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 transition-colors hover:bg-muted"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Section 1 — Static formula */}
            <section>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Formula
              </p>
              <p className="rounded-md border border-border bg-background p-2.5 font-mono text-sm leading-relaxed">
                {formula}
              </p>
            </section>

            {/* Phase 8.M — Multi-attribute selector (for attack_bonus /
                save_dc when primitives target multiple attributes).
                Per Mashu 2026-08-12: must render BEFORE provenance
                so the user picks the attribute first. */}
            {selector && (
              <section>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {selector.label}
                </label>
                <select
                  value={selector.value}
                  onChange={(e) => selector.onChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {selector.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {/* Section 2 — Provenance chain */}
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Provenance
                </p>
                <span className="font-mono text-xl font-bold tabular-nums">
                  {fmt(total)}
                </span>
              </div>
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contributions — total is the base value only.
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {breakdown.map((step, i) => (
                      <StepRow key={`${step.label}-${i}`} step={step} offCapabilityIds={offCapabilityIds} />
                    ))}
                  </ul>
                  <SummaryLine steps={breakdown} total={total} />
                </>
              )}
            </section>

            {/* Section 3b — Conditions summary: which contributions are
                gated and whether their condition is currently active. */}
            {renderConditionsSection(breakdown, setRawTokensOpen)}

            {/* Section 3 — Optional info panel */}
            {info && (
              <section>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {info.title}
                </p>
                <div className="rounded-md border border-border bg-background p-2.5 text-sm text-foreground">
                  {info.body}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>,
        document.body,
      )}
      {rawTokensOpen !== null
        ? createPortal(
<div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setRawTokensOpen(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Raw condition tokens"
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Raw condition tokens
              </h3>
              <button
                type="button"
                onClick={() => setRawTokensOpen(null)}
                className="rounded-md p-1 transition-colors hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(rawTokensOpen, null, 2)}
            </pre>
          </div>
        </div>,
            document.body,
          )
        : null}
    </Fragment>
  );
}
// =============================================================================
// Sub-components
// =============================================================================

function StepRow({ step, offCapabilityIds }: { step: FormulaStep; offCapabilityIds: Set<string> }) {
  // If this step carries a resolver contribution, render the
  // fancy breadcrumb + mirror pill UI from provenance-modal.
  if (step.contribution) {
    const c = step.contribution;
    return (
      <li className="rounded-md border border-border bg-background p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn(
              "truncate text-sm font-medium",
              isExpertiseName(c.primitiveName) && "font-bold text-teal-700 dark:text-teal-300",
              isProficiencyName(c.primitiveName) && "text-teal-700 dark:text-teal-300",
              c.originCapabilityId && offCapabilityIds.has(c.originCapabilityId) && "text-muted-foreground line-through"
            )} title={c.primitiveName}>
              {step.label}
              {c.originCapabilityId && offCapabilityIds.has(c.originCapabilityId) ? (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">(capability OFF)</span>
              ) : null}
            </p>
            {step.via && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                via {step.via}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            {c.op !== "min" && c.op !== "max" ? (
              <span className="font-mono text-xs text-muted-foreground">
                {OP_LABEL[c.op] ?? c.op}
              </span>
            ) : null}
            <span className={cn(
              "font-mono font-semibold tabular-nums",
              isPbHalfValue(c.value) && "text-teal-600 dark:text-teal-400",
              isExpertiseName(c.primitiveName) && "font-bold text-teal-700 dark:text-teal-300",
              isProficiencyName(c.primitiveName) && "text-teal-700 dark:text-teal-300",
              c.originCapabilityId && offCapabilityIds.has(c.originCapabilityId) && "text-muted-foreground line-through"
            )}>
              {c.op === "min" || c.op === "max" ? c.value : fmt(c.value)}
            </span>
            {c.preMirrorValue !== null && (
              <span
                className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
                title={`Standard (non-mirrored) value was ${fmt(c.preMirrorValue)} — mirror flipped it`}
              >
                Mirrored
              </span>
            )}
            {c.conditionActive === false ? (
              <span
                className="font-mono text-[10px] font-semibold text-red-500"
                title="Condition not met — contribution suppressed"
              >
                ⛔ Inhibited
              </span>
            ) : c.conditionActive === true ? (
              <span
                className="font-mono text-[10px] font-semibold text-teal-600 dark:text-teal-400"
                title="Condition met — contribution active"
              >
                ✓ Engaged
              </span>
            ) : null}
          </div>
        </div>
        {c.preMirrorValue !== null && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Standard: <span className="line-through">{fmt(c.preMirrorValue)}</span>{" "}
            → Mirrored: <span className="font-semibold">{fmt(c.value)}</span>
          </p>
        )}
      </li>
    );
  }

  // Plain step — label + value, optional breadcrumb.
  return (
    <li className="rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={step.label}>
            {step.label}
          </p>
          {step.via && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              via {step.via}
            </p>
          )}
        </div>
        <span className="shrink-0 font-mono font-semibold tabular-nums">
          {fmt(step.value)}
        </span>
      </div>
    </li>
  );
}

function SummaryLine({
  steps,
  total,
}: {
  steps: ReadonlyArray<FormulaStep>;
  total: number;
}) {
  // Build a single-line formula trace. Each step's value is
  // rendered with its sign. Base steps (the first one with
  // label containing "Base" or value matching the chip's
  // raw starting value) are NOT prefixed with +/− because
  // they're the starting number, not an addition.
  //
  // The rule we use: the FIRST step is the base (rendered as
  // a bare number). All subsequent steps are prefixed with
  // their sign.
  return (
    <p className="mt-3 rounded-md border border-dashed border-border bg-background/50 p-2 font-mono text-[11px] text-muted-foreground">
      {steps.map((step, i) => {
        const sign = step.value >= 0 ? "+" : "−";
        const abs = Math.abs(step.value);
        const display = i === 0 ? `${step.value}` : `${sign}${abs}`;
        return (
          <span key={`${step.label}-${i}`}>
            {i > 0 && " "}
            {display}
            {" "}
            <span className="text-muted-foreground/70">({step.label})</span>
          </span>
        );
      })}
      {" "}
      <span className="font-semibold text-foreground">= {fmt(total)}</span>
    </p>
  );
}// Phase 8.L round 31 (Mashu 2026-08-13): Reverted L30 refactor.

The L30 attempt to unify ALL modals via ContributionsSection
regressed the existing modals (PB lost Base/Level breakdown,
Save DC lost formula trace, Behavior Variable lost primitive
contributions, etc). The migration script dropped the static
{label, value} entries that lived alongside contributionsToSteps.

This commit reverts the L30 commits and forces a fresh
build so the modal state goes back to the L29 state:
  - Engaged/Inhibited terminology in Conditions section
  - All modals show the same status pills
  - All modals keep their static breakdown entries
