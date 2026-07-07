"use client";

// =============================================================================
// FlagAndForkFooter — Source-page lower section
//
// Hosts the per-source-page UI in the user's specified order:
//   Tags row  →  Flags (collapsible)  →  ForksList
//   →  Version history link
//
// The flags section hosts a modal that lists freeform OTHER notes. We
// keep state here (the modal is local to the section) rather than
// hoisting to the page so the server-rendered DetailShell can stay
// RSC-friendly.
//
// Visibility / privacy:
//   • Tag chips — public, no special handling.
//   • Flags count + distribution — public. Helps the community decide
//     whether to engage. Reporter identities NOT exposed; only the
//     note text is (reporters opted into the note by picking OTHER).
//   • ForksList — public.
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import {
  FlagsSection,
  FlagNotesModal,
  type FlagDistribution,
} from "@/components/engagement/flags-section";
import type { ForkTargetType } from "@/lib/publishing/forks-query";
import { ForksList } from "@/components/engagement/forks-list";

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
}) {
  const [notesOpen, setNotesOpen] = useState(false);

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

      {/* Existing forks list + version-history link. */}
      <div className="mt-5">
        <ForksList
          targetType={props.forksTargetType}
          targetId={props.targetId}
        />
      </div>
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
