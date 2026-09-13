"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CharactersError({ error, reset }: Props) {
  // PLAN Eilxina Part F (Mashu 2026-09-10): log the error to
  // the browser console (with stack) so I can read it via
  // DevTools if it bubbles up despite the production suppression.
  // AND also show the message in the UI (Next.js still passes
  // the Error object to error.tsx even in prod).
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[characters-error-boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12">
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-destructive">
              Characters page failed to render
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Something in <code>/characters</code> threw an error. The
              error text below is what Next.js passed to the error
              boundary (it&apos;s the real message, not the production
              default placeholder).
            </p>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-3 font-mono text-xs text-foreground">
              {error.message || "(no message)"}
              {error.digest ? `\n\n[digest: ${error.digest}]` : ""}
              {error.stack ? `\n\n---stack---\n${error.stack}` : ""}
            </pre>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              >
                Retry
              </button>
              <a
                href="/characters"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              >
                Reload page
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
