"use client";

// =============================================================================
// IconChip — IconDisplay + author attribution tooltip.
//
// Phase 8: the CC BY 3.0 license for game-icons.net requires a mention
// of the artist per-icon. This component wraps IconDisplay with a hover
// tooltip showing the artist (e.g. "By Lorc"). Uploaded icons don't
// need attribution and are rendered with just the IconDisplay.
//
// Usage:
//   <IconChip
//     source={row.iconSource}
//     key={row.iconKey}
//     color={row.iconColor}
//     size={32}
//   />
//
// The tooltip is a CSS-only hover popover (no JS state). On touch
// devices where hover doesn't fire, the title attribute on the
// underlying img still surfaces "by Author" via long-press.
//
// We don't expose a custom tooltip wrapper per the project's CSS
// conventions; the existing tooltip implementation (used elsewhere in
// the app) is heavier than what's needed here. CSS-only keeps the
// component dependency-free.
// =============================================================================

import type { ReactNode } from "react";
import { IconDisplay, type IconSource, type IconDisplayProps } from "./icon-display";

export interface IconChipProps extends IconDisplayProps {
  /** When source is GAME_ICONS, the artist name to show on hover. */
  artistName?: string | null;
  /** A wrapper element override. Default <span>. */
  as?: "span" | "div";
  /** Additional className for the wrapper. */
  wrapperClassName?: string;
}

export function IconChip({
  artistName,
  as: Tag = "span",
  wrapperClassName,
  iconSource,
  iconKey,
  iconUrl,
  iconColor,
  size,
  alt,
  className,
  priority,
}: IconChipProps): ReactNode {
  const attributionText =
    iconSource === "GAME_ICONS" && artistName
      ? `By ${artistName} • CC BY 3.0`
      : iconSource === "GAME_ICONS"
        ? "game-icons.net • CC BY 3.0"
        : iconSource === "UPLOAD"
          ? "Custom icon"
          : "No icon";

  return (
    <Tag
      className={
        wrapperClassName ??
        "group/chip relative inline-flex shrink-0"
      }
    >
      <IconDisplay
        iconSource={iconSource as IconSource}
        iconKey={iconKey ?? null}
        iconUrl={iconUrl ?? null}
        iconColor={iconColor ?? null}
        size={size ?? 32}
        alt={alt ?? artistName ?? undefined}
        className={className ?? undefined}
        priority={priority ?? undefined}
      />
      {/* Attribution tooltip — CSS-only, appears on hover/focus. */}
      {(iconSource === "GAME_ICONS" || iconSource === "UPLOAD") && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md ring-1 ring-border transition-opacity duration-150 group-hover/chip:opacity-100 focus-within:opacity-100"
        >
          {attributionText}
        </span>
      )}
    </Tag>
  );
}