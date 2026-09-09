"use client";

// =============================================================================
// CharacterVisibilityControl — PLAN Eilxina Part A (Mashu 2026-09-09).
//
// Tiny client wrapper around the shared <VisibilitySelect/> that hits
// /api/creations/visibility with targetType='CHARACTER'. Used in both
// the in-page header (desktop) and inside SheetIdentityHeader's expanded
// panel (mobile).
//
// The actual publications table write lives in /api/creations/visibility
// (which already supports CHARACTER in its BodySchema). This component
// is just the click-to-network glue.
//
// Phase Eilxina Part C will gate this to OWNER-only via canResolveCharacter;
// for Part A the server-side author check on the visibility endpoint is
// the safety net (existing.authorId check, plus our new syncIsPublic
// CHARACTER case keeps characters.isPublic in sync).
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  VisibilitySelect,
  type Visibility,
} from "@/components/library/visibility-select";

export interface CharacterVisibilityControlProps {
  readonly characterId: string;
  readonly initialVisibility: Visibility;
  /** Compact = 1-line chip strip; full = labelled box with hint copy. */
  readonly variant?: "compact" | "full";
}

export function CharacterVisibilityControl({
  characterId,
  initialVisibility,
  variant = "compact",
}: CharacterVisibilityControlProps) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: Visibility) {
    if (next === visibility) return;
    setError(null);
    // Optimistic update so the chip flips immediately; the server
    // call below either confirms or rolls back on error.
    const prev = visibility;
    setVisibility(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/creations/visibility", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            targetType: "CHARACTER",
            targetId: characterId,
            visibility: next,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        // Refresh the server component so any other surfaces that
        // read the visibility tier (e.g. the in-page badge, future
        // Public-library card) pick up the change.
        router.refresh();
      } catch (e) {
        // Roll back optimistic update.
        setVisibility(prev);
        setError(
          e instanceof Error ? e.message : "Failed to update visibility",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <VisibilitySelect
        compact={variant === "compact"}
        value={visibility}
        onChange={handleChange}
        disabled={pending}
      />
      {error ? (
        <p
          className="text-[10px] text-rose-500 dark:text-rose-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
