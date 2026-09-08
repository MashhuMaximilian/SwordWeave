"use client";
import { useEffect, useState } from "react";
import type { EntityKind, EntityKey } from "@/lib/character/workspace/model";
import type { LibraryItem } from "@/lib/publishing/library-query";
export function WorkspaceLibraryPicker({
  kinds,
  category,
  onSelect,
}: {
  kinds: EntityKind[];
  category: string;
  onSelect: (key: EntityKey, name: string) => void;
}) {
  const [kind, setKind] = useState<EntityKind>(kinds[0] ?? "primitive");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((r) => r + 1);
    window.addEventListener("sw:library-changed", refresh);
    window.addEventListener("sw:library-refresh", refresh);
    return () => {
      window.removeEventListener("sw:library-changed", refresh);
      window.removeEventListener("sw:library-refresh", refresh);
    };
  }, []);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const type =
      kind === "heritage"
        ? `${category === "ALL" ? "MANIFEST" : category}_TEMPLATE`
        : kind.toUpperCase();
    const params = new URLSearchParams({
      targetType: type,
      q: query,
      limit: "50",
    });
    const timer = setTimeout(() => {
      void fetch(`/api/library?${params}`, {
        cache: "no-store",
        signal: abort.signal,
      })
        .then(async (response) => {
          const value = await response.json();
          if (!response.ok)
            throw new Error(value.error ?? "Library unavailable.");
          setItems(value.items ?? []);
          setError("");
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [kind, query, category, revision]);
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex gap-2">
        <select
          aria-label="Library piece type"
          className="rounded border border-border bg-card p-2"
          value={kind}
          onChange={(e) => setKind(e.target.value as EntityKind)}
        >
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input
          aria-label="Search library pieces"
          className="min-w-0 flex-1 rounded border border-border bg-card p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the Library…"
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full justify-between rounded border border-border p-3 text-left hover:bg-secondary"
              onClick={() => onSelect(`${kind}:${item.targetId}`, item.name)}
            >
              <span>{item.name}</span>
              <span className="text-xs">{item.buCost ?? 0} BU</span>
            </button>
          </li>
        ))}
      </ul>
      {!items.length && !error && (
        <p className="text-sm text-muted-foreground">
          No matching library pieces.
        </p>
      )}
    </div>
  );
}
