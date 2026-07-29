"use client";

/**
 * ItemsTab — Phase 8.4 v21 (Mashu 2026-07-29): T2 — items
 * modal/UX redesign.
 *
 * Per Mashu 2026-07-29 (Feedback PDF section 1):
 *
 *   Items in the character edit modal work differently
 *   compared to other tabs. Like primitives from items are
 *   from items. They are not reusable in a way or mirrorable
 *   or whatever. Basically you just add the item as-is in
 *   the character modal (with its primitives nested,
 *   effects nested, capabilities nested). When pushed to
 *   character sheet, it's pretty much the same. You "take
 *   them for granted".
 *
 *   You add a container for each item. Within it we have
 *   nested primitives, capabilities, effects and effects
 *   in capabilities. For each capability inside items we
 *   still have the active/inactive and trigger buttons.
 *   For each item we need a toggle equipped/unequipped.
 *
 *   Item BU is separate, not part of the budget. The
 *   primitives capabilities effects of the item are only
 *   of the item, separate from the character. Yes, I
 *   should be able to set capabilities inside it as active
 *   or inactive and trigger them. Yes they can interact
 *   with the character sheet (item gives me +1 to save DC
 *   for example). But those are item's not characters. If
 *   I delete or unequip item they don't count.
 *
 * This tab renders:
 *   1. A list of slotted items as container cards.
 *   2. Each card has: item metadata + equipped toggle +
 *      nested primitives (read-only, collapsed) +
 *      nested capabilities (with toggle/trigger like the
 *      sheet's CapabilityCard) + nested effects (under
 *      caps, read-only).
 *   3. Empty state when no items.
 *
 * Phase 8.4 v23 (Mashu 2026-07-29): cap active/trigger
 * removed from the modal side. Per Mashu's direction,
 * cap toggles are SHEET-only — they fire at runtime per
 * character. The modal handles CRUD: add, remove,
 * equip/unequip. Nested bundle here is read-only.
 *
 * The sheet's ItemsTab has the matching item-scoped
 * active/trigger via the same localStorage pattern the
 * existing CapabilityCard uses (sw:itemcap:<itemId>:<capId>).
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Shield,
  ShieldOff,
  Package,
  Trash2,
} from "lucide-react";
import { useCharacterModal, type PendingSlot } from "../character-modal-store";
import { useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface ItemsTabProps {
  /**
   * The full character seed (gives us the item template's
   * nested bundle — capabilityLinks, effectLinks,
   * primitiveLinks — for each slotted item). Items NOT in
   * the seed (added via atelier during this session) fetch
   * their detail on demand.
   */
  characterSeedItemLinks: Array<{
    itemId: string;
    equipped?: boolean;
    item: {
      id: string;
      name: string;
      description: string;
      itemType: string;
      rarity: string;
      buCost: number;
      slotCost: number;
      isTwoHanded: boolean;
      isConsumable: boolean;
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
  }>;
}

export function ItemsTab({ characterSeedItemLinks }: ItemsTabProps) {
  const { pendingSlots, queueSlot, removeSlot, setDirty } =
    useCharacterModal();
  const { showToast } = useToasts();

  // Map of itemId → seeded item template (for nested content)
  const itemById = useMemo(() => {
    const m = new Map<string, ItemsTabProps["characterSeedItemLinks"][number]>();
    for (const link of characterSeedItemLinks) {
      m.set(link.itemId, link);
    }
    return m;
  }, [characterSeedItemLinks]);

  // Lazily fetched details for items added during this session
  // (i.e. present in pendingSlots but not in the seed).
  const [fetchedDetails, setFetchedDetails] = useState<
    Record<
      string,
      {
        item: ItemsTabProps["characterSeedItemLinks"][number]["item"];
      }
    >
  >({});

  const items = pendingSlots["items"] ?? [];
  const itemSlots = items.filter((s): s is Extract<PendingSlot, { kind: "item" }> => s.kind === "item");

  useEffect(() => {
    let cancelled = false;
    const missing = itemSlots.filter((s) => !itemById.has(s.itemId));
    if (missing.length === 0) return;
    (async () => {
      const next: typeof fetchedDetails = { ...fetchedDetails };
      for (const s of missing) {
        if (fetchedDetails[s.itemId]) continue;
        try {
          const res = await fetch(
            `/api/items/${encodeURIComponent(s.itemId)}`,
          );
          if (!res.ok) continue;
          const data = (await res.json()) as {
            item: ItemsTabProps["characterSeedItemLinks"][number]["item"];
          };
          next[s.itemId] = data;
        } catch {
          // Network blip — leave item without nested content.
        }
      }
      if (!cancelled) setFetchedDetails(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSlots.length]);

  const toggleEquipped = useCallback(
    (index: number) => {
      const slot = itemSlots[index];
      if (!slot) return;
      const next: PendingSlot = {
        ...slot,
        equipped: !(slot.equipped === true),
      };
      // Remove old + queue new is one approach; the modal store
      // doesn't expose a "replaceSlot", so we do remove+queue.
      removeSlot("items", index);
      queueSlot(next);
      setDirty(true);
    },
    [itemSlots, queueSlot, removeSlot, setDirty],
  );

  const removeItem = useCallback(
    (index: number) => {
      removeSlot("items", index);
      setDirty(true);
    },
    [removeSlot, setDirty],
  );

  if (itemSlots.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <Package className="mx-auto size-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No items</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Add items from the library via the{" "}
          <span className="font-semibold">"Slot into items"</span> button.
          Each item brings its own nested primitives,
          capabilities, and effects — they live with the
          item, not in your character&apos;s general pool.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
        Items live with their own primitives, capabilities,
        and effects. Toggling equipped on/off affects
        encumbrance and any character-side interactions the
        item provides — but the item's nested caps are
        toggled on the SHEET (per-character runtime), not
        here. This modal is for CRUD: add, remove, equip.
      </p>
      <ul className="space-y-3">
        {itemSlots.map((slot, index) => {
          const link = itemById.get(slot.itemId);
          const fetched = fetchedDetails[slot.itemId];
          const item = link?.item ?? fetched?.item ?? null;
          if (!item) {
            return (
              <li
                key={slot.itemId + index}
                className="rounded-md border border-dashed border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
              >
                <div className="flex items-center justify-between gap-2">
                  <span>Loading item…</span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:bg-secondary"
                    title="Remove from character"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li key={slot.itemId + index}>
              <ItemContainerCard
                item={item}
                equipped={slot.equipped === true}
                onToggleEquipped={() => toggleEquipped(index)}
                onRemove={() => removeItem(index)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * ItemContainerCard — single item with its nested bundle.
 * Mirrors the sheet's ItemCard for equipped toggle, but
 * also surfaces the item's nested primitives/caps/effects.
 */
function ItemContainerCard({
  item,
  equipped,
  onToggleEquipped,
  onRemove,
}: {
  item: ItemsTabProps["characterSeedItemLinks"][number]["item"];
  equipped: boolean;
  onToggleEquipped: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-4 transition-colors",
        equipped ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold">{item.name}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{item.itemType}</span>
            <span>· {item.rarity}</span>
            {item.isTwoHanded && <span>· Two-handed</span>}
            {item.isConsumable && <span>· Consumable</span>}
            <span>· {item.buCost} BU</span>
            <span>· Slot cost {item.slotCost}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleEquipped}
            aria-pressed={equipped}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              equipped
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:bg-secondary",
            )}
            title={equipped ? "Click to unequip" : "Click to equip"}
          >
            {equipped ? (
              <Shield className="size-3" />
            ) : (
              <ShieldOff className="size-3" />
            )}
            {equipped ? "Equipped" : "Equip"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
            title="Remove from character"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {item.description && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {item.description}
        </p>
      )}

      {/* Nested bundle — capabilities + primitives + effects */}
      <ItemNestedBundle item={item} />
    </div>
  );
}

/**
 * ItemNestedBundle — read-only display of item's
 * capabilities (no active/trigger — that's sheet-only
 * per Mashu 2026-07-29), effects, and primitives.
 *
 * Phase 8.4 v23 (Mashu 2026-07-29): cap active/trigger
 * was removed from the modal side per Mashu's direction
 * — item caps are toggled on the SHEET (per-character
 * view), not during modal edit. The modal is purely for
 * CRUD: equip/unequip, add/remove. Capability state
 * happens at runtime on the sheet.
 */
function ItemNestedBundle({
  item,
}: {
  item: ItemsTabProps["characterSeedItemLinks"][number]["item"];
}) {
  const hasAny =
    item.capabilityLinks.length > 0 ||
    item.primitiveLinks.length > 0 ||
    item.effectLinks.length > 0;

  if (!hasAny) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        No nested capabilities, effects, or primitives.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Capabilities — read-only (sheet has the active/trigger) */}
      {item.capabilityLinks.length > 0 && (
        <details className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Capabilities ({item.capabilityLinks.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {item.capabilityLinks.map((cl) => (
              <li
                key={cl.capabilityId}
                className="rounded border border-border/40 bg-card px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cl.capability.name}</span>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {cl.capability.type}
                  </span>
                </div>
                {cl.capability.verboseDescription && (
                  <p className="mt-1 text-muted-foreground line-clamp-3">
                    {cl.capability.verboseDescription}
                  </p>
                )}
                {cl.capability.effectLinks.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-border/30 pt-2">
                    {cl.capability.effectLinks.map((el) => (
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
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Effects directly on the item (not via caps) */}
      {item.effectLinks.length > 0 && (
        <details className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Effects ({item.effectLinks.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {item.effectLinks.map((el) => (
              <li
                key={el.effectId}
                className="rounded border border-border/40 bg-card px-2 py-1.5"
              >
                <div className="font-medium">{el.effect.name}</div>
                {el.effect.description && (
                  <p className="mt-0.5 text-muted-foreground line-clamp-3">
                    {el.effect.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Primitives — read-only */}
      {item.primitiveLinks.length > 0 && (
        <details className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Primitives ({item.primitiveLinks.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {item.primitiveLinks.map((pl) => (
              <li
                key={pl.primitiveId}
                className="rounded border border-border/40 bg-card px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{pl.primitive.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {pl.primitive.buCost} BU
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {pl.primitive.category}
                </div>
                {pl.primitive.narrativeRule && (
                  <p className="mt-1 text-muted-foreground line-clamp-3">
                    {pl.primitive.narrativeRule}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}