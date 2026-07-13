// =============================================================================
// resolve-icon-artist — turn an iconKey ("<author>/<slug>") into the
// artist's display name for the attribution tooltip.
//
// Phase 8: the picker stores keys in the canonical game-icons.net
// format. We just split on "/" and return the author segment. The
// author segment is the artist's handle (e.g. "lorc"), which is what
// we show in the hover tooltip — short, scannable, matches what the
// /attributions page lists.
//
// We don't load the full authorCredits map here because the resolution
// is hot-path (every IconChip render); a string split is the minimum
// work and doesn't require the 562KB index.
// =============================================================================

/**
 * Return the author handle from an icon key. For non-game-icons
 * (uploads) this returns null — the chip renders no artist line.
 */
export function resolveIconArtist(
  iconSource: string | null | undefined,
  iconKey: string | null | undefined,
): string | null {
  if (iconSource !== "GAME_ICONS" || !iconKey) return null;
  const idx = iconKey.indexOf("/");
  return idx > 0 ? iconKey.slice(0, idx) : iconKey;
}