"use client";

// =============================================================================
// FlagAndForkFooter — Source-page lower section
//
// Hosts the per-source-page UI in the user's specified order:
//   Tags row  →  Forked from (collapsible, if applicable)
//              →  Flags (collapsible)
//              →  Version history link
//
// ForksList is NOT rendered here — it's a server component (async data
// fetch against db/client) and client components can't import server
// components without inlining their DB code into the browser bundle
// (which throws DATABASE_URL is required at hydration time). The page
// renders <ForksList /> directly as a sibling instead.
//
// The flags section hosts a modal that lists freeform OTHER notes. We
// keep state here (the modal is local to the section) rather than
// hoisting to the page so the server-rendered DetailShell can stay
// RSC-friendly.
//
// Visibility / privacy:
//   • Tag chips — public, no special handling.
//   • Forked-from breadcrumb — public. Shows only the immediate parent
//     (no full ancestry) plus a "See forking line" link if the user
//     wants the full chain.
//   • Flags count + distribution — public. Reporter identities NOT
//     exposed; only the note text is.
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import {
  FlagsSection,
  FlagNotesModal,
  type FlagDistribution,
} from "@/components/engagement/flags-section";
import type { ForkTargetType } from "@/lib/publishing/forks-query";

export function FlagAndForkFooter(props: {
  /** Item type for the version-history link (e.g. "PRIMITIVE"). */
  targetType: string;
  /** Item id within its type. */
  targetId: string;
  /** Same value used by ForksList / LikeForkBar. */
  forksTargetType: ForkTargetType;
  /** Pre-fetched flag distribution for this item. */
  flagDistribution: FlagDistribution;
  /** Pre-fetched OTHER notes. Modal stays closed until user clicks
   *  "View all notes". */
  flagNotes: Array<{ id: string; note: string; reportedAt: Date | string }>;
  /** Tag chips to render as small pills above flags. Empty array hides
   *  the row. */
  tags: string[];
  /**
   * Immediate parent (if this entity is a fork). Null means it's the
   * original. Drives the "Forked from" breadcrumb in the footer.
   */
  forkSource: {
    sourceTargetType: string;
    sourceTargetId: string;
    sourceAuthorUsername: string | null;
    forkedAt: Date | string;
  } | null;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [forkedFromOpen, setForkedFromOpen] = useState(false);

  return (
    <>
      {/* Tags row — renders only if non-empty. Pure presentational. */}
      {props.tags.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {props.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Forked-from breadcrumb — renders only if this entity was forked
          from another. Collapsed by default; clicking expands to show
          when it was forked + the immediate parent link. The "See
          forking line" link opens a dedicated page with the full
          ancestry chain. */}
      {props.forkSource ? (
        <section className="mt-5 rounded-md border border-border bg-card">
          <button
            type="button"
            onClick={() => setForkedFromOpen((v) => !v)}
            aria-expanded={forkedFromOpen}
            className="flex w-full items-center justify-between gap-2 p-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className="text-muted-foreground">
                ⑂
              </span>
              <span className="font-semibold">Forked from</span>
              <Link
                href={`/library/item/${props.forkSource.sourceTargetType}:${encodeURIComponent(props.forkSource.sourceTargetId)}`}
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {props.forkSource.sourceTargetType}:
                {props.forkSource.sourceTargetId}
              </Link>
            </span>
            <span className="text-xs text-muted-foreground">
              {forkedFromOpen ? "Hide" : "Show"}
            </span>
          </button>
          {forkedFromOpen ? (
            <div className="space-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <p>
                Forked{" "}
                {new Date(props.forkSource.forkedAt).toLocaleDateString()}
                {props.forkSource.sourceAuthorUsername
                  ? ` from @${props.forkSource.sourceAuthorUsername}'s version`
                  : ""}
                .
              </p>
              <Link
                href={`/library/item/${props.targetType}:${encodeURIComponent(props.targetId)}/forks`}
                className="inline-block font-medium text-primary hover:underline"
              >
                See forking line (full ancestry) →
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Flags section — collapsible distribution + counts. */}
      {(() => {
        const total = Object.values(props.flagDistribution).reduce(
          (a, b) => a + b,
          0,
        );
        // Don't render the section at all if no flags have been placed —
        // an empty "Flags (0)" pill is noise.
        if (total === 0) return null;
        return (
          <div className="mt-5">
            <FlagsSection
              distribution={props.flagDistribution}
              onOpenNotes={() => setNotesOpen(true)}
            />
          </div>
        );
      })()}

      {/* Version-history link only — ForksList is rendered as a sibling by
          the page (server component) to keep DB code out of the client
          bundle. */}
      <div className="mt-3 flex justify-end">
        <Link
          href={`/library/item/${props.targetType}:${props.targetId}/versions`}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Version history →
        </Link>
      </div>

      <FlagNotesModal
        isOpen={notesOpen}
        onClose={() => setNotesOpen(false)}
        notes={props.flagNotes}
      />
    </>
  );
}
