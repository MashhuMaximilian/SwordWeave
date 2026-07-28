"use client";

import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error;
  reset: () => void;
}

export default function CharactersError({ error, reset }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12">
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-destructive">
              Character sheet failed to render
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Something in the character sheet threw an error. The error
              message is below — let me know in your next message and
              I&apos;ll fix it.
            </p>
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-background/50 p-3 text-xs text-muted-foreground">
              {error.message}
            </pre>
            <button
              type="button"
              onClick={reset}
              className="mt-3 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
