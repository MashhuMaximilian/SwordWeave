"use client";

// =============================================================================
// CharacterModal — the persistent overlay layer for character creation
// (Phase 8.1). Edit-mode (Phase 8.2 batch 7) rides the same modal — no
// separate UI surface.
// =============================================================================
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
//
// 5. **Phase 8.2 batch 7 rev 2 — close is non-destructive.** The user
//    can dismiss the modal at any time without a Save / Discard / Keep
//    editing prompt. The dirty guard lives on NAVIGATION AWAY FROM
//    /atelier (and on browser refresh), not on modal close. This
//    matches the spec from Mashu 2026-07-23: closing the modal lets
//    the user freely browse the atelier to slot mechanics / heritages
//    / items, then re-open the modal to keep editing. Wiping state on
//    close would defeat the entire edit flow.
//
// 6. **Edit mode bootstrap.** The /characters Edit button writes the
//    character id to localStorage and navigates to /atelier. The
//    AtelierSandboxClient's mount effect reads it, calls
//    openForEditFromStore() to fetch + seed, and clears the entry. By
//    the time this component renders with editCharacterId set, the
//    seed has already happened (the form's effect pulls it).
// =============================================================================

import { useEffect, useState, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCharacterModal } from "./character-modal-store";
import { TabbedCharacterForm } from "./tabbed-character-form";
import { UnsavedChangesModal } from "@/components/sandbox/unsaved-changes-modal";

export interface CharacterModalProps {
  /** Optional content override. Defaults to a minimal "scaffold" panel
   * so the architectural shell can land before the wizard content is
   * wired in (batch 2). */
  children?: ReactNode;
}

export function CharacterModal({ children }: CharacterModalProps) {
  const {
    isOpen,
    close,
    isDirty,
    editCharacterId,
    editCharacterName,
    resetDraft,
    pendingEditId,
    isSeedingEdit,
  } = useCharacterModal();
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const modalDescRef = useRef<string | undefined>(undefined);

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

  // ESC key closes the modal. Standard dialog UX. No confirm — see
  // architectural decision #5 above.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // Phase 8.2 batch 7 rev 2: navigate-away guard for the modal's
  // own dirty state. This guard prevents navigation away from the
  // character modal when it contains unsaved changes or is in edit mode.
  // It handles:
  //   - <a> tag clicks (internal navigation)
  //   - browser back/forward (popstate)
  //   - programmatic navigation via custom sw-navigate-away event (FAB links, router.push, etc.)
  //
  // The guard shows the UnsavedChangesModal to let the user confirm
  // navigation or cancel and stay on the current character.
  //
  // We consider the modal "dirty" for navigation purposes when:
  //   - isDirty is true (user has made changes to the form)
  //   OR editCharacterId is not null (we are in edit mode - abandoning loses seeded data)
  useEffect(() => {
    // Only guard when modal is open and contains content that would be lost
    if (!isOpen || (!isDirty && editCharacterId === null)) return;
    
    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      // Only handle internal navigation (href starting with /)
      if (!href.startsWith("/")) return;
      // Prevent navigation and show confirm modal
      e.preventDefault();
      e.stopPropagation();
      modalDescRef.current =
        `You have unsaved changes to ${editCharacterName ?? "this character"}. Leaving will discard them. Continue?`;
      setPendingNav(href);
    };
    
    const onPopState = (e: PopStateEvent) => {
      // Handle browser back/forward navigation
      const href = window.location.pathname + window.location.search + window.location.hash;
      // Prevent navigation and show confirm modal
      window.history.pushState(null, "", window.location.href); // revert to current URL
      modalDescRef.current =
        `You have unsaved changes to ${editCharacterName ?? "this character"}. Leaving will discard them. Continue?`;
      setPendingNav(href);
    };
    
    const onNavigateAway = (e: CustomEvent<string>) => {
      // Handle programmatic navigation (FAB links, router.push, etc.)
      const href = e.detail;
      // Only handle internal navigation
      if (!href.startsWith("/")) return;
      // Prevent navigation and show confirm modal
      e.preventDefault();
      modalDescRef.current =
        `You have unsaved changes to ${editCharacterName ?? "this character"}. Leaving will discard them. Continue?`;
      setPendingNav(href);
    };
    
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // For tab close/refresh, we can only use the browser's native confirm
      e.preventDefault();
      e.returnValue = "";
    };
    
    // Set up event listeners
    document.addEventListener("click", onAnchorClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("sw-navigate-away", onNavigateAway as EventListener);
    
    // Clean up event listeners on unmount or when dependencies change
    return () => {
      document.removeEventListener("click", onAnchorClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("sw-navigate-away", onNavigateAway as EventListener);
    };
  }, [isOpen, isDirty, editCharacterId, editCharacterName, isSeedingEdit]);

  if (!mounted || !isOpen) return null;

  const titleText = editCharacterId
    ? editCharacterName
      ? `Edit: ${editCharacterName}`
      : "Edit character"
    : "New Character";

  // Render the UnsavedChangesModal at document.body level so it appears above everything
  if (pendingNav) {
    return createPortal(
      <UnsavedChangesModal
        isOpen={!!pendingNav}
        onCancel={() => setPendingNav(null)}
        onConfirm={() => {
          const href = pendingNav;
          setPendingNav(null);
          // Discard the character draft before leaving
          resetDraft();
          close();
          window.location.assign(href);
        }}
        description={modalDescRef.current ?? "You have unsaved changes. Leaving will discard them. Continue?"}
      />,
      document.body,
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editCharacterId ? "Edit character" : "Character creation"}
      data-character-modal="true"
      className={cn(
        "fixed inset-0 z-[70] flex justify-center bg-black/60 sm:items-center sm:p-4",
      )}
      onClick={(e) => {
        // Backdrop click closes the modal — no confirm. See AD #5.
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
              {titleText}
            </span>
            {isDirty ? (
              <span
                className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                title="Unsaved changes"
              >
                Unsaved
              </span>
            ) : null}
            {editCharacterId && pendingEditId ? (
              <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
                loading…
              </span>
            ) : null}
            {/* Phase 8.2 batch 7 rev 4: "Start fresh" button in edit
              mode. Discard the seeded state and re-open the modal
              in CREATE mode so the user can abandon their changes
              and build a new character from scratch. Hidden in
              CREATE mode (already fresh). Hidden when not dirty
              (nothing to discard). */}
            {editCharacterId && isDirty ? (
              <button
                type="button"
                onClick={() => {
                  // Phase 8.2 batch 9: confirm before discarding.
                  // Mashu 2026-07-23: "It still doesn't keep save
                  // changes button and it changes to create button
                  // instead after I add some things". The header
                  // has Unsaved chip + Start fresh + X close all
                  // close together; on mobile (narrow viewport) it's
                  // easy to mis-tap. window.confirm is a defensive
                  // guard against accidental destruction of the
                  // edit session.
                  const ok = window.confirm(
                    "Discard changes to this character and start a new one from scratch?",
                  );
                  if (!ok) return;
                  resetDraft();
                  close();
                  // Re-open in fresh CREATE mode after the close.
                  window.setTimeout(() => open(), 0);
                }}
                className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:border-primary hover:text-foreground"
                title="Discard changes to this character and start a new one from scratch"
              >
                Start fresh
              </button>
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
            {children ?? <TabbedCharacterForm />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}