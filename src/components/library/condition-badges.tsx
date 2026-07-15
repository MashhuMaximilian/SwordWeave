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
  const narrativeBadges = badges.filter((b) => b.kind === "narrative");

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