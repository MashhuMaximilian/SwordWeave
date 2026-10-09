/** Keep quick details beside the pointer, flipping only when a viewport edge requires it. */
export function quickDetailsPosition(
  point: { x: number; y: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const edge = 12,
    gap = 14;
  const clamp = (value: number, size: number, limit: number) =>
    Math.max(edge, Math.min(value, limit - size - edge));
  return {
    left: clamp(
      point.x + gap + panel.width <= viewport.width - edge
        ? point.x + gap
        : point.x - panel.width - gap,
      panel.width,
      viewport.width,
    ),
    top: clamp(
      point.y + gap + panel.height <= viewport.height - edge
        ? point.y + gap
        : point.y - panel.height - gap,
      panel.height,
      viewport.height,
    ),
  };
}
