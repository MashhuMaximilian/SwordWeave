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
  Layers,
  ZapIcon,
} from "lucide-react";
import {
  EmbeddedCapabilityForm,
  EmbeddedEffectForm,
  EmbeddedPrimitiveForm,
  type ModifierDraft,
} from "@/components/characters/workspace/embedded-atelier-forms";

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
  tags: string[];
  /**
   * Phase 9.4 (Mashu 2026-09-07): sourceEntityType from
   * useRuntimeConditions — one of "capability" | "effect" |
   * "primitive" when source === "sheet" / "sheet-auto". Used by
   * the Promote tab to filter to conditions from DIRECT
   * primitives.
   */
  sourceEntityType?: "capability" | "effect" | "primitive";
  /**
   * Phase 9.4 (Mashu 2026-09-07): the source entity's id as a
   * string. For primitives this matches the global primitive id
   * (cast to string). Compared against directPrimitivesIndex.
   */
  sourceEntityId?: string;
}

export type PickerMode =
  | "search"
  | "quick"
  | "promote"
  | "capability"
  | "effect";

/**
 * DirectPrimitivesIndex — Phase 9.4 (Mashu 2026-09-07).
 *
 * A flat set of primitive IDs that are "DIRECT" on the character —
 * slotted with no origin (no heritage / capability / effect / item).
 * Used by the Promote tab to filter conditions down to those that
 * came from a primitive slotted directly on the character (per
 * Mashu's #2: "only from DIRECT primitives, not those nested in
 * capabilities and effects").
 *
 * `primitiveId` is the global primitive id (integer); not the
 * character_primitives instance id. Conditions carry their source
 * entity id as a string, so the matching is by primitive id string.
 */
export interface DirectPrimitivesIndex {
  /** Set of primitive IDs (as strings, since condition sourceEntityIds
   * are strings) that are direct on the character. */
  readonly directPrimitiveIds: ReadonlySet<string>;
}

export interface InlinePrimitiveSheetProps {
  characterId: string;
  accordionKind: AccordionKind;
  open: boolean;
  onClose: () => void;
  /** Phase 9.5 (Mashu 2026-09-07): the tab to open by default.
   * Defaults to "search" (the library browser). The AddPanel routes
   * to "quick" / "promote" / "capability" / "effect" based on which
   * mode button the user clicked. The picker resets to this value
   * every time it re-opens (open: false → true). */
  initialMode?: PickerMode;
  onCreated?: (info: {
    primitiveId: number;
    accordionKind: AccordionKind;
  }) => void;
  /** Optional callback after the slot succeeds; used to refetch
   *  the character's accordion chips. */
  onSlot?: () => void;
  /** Phase 9.5 (Mashu 2026-09-07): when the user changes the
   *  destination accordion from inside the preview modal, the
   *  change bubbles up so the panel's picker stays in sync
   *  (and so the next slot uses the same target). */
  onAccordionChange?: (next: AccordionKind) => void;
  /**
   * Phase 9.4 (Mashu 2026-09-07): the character's primitive
   * roster, used by the Promote tab to filter conditions down to
   * those that came from a DIRECT primitive. Optional — when
   * omitted, the Promote tab falls back to showing every
   * condition (legacy behavior).
   */
  directPrimitives?: DirectPrimitivesIndex | null;
}

export function InlinePrimitiveSheet({
  characterId,
  accordionKind,
  open,
  onClose,
  initialMode = "search",
  onSlot,
  onCreated,
  onAccordionChange,
  directPrimitives,
}: InlinePrimitiveSheetProps) {
  const [mode, setMode] = useState<PickerMode>(initialMode);
  // Phase 9.5: when the parent closes & reopens the sheet (open flips
  // false → true), reset to the requested initialMode so the picker
  // always lands on the right tab for the entry point.
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);
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
    /**
     * Phase 9.4 (Mashu 2026-09-07): when present, EmbeddedPrimitiveForm
     * adds this as a starting ModifierDraft so the user sees a real
     * "+X to Y when Z" modifier row pre-populated from the condition.
     */
    startingModifier?: ModifierDraft;
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
              sourceEntityType?: "capability" | "effect" | "primitive";
              sourceEntityId?: string;
              source?: "custom" | "sheet" | "sheet-auto";
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
                ...(parsed.sourceEntityType
                  ? { sourceEntityType: parsed.sourceEntityType }
                  : {}),
                ...(parsed.sourceEntityId
                  ? { sourceEntityId: parsed.sourceEntityId }
                  : {}),
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
      // Phase 9.5 (Mashu 2026-09-07): also search the hard
      // modifiers. Users often remember a primitive by its
      // "+1 to physical when X" rather than its name. The
      // match is a stringified scan — modifiers are objects
      // with a `target`, `operation`, `value` etc., so we
      // include all string/number fields.
      if (r.hardModifiers.length > 0) {
        const blob = JSON.stringify(r.hardModifiers).toLowerCase();
        if (blob.includes(q)) return true;
      }
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

  /**
   * Phase 9.4 (Mashu 2026-09-07): filter the Promote tab to only
   * conditions that originated from a DIRECT primitive on this
   * character (per Mashu's #2: "only from DIRECT primitives, not
   * those nested in capabilities and effects").
   *
   * When the directPrimitives index is missing, we fall back to
   * the legacy behavior of showing every condition (so the picker
   * still works during the transition window before the sheet
   * page threads the index down).
   */
  const directFilteredConditions = useMemo(() => {
    if (!conditions) return null;
    if (!directPrimitives) return conditions;
    return conditions.filter((c) => {
      // Conditions without a primitive source (custom-authored or
      // from a capability/effect) are excluded from the Promote
      // tab in Phase 9.4. The user can still promote them later
      // by widening the filter (out of scope for this round).
      if (c.sourceEntityType !== "primitive") return false;
      if (!c.sourceEntityId) return false;
      return directPrimitives.directPrimitiveIds.has(c.sourceEntityId);
    });
  }, [conditions, directPrimitives]);

  const filteredConditions = useMemo(() => {
    if (!directFilteredConditions) return null;
    const q = query.trim().toLowerCase();
    if (!q) return directFilteredConditions;
    return directFilteredConditions.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      if (c.description && c.description.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [directFilteredConditions, query]);

  const slot = useCallback(
    async (primitiveId: number, overrideKind?: AccordionKind) => {
      if (pendingSlotId !== null) return;
      setPendingSlotId(primitiveId);
      setError(null);
      const targetKind = overrideKind ?? accordionKind;
      try {
        const res = await fetch(
          `/api/characters/${characterId}/primitives`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // POST route reads `source` (not `accordion`).
              source: targetKind,
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
    // Phase 9.4 (Mashu 2026-09-07): in addition to seeding the
    // primitive's name + narrativeRule, build a starter ModifierDraft
    // so the user sees a real "+1 to physical when [condition title]"
    // modifier row pre-populated. They can edit / remove it before
    // saving.
    //
    // The shape mirrors the atelier's `blankModifier` (primitive-form
    // .tsx:290) with three overrides:
    //   - conditionMode: "custom" — fires when the condition matches
    //   - conditionKey: "custom" + freeTextNarrowFocus: condition title
    //     — the form's condition triple treats these as "any custom
    //     condition whose title equals the focus string"
    //   - targetValues: ["PHYSICAL"] — defaults to physical, the most
    //     common attribute axis; user can swap.
    const startingModifier = {
      id: "modifier-1",
      target: "attribute",
      operation: "add",
      tokens: [{ kind: "number", value: 1 }],
      value: "1",
      valueKind: "number",
      operands: [],
      targetValues: ["PHYSICAL"],
      granularity: "broad" as const,
      freeTextNarrowFocus: c.title,
      conditionMode: "custom" as const,
      conditionKey: "custom",
      conditionOperator: "equals" as const,
      // The remaining ModifierDraft fields (conditionValue, stacking,
      // v1Condition, tags, notes, isActive, trigger, effect) are
      // filled by blankModifier spread inside the form when this
      // partial is merged. Cast as never to skip the strict field
      // check here — the form's blankModifier is the canonical
      // source of truth for those defaults.
    } as unknown as ModifierDraft;
    setPromoteSeed({
      name: c.title,
      description: c.description ?? "",
      startingModifier,
    });
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
          <ModeTab
            label="Author capability"
            icon={<Layers className="size-3.5" />}
            active={mode === "capability"}
            onClick={() => setMode("capability")}
          />
          <ModeTab
            label="Author effect"
            icon={<ZapIcon className="size-3.5" />}
            active={mode === "effect"}
            onClick={() => setMode("effect")}
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

          {/* QUICK MODE — atelier's PrimitiveForm embedded. Phase 9.3
              (Mashu 2026-09-06): same UI + same fields + same modifier
              composer as /atelier. On save, the lifter auto-slots the
              new primitive onto this accordion. The Promote tab
              pre-fills name + narrativeRule from a chosen condition. */}
          {!loading && mode === "quick" && (
            <EmbeddedPrimitiveForm
              characterId={characterId}
              accordionKind={accordionKind}
              seed={promoteSeed}
              onSlot={({ primitiveId }) =>
                handleCreated({ primitiveId })
              }
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
                  {directPrimitives &&
                  conditions &&
                  conditions.length > 0 &&
                  conditions.length !== filteredConditions.length ? (
                    <>
                      No DIRECT-only conditions yet. The Promote tab only
                      shows conditions that originated from a primitive
                      slotted directly on this character (not from
                      capabilities or effects).
                    </>
                  ) : (
                    <>
                      No conditions on this character yet. Add conditions
                      from the right-side conditions panel first.
                    </>
                  )}
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

          {/* AUTHOR CAPABILITY MODE — atelier's CapabilityForm
              embedded. Phase 9.3 (Mashu 2026-09-06): same UI + same
              fields + same slot composer as /atelier. On save, the
              lifter auto-attaches the new capability to this character
              and routes it to the source accordion via slot_tab. */}
          {!loading && mode === "capability" && (
            <EmbeddedCapabilityForm
              characterId={characterId}
              targetSlotTab={
                accordionKind === "PERSONAL" ? null : accordionKind
              }
            />
          )}

          {/* AUTHOR EFFECT MODE — atelier's EffectForm embedded.
              Same as /atelier; the lifter auto-attaches the new effect
              via /api/characters/[id]/effects/attach. */}
          {!loading && mode === "effect" && (
            <EmbeddedEffectForm characterId={characterId} />
          )}
        </div>
      </div>

      {/* Phase 9.2: preview modal. Renders when a row in the Search
          list is clicked. */}
      {previewRow && (
        <PrimitivePreviewModal
          row={previewRow}
          pendingSlotId={pendingSlotId}
          accordionKind={accordionKind}
          onAccordionChange={onAccordionChange}
          onSlot={(id: number, overrideKind?: AccordionKind) => {
            void slot(id, overrideKind);
          }}
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
              className="group flex w-full flex-col items-stretch gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {r.name}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {r.description ?? r.category}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 font-semibold uppercase tracking-wider">
                    {r.category}
                  </span>
                  <span className="font-mono">{r.buCost} BU</span>
                  <Eye className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
              </div>
              {/* Phase 9.5 (Mashu 2026-09-07): show modifier previews
                  inline so the user can spot "+1 to physical when X"
                  without opening the preview modal. Truncated to
                  2 lines so the row stays compact. */}
              {r.hardModifiers.length > 0 && (
                <ul className="flex flex-wrap gap-1 text-[10px]">
                  {r.hardModifiers.slice(0, 3).map((mod, mi) => {
                    const m = mod as {
                      target?: string;
                      operation?: string;
                      value?: unknown;
                    };
                    const op = m.operation ?? "modify";
                    const target = m.target ?? "?";
                    const value = m.value;
                    const v =
                      typeof value === "string"
                        ? value
                        : typeof value === "number"
                          ? String(value)
                          : value && typeof value === "object" && "kind" in value
                            ? String(
                                (value as { kind?: string }).kind ?? "?",
                              )
                            : "?";
                    return (
                      <li
                        key={mi}
                        className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {op} {target} {v}
                      </li>
                    );
                  })}
                  {r.hardModifiers.length > 3 && (
                    <li className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                      +{r.hardModifiers.length - 3} more
                    </li>
                  )}
                </ul>
              )}
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
  accordionKind,
  onAccordionChange,
  onSlot,
  onClose,
}: {
  row: PrimitiveLibraryRow;
  pendingSlotId: number | null;
  /** Phase 9.5: the destination accordion the slot will land in.
   *  Mirrors the panel's `targetAccordion` so the user can override
   *  the destination from the modal. */
  accordionKind: AccordionKind;
  onAccordionChange?: ((next: AccordionKind) => void) | undefined;
  onSlot: (id: number, overrideKind?: AccordionKind) => void;
  onClose: () => void;
}) {
  const [localKind, setLocalKind] = useState<AccordionKind>(accordionKind);
  // Keep local in sync with parent (the panel's accordion picker).
  useEffect(() => {
    setLocalKind(accordionKind);
  }, [accordionKind]);
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
          {/* Phase 9.5: destination picker. The user picks which
              accordion to slot this primitive into right from the
              preview modal — saves a round-trip to the panel. */}
          <div className="mt-2 border-t border-border pt-3">
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Slot into
            </h4>
            <div
              className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background/60 p-1"
              role="radiogroup"
              aria-label="Slot into accordion"
            >
              {(["LINEAGE", "UPBRINGING", "MANIFEST", "PERSONAL"] as const).map(
                (kind) => {
                  const active = localKind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setLocalKind(kind);
                        onAccordionChange?.(kind);
                      }}
                      className={
                        "rounded px-2 py-1 text-xs font-medium transition " +
                        (active
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:bg-card hover:text-foreground")
                      }
                    >
                      {kind === "LINEAGE"
                        ? "Lineage"
                        : kind === "UPBRINGING"
                          ? "Upbringing"
                          : kind === "MANIFEST"
                            ? "Manifest"
                            : "Item (PERSONAL)"}
                    </button>
                  );
                },
              )}
            </div>
          </div>
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
            Slot to {localKind === "LINEAGE"
              ? "Lineage"
              : localKind === "UPBRINGING"
                ? "Upbringing"
                : localKind === "MANIFEST"
                  ? "Manifest"
                  : "Item"}
          </button>
        </footer>
      </div>
    </div>
  );
}
