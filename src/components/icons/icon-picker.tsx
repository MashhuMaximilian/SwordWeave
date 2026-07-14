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
  useDeferredValue,
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
import {
  Button as RAButton,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  parseColor,
} from "react-aria-components";

// =============================================================================
// Color presets — a small curated palette. Tints the picker toward
// system-themed colors that read well as icon color on a dark canvas.
// Each entry is a hex string compatible with parseColor.
// =============================================================================
const COLOR_PRESETS = [
  "#ffffff", // white
  "#000000", // black
  "#f97316", // orange-500
  "#ef4444", // red-500
  "#f43f5e", // rose-500
  "#ec4899", // pink-500
  "#a855f7", // purple-500
  "#8b5cf6", // violet-500
  "#6366f1", // indigo-500
  "#3b82f6", // blue-500
  "#0ea5e9", // sky-500
  "#06b6d4", // cyan-500
  "#14b8a6", // teal-500
  "#22c55e", // green-500
  "#84cc16", // lime-500
  "#eab308", // yellow-500
  "#f59e0b", // amber-500
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
  const [color, setColor] = useState<string>(currentColor ?? "#ffffff");
  // Phase 8: bucket is now a Set so the filters modal can multi-select.
  // Empty set = "All". The horizontal tab strip is hidden — the
  // filters button shows the count of active buckets.
  const [buckets, setBuckets] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
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
        // Match against slug + label (both lowercased).
        if (
          !icon.slug.toLowerCase().includes(term) &&
          !icon.label.toLowerCase().includes(term)
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
      // grid scrolls correctly.
      className="flex h-full max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
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
// ColorTrigger — toolbar swatch that opens the Adobe react-aria color
// picker in a popover. The popover is a react-aria-components primitive
// (no modal-stack because it's a lightweight dropdown, not a modal).
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
            // Phase 12: portal to body at z-[11000] so the picker is
            // never clipped by IconSlot's overflow-hidden inner card
            // or any ancestor stacking context. Backdrop click
            // closes; inner card stops propagation.
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Color</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium hover:bg-accent"
                >
                  Done
                </button>
              </div>
              <ColorPicker
                value={colorValue}
                onChange={(c) => onChange(c.toString("hex"))}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <ColorArea
                      colorSpace="hsb"
                      xChannel="saturation"
                      yChannel="brightness"
                      className="size-40 rounded-md"
                      style={{
                        backgroundColor: `hsl(${colorValue.toString("hsl").split(" ")[0]}, 100%, 50%)`,
                      }}
                    />
                    <ColorSlider
                      colorSpace="hsb"
                      channel="hue"
                      className="h-40 w-6 rounded-md"
                      style={{
                        background:
                          "linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                      }}
                    />
                  </div>
                  <ColorField
                    aria-label="Hex color"
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <input
                      className="w-24 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                      maxLength={9}
                      value={color}
                      onChange={(e) => onChange(e.target.value)}
                      spellCheck={false}
                      aria-label="Icon color hex"
                    />
                  </ColorField>
                  <ColorSwatchPicker className="grid grid-cols-9 gap-1">
                    {COLOR_PRESETS.map((hex) => (
                      <ColorSwatchPickerItem
                        key={hex}
                        color={hex}
                        className="size-6 cursor-pointer rounded border border-border transition-transform hover:scale-110"
                      >
                        <ColorSwatch />
                      </ColorSwatchPickerItem>
                    ))}
                  </ColorSwatchPicker>
                </div>
              </ColorPicker>
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