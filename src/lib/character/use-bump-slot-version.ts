"use client";

// =============================================================================
// useBumpSlotVersion — PLAN Eilxina Part D (Mashu 2026-09-09).
//
// Tiny client hook that calls the right bump-version endpoint for a given
// slot kind + entity/instance id. Returns a callback the SlotSourceBadge
// can wire to its click handler.
//
// After success, calls `router.refresh()` so the server component re-fetches
// the character row with the updated versionId — the badge then drops
// "update available" because versionId === latestVersionId.
//
// Failures surface as a toast (caller wires that). For Part D we just log
// + alert; proper toast plumbing is Part F polish.
// =============================================================================

import { useRouter } from "next/navigation";
import { useState } from "react";

export type BumpKind = "primitive" | "capability" | "item";

export function useBumpSlotVersion(characterId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bump(
    kind: BumpKind,
    entityId: string,
  ): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      // Construct the path. The primitive endpoint uses instanceId
      // (UUID); capability/item use the entity id directly.
      const path =
        kind === "primitive"
          ? `/api/characters/${characterId}/primitives/${entityId}/bump-version`
          : kind === "capability"
            ? `/api/characters/${characterId}/capabilities/${entityId}/bump-version`
            : `/api/characters/${characterId}/items/${entityId}/bump-version`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Refresh server state so the badge re-evaluates staleness
      // against the new versionId.
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to bump version");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { bump, pending, error };
}
