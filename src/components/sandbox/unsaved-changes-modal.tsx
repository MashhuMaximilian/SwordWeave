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
  /** When true, hide the destructive confirm ("Discard changes")
   *  button. Used for the in-build load prompt, where Reset is the
   *  intended clear path — the user resets first, then loads. */
  hideDiscard?: boolean;
}

export function UnsavedChangesModal({
  isOpen,
  onCancel,
  onConfirm,
  title = "Discard unsaved changes?",
  description = "You have unsaved work in the current form. Switching now will lose it.",
  confirmLabel = "Discard changes",
  cancelLabel = "Cancel",
  hideDiscard = false,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
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
          {!hideDiscard && (
            <button
              type="button"
              onClick={onConfirm}
              className="h-9 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}