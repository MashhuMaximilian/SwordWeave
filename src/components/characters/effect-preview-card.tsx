"use client";

/**
 * Phase 8.3e commit 2 (Mashu 2026-07-27): EffectPreviewCard
 *
 * Compact card for an effect on a character sheet. Mirrors
 * CapabilityCard's pattern (click to preview + trigger + active
 * toggle) but for effects.
 *
 * Effects aren't yet rendered on the character sheet (the page
 * query doesn't join them). This component is the building
 * block for 8.3e commit 4 (which will add an effects accordion).
 *
 * For now, the component exists and is tested in isolation; it
 * can be plugged into any accordion that has effect data.
 */

import { useCallback, useEffect, useState } from "react";
import { Power, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToasts } from "@/components/ui/toast";
import { useEntityPreview } from "@/components/characters/preview-modal";
import {
  type SandboxEffectRow,
  type SandboxPreviewItem,
} from "@/components/library/library-item-preview";

export interface EffectPreviewCardProps {
  readonly characterId: string;
  readonly effectLink: {
    readonly effectId: string;
    readonly acquiredAtLevel: number;
    readonly name: string;
    /** Narrative description (displayed under name on the card). */
    readonly narrativeDescription?: string;
    /** Source origin (e.g. "user:abc" or "DM"). Displayed as meta. */
    readonly sourceOrigin?: string | null;
  };
}

function toggleStorageKey(
  characterId: string,
  effectId: string,
): string {
  return `swordweave:effect-active:${characterId}:${effectId}`;
}

function readToggle(characterId: string, effectId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(toggleStorageKey(characterId, effectId)) ===
      "1"
    );
  } catch {
    return false;
  }
}

function writeToggle(
  characterId: string,
  effectId: string,
  active: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      window.localStorage.setItem(
        toggleStorageKey(characterId, effectId),
        "1",
      );
    } else {
      window.localStorage.removeItem(toggleStorageKey(characterId, effectId));
    }
  } catch {
    // localStorage might be disabled (private mode, quota); swallow.
  }
}

export function EffectPreviewCard({
  characterId,
  effectLink,
}: EffectPreviewCardProps) {
  const { showToast } = useToasts();
  const { openPreview } = useEntityPreview();

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [active, setActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggerPending, setTriggerPending] = useState(false);
  const [triggerFlash, setTriggerFlash] = useState(false);

  const fetchPreviewData = useCallback(async () => {
    if (previewData) return previewData;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/effects/${effectLink.effectId}`);
      if (!res.ok) throw new Error("Failed to fetch effect");
      const data = await res.json();
      setPreviewData(data.effect);
      return data.effect;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load preview",
        "error",
      );
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, [effectLink.effectId, previewData, showToast]);

  useEffect(() => {
    setActive(readToggle(characterId, effectLink.effectId));
    setHydrated(true);
  }, [characterId, effectLink.effectId]);

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    const next = !active;
    setActive(next);
    writeToggle(characterId, effectLink.effectId, next);
    setToggling(true);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/effects/${effectLink.effectId}/toggle`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: next }),
        },
      );
      if (!res.ok) {
        setActive(!next);
        writeToggle(characterId, effectLink.effectId, !next);
        showToast("Failed to update effect state", "error");
      }
    } catch {
      setActive(!next);
      writeToggle(characterId, effectLink.effectId, !next);
      showToast("Network error updating effect", "error");
    } finally {
      setToggling(false);
    }
  }, [
    active,
    characterId,
    effectLink.effectId,
    toggling,
    showToast,
  ]);

  const handleTrigger = useCallback(async () => {
    if (triggerPending) return;
    setTriggerPending(true);
    setTriggerFlash(true);
    window.setTimeout(() => setTriggerFlash(false), 1200);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/effects/${effectLink.effectId}/trigger`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to trigger effect");
      showToast(`Triggered "${effectLink.name}"`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Network error",
        "error",
      );
      setTriggerFlash(false);
    } finally {
      setTriggerPending(false);
    }
  }, [characterId, effectLink.effectId, effectLink.name, showToast, triggerPending]);

  const showActive = triggerFlash || (hydrated && active);

  const handlePreviewClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const data = await fetchPreviewData();
      if (data) {
        const item: SandboxPreviewItem = {
          kind: "effect",
          row: data as SandboxEffectRow,
        };
        openPreview({ item });
      }
    },
    [fetchPreviewData, openPreview],
  );

  const handleCardClick = useCallback(
    async (e: React.MouseEvent) => {
      if (
        (e.target as HTMLElement).closest("button") ||
        (e.target as HTMLElement).closest("a")
      ) {
        return;
      }
      const data = await fetchPreviewData();
      if (data) {
        const item: SandboxPreviewItem = {
          kind: "effect",
          row: data as SandboxEffectRow,
        };
        openPreview({ item });
      }
    },
    [fetchPreviewData, openPreview],
  );

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "relative rounded-md border bg-card p-4 transition-all cursor-pointer",
        showActive
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50",
      )}
      data-testid="effect-preview-card"
      data-effect-id={effectLink.effectId}
      data-effect-name={effectLink.name}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold">{effectLink.name}</h4>
        <button
          type="button"
          onClick={handlePreviewClick}
          disabled={previewLoading}
          className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium hover:bg-secondary/80"
          title="Open effect preview"
        >
          {previewLoading ? "Loading…" : "Preview"}
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {effectLink.sourceOrigin ? (
          <span>{effectLink.sourceOrigin}</span>
        ) : null}
        <span>·</span>
        <span>Acquired L{effectLink.acquiredAtLevel}</span>
      </div>

      {effectLink.narrativeDescription ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {effectLink.narrativeDescription}
        </p>
      ) : null}

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
              : "Click to activate"
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
          title="Trigger this effect"
        >
          <Zap className="size-3" />
          {triggerPending ? "Triggering…" : "Trigger"}
        </button>
      </div>
    </div>
  );
}