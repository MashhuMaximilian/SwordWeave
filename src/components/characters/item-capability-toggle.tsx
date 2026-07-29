"use client";

/**
 * ItemCapabilityToggle — Phase 8.4 v23 (Mashu 2026-07-29)
 *
 * Sheet-side active/trigger for a capability that lives
 * INSIDE an item. Mirrors CapabilityCard but:
 *
 *   - Keyed by (itemId, capabilityId) — no characterId
 *     because item caps are item-scoped (per Mashu: cap
 *     active state belongs to the item, not to the
 *     character). The same cap on the same character
 *     gets the same state because the character owns
 *     the item.
 *   - No preview link / no origin badges — those belong
 *     to CapabilityCard. Items are simpler.
 *   - No log entries — the audit trail is captured at
 *     capability-toggle / capability-trigger endpoints
 *     used by CapabilityCard. For items, the toggle is
 *     purely visual / runtime, matching the spec that
 *     "cap state is per-session".
 *
 * Same key shape as CapabilityCard's own localStorage
 * helper for consistency:
 *   sw:itemcap:<itemId>:<capabilityId> -> "1" | "0"
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Power, Zap } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface ItemCapabilityToggleProps {
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

function storageKey(itemId: string, capabilityId: string): string {
  return `sw:itemcap:${itemId}:${capabilityId}`;
}

export function ItemCapabilityToggle({
  itemId,
  capability,
}: ItemCapabilityToggleProps) {
  const { showToast } = useToasts();
  const key = storageKey(itemId, capability.id);
  const [active, setActive] = useState(false);
  const [triggerPending, setTriggerPending] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(key) === "1") setActive(true);
    } catch {
      // ignore
    }
  }, [key]);

  const persist = useCallback(
    (next: boolean) => {
      setActive(next);
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // ignore
      }
    },
    [key],
  );

  const handleToggle = useCallback(() => {
    persist(!active);
  }, [active, persist]);

  const handleTrigger = useCallback(() => {
    setTriggerPending(true);
    persist(true);
    showToast(`Triggered "${capability.name}".`, "success");
    setTimeout(() => {
      persist(false);
      setTriggerPending(false);
    }, 1200);
  }, [capability.name, persist, showToast]);

  return (
    <div className="rounded border border-border/40 bg-card px-2 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{capability.name}</span>
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {capability.type}
            </span>
          </div>
          {capability.verboseDescription && (
            <p className="mt-1 text-muted-foreground line-clamp-3">
              {capability.verboseDescription}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggle}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
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
      </div>
      {/* Effects under the cap (read-only) */}
      {capability.effectLinks.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/30 pt-2">
          {capability.effectLinks.map((el) => (
            <li
              key={el.effectId}
              className="rounded bg-background/40 px-2 py-1 text-[11px]"
            >
              <span className="font-medium">{el.effect.name}</span>
              {el.effect.description && (
                <p className="mt-0.5 text-muted-foreground line-clamp-2">
                  {el.effect.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}