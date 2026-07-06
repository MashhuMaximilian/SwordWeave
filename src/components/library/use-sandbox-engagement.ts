"use client";

// =============================================================================
// useSandboxEngagement — bridge between LibraryItem and the
// PreviewEngagement shape that <LibraryItemPreview> consumes.
//
// The sandbox's left column works off pre-fetched LibraryItem[] payloads
// (no per-row API calls). When the user opens a row, the modal needs
// engagement data + author info for the LikeForkBar / version history
// link. This hook derives the snapshot from the LibraryItem (counts come
// from the row payload; user reaction is fetched client-side when the
// user opens the modal).
//
// The follow + per-user reaction lookups are best-effort — if the API
// call fails (offline, not signed in, etc.) we still render the preview
// with whatever data we have so the modal-stack entry is never broken.
// =============================================================================

import { useEffect, useState } from "react";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { PreviewEngagement } from "@/components/library/library-item-preview";

export function useSandboxEngagement(
  item: LibraryItem | null,
): { engagement: PreviewEngagement | null; loading: boolean } {
  const [reaction, setReaction] = useState<"LIKE" | "DISLIKE" | null>(null);
  const [currentUserInternalId, setCurrentUserInternalId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) {
      setReaction(null);
      setCurrentUserInternalId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/engagement/lookup?targetType=${encodeURIComponent(
            item.targetType,
          )}&targetId=${encodeURIComponent(item.targetId)}`,
        );
        if (!res.ok) {
          if (!cancelled) {
            setReaction(null);
            setCurrentUserInternalId(null);
          }
          return;
        }
        const data = (await res.json()) as {
          userReaction?: "LIKE" | "DISLIKE" | null;
          currentUserInternalId?: string | null;
        };
        if (!cancelled) {
          setReaction(data.userReaction ?? null);
          setCurrentUserInternalId(data.currentUserInternalId ?? null);
        }
      } catch {
        if (!cancelled) {
          setReaction(null);
          setCurrentUserInternalId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.targetType, item?.targetId]);

  if (!item) {
    return { engagement: null, loading: false };
  }

  return {
    engagement: {
      likes: item.likesCount,
      dislikes: item.dislikesCount,
      forks: item.forkCount,
      userReaction: reaction,
      authorId: item.authorId,
      authorUsername: item.authorUsername,
      currentUserInternalId,
    },
    loading,
  };
}
