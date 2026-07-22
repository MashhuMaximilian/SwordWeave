"use client";

// useSandboxSaveHandler — Phase 8.1 batch 13.6 follow-up.
//
// Shared hook for both grammar-library.tsx and heritage-library.tsx
// to react to `sw-sandbox-saved` events. Centralizes three concerns:
//
//   1. Maintain an `optimisticItems` state that prepends the just-
//      saved row to the visible list, so the user sees the new
//      entity INSTANTLY — without waiting for the server-side
//      router.refresh() round-trip to complete.
//   2. Drop optimistic entries once `libraryItems` updates from
//      the server (no duplicate row when SC re-fetches).
//   3. Expose a subscribe() callback so the consumer can add UI
//      side effects (filter reset, scroll, flash).
//
// Mashu 2026-07-22: "Soninfork idk a domain, I save, and I cannot
// see in list or search and find the new fork unless I refresh page."
// Even with batch 13.4's retry-loop, the new row sometimes arrived
// late (router.refresh takes 200-800ms in dev, longer on prod)
// and the retry window missed it. Optimistic prepend eliminates
// the wait entirely.

import { useCallback, useEffect, useState } from "react";
import type { LibraryItem } from "@/lib/publishing/library-query";

export type SandboxSaveKind =
  | "primitive"
  | "effect"
  | "capability"
  | "heritage"
  | "item";

export interface SandboxSaveDetail {
  kind: SandboxSaveKind;
  id: string;
  row?: LibraryItem;
}

const SW_SANDBOX_SAVED = "sw-sandbox-saved";

export function useSandboxSaveHandler(): {
  optimisticItems: LibraryItem[];
  flushOptimisticIfMatched: (id: string) => void;
  subscribe: (handler: (detail: SandboxSaveDetail) => void) => () => void;
} {
  const [optimisticItems, setOptimisticItems] = useState<LibraryItem[]>([]);

  // Always-on listener — keeps optimistic state up-to-date even if
  // the caller hasn't yet subscribed (subscribers add UI effects).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const e = event as CustomEvent<SandboxSaveDetail>;
      const detail = e.detail;
      if (!detail || !detail.id || !detail.row) return;
      // Prepend, dedupe by id.
      setOptimisticItems((prev) => {
        const filtered = prev.filter(
          (it) => String(it.id) !== String(detail.id),
        );
        return [detail.row as LibraryItem, ...filtered];
      });
    };
    window.addEventListener(SW_SANDBOX_SAVED, handler);
    return () => window.removeEventListener(SW_SANDBOX_SAVED, handler);
  }, []);

  const flushOptimisticIfMatched = useCallback((id: string) => {
    setOptimisticItems((prev) =>
      prev.filter((it) => String(it.id) !== String(id)),
    );
  }, []);

  const subscribe = useCallback(
    (handler: (detail: SandboxSaveDetail) => void) => {
      if (typeof window === "undefined") return () => {};
      const wrapper = (event: Event) => {
        const e = event as CustomEvent<SandboxSaveDetail>;
        if (!e.detail) return;
        handler(e.detail);
      };
      window.addEventListener(SW_SANDBOX_SAVED, wrapper);
      return () => window.removeEventListener(SW_SANDBOX_SAVED, wrapper);
    },
    [],
  );

  return { optimisticItems, flushOptimisticIfMatched, subscribe };
}