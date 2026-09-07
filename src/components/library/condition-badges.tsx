"use client";

/**
 * ConditionBadges — Phase 7 Q-B (D-prime, minimal)
 *
 * Renders a condition (legacy OR v1) as a row of pill badges for
 * the character sheet / saved-records preview. Replaces the old
 * `<pre>{JSON.stringify(...)}</pre>` dump so the v1 picker output
 * is actually visible to the user.
 *
 * Visual: each preset renders as a small primary-tinted pill, each
 * custom tag renders as a neutral pill, narrative renders as an
 * italic line.
 *
 * Phase scope: this is the **minimal** D-prime. The full character
 * sheet + character-creation rendering is deferred to a later phase
 * (see docs/phase-7/condition-v1-closeout.md). For now, this lives
 * only in the sandbox grammar saved-records preview.
 */

import { useMemo, type ReactElement } from "react";
import { parseCondition, conditionToBadges } from "@/lib/primitives/condition";

interface ConditionBadgesProps {
  /**
   * Raw condition payload from the modifier — either legacy
   * `{key, operator, value}` OR v1 `{kind, ...}` OR null/undefined.
   * The component parses internally and renders gracefully.
   */
  readonly condition: unknown;
  /**
   * When true, render the narrative variant as italic prose on a
   * single line. When false, skip narrative rendering entirely
   * (used by inline previews where narrative would crowd the row).
   * @default true
   */
  readonly showNarrative?: boolean;
}

/**
 * Render a condition as a horizontal flex of pill badges + optional
 * narrative line. Pure presentational — no state, no side effects.
 */
export function ConditionBadges({
  condition,
  showNarrative = true,
}: ConditionBadgesProps): ReactElement | null {
  const badges = useMemo(() => {
    const parsed = parseCondition(condition);
    if (!parsed) return [];
    return conditionToBadges(parsed);
  }, [condition]);

  if (badges.length === 0) return null;

  const presetBadges = badges.filter((b) => b.kind === "preset");
  const tagBadges = badges.filter((b) => b.kind === "tag");
  const axisBadges = badges.filter((b) => b.kind === "axis");
  const narrativeBadges = badges.filter((b) => b.kind === "narrative");

  // Phase 9.5 follow-up (Mashu 2026-09-07): render the
  // axis-prefix (self / target / scene / actor) as a
  // distinct pill so users can SEE which side a modifier
  // gates on. Mashu's bug: Enfeebling Envenom's
  // "target:exposed" was being applied even when no target
  // was exposed because the engine silently treated
  // non-computable predicates as truthy. Surfacing the
  // axis here is the user-facing half of the fix.
  const axisStyle: Record<
    NonNullable<(typeof axisBadges)[number]["axis"]>,
    { tone: string; label: string }
  > = {
    self: {
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      label: "when self",
    },
    actor: {
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      label: "when self",
    },
    target: {
      tone: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      label: "when target",
    },
    scene: {
      tone: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      label: "when scene",
    },
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {presetBadges.map((b, i) => (
        <span
          key={`p-${i}-${b.label}`}
          className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-medium text-primary"
          title="Preset condition"
        >
          {b.label}
        </span>
      ))}
      {axisBadges.map((b, i) => {
        const axis = b.axis ?? "self";
        const meta = axisStyle[axis];
        return (
          <span
            key={`a-${i}-${b.label}-${axis}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${meta.tone}`}
            title={`Triggers ${axis}`}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
              {meta.label}
            </span>
            <span className="font-medium">{b.label}</span>
          </span>
        );
      })}
      {tagBadges.map((b, i) => (
        <span
          key={`t-${i}-${b.label}`}
          className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-muted-foreground"
          title="Custom tag"
        >
          {b.label}
        </span>
      ))}
      {showNarrative && narrativeBadges.length > 0 ? (
        <span
          key={`n-${narrativeBadges[0]!.label}`}
          className="italic text-muted-foreground"
          title="Narrative condition"
        >
          “{narrativeBadges[0]!.label}”
        </span>
      ) : null}
    </div>
  );
}