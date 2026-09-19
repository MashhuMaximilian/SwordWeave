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
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { InstrumentDialogFrame } from "@/components/ui/instrument-dialog";

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
  scopeHost: HTMLElement | null;
  setScopeHost: (host: HTMLElement | null) => void;
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
      scopeHost: null,
      setScopeHost: () => {},
    };
  }
  return ctx;
}

export function ModalStackHost({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);
  const [scopeHost, setScopeHost] = useState<HTMLElement | null>(null);
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
      // A click can be observed by both a compact composition card and its
      // parent preview listener. Re-opening a record already in the stack
      // should focus that record, never add a duplicate React key.
      const existingIndex = current.findIndex((candidate) => candidate.key === entry.key);
      if (existingIndex >= 0) {
        pushed = true;
        return [...current.slice(0, existingIndex), entry as ModalEntry];
      }
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
      scopeHost,
      setScopeHost,
    }),
    [stack, push, pop, popTo, clear, scopeHost],
  );

  return (
    <StackCtx.Provider value={value}>
      {children}
      <ModalStackRenderer />
    </StackCtx.Provider>
  );
}

/** Registers a page-local portal boundary while mounted. Atelier places this
 * inside its source panel so every shared preview keeps the global content
 * contract but opens within that panel. */
export function ModalStackScope() {
  const { setScopeHost } = useModalStack();
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    setScopeHost(host);
    return () => setScopeHost(null);
  }, [setScopeHost]);
  return <div ref={hostRef} className="pointer-events-none absolute inset-0 z-[150]" data-modal-stack-scope />;
}

function ModalStackRenderer() {
  const { stack, pop, scopeHost } = useModalStack();
  const [isDesktop, setIsDesktop] = useState(false);

  // Desktop and mobile both use an isolated modal surface. The rich V12
  // instrument background must never show through long preview content.
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
        const z = 160 + idx;

        if (isDesktop) {
          return (
            <div
              key={entry.key}
              role="dialog"
              aria-modal="true"
              aria-label={entry.label}
              className={cn("v12-modal-backdrop inset-0 flex items-center justify-center", scopeHost ? "pointer-events-auto absolute p-0" : "fixed p-6")}
              style={{ zIndex: z }}
              onClick={isTop ? (event) => { if (event.target === event.currentTarget) pop(); } : undefined}
            >
              <InstrumentDialogFrame
                title={entry.label}
                kicker={entry.category ?? "Archive preview"}
                onClose={pop}
                className={cn(
                  scopeHost ? "max-h-[calc(100%-8px)] max-w-full" : "max-h-[calc(100dvh-48px)] max-w-6xl",
                  !isTop && "max-w-5xl opacity-95",
                )}
                bodyClassName={isScopedBodyClass(Boolean(scopeHost))}
              >
                {entry.content}
              </InstrumentDialogFrame>
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
            className={cn("v12-modal-backdrop inset-0 z-50 flex justify-center bg-black/80 sm:items-center sm:p-4", scopeHost ? "pointer-events-auto absolute" : "fixed")}
            style={{ zIndex: z }}
            onClick={isTop ? (e) => { if (e.target === e.currentTarget) pop(); } : undefined}
          >
            <InstrumentDialogFrame
              title={entry.label}
              kicker={entry.category ?? "Archive preview"}
              onClose={pop}
              className={cn(
                "max-w-2xl max-h-[calc(100dvh-8px)] sm:max-h-[90dvh]",
                !isTop && "max-w-md",
              )}
              bodyClassName={isScopedBodyClass(Boolean(scopeHost))}
            >
              {entry.content}
            </InstrumentDialogFrame>
          </div>
        );
      })}
    </>,
    scopeHost ?? document.body
  );
}

function isScopedBodyClass(scoped: boolean) {
  return scoped ? "p-2 text-sm" : "p-3 sm:p-4 text-sm";
}
