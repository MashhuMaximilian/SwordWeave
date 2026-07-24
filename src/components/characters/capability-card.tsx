"use client";

/**
 * CapabilityCard — Phase 8.2 batch 4
 *
 * Interactive card for a single capability on the character sheet.
 * Two runtime actions:
 *
 *   1. TOGGLE  (sustained capabilities, e.g. "Shield Wall is up")
 *      - State persists in localStorage keyed by (characterId, capabilityId)
 *      - Always writes a capability_toggle log entry so the audit trail
 *        captures the act of toggling even if the browser storage is
 *        cleared later.
 *      - Toggling from active → inactive is the same endpoint, just
 *        passes `active: false`.
 *
 *   2. TRIGGER (one-shot fire-and-revert capabilities, e.g. "Cast Fireball")
 *      - Optimistically flashes the capability as active, fires the
 *        capability_trigger log entry, then immediately reverts to
 *        inactive. The UI shows a brief "Triggered!" confirmation.
 *      - Per Mashu 2026-07-22: "trigger = instant fire + revert to
 *        inactive; logged". So the trigger does NOT persist any
 *        "active" state — it's purely a log event with a visual flash.
 *
 * State model (Mashu 2026-07-23):
 *   - localStorage ONLY. No server-side persistence of active state.
 *   - Different device / hard refresh / cleared storage = all
 *     capabilities show as inactive (default).
 *   - Log entries are the forensic trail; player can reconstruct
 *     what happened even if localStorage was lost.
 *
 * The card is the smallest unit of state: each card reads its own
 * slice from localStorage so 50 capabilities = 50 keys. The keys
 * are namespaced under "sw:cap:<characterId>:<capabilityId>" so
 * clearing one character doesn't affect another.
 */

import { useState, useEffect, useCallback } from "react";
import { Zap, Power, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { SlotSource } from "@/db/schema/characters";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import { OriginBadge } from "@/components/characters/origin-badge";
import { useEntityPreview } from "@/components/characters/preview-modal";

interface ToggleResponse {
  capability: { id: string; active: boolean };
}

interface TriggerResponse {
  capability: { id: string; name: string };
}

export interface CapabilityCardProps {
  characterId: string;
  capability: {
    id: string;
    name: string;
    type: string;
    sourceType: string;
    acquiredAtLevel: number;
    /**
     * Optional longer description shown in the card body. Truncated
     * via line-clamp; the full text lives in the entity preview.
     */
    verboseDescription?: string | null;
    versionId: string | null;
    slotSource: SlotSource | null;
    latestVersionId: string | null;
    /**
     * Optional precomputed origin chain (heritage badges, etc.).
     * If present, renders an OriginBadge beneath the slot metadata.
     */
    originChain?: Array<{
      kind: "heritage" | "capability" | "effect";
      name: string;
    }>;
  };
}

function storageKey(characterId: string, capabilityId: string) {
  return `sw:cap:${characterId}:${capabilityId}`;
}

/**
 * Read the local toggle state. Returns null if not set (treated
 * as inactive). Safe to call server-side — returns null when
 * window/localStorage are unavailable.
 */
function readToggle(characterId: string, capabilityId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(characterId, capabilityId)) === "1";
  } catch {
    return false;
  }
}

function writeToggle(
  characterId: string,
  capabilityId: string,
  active: boolean,
) {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      window.localStorage.setItem(storageKey(characterId, capabilityId), "1");
    } else {
      window.localStorage.removeItem(storageKey(characterId, capabilityId));
    }
  } catch {
    // localStorage might be disabled (private mode, quota); swallow.
  }
}

export function CapabilityCard({
  characterId,
  capability,
}: CapabilityCardProps) {
  const { showToast } = useToasts();
  const { openPreview } = useEntityPreview();
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Local optimistic state. Hydrate from localStorage on mount.
  const [active, setActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggerPending, setTriggerPending] = useState(false);
  // Brief flash to confirm a trigger. Cleared after ~1.2s.
  const [triggerFlash, setTriggerFlash] = useState(false);

  const fetchPreviewData = useCallback(async () => {
    if (previewData) return previewData;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/capabilities/${capability.id}`);
      if (!res.ok) throw new Error("Failed to fetch capability");
      const data = await res.json();
      setPreviewData(data.capability);
      return data.capability;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load preview", "error");
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, [capability.id, previewData, showToast]);

  useEffect(() => {
    setActive(readToggle(characterId, capability.id));
    setHydrated(true);
  }, [characterId, capability.id]);

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    const next = !active;

    // Optimistic UI update — feels instant.
    setActive(next);
    writeToggle(characterId, capability.id, next);
    setToggling(true);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/capabilities/${capability.id}/toggle`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: next }),
        },
      );

      if (!res.ok) {
        // Revert optimistic update on failure.
        setActive(!next);
        writeToggle(characterId, capability.id, !next);
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to toggle capability.";
        showToast(msg, "error");
        return;
      }

      const data = (await res.json()) as ToggleResponse;
      // Reconcile with server's view of truth.
      setActive(data.capability.active);
      writeToggle(characterId, capability.id, data.capability.active);

      showToast(
        next ? `Activated "${capability.name}"` : `Deactivated "${capability.name}"`,
        "success",
      );
    } catch (err) {
      setActive(!next);
      writeToggle(characterId, capability.id, !next);
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setToggling(false);
    }
  }, [active, capability.id, capability.name, characterId, showToast, toggling]);

  const handleTrigger = useCallback(async () => {
    if (triggerPending) return;
    setTriggerPending(true);

    // Visual flash: show active for ~1.2s regardless of stored state.
    setTriggerFlash(true);
    window.setTimeout(() => setTriggerFlash(false), 1200);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/capabilities/${capability.id}/trigger`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to trigger capability.";
        showToast(msg, "error");
        setTriggerFlash(false);
        return;
      }

      const data = (await res.json()) as TriggerResponse;
      showToast(`Triggered "${data.capability.name}"`, "success");
      // No router.refresh() — trigger is a log-only event, nothing
      // else on the sheet needs to re-render.
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
      setTriggerFlash(false);
    } finally {
      setTriggerPending(false);
    }
  }, [capability.id, capability.name, characterId, showToast, triggerPending]);

  // Until hydration runs on the client, render a neutral state so
  // server-rendered HTML matches the first client render (avoids
  // hydration mismatch on the active ring).
  const showActive = triggerFlash || (hydrated && active);

  const handlePreviewClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click from also triggering
    const data = await fetchPreviewData();
    if (data) {
      openPreview({
        item: {
          kind: "capability",
          row: data as typeof data & { id: string; name: string; type: string; sourceType: string; verboseDescription: string | null; sourceOrigin: string | null; tags: string[]; isPublic: boolean; primitiveLinks: unknown[]; effectLinks: unknown[]; iconSource: string | null; iconKey: string | null; iconUrl: string | null; iconColor: string },
        },
        category: "CAPABILITY",
        callbacks: {
          engagement: {
            likes: 0,
            dislikes: 0,
            forks: 0,
            userReaction: null,
            authorId: null,
            authorUsername: null,
            authorIsAdmin: null,
            currentUserInternalId: null,
          },
        },
      });
    }
  };

  const handleCardClick = async (e: React.MouseEvent) => {
    // Don't trigger preview if clicking on buttons
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("a")
    ) {
      return;
    }
    const data = await fetchPreviewData();
    if (data) {
      openPreview({
        item: {
          kind: "capability",
          row: data as typeof data & { id: string; name: string; type: string; sourceType: string; verboseDescription: string | null; sourceOrigin: string | null; tags: string[]; isPublic: boolean; primitiveLinks: unknown[]; effectLinks: unknown[]; iconSource: string | null; iconKey: string | null; iconUrl: string | null; iconColor: string },
        },
        category: "CAPABILITY",
        callbacks: {
          engagement: {
            likes: 0,
            dislikes: 0,
            forks: 0,
            userReaction: null,
            authorId: null,
            authorUsername: null,
            authorIsAdmin: null,
            currentUserInternalId: null,
          },
        },
      });
    }
  };

  return (
      <div
        className={cn(
          "relative rounded-md border bg-card p-4 transition-all cursor-pointer",
          showActive
            ? "border-primary ring-2 ring-primary/30"
            : "border-border hover:border-primary/50",
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold">{capability.name}</h4>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            {capability.type}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{capability.sourceType}</span>
          <span>·</span>
          <span>Acquired L{capability.acquiredAtLevel}</span>
        </div>

        {/* Slot metadata: badge for source + optional origin chain. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SlotSourceBadge
            slotSource={capability.slotSource}
            versionId={capability.versionId}
            latestVersionId={capability.latestVersionId}
          />
          {capability.originChain && capability.originChain.length > 0 ? (
            <OriginBadge chain={capability.originChain} />
          ) : null}
        </div>

        {capability.verboseDescription && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {capability.verboseDescription}
          </p>
        )}

        {/* Action row */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling || triggerPending}
            aria-pressed={showActive}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              showActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:bg-secondary",
            )}
            title={
              showActive
                ? "Currently active — click to deactivate"
                : "Click to activate (persists in this browser)"
            }
          >
            <Power className="size-3" />
            {showActive ? "Active" : "Inactive"}
          </button>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={triggerPending || toggling}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300"
            title="Fire this capability once and log it (state does not persist)"
          >
            {triggerFlash ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <Zap className="size-3" />
            )}
            {triggerFlash ? "Triggered" : triggerPending ? "…" : "Trigger"}
          </button>
          {/* Preview modal — same EntityPreview used in atelier/library */}
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={previewLoading}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            title="Open preview modal"
          >
            {previewLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ExternalLink className="size-3" />
            )}
            Preview
          </button>
        </div>

        {triggerFlash && (
          <p
            className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300"
            aria-live="polite"
          >
            Capability fired (logged). Effect resolves per its description.
          </p>
        )}
      </div>
    );
  }
