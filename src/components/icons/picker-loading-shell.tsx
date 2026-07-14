// =============================================================================
// PickerLoadingShell — fallback rendered while next/dynamic is fetching
// the lazy IconPicker module. Keeps the modal chrome visible so the
// user doesn't see a flash of empty space, while the actual icons and
// search/swatch controls load.
//
// Phase 18B (2026-07-14, perf): the picker is split into a lazy
// boundary because react-aria-components + the 575 KB icon catalog
// JSON together add ~280 KB to the initial JS payload. The cost of
// the split is one extra round-trip for the picker chunk when the
// user clicks "Change" — typically <100 ms on a warm connection. We
// mask that by showing this skeleton inside the modal while the
// chunk arrives.
//
// Why this is a separate file:
//   - next/dynamic's `loading` prop is evaluated synchronously during
//     the IconSlot render. If this JSX lived in icon-slot.tsx, the
//     picker-loading markup itself would pull in icons/skeleton CSS
//     that we'd rather not ship unless we have to.
//   - Splitting keeps the components/icons/* surface clean: each
//     file has a single responsibility (trigger, picker, display,
//     loading shell).
//
// The shell itself intentionally uses NO ICONS or images — just
// skeleton blocks. Any image data would have to come from the
// react-aria/chunk we just deferred.
// =============================================================================

export function PickerLoadingShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading icon picker"
      className="flex h-full w-full flex-col gap-4 p-3"
    >
      {/* Top toolbar skeleton — matches the actual picker's
          row layout (search + filter + color swatch + upload). */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted/40" />
        <div className="ml-auto h-9 w-9 animate-pulse rounded-md bg-muted/40" />
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
      </div>
      {/* Grid skeleton — 6 rows × 8 cols of icon placeholders.
          Matches the actual picker grid so users don't see a layout
          shift when the real grid mounts. */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-[repeat(8,minmax(0,1fr))] gap-1.5">
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded bg-muted/40"
              style={{ animationDelay: `${(i % 8) * 80}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
