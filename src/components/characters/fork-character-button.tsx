"use client";

// =============================================================================
// ForkCharacterButton — PLAN Eilxina Part B (Mashu 2026-09-09).
//
// Tiny client button that POSTs to /api/characters/[id]/clone and
// redirects to the new character sheet on success.
//
// Why a separate component (vs. inlining the fetch in the page):
// - Page is a server component; needs a client island for the click
//   handler + loading state.
// - Reused by the Public-library tab in /characters and by any
//   future "fork this build" affordance (Part C may add it to the
//   preview pane).
//
// Behaviour mirrors the existing /characters page's in-card "Clone"
// link (which deep-copies a character you already own) — the fork
// path is the same for a public-library character: you become the
// owner of the clone, the original is untouched.
//
// Edge cases handled:
// - POST failure (network / 4xx / 5xx): show toast + keep modal open.
// - Auth-gated: Clerk middleware redirects unauth'd requests; we don't
//   re-check auth here.
// - Double-click: disable button while in-flight.
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitFork, Loader2 } from "lucide-react";

interface ForkCharacterButtonProps {
  /** The public character id to fork. */
  characterId: string;
  /** Optional compact variant for use in tight rows. */
  compact?: boolean;
}

export function ForkCharacterButton({
  characterId,
  compact = false,
}: ForkCharacterButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleFork = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/characters/${characterId}/clone`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Fork failed (HTTP ${res.status})`);
        }
        // Server returns { character: { id, ... } }. We only need the
        // new id — the character is now owned by the current user.
        const data = (await res.json()) as { character?: { id?: string } };
        const newId = data.character?.id;
        if (!newId) {
          throw new Error("Fork succeeded but server returned no character id.");
        }
        router.push(`/characters/${newId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fork failed.");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleFork}
        disabled={isPending}
        className={`flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? "px-2 py-1" : ""
        }`}
        title="Fork this character into your roster — you'll own the copy"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <GitFork className="size-3.5" />
        )}
        {isPending ? "Forking…" : "Fork as my own"}
      </button>
      {error && (
        <span className="text-[10px] font-medium text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
