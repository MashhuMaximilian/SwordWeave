"use client";
import { useEffect, useState } from "react";
import type { LibraryItem } from "@/lib/publishing/library-query";
export function useCollectionFilter(
  collectionId: string | undefined,
  items: LibraryItem[],
) {
  const [allowed, setAllowed] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!collectionId) {
      setAllowed(null);
      return;
    }
    const ctrl = new AbortController();
    setAllowed(new Set());
    const chunks = Array.from(
      { length: Math.ceil(items.length / 500) },
      (_, i) => items.slice(i * 500, (i + 1) * 500),
    );
    Promise.all(
      chunks.map((chunk) =>
        fetch(`/api/collections/${collectionId}/matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: chunk.map((item) => ({
              targetType: item.targetType,
              targetId: item.targetId,
            })),
          }),
          signal: ctrl.signal,
        }).then((r) => r.json()),
      ),
    )
      .then((results) => {
        if (!ctrl.signal.aborted)
          setAllowed(
            new Set(
              results.flatMap((r) =>
                (r.entries ?? []).map(
                  (e: { targetType: string; targetId: string }) =>
                    `${e.targetType}:${e.targetId}`,
                ),
              ),
            ),
          );
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [collectionId, items]);
  return allowed;
}
