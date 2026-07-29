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
import { Shield, ShieldOff, Eye } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import type { SlotSource } from "@/db/schema/characters";
import { ItemCapabilityToggle } from "@/components/characters/item-capability-toggle";
import { useEntityPreview } from "@/components/characters/preview-modal";
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
  /**
   * Phase 8.4 v22 (Mashu 2026-07-29): T2 — item's nested
   * bundle (capabilities / effects / primitives) for the
   * sheet side. The modal ItemsTab has its own component;
   * here we add a compact nested bundle preview to the
   * existing card.
   */
  nested?: {
    capabilityLinks: Array<{
      capabilityId: string;
      capability: {
        id: string;
        name: string;
        type: string;
        sourceType: string;
        verboseDescription: string;
        effectLinks: Array<{
          effectId: string;
          effect: { id: string; name: string; description: string };
        }>;
      };
    }>;
    effectLinks: Array<{
      effectId: string;
      effect: { id: string; name: string; description: string };
    }>;
    primitiveLinks: Array<{
      primitiveId: number;
      primitive: {
        id: number;
        name: string;
        category: string;
        buCost: number;
        isMirrorable: boolean;
        mirrorBuCredit: number;
        narrativeRule: string | null;
      };
    }>;
  };
}

export function ItemCard({
  characterId,
  item,
  atCapacity = false,
  nested,
}: ItemCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { showToast } = useToasts();
  const { openPreview } = useEntityPreview();
  const [previewPending, setPreviewPending] = useState(false);

  // Phase 8.4 v23 (Mashu 2026-07-29): T3c — open the
  // item in the EntityPreview modal stack instead of a
  // new tab. Per Mashu: "Preview button — replace with
  // click-to-preview modal (no new tab)".
  const openItemPreview = useCallback(async () => {
    setPreviewPending(true);
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { item: Record<string, unknown> };
      // Project to SandboxItemRow shape that EntityPreview expects.
      // The /api/items/[id] endpoint already returns a complete
      // payload (name, description, buCost, itemType, rarity, etc.)
      // — we just feed it through with kind:"item".
      openPreview({
        item: { kind: "item", row: data.item as never },
        category: "ITEM",
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
    } catch (err) {
      showToast(
        `Could not open preview: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    } finally {
      setPreviewPending(false);
    }
  }, [item.id, openPreview, showToast]);

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
        {/* Phase 8.2 batch 6: preview link opens the canonical library
            detail page in a new tab. Same EntityPreview the atelier
            uses, fully read-only, sheet state preserved. */}
        <button
          type="button"
          onClick={openItemPreview}
          disabled={previewPending}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
          title="Open preview in modal"
        >
          <Eye className="size-3" />
          {previewPending ? "Loading…" : "Preview"}
        </button>
      </div>

      {/* Phase 8.4 v22 (Mashu 2026-07-29): T2 — nested
          bundle (capabilities + effects + primitives).
          Per Mashu: item's nested content is item-scoped,
          not in the character's general pool. The toggles
          here are read-only (caps still have their full
          active/trigger via the sheet's CapabilityCard
          when slotted through manifest, but the item's
          own cap toggles live in the modal — sheet side
          is just for visibility). */}
      {nested &&
        (nested.capabilityLinks.length > 0 ||
          nested.effectLinks.length > 0 ||
          nested.primitiveLinks.length > 0) && (
          <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
            {nested.capabilityLinks.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Capabilities ({nested.capabilityLinks.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {nested.capabilityLinks.map((cl) => (
                    <li key={cl.capabilityId}>
                      {/* Phase 8.4 v23 (Mashu 2026-07-29):
                          cap active/trigger lives on the
                          sheet (per-character runtime).
                          Per Mashu: items don't have caps
                          in the modal — toggle here. */}
                      <ItemCapabilityToggle
                        itemId={item.id}
                        capability={cl.capability}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {nested.effectLinks.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Effects ({nested.effectLinks.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {nested.effectLinks.map((el) => (
                    <li
                      key={el.effectId}
                      className="rounded border border-border/40 bg-background/40 px-2 py-1.5"
                    >
                      <div className="font-medium">{el.effect.name}</div>
                      {el.effect.description && (
                        <p className="mt-1 text-muted-foreground line-clamp-2">
                          {el.effect.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {nested.primitiveLinks.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Primitives ({nested.primitiveLinks.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {nested.primitiveLinks.map((pl) => (
                    <li
                      key={pl.primitiveId}
                      className="rounded border border-border/40 bg-background/40 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {pl.primitive.name}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {pl.primitive.buCost} BU
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {pl.primitive.category}
                      </div>
                      {pl.primitive.narrativeRule && (
                        <p className="mt-1 text-muted-foreground line-clamp-2">
                          {pl.primitive.narrativeRule}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
    </div>
  );
}
