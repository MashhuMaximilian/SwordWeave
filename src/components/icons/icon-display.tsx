"use client";

// =============================================================================
// IconDisplay — render any icon for any entity.
//
// Centralized icon renderer so the same entity-row data renders
// consistently across: sandbox forms, library cards, sandbox preview
// modals, character sheets, etc. The component knows how to handle all
// three states (no icon / game-icons / upload) and applies the entity's
// `iconColor` automatically.
//
// Props:
//   iconSource : "GAME_ICONS" | "UPLOAD" | null | undefined  — null means no icon
//   iconKey    : "<author>/<slug>" when source is GAME_ICONS
//   iconUrl    : blob pathname (e.g. "user-uploads/abc/xyz.png") when source is UPLOAD
//   iconColor  : hex color for game-icons (no effect on uploads)
//   size       : pixel size (default 32)
//   className  : extra classes for the wrapper
//
// The component renders an `<img>` for both sources. The src URLs are
// constructed to flow through our two proxy routes:
//   - /api/icons/game/<author>/<slug>?color=<hex>  → /api/icons/blob/[...path]
// Both proxies do whatever processing is needed (recolor / Clerk-auth)
// and return the bytes directly.
//
// Why <img> not <object> or inline SVG:
//   - SVGs served as `image/svg+xml` via `<img>` cannot execute scripts,
//     so a malicious upload is neutralized by the browser regardless of
//     file content.
//   - The browser caches <img> URLs natively (matches our Cache-Control
//     strategy: 1yr immutable for game-icons, private no-store for blobs).
//   - Lazy loading works without extra plumbing (`loading="lazy"`).
//   - Inline SVG would mean fetching + parsing the SVG ourselves, which
//     loses the per-route cache and adds CPU cost on every render.
// =============================================================================

import { cn } from "@/lib/utils";

export type IconSource = "GAME_ICONS" | "UPLOAD" | null | undefined;

export interface IconDisplayProps {
  iconSource?: IconSource;
  iconKey?: string | null | undefined;
  iconUrl?: string | null | undefined;
  iconColor?: string | null | undefined;
  size?: number | undefined;
  /** Optional alt text — defaults to the slug or url. */
  alt?: string | undefined;
  className?: string | undefined;
  /** When true, render with eager loading + high fetchpriority for
   *  above-the-fold placement. Default lazy. */
  priority?: boolean | undefined;
}

export function IconDisplay({
  iconSource,
  iconKey,
  iconUrl,
  iconColor = "#ffffff",
  size = 32,
  alt,
  className,
  priority = false,
}: IconDisplayProps) {
  if (!iconSource) {
    // No icon set on this entity. Render a subtle fallback square so
    // the layout doesn't collapse when an icon slot is empty.
    return (
      <div
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground/50",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <svg
          width={Math.max(12, size * 0.5)}
          height={Math.max(12, size * 0.5)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }

  if (iconSource === "GAME_ICONS") {
    if (!iconKey) return null;
    const color = encodeURIComponent(iconColor ?? "#ffffff");
    const src = `/api/icons/game/${iconKey}?color=${color}`;
    return (
      <img
        src={src}
        alt={alt ?? iconKey.replace(/[/_-]/g, " ")}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        // Game-icons are CC BY 3.0 — preserve attribution in the markup
        // for accessibility tools / right-click "view source" users.
        // Hover tooltip is added by the parent (<IconChip>) when more
        // UI chrome is appropriate; the img alone stays simple.
        className={cn("inline-block shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (iconSource === "UPLOAD") {
    if (!iconUrl) return null;
    // The blob path comes back from /api/icons/upload as a relative
    // pathname ("user-uploads/<id>/<uuid>.png"). We route through our
    // Clerk-auth proxy so the private blob is never exposed directly.
    const src = iconUrl.startsWith("/")
      ? iconUrl
      : `/api/icons/blob/${iconUrl}`;
    return (
      <img
        src={src}
        alt={alt ?? "Custom icon"}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        className={cn("inline-block shrink-0 rounded", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return null;
}