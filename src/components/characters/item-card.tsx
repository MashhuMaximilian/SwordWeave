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
import {
  SIZE_LOAD,
  type CharacterSize,
} from "@/lib/engine/encumbrance";
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
    // Phase 8.5 / Session H6 (Mashu 2026-08-03): carried-
    // but-not-equippable flag. The public character sheet
    // hides the Equip button when this is true so potions
    // / scrolls / ammo pouches don't show an equip toggle
    // they'd never use. Mirrors the modal ItemsTab logic.
    isNotEquippable?: boolean;
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
  //
  // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — same preview
  // pattern for nested item capabilities, effects, and
  // primitives. Mashu: "I still cannot click on the item
  // primitives or capabilities to see their preview modals."
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
        // Phase 8.5 / Session H6 (Mashu 2026-08-03):
        // pass the source + version-history links into
        // the preview's action bar so they render as
        // buttons at the bottom of the modal (matching
        // the source / versions buttons the My Creations
        // and Library previews already show). The user
        // wanted these in the PREVIEW MODAL, not inline
        // on the card — this is the central wiring.
        actionBar: {
          openSourceHref: `/atelier/item/${item.id}`,
          versionHistoryHref: `/atelier/item/${item.id}?tab=versions`,
        },
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

  // v24.5: click on a nested capability → preview modal.
  const openCapabilityPreview = useCallback(
    async (capabilityId: string) => {
      try {
        const res = await fetch(
          `/api/capabilities/${encodeURIComponent(capabilityId)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          capability: Record<string, unknown>;
        };
        openPreview({
          item: { kind: "capability", row: data.capability as never },
          category: "CAPABILITY",
        });
      } catch (err) {
        showToast(
          `Could not open preview: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
    [openPreview, showToast],
  );

  // v24.5: click on a nested primitive → preview modal.
  const openPrimitivePreview = useCallback(
    async (primitiveId: number) => {
      try {
        const res = await fetch(
          `/api/primitives/${encodeURIComponent(String(primitiveId))}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          primitive: Record<string, unknown>;
        };
        openPreview({
          item: { kind: "primitive", row: data.primitive as never },
          category: "PRIMITIVE",
        });
      } catch (err) {
        showToast(
          `Could not open preview: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
    [openPreview, showToast],
  );

  // v24.5: click on a nested effect → preview modal.
  const openEffectPreview = useCallback(
    async (effectId: string) => {
      try {
        const res = await fetch(
          `/api/effects/${encodeURIComponent(effectId)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          effect: Record<string, unknown>;
        };
        openPreview({
          item: { kind: "effect", row: data.effect as never },
          category: "EFFECT",
        });
      } catch (err) {
        showToast(
          `Could not open preview: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
    [openPreview, showToast],
  );

  // Optimistic local state.
  const [optimisticEquipped, setOptimisticEquipped] = useState(item.equipped);
  // Phase 8.5 / Session H6 (Mashu 2026-08-03): optimistic
  // quantity so the inline Qty input on the sheet card
  // updates immediately. The route /api/characters/[id]/
  // items/[itemId]/quantity persists and refreshes the SC.
  const [optimisticQuantity, setOptimisticQuantity] = useState(item.quantity);
  const [pending, setPending] = useState(false);

  // Reconcile with props on server-pushed updates.
  useEffect(() => {
    if (!pending) setOptimisticEquipped(item.equipped);
  }, [item.equipped, pending]);
  useEffect(() => {
    if (!pending) setOptimisticQuantity(item.quantity);
  }, [item.quantity, pending]);

  // Phase 8.5 / Session H6 (Mashu 2026-08-03): optimistic
  // quantity save. Same shape as handleToggleEquip but
  // posts to /quantity instead of /equip. Clamped to >=1.
  const handleSetQuantity = useCallback(
    async (next: number) => {
      if (pending) return;
      const clamped = Math.max(
        1,
        Math.floor(Number.isFinite(next) ? next : 1),
      );
      if (clamped === optimisticQuantity) return;

      const previous = optimisticQuantity;
      setOptimisticQuantity(clamped);
      setPending(true);

      try {
        const res = await fetch(
          `/api/characters/${characterId}/items/${item.id}/quantity`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ quantity: clamped }),
          },
        );

        if (!res.ok) {
          setOptimisticQuantity(previous);
          const body = await res.json().catch(() => ({}));
          const msg =
            (body as { error?: string }).error ??
            "Failed to update item quantity.";
          showToast(msg, "error");
          return;
        }

        startTransition(() => router.refresh());

        const delta = clamped - previous;
        const verb = delta > 0 ? "Added" : "Removed";
        showToast(
          `${verb} ${Math.abs(delta)} ${item.name} (now ${clamped}).`,
          "success",
        );
      } catch {
        setOptimisticQuantity(previous);
        showToast("Network error updating item quantity.", "error");
      } finally {
        setPending(false);
      }
    },
    [
      pending,
      optimisticQuantity,
      characterId,
      item.id,
      item.name,
      router,
      showToast,
    ],
  );

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
        <div className="min-w-0">
          <h4 className="flex flex-wrap items-center gap-2 font-semibold">
            {item.name}
            {/* Phase 8.5 / Session H6 (Mashu 2026-08-03):
                editable inline Qty stepper on the sheet card.
                A traveller carrying 4 healing potions sees 4
                in the input; typing 7 + blur immediately
                saves the new stack count and refreshes the
                SC (which updates Load + the bottom drawer).
                Min 1, no upper cap. Equivalent to opening
                the modal and editing quantity there, but
                without leaving the page. */}
            <label
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-xs font-bold text-foreground"
              title="How many of this item the character holds. Scales into Load."
            >
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                ×
              </span>
              <input
                type="number"
                min={1}
                value={optimisticQuantity}
                onChange={(e) => handleSetQuantity(Number(e.target.value))}
                onBlur={(e) => {
                  const raw = Number(e.target.value);
                  handleSetQuantity(
                    Math.max(1, Math.floor(Number.isFinite(raw) ? raw : 1)),
                  );
                }}
                disabled={pending}
                className="w-12 border-0 bg-transparent p-0 text-xs font-bold tabular-nums text-foreground outline-none"
              />
            </label>
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{item.rarity}</span>
            {item.isTwoHanded && <span>· Two-handed</span>}
            {item.isConsumable && <span>· Consumable</span>}
            {optimisticEquipped && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                Equipped
              </span>
            )}
            {/* Phase 8.5 / Session H6: per-item Load = ceil(qty /
                SIZE_LOAD[size]). The ceiling matches the
                "1 Load fits N items" rule the user clarified
                this round — e.g. SMALL = 1 item per Load, so
                4 SMALL items costs 4 Load (not 1). LARGE = 1
                item per 4 Load, so a single LARGE item costs
                ceil(1 / 4) = 1 Load. 5 LARGE items = ceil(5
                / 4) = 2 Load. The number input above lets the
                user pick the quantity; this line lets them
                see the Load impact without scrolling. */}
            <span>
              · Load{" "}
              {Math.ceil(
                optimisticQuantity /
                  Math.max(
                    1,
                    SIZE_LOAD[
                      (item as { size?: CharacterSize }).size ?? "SMALL"
                    ],
                  ),
              )}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
          {item.itemType}
        </span>
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
        {/* Phase 8.5 / Session H6 (Mashu 2026-08-03): hide
            the Equip / Unequip toggle entirely when the
            item is marked not-equippable. Potions, scrolls,
            and ammo pouches have no "equipped" state — they
            just sit in the inventory. The "Not equippable"
            pill below replaces the button so the user
            understands why it's gone. */}
        {!item.isNotEquippable && (
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
        )}
        {/* Phase 8.5 / Session H6 (Mashu 2026-08-03): pill
            replacement for the Equip button on items that
            are not equippable. Shows the user the meta
            reason the button is missing. */}
        {item.isNotEquippable && (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
            title="Carried but never equipped. Set on the item's edit form."
          >
            Not equippable
          </span>
        )}
        {/* Phase 8.5 / Session H6 (Mashu 2026-08-03): the
          View source + View version history buttons were
          removed from this card. Mashu clarified the
          buttons belong in the PREVIEW MODAL that opens
          when the user clicks the item's title / Preview
          button — not inline on every card. Inline cards
          should stay compact. The new buttons live in
          library-item-preview.tsx and render for every
          entity type (item, capability, effect, primitive). */}
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
                          in the modal — toggle here.
                          v24.5: clicking the cap name
                          opens the EntityPreview modal
                          (cap click should preview the cap,
                          not just be a toggle). */}
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => openCapabilityPreview(cl.capabilityId)}
                          title={`Preview "${cl.capability.name}"`}
                          className="flex-1 rounded border border-border/40 bg-card px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {cl.capability.name}
                            </span>
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {cl.capability.type}
                            </span>
                          </div>
                          {cl.capability.verboseDescription && (
                            <p className="mt-1 text-muted-foreground line-clamp-3">
                              {cl.capability.verboseDescription}
                            </p>
                          )}
                        </button>
                        <ItemCapabilityToggle
                          itemId={item.id}
                          characterId={characterId}
                          capability={cl.capability}
                        />
                      </div>
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
                      {/* v24.5: click the effect name to preview. */}
                      <button
                        type="button"
                        onClick={() => openEffectPreview(el.effectId)}
                        title={`Preview "${el.effect.name}"`}
                        className="block w-full text-left transition-colors hover:underline"
                      >
                        <div className="font-medium">{el.effect.name}</div>
                        {el.effect.description && (
                          <p className="mt-1 text-muted-foreground line-clamp-2">
                            {el.effect.description}
                          </p>
                        )}
                      </button>
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
                      {/* v24.5: click the primitive name to preview. */}
                      <button
                        type="button"
                        onClick={() => openPrimitivePreview(pl.primitiveId)}
                        title={`Preview "${pl.primitive.name}"`}
                        className="block w-full text-left transition-colors hover:underline"
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
                      </button>
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
