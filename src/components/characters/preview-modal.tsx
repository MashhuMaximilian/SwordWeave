import { useModalStack } from "@/components/ui/modal-stack";
import { EntityPreview } from "@/components/preview/entity-preview";
import { type SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { PreviewCallbacks } from "@/components/preview/preview-shared";
import type { PreviewActionProps } from "@/components/preview/preview-shared";

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
        <EntityPreview
          item={item}
          variant="read"
          callbacks={callbacks}
          actionBar={actionBar}
        />
      ),
    });
  }

  return { openPreview };
}