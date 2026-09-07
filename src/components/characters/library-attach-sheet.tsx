"use client";

/**
 * LibraryAttachSheet — Phase 9.5 follow-up (Mashu 2026-09-07)
 *
 * Right-column "add from library" sheet for non-primitive
 * entity types (heritage / capability / effect / item).
 *
 * Mashu: "In character sheet besides primitives I should
 * also be able to add heritages and capabilities and effects
 * from library in a way."
 *
 * Architecture mirrors InlinePrimitiveSheet's search tab:
 *   - Fetch GET /api/library?type=<T>&q=<q>
 *   - Show a list of LibraryItems
 *   - Click → POST /api/characters/[id]/{heritage|capability|effect|item}/attach
 *   - Refresh the character sheet on success
 *
 * The library API already supports all four entity types
 * (see lib/publishing/library-query.ts). The attach endpoints
 * for capability and effect already existed; this commit
 * adds the matching one for heritage.
 */

import { useEffect, useState, useCallback } from "react";
import { X, Loader2, Plus, Check } from "lucide-react";
import type { LibraryItem } from "@/lib/publishing/library-query";

export type LibraryEntityType = "heritage" | "capability" | "effect" | "item";

export interface LibraryAttachSheetProps {
  characterId: string;
  entityType: LibraryEntityType;
  /** The accordion the entity will slot into. For heritage this
   *  drives which `kind` we filter by; for capability/effect
   *  it drives the slot_tab on character_capabilities. */
  accordion: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  open: boolean;
  onClose: () => void;
  onAttached?: (info: {
    entityType: LibraryEntityType;
    itemId: string;
    itemName: string;
  }) => void;
}

const ENTITY_LABEL: Record<LibraryEntityType, { singular: string; plural: string }> = {
  heritage: { singular: "heritage", plural: "heritages" },
  capability: { singular: "capability", plural: "capabilities" },
  effect: { singular: "effect", plural: "effects" },
  item: { singular: "item", plural: "items" },
};

export function LibraryAttachSheet({
  characterId,
  entityType,
  accordion,
  open,
  onClose,
  onAttached,
}: LibraryAttachSheetProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the library whenever the sheet opens or the query changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Map entityType → library targetType query string.
        // The library route reads `targetType=` (NOT `type=`
        // — that's an unrelated param). Heritages split into
        // three concrete types; the active accordion decides
        // which one we ask for.
        const url = new URL(
          `/api/library`,
          typeof window === "undefined"
            ? "http://localhost"
            : window.location.origin,
        );
        if (search.trim()) url.searchParams.set("q", search.trim());
        if (entityType === "heritage") {
          url.searchParams.set(
            "targetType",
            accordion === "LINEAGE"
              ? "LINEAGE_TEMPLATE"
              : accordion === "UPBRINGING"
                ? "UPBRINGING_TEMPLATE"
                : "MANIFEST_TEMPLATE",
          );
        } else if (entityType === "capability") {
          url.searchParams.set("targetType", "CAPABILITY");
        } else if (entityType === "effect") {
          url.searchParams.set("targetType", "EFFECT");
        } else if (entityType === "item") {
          url.searchParams.set("targetType", "ITEM");
        }
        url.searchParams.set("limit", "24");
        const res = await fetch(url.pathname + url.search, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`library fetch failed (${res.status})`);
        }
        const data = (await res.json()) as { items?: LibraryItem[] };
        if (cancelled) return;
        setItems(data.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load library.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, entityType, accordion, search]);

  const attach = useCallback(
    async (item: LibraryItem) => {
      if (attachingId) return;
      setAttachingId(item.id);
      setError(null);
      try {
        let url: string;
        let body: Record<string, unknown>;
        if (entityType === "heritage") {
          url = `/api/characters/${characterId}/heritages/attach`;
          body = { heritageId: item.targetId };
        } else if (entityType === "capability") {
          url = `/api/characters/${characterId}/capabilities/attach`;
          body = { capabilityId: item.targetId, slotTab: accordion };
        } else if (entityType === "effect") {
          url = `/api/characters/${characterId}/effects/attach`;
          body = { effectId: item.targetId };
        } else {
          url = `/api/characters/${characterId}/items/formalize`;
          body = { itemId: item.targetId };
        }
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ?? `attach failed (${res.status})`,
          );
        }
        onAttached?.({
          entityType,
          itemId: item.targetId,
          itemName: item.name,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to attach.",
        );
      } finally {
        setAttachingId(null);
      }
    },
    [characterId, entityType, accordion, attachingId, onAttached],
  );

  if (!open) return null;

  const label = ENTITY_LABEL[entityType];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${label.singular} from library`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Library · {accordion}
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Add {label.singular} from library
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="border-b border-border bg-card/50 px-5 py-3">
          <input
            type="search"
            placeholder={`Search ${label.plural}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </p>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No {label.plural} match your search.
            </p>
          )}
          {!loading && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => {
                const busy = attachingId === item.id;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => attach(item)}
                      disabled={busy || !!attachingId}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50"
                      aria-label={`Attach ${item.name}`}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      Attach
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
