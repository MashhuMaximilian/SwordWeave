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
import { Search, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconDisplay, type IconSource } from "./icon-display";
import { useModalStack } from "@/components/ui/modal-stack";

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
  const stack = useModalStack();
  const [index, setIndex] = useState<IconIndex | null>(_indexCache);
  const [color, setColor] = useState<string>(currentColor ?? "#ffffff");
  const [bucket, setBucket] = useState<string>("all");
  const [search, setSearch] = useState("");
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
      if (bucket !== "all" && icon.category !== bucket) continue;
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
  }, [index, bucket, deferredSearch]);

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
  }, [bucket, deferredSearch]);

  const handleIconClick = useCallback(
    (icon: IconIndexEntry) => {
      onSelect({
        source: "GAME_ICONS",
        key: icon.key,
        color,
      });
      stack.pop();
    },
    [onSelect, color, stack],
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
        stack.pop();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
        // Clear the input so the same file can be re-selected after an
        // error fix.
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [color, onSelect, stack],
  );

  const handleClose = useCallback(() => {
    onCancel?.();
    stack.pop();
  }, [onCancel, stack]);

  return (
    <div
      role="dialog"
      aria-label="Choose icon"
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

      {/* Color picker strip + upload */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Color</span>
          <input
            type="color"
            value={normalizeColor(color)}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Icon color"
            className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            spellCheck={false}
            aria-label="Icon color hex"
            className="w-20 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
            maxLength={9}
          />
        </label>
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <Upload className="size-3.5" />
          {uploading ? "Uploading…" : "Upload custom"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {uploadError && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {uploadError}
        </div>
      )}

      {/* Category tabs (horizontally scrollable on narrow screens) */}
      <div className="flex overflow-x-auto border-b border-border bg-background">
        <CategoryTab
          label="All"
          active={bucket === "all"}
          onClick={() => setBucket("all")}
        />
        {(index?.pickerBuckets ?? []).map((b) => (
          <CategoryTab
            key={b.key}
            label={b.label}
            active={bucket === b.key}
            onClick={() => setBucket(b.key)}
          />
        ))}
      </div>

      {/* Search box */}
      <div className="border-b border-border px-4 py-2">
        <div className="relative">
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