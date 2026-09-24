import { useEffect, useMemo, useState } from "react";
import { useModalStack } from "@/components/ui/modal-stack";
import { EntityPreview } from "@/components/preview/entity-preview";
import {
  libraryCompositeId,
  type SandboxPreviewItem,
} from "@/components/library/library-item-preview";
import { ForkMapButton } from "@/components/engagement/fork-map-button";
import type { ForkTargetType } from "@/lib/publishing/forks-query";
import type {
  PreviewCallbacks,
  PreviewEngagement,
} from "@/components/preview/preview-shared";
import type { PreviewActionProps } from "@/components/preview/preview-shared";

function ModalEntityPreview({
  item,
  callbacks,
  actionBar,
}: {
  item: SandboxPreviewItem;
  callbacks?: PreviewCallbacks;
  actionBar?: PreviewActionProps;
}) {
  const compositeId = libraryCompositeId(item);
  const [targetType, targetId] = compositeId.split(":", 2) as [ForkTargetType, string];
  // Controls must not disappear while the lookup is in flight (or when an
  // older/system record has no engagement row yet).  A zero snapshot is a
  // valid empty state and lets every character-sheet preview expose the same
  // like/dislike/fork/flag controls immediately.
  const [fetchedEngagement, setFetchedEngagement] = useState<PreviewEngagement>({
    likes: 0,
    dislikes: 0,
    forks: 0,
    userReaction: null,
    authorId: null,
    authorUsername: null,
    authorIsAdmin: null,
    currentUserInternalId: null,
  });
  const engagement = callbacks?.engagement ?? fetchedEngagement;

  useEffect(() => {
    if (callbacks?.engagement) return;
    const controller = new AbortController();
    void fetch(
      `/api/engagement/lookup?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
      { signal: controller.signal },
    )
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setFetchedEngagement({
          likes: Number(data.likes ?? 0),
          dislikes: Number(data.dislikes ?? 0),
          forks: Number(data.forks ?? 0),
          userReaction: data.userReaction ?? null,
          authorId: null,
          authorUsername: null,
          authorIsAdmin: null,
          currentUserInternalId: data.currentUserInternalId ?? null,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [callbacks?.engagement, targetId, targetType]);

  const resolvedCallbacks = useMemo<PreviewCallbacks>(
    () => ({
      ...callbacks,
      engagement,
      openSourceHref: callbacks?.openSourceHref ?? `/library/item/${compositeId}`,
      versionHistoryHref:
        callbacks?.versionHistoryHref ?? `/library/item/${compositeId}/versions`,
    }),
    [callbacks, compositeId, engagement],
  );
  const resolvedActions = useMemo<PreviewActionProps>(
    () => ({
      ...actionBar,
      openSourceHref: actionBar?.openSourceHref ?? `/library/item/${compositeId}`,
      versionHistoryHref:
        actionBar?.versionHistoryHref ?? `/library/item/${compositeId}/versions`,
      forkMap:
        actionBar?.forkMap ?? (
          <ForkMapButton
            targetType={targetType}
            targetId={targetId}
            targetName={item.row.name}
            className="min-w-0 flex-1 justify-center px-1.5 py-2 text-xs"
          />
        ),
    }),
    [actionBar, compositeId, item.row.name, targetId, targetType],
  );

  return (
    <EntityPreview
      item={item}
      variant="read"
      callbacks={resolvedCallbacks}
      actionBar={resolvedActions}
    />
  );
}

/**
 * Hook to open the SAME EntityPreview component used in the atelier/library
 * inside a modal stack modal. Returns an `openPreview` function.
 *
 * Usage:
 *   const { openPreview } = useEntityPreview();
 *   <button onClick={() => openPreview({ item, callbacks, actionBar })}>Preview</button>
 */
export function useEntityPreview() {
  const stack = useModalStack();

  function openPreview(opts: {
    item: SandboxPreviewItem;
    category?: string;
    callbacks?: PreviewCallbacks;
    actionBar?: PreviewActionProps;
  }) {
    const { item, category, callbacks, actionBar } = opts;
    const key = `preview:${item.kind}:${item.row?.id ?? "unknown"}`;

    stack.push({
      key,
      label: item.row?.name ?? "Preview",
      category: category ?? null,
      content: (
        <ModalEntityPreview
          item={item}
          {...(callbacks ? { callbacks } : {})}
          {...(actionBar ? { actionBar } : {})}
        />
      ),
    });
  }

  return { openPreview };
}
