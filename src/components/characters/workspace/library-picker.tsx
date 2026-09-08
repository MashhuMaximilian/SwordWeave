"use client";
import { useEffect, useState } from "react";
import { EntityPreview } from "@/components/preview/entity-preview";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import { loadEntityPreview, previewKind } from "./workspace-entity-preview";
import { WorkspaceSurface } from "./workspace-surface";
import type { EntityKind, EntityKey } from "@/lib/character/workspace/model";
import type { LibraryItem } from "@/lib/publishing/library-query";
export function WorkspaceLibraryPicker({
  kinds,
  category,
  onSelect,
}: {
  kinds: EntityKind[];
  category: string;
  onSelect: (key: EntityKey, name: string, heritageType?: string) => void;
}) {
  const [previewPath, setPreviewPath] = useState<SandboxPreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  async function openPreview(type: EntityKind, id: string, nested = false) {
    setPreviewLoading(true);
    try {
      const item = await loadEntityPreview(type, id);
      setPreviewPath((previous) => (nested ? [...previous, item] : [item]));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview unavailable.");
    } finally {
      setPreviewLoading(false);
    }
  }
  const [heritageType, setHeritageType] = useState(
    category === "LINEAGE" || category === "UPBRINGING" ? category : "MANIFEST",
  );
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
      kind === "heritage" ? `${heritageType}_TEMPLATE` : kind.toUpperCase();
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
  }, [kind, query, heritageType, revision]);
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
        {kind === "heritage" && (
          <select
            aria-label="Library heritage type"
            className="rounded border border-border bg-card p-2"
            value={heritageType}
            onChange={(e) => setHeritageType(e.target.value)}
          >
            <option value="LINEAGE">Lineages</option>
            <option value="UPBRINGING">Upbringings</option>
            <option value="MANIFEST">Manifests</option>
          </select>
        )}
        <input
          aria-label="Search library pieces"
          className="min-w-0 flex-1 rounded border border-border bg-card p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the Library…"
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {previewLoading && <p role="status">Loading preview…</p>}
      {previewPath.length > 0 && (
        <WorkspaceSurface
          modal
          title={`Preview ${previewPath.at(-1)!.row.name}`}
          onClose={() => setPreviewPath([])}
        >
          {previewPath.length > 1 && (
            <button
              className="mb-3 rounded border border-border px-3 py-2"
              onClick={() => setPreviewPath((p) => p.slice(0, -1))}
            >
              Back to {previewPath.at(-2)!.row.name}
            </button>
          )}
          <EntityPreview
            item={previewPath.at(-1)!}
            callbacks={{
              onSubLinkClick: (link) =>
                void openPreview(
                  previewKind(link.targetType),
                  String(link.targetId),
                  true,
                ),
            }}
          />
          {previewPath.length === 1 && (
            <button
              className="mt-3 rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => {
                const p = previewPath[0]!;
                onSelect(
                  `${p.kind}:${p.row.id}`,
                  p.row.name,
                  p.kind === "heritage" ? p.row.kind : undefined,
                );
                setPreviewPath([]);
              }}
            >
              + Add {previewPath[0]!.row.name}
            </button>
          )}
        </WorkspaceSurface>
      )}
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-2 rounded border border-border p-3"
          >
            <span className="min-w-0 flex-1 font-medium">{item.name}</span>
            <span className="text-xs">{item.buCost ?? 0} BU</span>
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm hover:bg-secondary"
              disabled={previewLoading}
              onClick={() => void openPreview(kind, String(item.targetId))}
            >
              Preview<span className="sr-only"> {item.name}</span>
            </button>
            <button
              type="button"
              className="rounded border border-primary bg-primary/15 px-3 py-2 text-sm text-primary"
              onClick={() =>
                onSelect(
                  `${kind}:${item.targetId}`,
                  item.name,
                  kind === "heritage" ? heritageType : undefined,
                )
              }
            >
              + Add<span className="sr-only"> {item.name}</span>
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
