"use client";

// =============================================================================
// Sandbox error boundary — wraps /sandbox/* and shows a real error message
// instead of the default Next.js "could not load" page.
//
// The Vercel 404 we hit for /sandbox/blueprint on commit 27cd319 was a
// cached 404 from a previous broken build that lasted 8+ minutes. The
// caching layer ate the real error. This boundary at least gives the user
// a "Clear session & reload" path that resets Clerk cookies + localStorage
// and forces a fresh navigation.
// =============================================================================

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Home, RefreshCw, Trash2 } from "lucide-react";

export default function SandboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[SandboxError]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <AlertTriangle className="size-12 text-amber-500" />
      <h1 className="font-display mt-6 text-3xl font-semibold uppercase">
        Sandbox failed to load
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The sandbox page (grammar / blueprint / characters / builds) hit a
        server error. This is usually one of:
      </p>
      <ul className="mt-3 max-w-md space-y-1 text-left text-xs text-muted-foreground">
        <li>
          <span className="font-semibold text-foreground">Stale Vercel cache</span>{" "}
          — a previous broken build left a 404 that&apos;s still being
          served. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R) to bust it.
        </li>
        <li>
          <span className="font-semibold text-foreground">Clerk session</span>{" "}
          — your auth token expired or got into a bad state. The &quot;Clear
          session&quot; button below resets it.
        </li>
        <li>
          <span className="font-semibold text-foreground">DB outage</span>{" "}
          — the route needs to load primitives / effects / capabilities
          from Postgres, and the pooler might be down. Check Vercel logs.
        </li>
      </ul>

      <div className="mt-4 max-w-md rounded-md border border-border bg-card/50 p-3 text-left font-mono text-xs text-muted-foreground">
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
            // Hard refresh — bypass the Next.js client router cache.
            // router.refresh() alone can re-serve the same cached error.
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
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
    </div>
  );
}
