"use client";

import { useEffect, useRef } from "react";

/**
 * Confirmation modal for destructive sandbox actions.
 *
 * Used when the user attempts to switch build modes or load a library row
 * while the current form has unsaved changes. Behavior is intentionally
 * minimal:
 *
 * - "Cancel" (primary) → stays on current form, no swap
 * - "Discard changes" (destructive) → confirms and runs the pending action
 * - Esc → cancel
 * - Enter → discard
 * - Backdrop click → cancel
 * - Body scroll lock while open
 * - Auto-focus on Cancel so accidental Enter doesn't nuke work
 *
 * The modal is intentionally generic — the caller decides the action label
 * and what "discard" actually does (close + reload, clear + swap, etc).
 */

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Heading shown at top. Defaults to "Discard unsaved changes?" */
  title?: string;
  /** Body copy explaining what will be lost. */
  description?: string;
  /** Label of the destructive button. Defaults to "Discard changes". */
  confirmLabel?: string;
  /** Label of the safe button. Defaults to "Cancel". */
  cancelLabel?: string;
}

export function UnsavedChangesModal({
  isOpen,
  onCancel,
  onConfirm,
  title = "Discard unsaved changes?",
  description = "You have unsaved work in the current form. Switching now will lose it.",
  confirmLabel = "Discard changes",
  cancelLabel = "Cancel",
}: UnsavedChangesModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll when open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Esc cancels, Enter confirms. Cancel gets focus so Enter on first open
  // does NOT discard — protects against accidental loss.
  useEffect(() => {
    if (!isOpen) return undefined;
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      // Phase 9 round 5: z-[12000] so the discard-changes modal
      // always sits ABOVE every other modal in the app — the
      // atelier preview modal (z-[60]), the icon picker (z-[9999]),
      // and the color picker (z-[11000]). Previously z-50, which
      // placed it BELOW the atelier modal — when the user tried
      // to navigate away from the load panel with unsaved edits,
      // the confirm modal appeared beneath the panel and was
      // invisible. The 12000 tier is the dedicated "modal-stacked-
      // on-modal-stacked-on-modal" band used by Hermes in-app
      // confirms; see fab-speed-dial.tsx and modal-stack.tsx.
      className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
      aria-describedby="unsaved-modal-desc"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <h2
            id="unsaved-modal-title"
            className="text-lg font-semibold leading-tight"
          >
            {title}
          </h2>
          <p
            id="unsaved-modal-desc"
            className="mt-2 text-sm text-muted-foreground"
          >
            {description}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}