"use client";

// =============================================================================
// useBumpAllSlots — PLAN Eilxina Part D follow-up (Mashu 2026-09-09).
//
// Client hook for the header "Update all" button. Calls
// POST /api/characters/[id]/slots/bump-all with { kind: "ALL" }
// and refreshes the route on success so the badges re-render
// with the new versionIds (stale pills disappear).
//
// On failure surfaces the error message via setError() — the
// caller can render it inline. Toast plumbing is Part F polish.
// =============================================================================

import { useRouter } from "next/navigation";
import { useState } from "react";

export function useBumpAllSlots(characterId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bumpAll(): Promise<{
    bumped: { primitive: number; capability: number; item: number };
    total: number;
  } | null> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/slots/bump-all`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "ALL" }),
        },
      );
      const json = (await res.json()) as
        | {
            bumped: { primitive: number; capability: number; item: number };
            total: number;
          }
        | { error: string };
      if (!res.ok || "error" in json) {
        const msg =
          "error" in json
            ? json.error
            : `Bump-all failed (${res.status}).`;
        setError(msg);
        return null;
      }
      // Force a server re-fetch so all SlotSourceBadges re-render
      // with the new versionIds (stale pills disappear).
      router.refresh();
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      return null;
    } finally {
      setPending(false);
    }
  }

  return { bumpAll, pending, error };
}
