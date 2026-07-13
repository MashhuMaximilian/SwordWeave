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
  LibraryItemPreview,
  previewHeadingLabel,
  type SandboxPreviewItem,
} from "@/components/library/library-item-preview";
import { IconDisplay } from "@/components/icons/icon-display";

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
}

// ---- Modal shell -----------------------------------------------------------

export function SandboxPreviewModal({
  item,
  onClose,
  primaryActionLabel = "Load into Build",
  onPrimaryAction,
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
        className="relative w-full max-w-2xl overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Phase 8: entity icon in the modal header. Same fallback
                pattern as the library card so the layout is stable. */}
            <div className="shrink-0">
              {item.row.iconSource ? (
                <IconDisplay
                  iconSource={item.row.iconSource as "GAME_ICONS" | "UPLOAD"}
                  iconKey={item.row.iconKey}
                  iconUrl={item.row.iconUrl}
                  iconColor={item.row.iconColor}
                  size={40}
                  className="rounded-md border border-border"
                  alt={item.row.name}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {(item.row as { name: string }).name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {previewHeadingLabel(item)}
              </p>
              <h2
                id="sandbox-preview-title"
                className="mt-1 flex items-center gap-2 truncate text-base font-semibold leading-tight"
              >
                {item.latestVersionNumber != null ? (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    v{item.latestVersionNumber}
                  </span>
                ) : null}
                <span className="truncate">{item.row.name}</span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    item.row.isPublic
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {item.row.isPublic ? "Public" : "Private"}
                </span>
              </h2>
              {/* BU cost summary — computed from composed primitives */}
              {(() => {
                const abs = Math.abs;
                let bu: number | null = null;
                if (item.kind === "primitive") {
                  bu = item.row.buCost;
                } else if (item.kind === "effect") {
                  bu = item.row.primitiveLinks.reduce(
                    (s, l) => s + abs(l.primitive.buCost * l.quantity),
                    0,
                  );
                } else if (item.kind === "capability") {
                  bu = item.row.primitiveLinks.reduce(
                    (s, l) => s + abs(l.primitive.buCost * l.quantity),
                    0,
                  );
                }
                if (bu == null) return null;
                return (
                  <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                    {bu} BU
                  </span>
                );
              })()}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-2 hover:bg-accent"
            aria-label="Close preview"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <LibraryItemPreview item={item} />
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
