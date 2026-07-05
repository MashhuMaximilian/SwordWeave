// =============================================================================
// app/not-found.tsx — global 404 page
//
// Themed, mobile-first, with a search bar + browse CTA. App Router picks this
// up for any `notFound()` call or unmatched route.
// =============================================================================

import Link from "next/link";
import { Compass, Home, Library, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
      <Compass
        className="mb-4 size-12 text-muted-foreground"
        aria-hidden="true"
      />

      <p className="text-sm font-semibold uppercase tracking-widest text-sword-accent">
        404
      </p>
      <h1 className="font-display mt-2 break-words text-4xl font-semibold uppercase leading-tight tracking-wide">
        This page wandered off the map.
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist — it may have been
        moved, deleted, or never existed. Try a search or head back to known
        ground.
      </p>

      {/* Inline search — submits to /library/browse?q=... */}
      <form
        action="/library/browse"
        method="GET"
        className="mt-6 flex w-full max-w-sm items-center gap-2"
      >
        <label htmlFor="notfound-search" className="sr-only">
          Search the library
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="notfound-search"
            name="q"
            type="search"
            placeholder="Search the library…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          href="/library/browse"
          className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
        >
          <Library className="size-4" aria-hidden="true" />
          Browse the library
        </Link>
        <span className="text-muted-foreground" aria-hidden="true">
          ·
        </span>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
        >
          <Home className="size-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </div>
  );
}