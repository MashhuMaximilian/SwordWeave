"use client";

/**
 * ItemCapabilityToggle — Phase 8.4 v23 (Mashu 2026-07-29),
 * updated in v24.5.
 *
 * Sheet-side active/trigger for a capability that lives
 * INSIDE an item. Mirrors CapabilityCard but:
 *
 *   - Keyed by (itemId, capabilityId). The audit endpoints
 *     also need the parent characterId because the character
 *     owns the item — and the audit log lives on the
 *     character, not the item (Phase 8.4 v24.5).
 *   - No preview link / no origin badges — those belong
 *     to CapabilityCard. Items are simpler.
 *   - Active state stays in localStorage (the source of
 *     truth for transient runtime state, same as
 *     CapabilityCard). Each toggle/trigger ALSO fires
 *     POST /api/characters/[characterId]/capabilities/[capId]/{toggle|trigger}
 *     with { itemId } so the audit log captures the event
 *     with itemId + scope="item" tags. The history tab can
 *     then distinguish item-scoped from character-scoped
 *     events.
 *
 * localStorage key shape:
 *   sw:itemcap:<characterId>:<itemId>:<capabilityId> -> "1" | "0"
 *
 * (v24.5: includes characterId so two characters with the
 * same itemId + capabilityId don't collide.)
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Power, Zap } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { emitCharacterLogAdded } from "@/lib/character/character-events";
import { cn } from "@/lib/utils";

export interface ItemCapabilityToggleProps {
  characterId: string;
  itemId: string;
  capability: {
    id: string;
    name: string;
    type: string;
    verboseDescription?: string | null;
    effectLinks: Array<{
      effectId: string;
      effect: { id: string; name: string; description: string | null };
    }>;
  };
}

function storageKey(
  characterId: string,
  itemId: string,
  capabilityId: string,
): string {
  return `sw:itemcap:${characterId}:${itemId}:${capabilityId}`;
}

function readStorage(
  characterId: string,
  itemId: string,
  capabilityId: string,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(
        storageKey(characterId, itemId, capabilityId),
      ) === "1"
    );
  } catch {
    return false;
  }
}

function writeStorage(
  characterId: string,
  itemId: string,
  capabilityId: string,
  active: boolean,
) {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      window.localStorage.setItem(
        storageKey(characterId, itemId, capabilityId),
        "1",
      );
    } else {
      window.localStorage.removeItem(
        storageKey(characterId, itemId, capabilityId),
      );
    }
  } catch {
    // ignore
  }
}

export function ItemCapabilityToggle({
  characterId,
  itemId,
  capability,
}: ItemCapabilityToggleProps) {
  const { showToast } = useToasts();
  const [active, setActive] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggerPending, setTriggerPending] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setActive(readStorage(characterId, itemId, capability.id));
  }, [characterId, itemId, capability.id]);

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    const next = !active;

    // Optimistic UI update.
    setActive(next);
    writeStorage(characterId, itemId, capability.id, next);
    setToggling(true);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/capabilities/${capability.id}/toggle`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: next, itemId }),
        },
      );

      if (!res.ok) {
        // Revert optimistic update on failure.
        setActive(!next);
        writeStorage(characterId, itemId, capability.id, !next);
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ??
          "Failed to toggle capability.";
        showToast(msg, "error");
        return;
      }

      const data = (await res.json()) as {
        capability: { id: string; name: string; active: boolean };
      };
      setActive(data.capability.active);
      writeStorage(characterId, itemId, capability.id, data.capability.active);
      showToast(
        next
          ? `Activated "${capability.name}"`
          : `Deactivated "${capability.name}"`,
        "success",
      );
      emitCharacterLogAdded(characterId);
    } catch (err) {
      setActive(!next);
      writeStorage(characterId, itemId, capability.id, !next);
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setToggling(false);
    }
  }, [
    active,
    capability.id,
    capability.name,
    characterId,
    itemId,
    showToast,
    toggling,
  ]);

  const handleTrigger = useCallback(async () => {
    if (triggerPending) return;
    setTriggerPending(true);

    // Visual flash: show active for ~1.2s regardless of stored state.
    const prevActive = active;
    setActive(true);
    const timeout = window.setTimeout(() => {
      setActive(prevActive);
    }, 1200);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/capabilities/${capability.id}/trigger`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ itemId }),
        },
      );

      if (!res.ok) {
        window.clearTimeout(timeout);
        setActive(prevActive);
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ??
          "Failed to trigger capability.";
        showToast(msg, "error");
        return;
      }

      showToast(`Triggered "${capability.name}".`, "success");
      emitCharacterLogAdded(characterId);
    } catch (err) {
      window.clearTimeout(timeout);
      setActive(prevActive);
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setTriggerPending(false);
    }
  }, [
    active,
    capability.id,
    capability.name,
    characterId,
    itemId,
    showToast,
    triggerPending,
  ]);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50",
          active
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background hover:bg-secondary",
        )}
        title={active ? "Click to deactivate" : "Click to activate"}
      >
        {active ? (
          <CheckCircle2 className="size-3" />
        ) : (
          <Power className="size-3" />
        )}
        {active ? "Active" : "Inactive"}
      </button>
      <button
        type="button"
        onClick={handleTrigger}
        disabled={triggerPending}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium transition-colors hover:bg-secondary disabled:opacity-50"
        title="Trigger (one-shot fire-and-revert)"
      >
        {triggerPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Zap className="size-3" />
        )}
        Trigger
      </button>
    </div>
  );
}