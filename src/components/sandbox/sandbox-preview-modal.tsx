"use client";

// =============================================================================
// SandboxPreviewModal — full-content preview modal for sandbox library rows.
//
// Renders the complete entity data when a user clicks a row in the sandbox
// left column. Replaces the previous "View in Library" CTA with full
// inline rendering of every field the row carries.
//
// Supports primitives, effects, capabilities, templates, and items.
// The body content is rendered by <LibraryItemPreview />, which is also
// used directly in the modal stack body (no chrome duplication).
//
// The modal is dismissable via:
// - Close button (X)
// - Esc key
// - Backdrop click
// Body scroll lock while open.
// =============================================================================

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  EntityPreview,
  type EntityPreviewOwner,
  type EntityPreviewActions,
} from "@/components/preview/entity-preview";
import {
  libraryCompositeId,
  type SandboxPreviewItem,
} from "@/components/library/library-item-preview";

// Re-export so the rest of the codebase can keep importing the type from
// this module. The implementation lives in library-item-preview.tsx.
export type {
  SandboxPreviewItem,
  SandboxPrimitiveRow,
  SandboxEffectRow,
  SandboxCapabilityRow,
  SandboxTemplateRow,
  SandboxItemRow,
} from "@/components/library/library-item-preview";

interface SandboxPreviewModalProps {
  item: SandboxPreviewItem | null;
  onClose: () => void;
  /**
   * Label of the primary action button. Defaults to "Load into Build".
   * Set to null to hide the action button entirely (e.g. for read-only previews).
   */
  primaryActionLabel?: string | null;
  onPrimaryAction?: () => void;
  /** Ownership + author display (rendered identically to every other surface). */
  owner?: EntityPreviewOwner;
  /** Action bar (Edit / Open source / Versions / Delete). */
  actions?: EntityPreviewActions;
}

// ---- Modal shell -----------------------------------------------------------

export function SandboxPreviewModal({
  item,
  onClose,
  primaryActionLabel = "Load into Build",
  onPrimaryAction,
  owner,
  actions,
}: SandboxPreviewModalProps) {
  useEffect(() => {
    if (!item) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", handler);
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sandbox-preview-title"
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <EntityPreview
            item={item}
            variant="read"
            {...(owner ? { owner } : {})}
            {...(actions ? { actions } : {})}
          />
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            Close
          </button>
          {primaryActionLabel !== null && onPrimaryAction ? (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {primaryActionLabel}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
