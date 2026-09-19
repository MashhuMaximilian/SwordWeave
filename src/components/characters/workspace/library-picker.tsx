"use client";
import { useEffect, useState } from "react";
import { EntityPreview } from "@/components/preview/entity-preview";
import { LibraryTable } from "@/components/library/library-table";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import { loadEntityPreview, previewKind } from "./workspace-entity-preview";
import type { EntityKind, EntityKey } from "@/lib/character/workspace/model";
import type { LibraryItem } from "@/lib/publishing/library-query";
export function WorkspaceLibraryPicker({
  kinds,
  category,
  onSelect,
  destinationLabel = "character",
}: {
  kinds: EntityKind[];
  category: string;
  onSelect: (key: EntityKey, name: string, heritageType?: string) => void;
  destinationLabel?: string;
}) {
  const [previewPath, setPreviewPath] = useState<SandboxPreviewItem[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
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
    <div className="v12-workspace-library space-y-3 rounded-lg border border-border p-4">
      <header className="v12-workspace-library-head">
        <div><span>Shared catalogue</span><h3>Library</h3></div>
        <p>Preview the complete piece, then add the exact version to this character.</p>
      </header>
      <div className="v12-workspace-library-tools flex gap-2">
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
      <div className="v12-character-library-workbench" data-has-preview={previewPath.length > 0}>
        <div className="v12-character-library-corpus">
          {previewLoading && <p className="v12-library-loading" role="status">Loading canonical preview…</p>}
          <LibraryTable
            items={items}
            view="LIST"
            engagement={{ reactions: {}, following: {} }}
            currentUserInternalId={null}
            selectedKey={selectedLibraryId}
            showClearFilters={false}
            surface="atelier"
            emptyTitle="No compatible Library entries"
            emptyDescription="Change the piece type or broaden the search."
            onSelect={(item) => {
              setSelectedLibraryId(item.id);
              void openPreview(kind, String(item.targetId));
            }}
          />
        </div>
        <aside className="v12-character-library-inspector" aria-label="Library preview and placement">
          {previewPath.length > 0 ? (
            <>
              <div className="v12-library-preview-command">
                <div>
                  <span>{previewPath.length > 1 ? "Nested preview" : "Destination ready"}</span>
                  <strong>{previewPath.at(-1)!.row.name}</strong>
                  <small>Add exact saved version to {destinationLabel}</small>
                </div>
                <div className="v12-library-preview-actions">
                  {previewPath.length > 1 ? (
                    <button type="button" onClick={() => setPreviewPath((path) => path.slice(0, -1))}>
                      Back
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => {
                      const candidate = previewPath[0]!;
                      onSelect(
                        `${candidate.kind}:${candidate.row.id}`,
                        candidate.row.name,
                        candidate.kind === "heritage" ? candidate.row.kind : undefined,
                      );
                    }}
                  >
                    Add to {destinationLabel}
                  </button>
                </div>
              </div>
              <div className="v12-character-library-preview-body">
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
              </div>
            </>
          ) : (
            <div className="v12-character-library-empty-preview">
              <span>Character Atelier</span>
              <strong>Select a Library entry</strong>
              <p>Its canonical preview appears here before anything is attached to the character.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
