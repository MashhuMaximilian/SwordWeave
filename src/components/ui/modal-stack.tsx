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

  return (
    <>
      {stack.map((entry, idx) => {
        const isTop = idx === stack.length - 1;
        const z = 50 + idx;

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

        // Mobile / tablet: full-screen overlay with dimming backdrop and
        // click-to-close on the top modal.
        return (
          <div
            key={entry.key}
            role="dialog"
            aria-modal="true"
            aria-label={entry.label}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
            style={{ zIndex: z }}
            onClick={isTop ? (e) => { if (e.target === e.currentTarget) pop(); } : undefined}
          >
            <div
              className={cn(
                "relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl",
                "max-h-[95vh]",
                !isTop && "max-w-md",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {renderModalBody(entry, isTop, stack, idx, pop, popTo)}
            </div>
          </div>
        );
      })}
    </>
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
      <header className="sticky top-0 z-10 flex flex-col gap-1 border-b border-border bg-card px-4 py-3">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {stack.slice(0, idx + 1).map((crumb, i) => {
            const isLast = i === idx;
            return (
              <span key={crumb.key} className="flex items-center gap-1">
                {i > 0 ? (
                  <ChevronRight className="size-3 shrink-0" />
                ) : null}
                <button
                  type="button"
                  onClick={() => popTo(i)}
                  className={cn(
                    "truncate rounded px-1 transition-colors hover:bg-accent",
                    isLast && "text-foreground",
                  )}
                  title={crumb.label}
                >
                  {crumb.label}
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">
              {entry.label}
            </h2>
            {entry.category ? (
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {entry.category}
              </p>
            ) : null}
          </div>
          {isTop ? (
            <button
              type="button"
              onClick={pop}
              aria-label="Close"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {!isTop ? (
          <button
            type="button"
            onClick={pop}
            className="self-start text-xs text-primary hover:underline"
          >
            ← Back
          </button>
        ) : null}
      </header>
      {/* Mashu 2026-07-09: modal body baseline font set to text-sm so
          the inherited text size matches the source-page preview's
          `prose prose-sm` sizing. Without this, default browser font
          (16px) inflated Markdown paragraphs + raw `<div>` content
          compared to the library source page where `prose-sm` wraps
          everything. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
        {entry.content}
      </div>
    </>
  );
}
