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
// A "sub-entity" link inside a modal (e.g. a primitive mentioned in a
// capability's primitiveLinks) can call useModalStack().push(...) to open the
// next modal in the stack.
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
    // No provider — return a no-op stack so components can call push/pop
    // unconditionally without crashing. Pages that actually need stack
    // behaviour must wrap their tree in <ModalStackHost />.
    const noop: ModalStackState = {
      stack: [],
      push: () => false,
      pop: () => {},
      popTo: () => {},
      clear: () => {},
      canPush: false,
      depth: 0,
    };
    return noop;
  }
  return ctx;
}

export function ModalStackHost({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);

  // Lock body scroll when stack is non-empty.
  useEffect(() => {
    if (stack.length === 0) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [stack.length > 0]);

  // Esc pops one level (not closes everything).
  useEffect(() => {
    if (stack.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStack((s) => (s.length > 0 ? s.slice(0, -1) : s));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stack.length > 0]);

  const push = useCallback(<T,>(entry: ModalEntry<T>) => {
    let ok = false;
    setStack((s) => {
      if (s.length >= MAX_DEPTH) return s;
      ok = true;
      return [...s, entry as ModalEntry];
    });
    return ok;
  }, []);

  const pop = useCallback(() => {
    setStack((s) => (s.length > 0 ? s.slice(0, -1) : s));
  }, []);

  const popTo = useCallback((depth: number) => {
    setStack((s) => s.slice(0, Math.max(0, depth)));
  }, []);

  const clear = useCallback(() => setStack([]), []);

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
  const { stack, pop, popTo, clear } = useModalStack();
  if (stack.length === 0) return null;

  // Each modal is rendered as a separate overlay, with z-index staggered so
  // deeper modals sit on top. The top modal gets full focus, ancestors get a
  // compact header with breadcrumb + back button.
  return (
    <>
      {stack.map((entry, idx) => {
        const isTop = idx === stack.length - 1;
        const z = 50 + idx;
        return (
          <div
            key={entry.key}
            role="dialog"
            aria-modal="true"
            aria-label={entry.label}
            className="fixed inset-0 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
            style={{ zIndex: z }}
            onClick={isTop ? (e) => { if (e.target === e.currentTarget) pop(); } : undefined}
          >
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl",
                "max-w-2xl max-h-[95vh] flex flex-col",
                !isTop && "max-w-md",
              )}
              onClick={(e) => e.stopPropagation()}
            >
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
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {entry.content}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
