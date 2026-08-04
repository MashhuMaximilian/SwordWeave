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
import {
  Shield,
  ShieldOff,
  Eye,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import {
  SIZE_LOAD,
  TINY_ITEMS_PER_POUCH,
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
  // Phase 8.5 / Session H6 (Mashu 2026-08-03 round 4):
  // the quantity field uses a CHECKBOX-CONFIRM pattern,
  // not instant-save. The user types a number into the
  // input but the value is NOT saved until they click
  // the small checkbox next to the field. Reasons:
  //   1) typing into the field shouldn't trigger SC
  //      refreshes that re-arrange cards (wonky UX)
  //   2) the user couldn't delete and re-type cleanly;
  //      with the checkbox-confirm, the input is its
  //      own little scratchpad until confirmation
  // Tri-state:
  //   - editing=false: shows a "× N" pill + pencil edit
  //     button (compact inline display)
  //   - editing=true: shows the input + a checkbox to
  //     confirm (saves), or X to cancel (reverts)
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState<string>(String(item.quantity));
  const [pending, setPending] = useState(false);

  // Reconcile with props on server-pushed updates.
  useEffect(() => {
    if (!pending) setOptimisticEquipped(item.equipped);
  }, [item.equipped, pending]);
  // When the server pushes a new quantity (e.g. another
  // tab saved) and we're not in edit mode, sync the input
  // string so the next edit starts from the right value.
  useEffect(() => {
    if (!pending && !editingQty) setQtyInput(String(item.quantity));
  }, [item.quantity, pending, editingQty]);

  // Phase 8.5 / Session H6 round 4: confirm-checkbox
  // save. The bounding box for the new quantity is the
  // input text at the moment the user clicks the
  // checkbox. Empty / non-numeric / < 1 inputs are
  // silently rejected and the input stays open for the
  // user to fix.
  const handleConfirmQuantity = useCallback(async () => {
    if (pending) return;
    const parsed = Number(qtyInput);
    if (!Number.isInteger(parsed) || parsed < 1) {
      showToast("Quantity must be a positive integer.", "error");
      return;
    }
    const previous = item.quantity;
    if (parsed === previous) {
      // No-op — exit edit mode without saving.
      setEditingQty(false);
      return;
    }

    setPending(true);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/items/${item.id}/quantity`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quantity: parsed }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ??
          "Failed to update item quantity.";
        showToast(msg, "error");
        // Leave edit mode open so the user can retry.
        return;
      }

      startTransition(() => router.refresh());
      const delta = parsed - previous;
      const verb = delta > 0 ? "Added" : "Removed";
      showToast(
        `${verb} ${Math.abs(delta)} ${item.name} (now ${parsed}).`,
        "success",
      );
      setEditingQty(false);
    } catch {
      showToast("Network error updating item quantity.", "error");
    } finally {
      setPending(false);
    }
  }, [pending, qtyInput, item.quantity, item.id, item.name, characterId, router, showToast]);

  // Cancel button: reverts the input to the server value
  // and exits edit mode without saving.
  const handleCancelQuantity = useCallback(() => {
    setQtyInput(String(item.quantity));
    setEditingQty(false);
  }, [item.quantity]);

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
            {/* Phase 8.5 H6 round 5 (Mashu 2026-08-03):
                the item name is now a clickable preview
                trigger — same affordance as the cap
                cards. The standalone Preview button at
                the bottom of the card was removed because
                naming the item should open the preview
                the same way it does for caps / primitives
                / effects / heritages. */}
            <button
              type="button"
              onClick={() => void openItemPreview()}
              disabled={previewPending}
              aria-label={`Open preview for ${item.name}`}
              title="Open preview"
              className="cursor-pointer hover:underline disabled:opacity-50"
            >
              {item.name}
            </button>
            {/* Phase 8.5 / Session H6 round 4 (Mashu
                2026-08-03): CHECKBOX-CONFIRM quantity
                pattern. The instant-save version was
                wonky — typing into the field triggered
                SC refreshes that re-arranged cards, and
                the user couldn't cleanly delete and
                retype. Now the field has two modes:
                  - display mode (default): a "× N" pill
                    + a pencil edit button
                  - edit mode: a number input + a small
                    checkbox (save) + an X (cancel)
                The save fires only when the user clicks
                the checkbox. The input is a scratchpad;
                empty / non-numeric values are rejected
                with a toast and the input stays open. */}
            {editingQty ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-xs font-bold text-foreground"
                title="Type a positive integer, then click the checkbox to save."
              >
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  ×
                </span>
                <input
                  type="number"
                  min={1}
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleConfirmQuantity();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelQuantity();
                    }
                  }}
                  autoFocus
                  disabled={pending}
                  className="w-14 border-0 bg-transparent p-0 text-xs font-bold tabular-nums text-foreground outline-none"
                />
                {/* Confirm checkbox */}
                <button
                  type="button"
                  onClick={() => void handleConfirmQuantity()}
                  disabled={pending}
                  title="Save quantity"
                  aria-label="Save quantity"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                >
                  <Check className="size-3" />
                </button>
                {/* Cancel X */}
                <button
                  type="button"
                  onClick={handleCancelQuantity}
                  disabled={pending}
                  title="Cancel"
                  aria-label="Cancel quantity edit"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQtyInput(String(item.quantity));
                  setEditingQty(true);
                }}
                title="Edit quantity"
                aria-label="Edit quantity"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary/70"
              >
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  ×
                </span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  {item.quantity}
                </span>
                <Pencil className="size-3 text-muted-foreground" />
              </button>
            )}
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
          </div>

          {/* Phase 8.5 / Session H6 round 5 (Mashu 2026-08-03):
              per-card encumbrance metadata. The user wants
              size, load value, and equipped slots visible on
              every item card so the math is transparent without
              opening the preview. TINY items show the pouch
              rule explicitly. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            {/* Size chip */}
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
              Size:{" "}
              <span className="font-mono">
                {(item as { size?: CharacterSize }).size ?? "SMALL"}
              </span>
            </span>
            {/* Load value chip — TINY uses pouch rule */}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-foreground">
              Load:{" "}
              <span className="font-mono">
                {(item as { size?: CharacterSize }).size === "TINY"
                  ? Math.ceil(item.quantity / TINY_ITEMS_PER_POUCH)
                  : SIZE_LOAD[
                      (item as { size?: CharacterSize }).size ?? "SMALL"
                    ] * item.quantity}
              </span>
            </span>
            {/* Equipped slots chip */}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-foreground">
              Equipped slots:{" "}
              <span className="font-mono">
                {(() => {
                  const is2H = item.isTwoHanded === true;
                  const baseline = is2H ? 2 : 1;
                  const stored = item.slotCost ?? 1;
                  const effective = Math.max(baseline, stored);
                  return effective * item.quantity;
                })()}
              </span>
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
        {/* Phase 8.5 H6 round 5 (Mashu 2026-08-03):
            the standalone Preview button was removed.
            Clicking the item name (top of the card) opens
            the preview — same pattern as the cap cards.
            The user explicitly asked for the preview button
            to be gone so the card has two single-purpose
            buttons: Equip toggle + the name (preview). */}
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
