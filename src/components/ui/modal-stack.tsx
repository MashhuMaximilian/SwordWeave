"use client";

// =============================================================================
// ModalStack — stacked modals with breadcrumb navigation.
//
// Supports up to 4-deep stacks. The current top modal is the one rendered fully;
// ancestors are kept in the stack (so going back returns to the previous modal)
// but rendered as compact breadcrumbs in the header.
//
// Pages push/pop modal entries via the imperative handle returned by
// useModalStack(). The renderer subscribes to the stack and draws each level.
//
// On desktop (≥1024px) the modal renders as a left-anchored side panel so
// the middle/right sandbox columns stay visible and clickable. On mobile it's
// a full-screen overlay (the other columns aren't visible anyway).
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MAX_DEPTH = 4;

export interface ModalEntry<T = unknown> {
  /** Unique stable key — used for breadcrumb labels and React keys. */
  key: string;
  /** Short label shown in breadcrumbs. */
  label: string;
  /** Optional category/tag for visual distinction. */
  category?: string | null;
  /** The content to render. */
  content: ReactNode;
  /** Payload — passed to `content` via a stable render prop. */
  payload?: T;
}

interface ModalStackState {
  stack: ModalEntry[];
  push: <T>(entry: ModalEntry<T>) => boolean;
  pop: () => void;
  popTo: (depth: number) => void;
  clear: () => void;
  canPush: boolean;
  depth: number;
}

const StackCtx = createContext<ModalStackState | null>(null);

export function useModalStack(): ModalStackState {
  const ctx = useContext(StackCtx);
  if (!ctx) {
    // No provider — return a no-op stack so callsites that fire events from
    // unmounted components don't crash. Pushes silently fail.
    return {
      stack: [],
      push: () => false,
      pop: () => {},
      popTo: () => {},
      clear: () => {},
      canPush: false,
      depth: 0,
    };
  }
  return ctx;
}

export function ModalStackHost({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);
  const pathname = usePathname();

  // Phase 2 fix: clear the stack when the route changes. The Creations
  // page's "Edit in sandbox" handler calls `router.push(...)` to navigate
  // to the sandbox, but the stack from the preview modal would otherwise
  // persist because the ModalStackHost outlives page navigations (it's
  // mounted at the app-shell level). Without this, opening a preview
  // modal on /creations, then clicking "Edit in sandbox", would leave
  // the preview modal overlaid on top of the sandbox.
  //
  // We compare to the stack's last-rendered pathname (not the current
  // pathname at mount) so the first render after navigation is a no-op
  // rather than clearing whatever the user opened.
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    setStack((current) => (current.length === 0 ? current : []));
  }, [pathname]);

  const push = useCallback(<T,>(entry: ModalEntry<T>): boolean => {
    let pushed = false;
    setStack((current) => {
      if (current.length >= MAX_DEPTH) return current;
      pushed = true;
      return [...current, entry as ModalEntry];
    });
    return pushed;
  }, []);

  const pop = useCallback(() => {
    setStack((current) => current.slice(0, -1));
  }, []);

  const popTo = useCallback((depth: number) => {
    setStack((current) => current.slice(0, depth + 1));
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  const value = useMemo<ModalStackState>(
    () => ({
      stack,
      push,
      pop,
      popTo,
      clear,
      canPush: stack.length < MAX_DEPTH,
      depth: stack.length,
    }),
    [stack, push, pop, popTo, clear],
  );

  return (
    <StackCtx.Provider value={value}>
      {children}
      <ModalStackRenderer />
    </StackCtx.Provider>
  );
}

function ModalStackRenderer() {
  const { stack, pop, popTo } = useModalStack();
  const [isDesktop, setIsDesktop] = useState(false);

  // On desktop (≥1024px) the modal opens as a left-anchored side panel so
  // the middle/right sandbox columns stay visible and clickable. On mobile
  // it's a full-screen overlay (the other columns aren't visible anyway).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (stack.length === 0) return null;

  // Phase 9: portal to document.body so the modal stack is detached from
  // the AppShell DOM hierarchy. Previously the modal renderer was a
  // sibling of <main> / <footer> / <GlobalControls> (which contains
  // BuildPreviewDrawer at z-50), so its z-index competed against the
  // drawer's z-50 and the icon picker was visually eclipsed when the
  // user opened a build-composer-style edit through the drawer. A
  // portal puts the modals at the document root, where their z-index
  // is unambiguously the highest on the page. (document.body is
  // always present by the time we render — the modal only mounts on
  // user interaction, after the body is hydrated.)
  return createPortal(
    <>
      {stack.map((entry, idx) => {
        const isTop = idx === stack.length - 1;
        const z = 60 + idx;

        if (isDesktop) {
          // Desktop: side panel anchored to the left edge. No backdrop, no
          // click-to-close — the middle/right columns stay fully interactive.
          return (
            <div
              key={entry.key}
              role="dialog"
              aria-modal="false"
              aria-label={entry.label}
              className="fixed left-0 top-0 flex h-full"
              style={{ zIndex: z }}
            >
              <div
                className={cn(
                  "relative flex h-full w-[420px] max-w-[42vw] flex-col overflow-hidden border-r border-border bg-card shadow-2xl",
                  !isTop && "w-[360px] opacity-95",
                )}
              >
                {renderModalBody(entry, isTop, stack, idx, pop, popTo)}
              </div>
            </div>
          );
        }

        // Mobile / tablet: full-viewport modal with explicit top inset so
        // the modal always sits at the same height regardless of body
        // scroll. Phase 9 round-3: user-reported that the previous
        // `items-end` + `max-h-[90dvh]` modal appeared to 'scroll up' when
        // the page scrolled, and the sticky header wasn't always visible.
        // Solution: pin to all four edges (`inset-y-0`) so the modal fills
        // the viewport from a top safe-area to the bottom edge. The
        // close button + header are always reachable because they're at
        // the top of the modal.
        return (
          <div
            key={entry.key}
            role="dialog"
            aria-modal="true"
            aria-label={entry.label}
            className="fixed inset-0 z-50 flex justify-center bg-black/60 sm:items-center sm:p-4"
            style={{ zIndex: z }}
            onClick={isTop ? (e) => { if (e.target === e.currentTarget) pop(); } : undefined}
          >
            <div
              className={cn(
                "relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl",
                // Mobile: explicit top + bottom positioning so the modal
                // never moves with body scroll. sm+: cap height with dvh
                // and center vertically via the parent's `items-center`.
                "inset-x-0 bottom-0 top-2 sm:inset-auto sm:max-h-[90dvh]",
                !isTop && "max-w-md",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {renderModalBody(entry, isTop, stack, idx, pop, popTo)}
            </div>
          </div>
        );
      })}
    </>,
    document.body
  );
}

function renderModalBody(
  entry: ModalEntry,
  isTop: boolean,
  stack: ModalEntry[],
  idx: number,
  pop: () => void,
  popTo: (depth: number) => void,
) {
  return (
    <>
      {/* The modal header is rendered INSIDE the scroll container (below)
          so it sticks to the top of the scroll when content is taller
          than the viewport. Phase 9 round-2: 'If the thing has a lot of
          info, the header goes above the max height of the screen thus
          I cannot close it' — sticky inside the scroll container fixes
          this. */}
      {/* Mashu 2026-07-09: modal body baseline font set to text-sm so
          the inherited text size matches the source-page preview's
          `prose prose-sm` sizing. Without this, default browser font
          (16px) inflated Markdown paragraphs + raw `<div>` content
          compared to the library source page where `prose-sm` wraps
          everything. Phase 9 round-2: the whole modal now scrolls as
          ONE unit so the header sits at the top of the scroll and
          remains reachable even when the content is taller than the
          viewport (user-reported: 'If the thing has a lot of info,
          the header goes above the max height of the screen thus
          I cannot close it'). The header uses `sticky top-0` inside
          the scroll container so it pins when content scrolls under it.
      */}
      {/* Phase 8.1 batch 13.2 (Mashu 2026-07-22): removed the
          breadcrumb navigation row in the header. Per user: "instead
          of opening in same modal with breadcrubs, it should just
          stack another modal on top." Each modal in the stack now
          renders as an independent panel with its own close button.
          The stack depth is still tracked (so we can render up to 4
          modals side-by-side on desktop), but there's no breadcrumb
          UI — the user closes each modal independently by clicking
          its X button. */}
      <div className="min-h-0 flex-1 overflow-y-auto text-sm">
        <header className="sticky top-0 z-20 flex h-10 items-center justify-between gap-2 border-b border-border bg-card px-4">
          {/* Phase 9 round-3: header now shows only the CATEGORY (uppercase
              muted). The entity name is rendered inside the body (above
              the type chips) so the user sees "PRIMITIVE" in the header
              and "Domain of Storm" prominently in the preview body. */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {entry.category ? (
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {entry.category}
              </span>
            ) : null}
          </div>
          {/* Every modal in the stack is independently closeable — no
              breadcrumb row, no "← Back" button. The user closes each
              modal by clicking its X button (matches the user's stated
              mental model: stacked panels, not breadcrumb navigation). */}
          <button
            type="button"
            onClick={pop}
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="p-4">
          {/* Phase 9 round-3: entity name rendered INSIDE the body
              (above the type chips + meta), not in the modal header.
              User-feedback: 'the name is in the header (where close
              button is) not the body of preview like I asked... Just
              about "domain" for example from pictures'. The header
              keeps just the category + close button. */}
          {entry.label ? (
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {entry.label}
            </h2>
          ) : null}
          {entry.content}
        </div>
      </div>
    </>
  );
}
