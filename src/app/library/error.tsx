"use client";

// =============================================================================
// Library error boundary — wraps /library/* and /sandbox/blueprint/* in a
// user-visible error UI. The previous behaviour was a Next.js default
// error page that just said "could not load" with an opaque hash — users
// (and me) couldn't tell whether the issue was a Clerk auth failure, a DB
// outage, or a Vercel cache problem. This gives us:
//
//   - The actual error message + digest
//   - A retry button (calls router.refresh())
//   - A link back to the home page
//   - A "clear cookies & reload" button for Clerk session issues
//
// The Vercel cache HIT on /sandbox/blueprint (HTTP 404) was a stale 404
// from a previous broken build, served for 8+ minutes. The error boundary
// at least tells the user "this is the page error, not your fault."
// =============================================================================

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Home, RefreshCw, Trash2 } from "lucide-react";

export default function LibraryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log to console so we can grep Vercel logs.
    // eslint-disable-next-line no-console
    console.error("[LibraryError]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <AlertTriangle className="size-12 text-amber-500" />
      <h1 className="font-display mt-6 text-3xl font-semibold uppercase">
        Couldn&apos;t load this page
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Something broke on the server when rendering this library or
        template page. The most common cause is a stale Vercel cache from
        a previous broken build — try a hard refresh first.
      </p>

      <div className="mt-2 max-w-md rounded-md border border-border bg-card/50 p-3 text-left font-mono text-xs text-muted-foreground">
        <div>
          <span className="text-foreground">Error:</span> {error.message}
        </div>
        {error.digest ? (
          <div className="mt-1">
            <span className="text-foreground">Digest:</span> {error.digest}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            // Hard refresh: bypass the Next.js client router cache by
            // forcing a full document reload. router.refresh() alone only
            // re-fetches the RSC payload, but if the cached error response
            // is still in the router cache, it can re-serve the same error.
            // A full reload clears the in-memory cache + IndexedDB-backed
            // prefetch cache.
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              // Cache-bust by adding a query param that the page ignores
              url.searchParams.set("_", String(Date.now()));
              window.location.replace(url.toString());
            } else {
              router.refresh();
              reset();
            }
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="size-4" /> Retry
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Home className="size-4" /> Home
        </Link>
        <button
          type="button"
          onClick={() => {
            // Clerk session cookies can get into a bad state — clearing
            // them and reloading forces a fresh sign-in. Better than
            // trapping the user in a "could not load" loop.
            const cookies = document.cookie.split(";");
            for (const c of cookies) {
              const name = c.split("=")[0]?.trim();
              if (!name) continue;
              if (
                name.startsWith("__session") ||
                name.startsWith("__client") ||
                name.startsWith("__host-")
              ) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
              }
            }
            // Also clear localStorage session keys Clerk might leave.
            try {
              const keys = Object.keys(window.localStorage);
              for (const k of keys) {
                if (k.startsWith("clerk") || k.startsWith("__clerk")) {
                  window.localStorage.removeItem(k);
                }
              }
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
          className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
        >
          <Trash2 className="size-4" /> Clear session &amp; reload
        </button>
      </div>

      <p className="mt-8 max-w-md text-xs text-muted-foreground">
        If retrying doesn&apos;t help, this is a real server error — share
        the digest with me and I can grep the Vercel logs.
      </p>
    </div>
  );
}
