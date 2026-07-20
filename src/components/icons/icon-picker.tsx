"use client";

// =============================================================================
// IconPicker — modal for selecting + configuring an icon on an entity.
//
// UX flow:
//   1. User clicks the entity's icon slot (or "Choose icon" button)
//   2. IconPicker opens as a modal in the existing modal stack
//   3. User picks a color (defaults to current iconColor or #ffffff)
//   4. User browses by category tab (Weapon / Body / Creature / ...)
//   5. User optionally types in the search box to narrow further
//   6. User clicks an icon → modal closes, entity row updates with the
//      chosen iconSource=game-icons + iconKey + iconColor
//   OR
//   6b. User clicks "Upload custom" → file picker → uploads to blob
//      → modal closes, entity row updates with iconSource=upload + iconUrl
//
// Data: src/lib/icons/game-icons-index.json (562 KB) is loaded lazily on
// first picker open via dynamic import so the 562KB doesn't ship in the
// initial bundle. The picker caches the loaded index in module scope.
//
// State:
//   - color: local picker state. Initialized from prop `currentColor`.
//     Confirms to the parent on icon selection.
//   - bucket: active category tab. "all" = no filter.
//   - search: text filter on slug + label.
//
// Filtering: an icon shows when (bucket === "all" || icon.category ===
// bucket) AND (search === "" || slug matches search). Match is case-
// insensitive substring.
//
// Rendering: the visible window is computed from the scroll position of
// the grid container. We render ROW_BUFFER rows above + below the
// viewport. This keeps DOM size manageable (a few hundred <img> nodes)
// even with 4180 icons total.
// =============================================================================

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Filter, Search, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconDisplay, type IconSource } from "./icon-display";
import { PickerErrorBoundary } from "./picker-error-boundary";
import {
  Button as RAButton,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ColorThumb,
  Dialog,
  DialogTrigger,
  Input,
  Modal,
  SearchField,
  SliderTrack,
  parseColor,
} from "react-aria-components";

// =============================================================================
// Color presets — curated palette tuned for icon glyphs on a dark canvas.
// 24 entries (6×4 grid) covers 90% of icon use. Each entry is a hex string.
// =============================================================================
const COLOR_PRESETS = [
  // row 1 — bright primaries
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  // row 2 — fresh + cool mids
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  // row 3 — deep + warm darks
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  // row 4 — neutrals + ink/paper
  "#64748b", // slate
  "#6b7280", // gray
  "#0a0a0a", // black
  "#27272a", // charcoal
  "#fef3c7", // cream
  "#fafafa", // white
];

// Shape of the static index. Loaded lazily.
interface IconIndexEntry {
  key: string;
  author: string;
  slug: string;
  label: string;
  tags: string[];
  category: string;
}
interface IconIndex {
  totalIcons: number;
  authors: string[];
  pickerBuckets: { key: string; label: string }[];
  icons: IconIndexEntry[];
  authorCredits: Record<string, string | null>;
}

// Module-scope cache so the second open of the picker doesn't re-fetch.
let _indexCache: IconIndex | null = null;
async function loadIconIndex(): Promise<IconIndex> {
  if (_indexCache) return _indexCache;
  const mod = await import("@/lib/icons/game-icons-index.json");
  _indexCache = mod.default as unknown as IconIndex;
  return _indexCache;
}

export interface IconPickerProps {
  /** Current icon source on the entity (or null if none). */
  currentSource?: IconSource;
  /** Current icon key (for GAME_ICONS). */
  currentKey?: string | null;
  /** Current icon URL/path (for UPLOAD). */
  currentUrl?: string | null;
  /** Current icon color (hex). */
  currentColor?: string | null;
  /**
   * Called when the user confirms a selection. The modal stays open
   * during browsing/searching and closes only on confirm.
   */
  onSelect: (choice: {
    source: "GAME_ICONS" | "UPLOAD";
    key?: string;
    url?: string;
    color: string;
  }) => void;
  /** Called when the user dismisses without selecting (close button). */
  onCancel?: () => void;
}

const ROW_BUFFER = 4;
const ICON_SIZE = 56; // px — fits in the grid
const COL_GAP = 8; // px

export function IconPicker({
  currentSource,
  currentKey,
  currentUrl,
  currentColor,
  onSelect,
  onCancel,
}: IconPickerProps) {
  // Phase 11: IconPicker no longer touches the modal stack. Previously
  // FiltersTrigger pushed a 'Filters' modal into useModalStack and the
  // close handlers called stack.pop(). With the picker now mounted
  // inline inside the IconSlot overlay (Phase 10), pushing to the
  // modal stack re-introduced z-order races and the modal rendered
  // behind the picker. Everything below uses local React state instead.
  const [index, setIndex] = useState<IconIndex | null>(_indexCache);
  // Phase 8: Color state is a hex string. The ColorPicker control
  // operates on a Color object internally; we sync via parseColor.
  const [color, setColor] = useState<string>(normalizeColor(currentColor ?? ""));
  // Phase 8: bucket is now a Set so the filters modal can multi-select.
  // Empty set = "All". The horizontal tab strip is hidden — the
  // filters button shows the count of active buckets.
  const [buckets, setBuckets] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Phase 18: drop useDeferredValue here. The deferred-value wrapper
  // updates the search filter on a separate render cycle from the
  // input's controlled value, which made the grid look stale while
  // the user was still typing — the search box would show "Storm"
  // but the grid kept showing the first icons from the unfiltered
  // catalog. With 4180 icons the substring match is cheap enough
  // (sub-millisecond on a desktop browser) that the deferral is
  // not buying us anything visible.
  const deferredSearch = search;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });

  // Lazy-load the index on mount if not cached.
  useEffect(() => {
    if (_indexCache) {
      setIndex(_indexCache);
      return;
    }
    let cancelled = false;
    loadIconIndex().then((idx) => {
      if (!cancelled) setIndex(idx);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered icon list — recompute on bucket/search change. We compute
  // over the full 4180-icon array (cheap — substring match is fast).
  //
  // Search matches against slug + label + tags. The icon index
  // includes author-assigned tags like "sky", "lightning", "weather"
  // — searching "storm" without tag support yields only 4 matches
  // (sandstorm, book-storm, brainstorm, lightning-storm), missing
  // icons tagged "thunder", "weather", "rain" etc. that the user
  // would expect when they type "storm". Tags-as-search-input also
  // makes the picker discoverable for non-exact names.
  const filtered = useMemo(() => {
    if (!index) return [];
    const term = deferredSearch.trim().toLowerCase();
    const out: IconIndexEntry[] = [];
    for (const icon of index.icons) {
      // Phase 8: multi-select bucket filter. Empty set = no category
      // filter (equivalent to "All"). Otherwise require the icon's
      // category to be in the active set.
      if (buckets.size > 0 && !buckets.has(icon.category)) continue;
      if (term) {
        // Match against slug + label + tags. Tags are already
        // lower-cased when indexed; we still call .toLowerCase() on
        // them defensively in case the index schema changes.
        const tags = icon.tags ?? [];
        const tagMatch = tags.some((t) => t.toLowerCase().includes(term));
        if (
          !icon.slug.toLowerCase().includes(term) &&
          !icon.label.toLowerCase().includes(term) &&
          !tagMatch
        ) {
          continue;
        }
      }
      out.push(icon);
    }
    return out;
  }, [index, buckets, deferredSearch]);

  // Compute visible window from scroll position. We render ROW_BUFFER
  // rows above + below the visible area so scrolling feels instant.
  useLayoutEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const cols = Math.max(
        1,
        Math.floor((width + COL_GAP) / (ICON_SIZE + COL_GAP)),
      );
      const rowH = ICON_SIZE + COL_GAP;
      const scrollTop = el.scrollTop;
      const viewportH = el.clientHeight;
      const startRow = Math.max(0, Math.floor(scrollTop / rowH) - ROW_BUFFER);
      const endRow =
        Math.ceil((scrollTop + viewportH) / rowH) + ROW_BUFFER;
      const start = startRow * cols;
      const end = Math.min(filtered.length, endRow * cols);
      setVisibleRange({ start, end });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [filtered.length]);

  // When filter changes, reset scroll to top so the user sees results.
  useEffect(() => {
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0;
  }, [buckets, deferredSearch]);

  const handleIconClick = useCallback(
    (icon: IconIndexEntry) => {
      onSelect({
        source: "GAME_ICONS",
        key: icon.key,
        color,
      });
      // Phase 11: don't pop the modal stack — we're inline. The
      // IconSlot's overlay handles its own open state.
    },
    [onSelect, color],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/icons/upload", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Upload failed (${res.status})`);
        }
        const body = (await res.json()) as { pathname: string };
        onSelect({
          source: "UPLOAD",
          url: body.pathname,
          color,
        });
        // Phase 11: IconSlot owns close state, no modal stack.
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
        // Clear the input so the same file can be re-selected after an
        // error fix.
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [color, onSelect],
  );

  const handleClose = useCallback(() => {
    onCancel?.();
    // Phase 11: IconSlot owns close state.
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-label="Choose icon"
      // h-full resolves against IconSlot's h-[80vh] container, so
      // the picker's flex column gets a real height and the inner
      // grid scrolls correctly. min-h-0 lets the inner grid shrink
      // below its content's intrinsic height (otherwise the flex
      // container grows past the 80vh cap and the search input +
      // grid both end up cropped or the search stops filtering
      // because the grid is rendered at 0 height). The previous
      // shape used `h-full max-h-[80vh]` which collapsed to ~0
      // when the IconSlot wrapper passed through a wrapper with no
      // explicit height — search would update the filter but the
      // grid would still render the first icons in the catalog.
      className="flex min-h-0 h-full max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">Choose an icon</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* The toolbar (Filters / Search / Color / Upload) is rendered above the grid below. */}

      {uploadError && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {uploadError}
        </div>
      )}

      {/* Toolbar: Filters button | Search | Color swatch | Upload */}
      <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
        {/* Filters trigger — opens the category multi-select modal. */}
        <FiltersTrigger
          buckets={buckets}
          bucketDefs={index?.pickerBuckets ?? []}
          onApply={(next) => {
            setBuckets(next);
            setFiltersOpen(false);
          }}
          onClear={() => setBuckets(new Set())}
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
        />
        {/* Search box */}
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search icons"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
        {/* Color trigger — opens the popover with the Adobe color picker. */}
        <ColorTrigger color={color} onChange={setColor} />
        {/* Upload button (kept on the toolbar) */}
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <Upload className="size-3.5" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Icon grid (lazy windowed) */}
      <div
        ref={gridScrollRef}
        className="flex-1 overflow-y-auto"
      >
        {!index ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading icons…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No icons match this filter.
          </div>
        ) : (
          <IconGrid
            icons={filtered}
            start={visibleRange.start}
            end={visibleRange.end}
            color={color}
            onIconClick={handleIconClick}
          />
        )}
      </div>

      {/* Footer status */}
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span>
          {filtered.length.toLocaleString()} icon
          {filtered.length === 1 ? "" : "s"}
        </span>
        <span>
          Icons by{" "}
          <a
            href="https://game-icons.net"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            game-icons.net
          </a>{" "}
          contributors, CC BY 3.0
        </span>
      </div>
    </div>
  );
}

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function IconGrid({
  icons,
  start,
  end,
  color,
  onIconClick,
}: {
  icons: IconIndexEntry[];
  start: number;
  end: number;
  color: string;
  onIconClick: (icon: IconIndexEntry) => void;
}) {
  // Compute the windowed slice + render with absolute positioning so
  // the scroll height reflects the full filtered list (otherwise the
  // scrollbar would shrink to the visible window's height).
  const slice = icons.slice(start, end);

  // We need to know how many columns the parent uses, which depends on
  // viewport width. The parent doesn't pass that; we let CSS handle
  // the grid via display:grid with auto-fill. So here we render a
  // positioned spacer + a grid of visible items.
  //
  // Approach: render a tall invisible spacer (height = total rows *
  // rowH) plus an absolute-positioned grid of just the visible items,
  // offset by startRow * rowH.
  //
  // We don't actually know cols from here, so we ask the parent via
  // a CSS variable. Simpler: render a flat grid but only with the
  // visible items; the spacer height is filtered.length / cols * rowH.
  // cols is computed by the parent's useLayoutEffect and stored in a
  // CSS variable on the grid container. To avoid threading that, we
  // just use a CSS grid with auto-fill which fills available width —
  // the spacer height is then filtered.length / (grid width / icon
  // size) rows. That's hard to compute without measuring.
  //
  // Simplest pragmatic fix: render a flex-wrap container that lays out
  // items by width — items appear in DOM order, browser wraps. This
  // gives correct visual layout but loses the "scrollbar reflects full
  // list height" property.
  //
  // For 4180 icons in 100+ rows, the grid will fill its container with
  // many items below the visible area. We DO want scrollbar to reflect
  // total height. So we render a height-spacer div sized to total
  // filtered count, with absolutely-positioned items inside.

  // We compute cols from window width at render time. This is OK
  // because the grid container is fixed-width and we re-measure on
  // resize via the ResizeObserver in the parent.
  const [cols, setCols] = useState(6);
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const c = Math.max(1, Math.floor((width + COL_GAP) / (ICON_SIZE + COL_GAP)));
      setCols(c);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowH = ICON_SIZE + COL_GAP;
  const totalRows = Math.ceil(icons.length / cols);
  const startRow = Math.floor(start / cols);
  const totalH = totalRows * rowH;

  return (
    <div
      ref={containerRef}
      className="relative px-3 py-3"
      style={{ height: totalH }}
    >
      {slice.map((icon, i) => {
        const idx = start + i;
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        return (
          <button
            key={icon.key}
            type="button"
            onClick={() => onIconClick(icon)}
            title={`${icon.label} (by ${icon.author})`}
            className="absolute rounded-md p-1 hover:bg-accent focus:bg-accent focus:outline-none"
            style={{
              left: col * (ICON_SIZE + COL_GAP),
              top: (row - startRow) * rowH,
              width: ICON_SIZE + COL_GAP,
              height: rowH,
            }}
          >
            <div
              className="rounded"
              style={{
                width: ICON_SIZE,
                height: ICON_SIZE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={`/api/icons/game/${icon.key}?color=${encodeURIComponent(color)}`}
                alt={icon.label}
                width={ICON_SIZE}
                height={ICON_SIZE}
                loading="lazy"
                style={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  filter: "drop-shadow(0 0 0 transparent)",
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// FiltersTrigger — toolbar button that opens the category multi-select
// modal. Phase 12: portal the FiltersModal to document.body at
// z-[11000] (above IconSlot's z-[9999]) so it always sits above the
// picker no matter how IconSlot is wrapped. Each modal manages its
// own backdrop and close-on-outside-click. We can't reuse
// useModalStack because the picker is inline (Phase 10) and pushing
// from inside a portal-at-body overlay would race with IconSlot's
// own overlay lifecycle.
// =============================================================================
function FiltersTrigger({
  buckets,
  bucketDefs,
  onApply,
  onClear,
  open,
  onOpenChange,
}: {
  buckets: Set<string>;
  bucketDefs: { key: string; label: string }[];
  onApply: (next: Set<string>) => void;
  onClear: () => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(buckets);

  // Sync draft from props when the picker state changes outside
  // (e.g. user clicks "Clear" from somewhere).
  useEffect(() => {
    if (!open) setDraft(new Set(buckets));
  }, [buckets, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Filter icons by category"
        aria-expanded={open}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
          buckets.size > 0
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background hover:bg-accent",
        )}
      >
        <Filter className="size-3.5" />
        Filters
        {buckets.size > 0 ? (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {buckets.size}
          </span>
        ) : null}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <FiltersModal
            draft={draft}
            bucketDefs={bucketDefs}
            onChange={setDraft}
            onApply={() => {
              onApply(draft);
              onOpenChange(false);
            }}
            onClear={() => {
              setDraft(new Set());
              onClear();
            }}
            onClose={() => onOpenChange(false)}
          />,
          document.body,
        )}
    </>
  );
}

// =============================================================================
// FiltersModal — the multi-select category list. Phase 12: this used
// to be the body of a top-level modal-stack entry, but pushing to
// useModalStack from inside the inline picker overlay races with
// IconSlot. Now it renders at body level (via createPortal in
// FiltersTrigger) as a fixed-position modal with its own backdrop
// and ESC handler. Click backdrop → close. ESC → close.
// =============================================================================
function FiltersModal({
  draft,
  bucketDefs,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  draft: Set<string>;
  bucketDefs: { key: string; label: string }[];
  onChange: (next: Set<string>) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const toggle = (key: string) => {
    const next = new Set(draft);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  // ESC closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filter icons by category"
      // Phase 12: full-screen backdrop with z-[11000] (above
      // IconSlot's z-[9999]). Clicking the backdrop closes the
      // modal; clicks on the inner card stopPropagation to prevent
      // that.
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Filter by category</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-1.5">
          {bucketDefs.map((b) => {
            const active = draft.has(b.key);
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => toggle(b.key)}
                aria-pressed={active}
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                <span>{b.label}</span>
                {active ? (
                  <span aria-hidden="true" className="text-primary">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
        <button
          type="button"
          onClick={onClear}
          disabled={draft.size === 0}
          className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Clear
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Apply{draft.size > 0 ? ` (${draft.size})` : ""}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// =============================================================================
// ColorTrigger — toolbar swatch that opens the full Adobe react-aria HSB
// color picker in a popover. The popover is rendered via createPortal so
// it escapes IconSlot's overflow-hidden inner card.
//
// Crash history (resolved):
//   - Round 4 (dae0097): the bare <input> inside <ColorField> crashed
//     because ColorField's ColorFieldStateContext had no input bound.
//   - Round 5 (d0c51ec): swapped to <Input> slot from
//     react-aria-components. Still crashed when nested under the
//     ColorPicker on mobile.
//   - Round 6 (abd487d): replaced the entire Adobe picker with a
//     simplified swatch-only picker. No crash, but lost the HSB
//     visual editor the user wanted.
//   - Round 7 (700f7d7): restored the Adobe HSB picker with <Input>
//     slot, simple inline span callouts (no SVG). Worked.
//   - Round 8 (af9d509): wrapped in <PickerErrorBoundary> as defense
//     in depth.
//   - Round 9 (a9d8e4b): replaced react-aria picker with native HTML
//     controls because the picker kept crashing on production (the
//     dev test passed, prod failed). Lost the HSB visual editor.
//   - Round 10 (5940074): restored react-aria ColorPicker but used
//     useState + useEffect to sync, dropped renderProps callouts,
//     swapped ColorField for a bare <input>, used a subpath import
//     for parseColor. Production still crashed with React #185.
//   - Round 11 (this commit): revert to round 7 EXACTLY —
//     - useMemo for colorValue (no useState/useEffect sync loop)
//     - <ColorField> with <Input> slot (no bare <input> remount key)
//     - renderProps on <ColorThumb> for the callout (worked in r7)
//     - parseColor from the main barrel (worked in r7)
//     Plus keep the round 9 dialog scroll fixes (max-h + overflow-y-
//     auto with sticky header) so mobile doesn't cut off swatches,
//     and the round 8 PickerErrorBoundary as crash recovery.
//
// Root cause of the r10 crash is one of:
//   (a) the useState + useEffect loop created two paths that could
//       trigger setColorValue on each parent re-render, OR
//   (b) the bare <input> with key={colorValue.toString('hex')} was
//       remounting on every parent re-render in prod (where React 19
//       is stricter than dev), OR
//   (c) the subpath import of parseColor returned a Color class from
//       a different module instance than the one ColorPicker uses
//       internally, so identity comparisons in useControlledState
//       failed and fired forceUpdate in a loop.
// By reverting to round 7's exact pattern we eliminate all three.
// =============================================================================
function ColorTrigger({
  color,
  onChange,
}: {
  color: string;
  onChange: (next: string) => void;
}) {
  // parseColor needs a valid 6-digit hex; the value comes from the
  // picker's normalizeColor (always 6-digit) so this is safe.
  // useMemo (not useState + useEffect) — round 10's sync loop was
  // the most likely cause of prod React #185.
  const colorValue = useMemo(() => {
    try {
      return parseColor(color);
    } catch {
      return parseColor("#ffffff");
    }
  }, [color]);

  const [open, setOpen] = useState(false);

  // ESC closes the color picker.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose icon color"
        aria-expanded={open}
        aria-pressed={open}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
          open ? "border-primary text-primary" : "border-border",
        )}
      >
        <span
          aria-hidden="true"
          className="block size-5 rounded border border-border"
          style={{ backgroundColor: color }}
        />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose icon color"
            // Portal to body at z-[11000] so the picker is never
            // clipped by IconSlot's overflow-hidden inner card or
            // any ancestor stacking context. Backdrop click closes;
            // inner card stops propagation.
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="flex max-h-[calc(100vh-2rem)] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 -mx-3 flex items-center justify-between bg-card px-3 pb-2 pt-1">
                <h3 className="text-sm font-semibold">Color</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium hover:bg-accent"
                >
                  Done
                </button>
              </div>
              <PickerErrorBoundary
                fallback={(err, reset) => (
                  <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                    <div className="font-medium text-destructive">
                      Color picker crashed
                    </div>
                    <div className="font-mono text-muted-foreground">
                      Current: {colorValue.toString("hex")}
                    </div>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background/50 p-2 font-mono text-[10px] text-foreground/80">
                      {String(err?.message ?? err)}
                    </pre>
                    <p className="text-muted-foreground">
                      Close and reopen the popover. Tap retry to recover.
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
                    >
                      Retry
                    </button>
                  </div>
                )}
              >
                {/*
                 * Round 11: exact port of round 7's working ColorPicker
                 * tree. The renderProps children inside <ColorThumb>
                 * are NOT the bug — round 7 shipped with them and the
                 * picker worked in production. The bug was in MY round 10
                 * changes (sync loop, subpath import, bare input).
                 *
                 * The renderProps pipe the live color from react-aria's
                 * internal state into a small inline callout (the
                 * teardrop above the thumb). c.toString('css') is safe
                 * because react-aria guarantees color is always defined
                 * when the picker is in a working state.
                 */}
                <ColorPicker
                  value={colorValue}
                  onChange={(c) => onChange(c.toString("hex"))}
                >
                  {/* Row 1 — HSB square + hue slider. The 2D area is
                      sized 160px (size-40) to match the slider height
                      (h-40). Mobile users can drag the thumb or tap
                      the gradient directly to set hue+sat. */}
                  <div className="flex items-center gap-3">
                    <ColorArea
                      colorSpace="hsb"
                      xChannel="saturation"
                      yChannel="brightness"
                      className="relative size-40 rounded-md"
                      style={{
                        backgroundColor: `hsl(${colorValue.toString("hsl").split(" ")[0]}, 100%, 50%)`,
                      }}
                    >
                      {/* Simple inline callout: a small rounded square
                          above the thumb. Round 7 used this exact
                          pattern (no SVG) and it worked. */}
                      <ColorThumb className="color-thumb">
                        {({ color: c }) => (
                          <span
                            aria-hidden
                            className="color-callout"
                            style={{ backgroundColor: c.toString("css") }}
                          />
                        )}
                      </ColorThumb>
                    </ColorArea>
                    <ColorSlider
                      colorSpace="hsb"
                      channel="hue"
                      orientation="vertical"
                      className="relative h-40 w-8 rounded-md"
                      style={{
                        background:
                          "linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                      }}
                    >
                      {/* <SliderTrack> child is REQUIRED: ColorSlider
                          publishes trackProps via context, and only
                          <SliderTrack> consumes them to attach the
                          onPointerDown handler (click-to-set on the
                          empty bar). Without it, only the thumb is
                          clickable. */}
                      <SliderTrack className="h-full w-full">
                        <ColorThumb className="color-thumb">
                          {({ color: c }) => (
                            <span
                              aria-hidden
                              className="color-callout"
                              style={{ backgroundColor: c.toString("css") }}
                            />
                          )}
                        </ColorThumb>
                      </SliderTrack>
                    </ColorSlider>
                  </div>

                  {/* Row 2 — hex text input. Uses <Input> slot from
                      react-aria-components (NOT a bare <input>) — the
                      slot binds to ColorField's inputProps so hex
                      edits update the live color and the field stays
                      in sync with swatch/slider picks. */}
                  <ColorField
                    aria-label="Hex color"
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <Input
                      className="w-24 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                      maxLength={9}
                      spellCheck={false}
                      aria-label="Icon color hex"
                    />
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {color}
                    </span>
                  </ColorField>

                  {/* Row 3 — 24 curated swatches (6 cols × 4 rows).
                      ColorSwatchPicker binds to ColorPicker state so
                      clicks update the live color and mark the
                      selected swatch automatically. */}
                  <ColorSwatchPicker className="grid grid-cols-6 gap-1.5">
                    {COLOR_PRESETS.map((hex) => (
                      <ColorSwatchPickerItem
                        key={hex}
                        color={hex}
                        className="aspect-square cursor-pointer rounded border-2 border-border transition-transform hover:scale-110"
                      >
                        <ColorSwatch className="size-full rounded-sm" />
                      </ColorSwatchPickerItem>
                    ))}
                  </ColorSwatchPicker>
                </ColorPicker>
              </PickerErrorBoundary>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}




// normalizeColor ensures the native <input type="color"> always has a
// 6-digit hex (it rejects 3-digit). If the current color is invalid,
// fall back to white.
function normalizeColor(c: string): string {
  if (!c) return "#ffffff";
  const h = c.startsWith("#") ? c.slice(1) : c;
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h}`;
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h.split("").map((x) => x + x).join("")}`;
  }
  return "#ffffff";
}
