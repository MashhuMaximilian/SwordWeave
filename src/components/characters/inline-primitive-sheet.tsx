"use client";

/**
 * Phase 9.1 (Mashu 2026-09-06): Inline primitive picker sheet.
 *
 * A bottom-sheet / modal picker that lets the user add a primitive
 * to an accordion (LINEAGE / UPBRINGING / MANIFEST / PERSONAL).
 *
 * Three sources, ranked by recency:
 *   1. **Authored** — primitives the user has created (isPublic=false,
 *      userId=me). Pinned to the top.
 *   2. **Public** — primitives from the public library.
 *   3. **System** — primitives with `userId = null` (built-in
 *      starter kit, e.g. "PB to STR" from the canonical sample).
 *
 * Each row exposes:
 *   - "Add to <Accordion>" (slots it onto this character, source = kind)
 *   - Search/filter input at the top
 *   - "+ Author new" CTA that opens PrimitiveMiniForm inline
 *
 * Why mobile-first sheet:
 *   The character sheet is mobile-primary (per Phase 8.5 / Session H6);
 *   bottom sheets match the swipe-down gesture users expect on
 *   phones. Desktop still uses the same component — it just renders
 *   centered with a backdrop.
 *
 * Auth: required (the page is auth-gated).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2, Plus, Search, Sparkles, User, Globe } from "lucide-react";

type SourceBucket = "authored" | "public" | "system";

export type AccordionKind = "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";

export interface PrimitiveLibraryRow {
  id: number;
  name: string;
  description: string | null;
  category: string;
  buCost: number;
  userId: string | null;
  isPublic: boolean;
  hardModifiers: ReadonlyArray<unknown>;
}

export interface InlinePrimitiveSheetProps {
  characterId: string;
  accordionKind: AccordionKind;
  open: boolean;
  onClose: () => void;
  onCreated?: (info: {
    primitiveId: number;
    accordionKind: AccordionKind;
  }) => void;
  /** Optional callback after the slot succeeds; used to refetch
   *  the character's accordion chips. */
  onSlot?: () => void;
}

export function InlinePrimitiveSheet({
  characterId,
  accordionKind,
  open,
  onClose,
  onSlot,
  onCreated,
}: InlinePrimitiveSheetProps) {
  const [rows, setRows] = useState<PrimitiveLibraryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAuthorForm, setShowAuthorForm] = useState(false);
  const [pendingSlotId, setPendingSlotId] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Phase 9.1: lazy-load primitives on first open (avoid pre-fetching
  // for every accordion — the picker only opens on demand).
  useEffect(() => {
    if (!open) {
      setRows(null);
      setQuery("");
      setShowAuthorForm(false);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/primitives", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load primitives (${res.status}).`);
        }
        const data = (await res.json()) as { primitives?: PrimitiveLibraryRow[] };
        if (cancelled) return;
        setRows(data.primitives ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load primitives.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.description && r.description.toLowerCase().includes(q)) return true;
      if (r.category.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rows, query]);

  const buckets = useMemo(() => {
    if (!filtered) return null;
    const authored: PrimitiveLibraryRow[] = [];
    const publicRows: PrimitiveLibraryRow[] = [];
    const system: PrimitiveLibraryRow[] = [];
    for (const r of filtered) {
      if (r.userId == null) {
        system.push(r);
      } else if (r.isPublic) {
        publicRows.push(r);
      } else {
        authored.push(r);
      }
    }
    return { authored, public: publicRows, system };
  }, [filtered]);

  const slot = useCallback(
    async (primitiveId: number) => {
      if (pendingSlotId !== null) return;
      setPendingSlotId(primitiveId);
      setError(null);
      try {
        const res = await fetch(
          `/api/characters/${characterId}/primitives`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accordion: accordionKind,
              primitiveId,
            }),
          },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? `Slot failed (${res.status}).`);
        }
        onSlot?.();
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to slot primitive.",
        );
      } finally {
        setPendingSlotId(null);
      }
    },
    [characterId, accordionKind, pendingSlotId, onSlot, onClose],
  );

  const handleCreated = useCallback(
    (info: { primitiveId: number }) => {
      setShowAuthorForm(false);
      onCreated?.({ primitiveId: info.primitiveId, accordionKind });
      // Slot it on the accordion right away.
      void slot(info.primitiveId);
    },
    [slot, onCreated, accordionKind],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add primitive to ${accordionKind.toLowerCase()}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Add primitive
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              To {accordionKind.toLowerCase()} accordion
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            Close
          </button>
        </header>

        <div className="shrink-0 border-b border-border px-5 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, description, category..."
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
              Loading primitives…
            </div>
          )}
          {!loading && showAuthorForm && (
            <PrimitiveMiniForm
              characterId={characterId}
              accordionKind={accordionKind}
              onCancel={() => setShowAuthorForm(false)}
              onCreated={handleCreated}
            />
          )}
          {!loading && !showAuthorForm && buckets && (
            <div className="space-y-5">
              <Bucket
                label="Authored"
                icon={<User className="size-3.5" />}
                accent="text-primary"
                rows={buckets.authored}
                pendingSlotId={pendingSlotId}
                onSlot={slot}
              />
              <Bucket
                label="Public"
                icon={<Globe className="size-3.5" />}
                accent="text-emerald-500"
                rows={buckets.public}
                pendingSlotId={pendingSlotId}
                onSlot={slot}
              />
              <Bucket
                label="System"
                icon={<Sparkles className="size-3.5" />}
                accent="text-muted-foreground"
                rows={buckets.system}
                pendingSlotId={pendingSlotId}
                onSlot={slot}
              />
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border bg-card/40 px-5 py-3">
          <button
            type="button"
            onClick={() => setShowAuthorForm((s) => !s)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="size-4" />
            {showAuthorForm ? "Cancel authoring" : "Author new primitive"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Bucket({
  label,
  icon,
  accent,
  rows,
  pendingSlotId,
  onSlot,
}: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  rows: PrimitiveLibraryRow[];
  pendingSlotId: number | null;
  onSlot: (id: number) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3
        className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${accent}`}
      >
        {icon}
        {label} ({rows.length})
      </h3>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSlot(r.id)}
              disabled={pendingSlotId !== null}
              className="group flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {r.name}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {r.description ?? r.category}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="rounded-full border border-border bg-card px-2 py-0.5 font-semibold uppercase tracking-wider">
                  {r.category}
                </span>
                <span className="font-mono">{r.buCost} BU</span>
                {pendingSlotId === r.id && (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Phase 9.1 (Mashu 2026-09-06): primitive mini-form.
 *
 * Inline authoring form for creating a primitive right inside the
 * sheet picker. Calls POST /api/characters/[id]/primitives in
 * "inline authoring" mode (no primitiveId, just name + category +
 * buCost + description).
 */

interface PrimitiveMiniFormProps {
  characterId: string;
  accordionKind: AccordionKind;
  onCancel: () => void;
  onCreated: (info: { primitiveId: number }) => void;
}

const CATEGORIES = [
  "OUTPUT",
  "MECHANIC",
  "TRAIT",
  "FEATURE",
  "QUALITY",
  "FLAW",
  "DRAWBACK",
] as const;

export function PrimitiveMiniForm({
  characterId,
  accordionKind,
  onCancel,
  onCreated,
}: PrimitiveMiniFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>(
    "OUTPUT",
  );
  const [buCost, setBuCost] = useState(1);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(
            `/api/characters/${characterId}/primitives`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: name.trim(),
                category,
                buCost,
                description: description.trim() || undefined,
                accordion: accordionKind,
              }),
            },
          );
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(
              payload.error ?? `Authoring failed (${res.status}).`,
            );
          }
          const data = (await res.json()) as {
            characterPrimitive?: { primitiveId: number };
          };
          const newPrimitiveId = data.characterPrimitive?.primitiveId;
          if (!newPrimitiveId) {
            throw new Error("Server did not return a primitive id.");
          }
          onCreated({ primitiveId: newPrimitiveId });
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to author primitive.",
          );
        }
      });
    },
    [characterId, accordionKind, name, category, buCost, description, onCreated],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-border bg-background p-4"
      aria-label="Author new primitive"
    >
      <h3 className="text-sm font-semibold text-foreground">
        Author new primitive
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-foreground">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Endless Breath"
            required
            className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">BU cost</span>
          <input
            type="number"
            min={0}
            step={1}
            value={buCost}
            onChange={(e) =>
              setBuCost(Math.max(0, Math.floor(parseInt(e.target.value, 10) || 0)))
            }
            className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-foreground">Category</span>
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as typeof CATEGORIES[number])
          }
          className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-foreground">
          Description (optional)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this primitive does in plain language."
          className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
        >
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:bg-primary/40"
        >
          {isPending && <Loader2 className="size-3 animate-spin" />}
          Create and slot
        </button>
      </div>
    </form>
  );
}
