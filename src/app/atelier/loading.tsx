// =============================================================================
// /atelier loading — shown while the server component fetches the 5 entity
// tables (primitives, effects, capabilities, heritage, items) before the
// AtelierSandboxClient renders.
//
// Per Mashu 2026-07-22: "when I click edit from my creations we need a
// loading something until the build is loaded in the atelier page or
// something. It takes like a couple of seconds where I have to wait but
// I see no loading anything."
//
// We show a centered skeleton so the user gets visual feedback while
// the server queries complete. We deliberately do NOT block the client
// routing — Next.js shows this in parallel with the server data fetch.
// =============================================================================

export default function AtelierLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"
        aria-hidden="true"
      />
      <div className="space-y-1 text-center">
        <p className="text-base font-semibold text-foreground">
          Loading the atelier…
        </p>
        <p className="text-sm text-muted-foreground">
          Fetching primitives, effects, capabilities, heritages, and items so
          your build form has everything it needs.
        </p>
      </div>
      {/* Skeleton rows to suggest the library list is loading */}
      <div className="mt-4 grid w-full max-w-md gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-md border border-border bg-muted/60"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}