"use client";

/**
 * ItemCard — Phase 8.2 batch 4
 *
 * Interactive card for a single item on the character sheet. Adds
 * an equip/unequip toggle button next to the static "Equipped"
 * badge. The existing `character_items.equipped` column already
 * flows through encumbrance/sheet aggregation — this is just the
 * UI to flip it.
 *
 * Optimistic update: the local `equipped` state flips immediately,
 * the POST runs in the background. If it fails, we revert + toast.
 * On success, `router.refresh()` re-runs the SC so encumbrance,
 * defensive DCs, and any other derived numbers update.
 */

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import type { SlotSource } from "@/db/schema/characters";
import { cn } from "@/lib/utils";

interface EquipResponse {
  character: { id: string; itemId: string };
  equipped: boolean;
  note?: string;
}

export interface ItemCardProps {
  characterId: string;
  item: {
    id: string;
    name: string;
    itemType: string;
    rarity: string;
    description: string;
    buCost: number;
    slotCost: number;
    isTwoHanded: boolean;
    isConsumable: boolean;
    equipped: boolean;
    quantity: number;
    versionId: string | null;
    slotSource: SlotSource | null;
    latestVersionId: string | null;
  };
  /** Whether the character is at or over equip-slot capacity. */
  atCapacity?: boolean;
  onPreview?: () => void;
}

export function ItemCard({
  characterId,
  item,
  atCapacity = false,
  onPreview,
}: ItemCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { showToast } = useToasts();

  // Optimistic local state.
  const [optimisticEquipped, setOptimisticEquipped] = useState(item.equipped);
  const [pending, setPending] = useState(false);

  // Reconcile with props on server-pushed updates.
  useEffect(() => {
    if (!pending) setOptimisticEquipped(item.equipped);
  }, [item.equipped, pending]);

  const handleToggleEquip = useCallback(async () => {
    if (pending) return;
    const next = !optimisticEquipped;

    // Optimistic flip.
    setOptimisticEquipped(next);
    setPending(true);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/items/${item.id}/equip`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ equipped: next }),
        },
      );

      if (!res.ok) {
        setOptimisticEquipped(!next);
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to update item.";
        showToast(msg, "error");
        return;
      }

      const data = (await res.json()) as EquipResponse;
      setOptimisticEquipped(data.equipped);

      // Refresh the SC so encumbrance, slot counts, and any other
      // server-derived numbers update.
      startTransition(() => router.refresh());

      const verb = next ? "Equipped" : "Unequipped";
      showToast(`${verb} "${item.name}".`, "success");
    } catch (err) {
      setOptimisticEquipped(!next);
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }, [
    characterId,
    item.id,
    item.name,
    optimisticEquipped,
    pending,
    showToast,
  ]);

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-4 transition-colors",
        optimisticEquipped ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold">{item.name}</h4>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
          {item.itemType}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{item.rarity}</span>
        {item.isTwoHanded && <span>· Two-handed</span>}
        {item.isConsumable && <span>· Consumable</span>}
        {optimisticEquipped && (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
            Equipped
          </span>
        )}
      </div>
      <div className="mt-2">
        <SlotSourceBadge
          slotSource={item.slotSource}
          versionId={item.versionId}
          latestVersionId={item.latestVersionId}
        />
      </div>
      {item.description && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {item.description}
        </p>
      )}

      {/* Action row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggleEquip}
          disabled={pending || (!optimisticEquipped && atCapacity)}
          aria-pressed={optimisticEquipped}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            optimisticEquipped
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background hover:bg-secondary",
          )}
          title={
            !optimisticEquipped && atCapacity
              ? "Equip slots are full — unequip something first"
              : optimisticEquipped
                ? "Click to unequip"
                : "Click to equip (affects encumbrance and defense)"
          }
        >
          {optimisticEquipped ? (
            <Shield className="size-3" />
          ) : (
            <ShieldOff className="size-3" />
          )}
          {pending
            ? optimisticEquipped
              ? "Unequipping…"
              : "Equipping…"
            : optimisticEquipped
              ? "Equipped"
              : "Equip"}
        </button>
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary"
          >
            Preview
          </button>
        )}
      </div>
    </div>
  );
}
