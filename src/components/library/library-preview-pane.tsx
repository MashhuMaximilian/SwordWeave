"use client";

// =============================================================================
// LibraryPreviewPane — bottom-half / right-side preview for the selected
// library row in /library/browse.
//
// Renders the LibraryItem data we already have from queryLibrary() — full
// description, tags, engagement, author info, link to the canonical detail
// page. Doesn't fetch additional per-row data; if you need slot-by-slot
// detail (primitive slots, mirror data, etc.) the user clicks "Open detail
// page" to navigate to /library/item/[id] which renders the full entity.
// =============================================================================

import Link from "next/link";
import { ArrowRight, ExternalLink, User as UserIcon } from "lucide-react";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { Markdown } from "@/components/ui/markdown";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "@/components/library/library-table";

interface LibraryPreviewPaneProps {
  item: LibraryItem | null;
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
  onClose?: () => void;
}

export function LibraryPreviewPane({
  item,
  engagement,
  currentUserInternalId,
  onClose,
}: LibraryPreviewPaneProps) {
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Select an entry from the table
          </p>
          <p className="text-xs text-muted-foreground">
            Click any row to preview it here. Drag the divider between panes
            to resize.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {item.targetType.replace(/_/g, " ").toLowerCase()}
            {item.category ? ` · ${item.category.replace(/_/g, " ")}` : ""}
          </p>
          <h2 className="mt-0.5 truncate text-xl font-semibold leading-tight">
            {item.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.buCost !== null && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              {item.buCost} BU
            </span>
          )}
          <Link
            href={`/library/item/${item.id}`}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
          >
            Open
            <ExternalLink className="size-3" />
          </Link>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent sm:hidden"
              aria-label="Close preview"
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {item.description ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Description
              </h3>
              <div className="text-sm leading-6 text-foreground [&_p]:m-0 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:underline [&_a]:text-primary">
                <Markdown>{item.description}</Markdown>
              </div>
            </section>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No description provided.
            </p>
          )}

          {item.tags.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {item.authorUsername ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Author
              </h3>
              <Link
                href={`/u/${item.authorUsername}`}
                className="flex items-center gap-2 text-sm hover:text-foreground"
              >
                {item.authorAvatarUrl ? (
                  <img
                    src={item.authorAvatarUrl}
                    alt=""
                    className="size-5 rounded-full"
                  />
                ) : (
                  <UserIcon className="size-4" />
                )}
                <span className="font-semibold">
                  {item.authorDisplayName ?? item.authorUsername}
                </span>
              </Link>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Engagement
            </h3>
            <LikeForkBar
              targetType={item.targetType as GridLikeForkTargetType}
              targetId={item.targetId}
              initialLikes={item.likesCount}
              initialDislikes={item.dislikesCount}
              initialForks={item.forkCount}
              initialUserReaction={engagement.reactions[item.id] ?? null}
              authorId={item.authorId}
              authorUsername={item.authorUsername}
              currentUserId={currentUserInternalId}
            />
          </section>

          <section className="border-t border-border pt-4">
            <Link
              href={`/library/item/${item.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open full detail page
              <ArrowRight className="size-3.5" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

// LikeForkBar accepts a narrower union than LibraryTargetType.
type GridLikeForkTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "CHARACTER"
  | "ITEM"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE";