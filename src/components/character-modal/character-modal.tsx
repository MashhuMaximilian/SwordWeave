"use client";

// =============================================================================
// CharacterModal — the persistent overlay layer for character creation
// (Phase 8.1).
//
// Architectural decisions:
//
// 1. **NOT a ModalStack entry.** The route-change stack-clear in
//    ModalStackHost would clobber the modal when the user navigates
//    between atelier tabs (grammar → heritage → blueprint), which is
//    exactly what the spec forbids ("state persists across sandbox tab
//    navigation"). The character modal is its own thing.
//
// 2. **Portal to document.body.** Same rationale as ModalStack (Phase 9):
//    detach from the AppShell DOM hierarchy so the modal's z-index is
//    unambiguously the highest on the page. body is always hydrated by
//    the time the user clicks the FAB.
//
// 3. **Layout matches the existing modal-stack chrome on mobile:**
//    `inset-x-0 bottom-0 top-2` (Phase 9 round-3 fix — pin to all four
//    edges so the modal never moves with body scroll). On desktop the
//    spec says "centered 80% width panel" — different from the modal-
//    stack side panel pattern. We use a centered max-w-4xl modal with
//    backdrop on desktop; the atelier columns are still visible behind
//    a dim layer (per spec: "sits ABOVE the sandbox 3-column layout").
//
// 4. **Sticky header INSIDE scroll container** (Phase 9 round-2 lesson):
//    the close button is always reachable when the content is tall.
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCharacterModal } from "./character-modal-store";
import { SteppedWizardMode } from "./stepped-wizard-mode";

export interface CharacterModalProps {
  /**
   * Optional content override. Defaults to a minimal "scaffold" panel
   * so the architectural shell can land before the wizard content is
   * wired in (batch 2).
   */
  children?: ReactNode;
}

export function CharacterModal({ children }: CharacterModalProps) {
  const { isOpen, close, isDirty } = useCharacterModal();
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ESC key closes the modal. Standard dialog UX.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Character creation"
      data-character-modal="true"
      className={cn(
        "fixed inset-0 z-[70] flex justify-center bg-black/60 sm:items-center sm:p-4",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-card shadow-2xl sm:rounded-2xl",
          // Mobile: explicit top + bottom so the modal never moves with
          // body scroll. sm+: cap height with dvh, center vertically.
          "inset-x-0 bottom-0 top-2 sm:inset-auto sm:max-h-[90dvh]",
          isDesktop ? "max-w-5xl" : "max-w-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scroll container — header is INSIDE so it sticks when content
            scrolls (Phase 9 round-2 lesson). */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto text-sm">
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              New Character
            </span>
            {isDirty ? (
              <span
                className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                title="Unsaved changes"
              >
                Unsaved
              </span>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label="Close character modal"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="p-4">
            {children ?? <SteppedWizardMode />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

