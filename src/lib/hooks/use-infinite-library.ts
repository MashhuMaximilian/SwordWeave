"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryItem } from "@/lib/publishing/library-query";
import { readJsonResponse } from "@/lib/http/read-json-response";

export function mergeLibraryItems(previous: LibraryItem[], incoming: LibraryItem[]) {
  return [...new Map([...previous, ...incoming].map((item) => [item.id, item])).values()];
}

/** Debounced, cancellable library discovery. Offsets count server rows, not deduplicated cards. */
export function useInfiniteLibrary(queryString: string, { enabled = true, pageSize = 30, revision = 0, initialItems, initialTotal }: { enabled?: boolean; pageSize?: number; revision?: number; initialItems?: LibraryItem[]; initialTotal?: number } = {}) {
  const initialKey = useRef(`${queryString}|${revision}|0`);
  const seeded = initialItems !== undefined && initialTotal !== undefined;
  const [state, setState] = useState({ key: seeded ? `${queryString}|${revision}|0` : "", items: initialItems ?? [] as LibraryItem[], total: initialTotal ?? 0, loading: false, error: "", offset: initialItems?.length ?? 0, exhausted: seeded && initialItems!.length >= initialTotal! });
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const key = `${queryString}|${revision}|${reload}`;
  const latest = useRef(state);
  latest.current = state;
  const fetchPage = useCallback(async (offset: number, token: number) => {
    if (busy.current || !enabled) return;
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    setState((previous) => ({ ...previous, key, loading: true, error: "" }));
    try {
      const params = new URLSearchParams(queryString);
      params.set("limit", String(pageSize)); params.set("offset", String(offset));
      const response = await fetch(`/api/library?${params}`, { signal: controller.signal, cache: "no-store" });
      const result = await readJsonResponse(response);
      if (!response.ok) throw new Error(result.error ?? "Library unavailable.");
      if (token !== generation.current || controller.signal.aborted) return;
      const incoming: LibraryItem[] = result.items ?? [];
      setState((previous) => ({ key, items: mergeLibraryItems(offset && previous.key === key ? previous.items : [], incoming), total: result.total ?? offset + incoming.length, loading: false, error: "", offset: offset + incoming.length, exhausted: incoming.length < pageSize }));
    } catch (error) {
      if (token === generation.current && !controller.signal.aborted) setState((previous) => ({ ...previous, key, loading: false, error: error instanceof Error ? error.message : "Library unavailable." }));
    } finally {
      if (token === generation.current) busy.current = false;
    }
  }, [enabled, key, pageSize, queryString]);
  useEffect(() => {
    const token = ++generation.current;
    request.current?.abort(); busy.current = false;
    if (enabled && seeded && key === initialKey.current && latest.current.key === key && latest.current.total === initialTotal) return;
    setState({ key, items: [], total: 0, loading: enabled, error: "", offset: 0, exhausted: false });
    if (!enabled) return;
    const timer = setTimeout(() => void fetchPage(0, token), 220);
    return () => { clearTimeout(timer); request.current?.abort(); };
  }, [enabled, key, fetchPage, seeded, initialTotal]);
  const valid = state.key === key;
  const hasMore = enabled && valid && !state.exhausted && state.offset < state.total;
  const loadMore = useCallback(() => {
    const current = latest.current;
    if (current.key !== key || current.loading || current.exhausted || current.offset >= current.total) return;
    void fetchPage(current.offset, generation.current);
  }, [fetchPage, key]);
  const retry = useCallback(() => void fetchPage(latest.current.offset, generation.current), [fetchPage]);
  return { items: valid ? state.items : [], total: valid ? state.total : 0, loading: enabled && (!valid || state.loading), error: valid ? state.error : "", hasMore, loadMore, retry, reset: () => setReload((value) => value + 1) };
}
