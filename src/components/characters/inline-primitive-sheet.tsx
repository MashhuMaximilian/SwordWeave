"use client";

/**
 * Phase 9.1 + 9.2 (Mashu 2026-09-06): Inline primitive picker sheet.
 *
 * A bottom-sheet / modal picker that lets the user add a primitive
 * to an accordion (LINEAGE / UPBRINGING / MANIFEST / PERSONAL).
 *
 * Three modes (Phase 9.2):
 *   1. **Search library** — browse authored / public / system
 *      primitives with text search. Each row opens a preview modal
 *      showing the primitive's full description, hard modifiers,
 *      and provenance. From the modal, the user clicks [Slot] to
 *      drop it onto the accordion.
 *   2. **Quick author** — name + category + BU cost + 1-line
 *      description. Creates a stub primitive and slots it. Same
 *      form as Phase 9.1's mini-form.
 *   3. **Promote condition** — lists the character's existing
 *      runtime conditions; clicking one pre-fills the Quick Author
 *      form with the condition's title + description. This is
 *      the "turn a condition into a primitive properly" path you
 *      asked for — the right-side condition list (ConditionsDrawer)
 *      stays the source of truth for conditions; the Promote tab
 *      here just opens a one-click bridge from condition to
 *      primitive.
 *
 * Mobile-first bottom-sheet; desktop centers with backdrop.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Eye,
  Globe,
  Loader2,
  Plus,
  Search,
  Sparkles,
  User,
  Wand2,
  X,
  Zap,
} from "lucide-react";

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

/** Minimal shape returned by GET /api/characters/[id]/conditions (or
 *  equivalent) for the Promote tab. We only need title + description. */
export interface CharacterConditionRow {
  id: string;
  title: string;
  description: string | null;
  tags?: readonly string[];
}

export type PickerMode = "search" | "quick" | "promote";

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
  const [mode, setMode] = useState<PickerMode>("search");
  const [rows, setRows] = useState<PrimitiveLibraryRow[] | null>(null);
  const [conditions, setConditions] = useState<CharacterConditionRow[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingSlotId, setPendingSlotId] = useState<number | null>(null);
  const [previewRow, setPreviewRow] = useState<PrimitiveLibraryRow | null>(
    null,
  );
  const [promoteSeed, setPromoteSeed] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Phase 9.1: lazy-load primitives on first open (avoid pre-fetching
  // for every accordion — the picker only opens on demand).
  useEffect(() => {
    if (!open || rows !== null) return;
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
  }, [open, rows]);

  // Phase 9.2: lazy-load conditions when Promote tab is opened.
  // Conditions live in localStorage under `sw:cond:<characterId>:<id>`
  // (see src/lib/hooks/use-runtime-conditions.ts). We read directly
  // here — same source of truth as the existing ConditionsDrawer —
  // instead of adding a new API endpoint just for the picker.
  useEffect(() => {
    if (!open || mode !== "promote" || conditions !== null) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const prefix = `sw:cond:${characterId}:`;
        const out: CharacterConditionRow[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (!key || !key.startsWith(prefix)) continue;
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as {
              id?: string;
              title?: string;
              description?: string;
              tags?: string[];
            };
            if (typeof parsed.title === "string" && parsed.id) {
              out.push({
                id: parsed.id,
                title: parsed.title,
                description:
                  typeof parsed.description === "string"
                    ? parsed.description
                    : null,
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
              });
            }
          } catch {
            // skip malformed entries (matches ConditionsDrawer's behavior)
          }
        }
        if (cancelled) return;
        setConditions(out);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load conditions.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, conditions, characterId]);

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

  const filteredConditions = useMemo(() => {
    if (!conditions) return null;
    const q = query.trim().toLowerCase();
    if (!q) return conditions;
    return conditions.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      if (c.description && c.description.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [conditions, query]);

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
        setPreviewRow(null);
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
      setPromoteSeed(null);
      onCreated?.({ primitiveId: info.primitiveId, accordionKind });
      // Slot it on the accordion right away.
      void slot(info.primitiveId);
    },
    [slot, onCreated, accordionKind],
  );

  // Phase 9.2: clicking a condition in Promote pre-fills the Quick
  // Author form. The user can then tweak category + BU cost and
  // submit. Conditions are not consumed; they remain on the
  // character (they're runtime state). The user can later delete
  // the condition via ConditionsDrawer if they want.
  const promoteFromCondition = useCallback((c: CharacterConditionRow) => {
    setPromoteSeed({ name: c.title, description: c.description ?? "" });
    setMode("quick");
  }, []);

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

        {/* Phase 9.2: 3-mode tabs. Mashu 2026-09-06:
            Search (existing) / Quick (existing) / Promote (new — wraps
            the Quick form with a condition pre-fill). */}
        <div
          className="flex shrink-0 gap-1 border-b border-border bg-card/40 px-5 py-2"
          role="tablist"
          aria-label="Add primitive mode"
        >
          <ModeTab
            label="Search library"
            icon={<Search className="size-3.5" />}
            active={mode === "search"}
            onClick={() => {
              setMode("search");
              setPromoteSeed(null);
            }}
          />
          <ModeTab
            label="Quick author"
            icon={<Plus className="size-3.5" />}
            active={mode === "quick"}
            onClick={() => {
              setMode("quick");
              setPromoteSeed(null);
            }}
          />
          <ModeTab
            label="Promote condition"
            icon={<Wand2 className="size-3.5" />}
            active={mode === "promote"}
            onClick={() => setMode("promote")}
          />
        </div>

        {mode !== "promote" && (
          <div className="shrink-0 border-b border-border px-5 py-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  mode === "search"
                    ? "Search name, description, category..."
                    : "Filter conditions..."
                }
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>
        )}

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
              {mode === "search" ? "Loading primitives…" : "Loading conditions…"}
            </div>
          )}

          {/* SEARCH MODE (existing behavior, plus Phase 9.2: rows open
              a preview modal instead of slotting immediately). */}
          {!loading && mode === "search" && buckets && (
            <div className="space-y-5">
              <Bucket
                label="Authored"
                icon={<User className="size-3.5" />}
                accent="text-primary"
                rows={buckets.authored}
                onPreview={setPreviewRow}
              />
              <Bucket
                label="Public"
                icon={<Globe className="size-3.5" />}
                accent="text-emerald-500"
                rows={buckets.public}
                onPreview={setPreviewRow}
              />
              <Bucket
                label="System"
                icon={<Sparkles className="size-3.5" />}
                accent="text-muted-foreground"
                rows={buckets.system}
                onPreview={setPreviewRow}
              />
            </div>
          )}

          {/* QUICK MODE (Phase 9.1 form, with optional pre-fill from
              the Promote tab). */}
          {!loading && mode === "quick" && (
            <PrimitiveMiniForm
              characterId={characterId}
              accordionKind={accordionKind}
              seed={promoteSeed}
              onCreated={handleCreated}
              onCancel={() => setPromoteSeed(null)}
            />
          )}

          {/* PROMOTE MODE — list conditions; clicking one jumps to
              Quick with pre-filled values. */}
          {!loading && mode === "promote" && filteredConditions && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Click a condition to wrap it as a primitive. The condition
                stays on the character — you can detach it from
                ConditionsDrawer if you want.
              </p>
              {filteredConditions.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
                  No conditions on this character yet. Add conditions
                  from the right-side conditions panel first.
                </p>
              )}
              <ul className="space-y-1.5">
                {filteredConditions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => promoteFromCondition(c)}
                      className="group flex w-full items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {c.title}
                        </p>
                        {c.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {c.description}
                          </p>
                        )}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        <Wand2 className="size-3" />
                        Promote
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Phase 9.2: preview modal. Renders when a row in the Search
          list is clicked. */}
      {previewRow && (
        <PrimitivePreviewModal
          row={previewRow}
          pendingSlotId={pendingSlotId}
          onSlot={slot}
          onClose={() => setPreviewRow(null)}
        />
      )}
    </div>
  );
}

function ModeTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition " +
        (active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "border border-border bg-background text-muted-foreground hover:bg-card hover:text-foreground")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function Bucket({
  label,
  icon,
  accent,
  rows,
  onPreview,
}: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  rows: PrimitiveLibraryRow[];
  onPreview: (row: PrimitiveLibraryRow) => void;
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
              onClick={() => onPreview(r)}
              className="group flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
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
                <Eye className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Phase 9.2 (Mashu 2026-09-06): read-only preview modal for a
 * library primitive. Shows everything the user needs to decide
 * whether to slot it: name, category, BU cost, description, hard
 * modifiers as a JSON dump (the rest of the sheet renders the
 * expanded version). [Slot] drops the primitive onto the
 * accordion; [Cancel] closes the modal.
 */
function PrimitivePreviewModal({
  row,
  pendingSlotId,
  onSlot,
  onClose,
}: {
  row: PrimitiveLibraryRow;
  pendingSlotId: number | null;
  onSlot: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${row.name}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Preview
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
              {row.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground"
            aria-label="Close preview"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
              {row.category}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-mono font-semibold text-foreground">
              <Zap className="size-3" />
              {row.buCost} BU
            </span>
          </div>
          {row.description ? (
            <p className="mb-3 text-sm leading-relaxed text-foreground">
              {row.description}
            </p>
          ) : (
            <p className="mb-3 text-sm italic text-muted-foreground">
              No description.
            </p>
          )}
          {row.hardModifiers.length > 0 && (
            <div className="mb-3">
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Hard modifiers ({row.hardModifiers.length})
              </h4>
              <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-[11px] leading-relaxed text-foreground">
                {JSON.stringify(row.hardModifiers, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-card/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSlot(row.id)}
            disabled={pendingSlotId !== null}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:bg-primary/40"
          >
            {pendingSlotId === row.id && (
              <Loader2 className="size-3 animate-spin" />
            )}
            Slot to accordion
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Phase 9.1 (Mashu 2026-09-06): primitive mini-form.
 *
 * Inline authoring form for creating a primitive right inside the
 * sheet picker. Calls POST /api/characters/[id]/primitives in
 * "inline authoring" mode (no primitiveId, just name + category +
 * buCost + description). Phase 9.2: accepts an optional `seed`
 * prop so the Promote tab can pre-fill name + description from
 * the chosen condition.
 */

interface PrimitiveMiniFormProps {
  characterId: string;
  accordionKind: AccordionKind;
  onCancel: () => void;
  onCreated: (info: { primitiveId: number }) => void;
  seed?: { name: string; description: string } | null;
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
  seed,
}: PrimitiveMiniFormProps) {
  const [name, setName] = useState(seed?.name ?? "");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>(
    "OUTPUT",
  );
  const [buCost, setBuCost] = useState(1);
  const [description, setDescription] = useState(seed?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Phase 9.2: if a new seed arrives (from Promote), update the
  // form. This handles the case where the user clicks a condition,
  // then changes their mind and clicks another.
  useEffect(() => {
    if (seed) {
      setName(seed.name);
      setDescription(seed.description);
    }
  }, [seed]);

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
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {seed ? "Promote condition to primitive" : "Author new primitive"}
        </h3>
        {seed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Wand2 className="size-3" />
            Pre-filled
          </span>
        )}
      </div>
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
        {seed && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            Back to conditions
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className={
            seed
              ? "hidden"
              : "rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
          }
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:bg-primary/40"
        >
          {isPending && <Loader2 className="size-3 animate-spin" />}
          {seed ? "Promote & slot" : "Create and slot"}
        </button>
      </div>
    </form>
  );
}
