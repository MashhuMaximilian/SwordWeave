"use client";
import { useCharacterReadOnly } from "./character-read-only";
import { EditableNumberInput } from "@/components/ui/editable-number-input";

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
import type { VersionKey } from "@/lib/versions/version-key";
import {
  SIZE_LOAD,
  TINY_ITEMS_PER_POUCH,
  type CharacterSize,
} from "@/lib/engine/encumbrance";
import type { SlotSource } from "@/db/schema/characters";
import { ItemCapabilityToggle } from "@/components/characters/item-capability-toggle";
import { useEntityPreview } from "@/components/characters/preview-modal";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import {
  CompactCompositeCard,
  CompactHierarchyBranch,
  CompactPrimitiveCard,
} from "@/components/characters/compact-hierarchy";

interface EquipResponse {
  character: { id: string; itemId: string };
  equipped: boolean;
  note?: string;
}

export interface ItemCardProps {
  characterId: string;
  displayRole?: "equipped" | "gear" | "pack";
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
  // Phase 8.5 / Session H6 round 10 (Mashu
  // 2026-08-03): the latest-version map from
  // bulkResolveLatestVersions. Used to render
  // "Pinned v:XXXX" chips on every nested
  // cap/effect/primitive inside the item's
  // CAPABILITIES / EFFECTS / PRIMITIVES
  // accordions — without this, the nested chips
  // rendered a hardcoded "Pinned" without a
  // version number, even though every cap /
  // effect / primitive has a v1 version row.
  latestVersions?: Map<VersionKey, string> | undefined;
}

type ItemNestedPrimitive = {
  primitiveId: number;
  quantity?: number | null;
  primitive: {
    id: number;
    name: string;
    category?: string | null;
    buCost?: number | null;
    narrativeRule?: string | null;
    mechanicalOutputText?: string | null;
  };
};

function primitiveLinkBu(link: ItemNestedPrimitive): number {
  return Math.abs((link.primitive.buCost ?? 0) * (link.quantity ?? 1));
}

function effectCompositionBu(effect: ItemNestedEffect["effect"]): number {
  return (effect.primitiveLinks ?? []).reduce(
    (total, primitiveLink) => total + primitiveLinkBu(primitiveLink),
    0,
  );
}

type ItemNestedEffect = {
  effectId: string;
  effect: {
    id: string;
    name: string;
    description?: string | null;
    narrativeDescription?: string | null;
    primitiveLinks?: ItemNestedPrimitive[];
  };
};

function ItemPrimitiveCompositionRow({
  link,
  onOpen,
}: {
  link: ItemNestedPrimitive;
  onOpen: (primitiveId: number) => void;
}) {
  const mechanicalRule = link.primitive.mechanicalOutputText;
  const narrativeRule = link.primitive.narrativeRule;
  return (
    <CompactPrimitiveCard
      name={link.primitive.name}
      mechanicalText={mechanicalRule}
      narrativeText={narrativeRule}
      onOpen={() => onOpen(link.primitiveId)}
    />
  );
}

function ItemEffectComposition({
  link,
  onOpenEffect,
  onOpenPrimitive,
  hydrate = false,
}: {
  link: ItemNestedEffect;
  onOpenEffect: (effectId: string) => void;
  onOpenPrimitive: (primitiveId: number) => void;
  hydrate?: boolean;
}) {
  const [hydrated, setHydrated] = useState<ItemNestedEffect["effect"] | null>(null);

  useEffect(() => {
    const suppliedPrimitives = link.effect.primitiveLinks ?? [];
    const hasCompletePrimitiveRows = suppliedPrimitives.length > 0 && suppliedPrimitives.every(
      (primitiveLink) => primitiveLink.primitive.category !== undefined,
    );
    if (!hydrate || hasCompletePrimitiveRows) return;
    let cancelled = false;
    void fetch(`/api/effects/${encodeURIComponent(link.effectId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { effect?: ItemNestedEffect["effect"] } | null) => {
        if (!cancelled && payload?.effect) setHydrated(payload.effect);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [hydrate, link.effect.primitiveLinks, link.effectId]);

  const effect = hydrated ?? link.effect;
  const description = effect.narrativeDescription ?? effect.description;
  const primitiveLinks = effect.primitiveLinks ?? [];
  const effectBu = effectCompositionBu(effect);
  return (
    <CompactCompositeCard
      kind="effect"
      name={effect.name}
      cost={effectBu}
      state="Active"
      description={description}
      onOpen={() => onOpenEffect(link.effectId)}
    >
      {primitiveLinks.length > 0 && (
        <CompactHierarchyBranch label="Primitives" count={primitiveLinks.length} tone="teal">
            {primitiveLinks.map((primitiveLink) => (
              <ItemPrimitiveCompositionRow
                key={primitiveLink.primitiveId}
                link={primitiveLink}
                onOpen={onOpenPrimitive}
              />
            ))}
        </CompactHierarchyBranch>
      )}
    </CompactCompositeCard>
  );
}

function ItemCapabilityComposition({
  link,
  characterId,
  itemId,
  onOpenCapability,
  onOpenEffect,
  onOpenPrimitive,
}: {
  link: NonNullable<ItemCardProps["nested"]>["capabilityLinks"][number];
  characterId: string;
  itemId: string;
  onOpenCapability: (capabilityId: string) => void;
  onOpenEffect: (effectId: string) => void;
  onOpenPrimitive: (primitiveId: number) => void;
}) {
  const [composition, setComposition] = useState<{
    effectLinks?: ItemNestedEffect[];
    primitiveLinks?: ItemNestedPrimitive[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/capabilities/${encodeURIComponent(link.capabilityId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { capability?: { effectLinks?: ItemNestedEffect[]; primitiveLinks?: ItemNestedPrimitive[] } } | null) => {
        if (!cancelled && payload?.capability) setComposition(payload.capability);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [link.capabilityId]);

  const effects: ItemNestedEffect[] = composition?.effectLinks ?? link.capability.effectLinks;
  const directPrimitives = composition?.primitiveLinks ?? [];
  const capabilityBu = directPrimitives.reduce(
    (total, primitiveLink) => total + primitiveLinkBu(primitiveLink),
    effects.reduce((total, effectLink) => total + effectCompositionBu(effectLink.effect), 0),
  );
  return (
    <CompactCompositeCard
      kind="capability"
      name={link.capability.name}
      cost={capabilityBu}
      state={link.capability.type}
      description={link.capability.verboseDescription}
      onOpen={() => onOpenCapability(link.capabilityId)}
      collapsible
      defaultExpanded
      actions={<ItemCapabilityToggle itemId={itemId} characterId={characterId} capability={link.capability} />}
    >
      {(effects.length > 0 || directPrimitives.length > 0) && (
        <div className="v12-canonical-composition">
          {directPrimitives.length > 0 && (
            <CompactHierarchyBranch className="v12-expression-direct" label="Direct primitives" count={directPrimitives.length} tone="teal">
              {directPrimitives.map((primitiveLink) => (
                <ItemPrimitiveCompositionRow
                  key={primitiveLink.primitiveId}
                  link={primitiveLink}
                  onOpen={onOpenPrimitive}
                />
              ))}
            </CompactHierarchyBranch>
          )}
          {effects.length > 0 && (
            <CompactHierarchyBranch label="Effects" count={effects.length} tone="copper">
                {effects.map((effectLink) => (
                  <ItemEffectComposition
                    key={effectLink.effectId}
                    link={effectLink}
                    onOpenEffect={onOpenEffect}
                    onOpenPrimitive={onOpenPrimitive}
                    hydrate
                  />
                ))}
            </CompactHierarchyBranch>
          )}
        </div>
      )}
    </CompactCompositeCard>
  );
}

export function ItemCard({
  characterId,
  displayRole = "gear",
  item,
  atCapacity = false,
  nested,
}: ItemCardProps) {
  const readOnly = useCharacterReadOnly();
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
          // Phase 8.5 / Session H6 round 8 (Mashu
          // 2026-08-03): round 7 used
          // `/atelier/item/${id}` which 404s. Switched
          // to the canonical `/library/item/ITEM:<id>`
          // URL that the library page accepts.
          openSourceHref: `/library/item/ITEM:${item.id}`,
          versionHistoryHref: `/library/item/ITEM:${item.id}/versions`,
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
          // Phase 8.5 / Session H6 round 11 (Mashu
          // 2026-08-03): the preview modal must include
          // the source + version-history buttons so the
          // nested item-cap preview matches the slot
          // preview on the regular character sheet.
          actionBar: {
            openSourceHref: `/library/item/CAPABILITY:${capabilityId}`,
            versionHistoryHref: `/library/item/CAPABILITY:${capabilityId}/versions`,
          },
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
          // Phase 8.5 / Session H6 round 11 (Mashu
          // 2026-08-03): same source/version-history
          // wiring as the cap preview handler above.
          actionBar: {
            openSourceHref: `/library/item/PRIMITIVE:${primitiveId}`,
            versionHistoryHref: `/library/item/PRIMITIVE:${primitiveId}/versions`,
          },
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
          // Phase 8.5 / Session H6 round 11 (Mashu
          // 2026-08-03): same source/version-history
          // wiring as the cap / primitive handlers
          // above.
          actionBar: {
            openSourceHref: `/library/item/EFFECT:${effectId}`,
            versionHistoryHref: `/library/item/EFFECT:${effectId}/versions`,
          },
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
    if (readOnly || pending) return;
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
  }, [pending, qtyInput, item.quantity, item.id, item.name, characterId, router, showToast, readOnly]);

  // Cancel button: reverts the input to the server value
  // and exits edit mode without saving.
  const handleCancelQuantity = useCallback(() => {
    setQtyInput(String(item.quantity));
    setEditingQty(false);
  }, [item.quantity]);

  const handleToggleEquip = useCallback(async () => {
    if (readOnly || pending) return;
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
    readOnly,
    pending,
    showToast,
  ]);

  const itemSize = (item as { size?: CharacterSize }).size ?? "SMALL";
  const itemLoad = itemSize === "TINY"
    ? Math.ceil(item.quantity / TINY_ITEMS_PER_POUCH)
    : SIZE_LOAD[itemSize] * item.quantity;
  const equippedSlots = Math.max(item.isTwoHanded ? 2 : 1, item.slotCost ?? 1) * item.quantity;
  const constructionCount = nested
    ? nested.capabilityLinks.length + nested.effectLinks.length + nested.primitiveLinks.length
    : 0;

  const quantityControl = editingQty ? (
    <span className="v12-item-quantity is-editing" title="Type a positive integer, then confirm.">
      <span aria-hidden="true">×</span>
      <EditableNumberInput
        type="number"
        min={1}
        value={qtyInput}
        onChange={(e) => setQtyInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void handleConfirmQuantity(); }
          if (e.key === "Escape") { e.preventDefault(); handleCancelQuantity(); }
        }}
        autoFocus
        disabled={pending}
        aria-label="Item quantity"
      />
      <button type="button" onClick={() => void handleConfirmQuantity()} disabled={pending} title="Save quantity" aria-label="Save quantity"><Check /></button>
      <button type="button" onClick={handleCancelQuantity} disabled={pending} title="Cancel" aria-label="Cancel quantity edit"><X /></button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => { setQtyInput(String(item.quantity)); setEditingQty(true); }}
      disabled={readOnly}
      title={readOnly ? "Quantity" : "Edit quantity"}
      aria-label={readOnly ? "Quantity" : "Edit quantity"}
      className="v12-item-quantity"
    >
      <span aria-hidden="true">×</span><b>{item.quantity}</b><Pencil />
    </button>
  );

  return (
    <div
      data-item-kind={item.itemType.toLowerCase()}
      data-inventory-role={displayRole}
      data-has-construction={constructionCount > 0}
      className={cn(
        "v12-inventory-card v12-item-dossier transition-colors",
        optimisticEquipped && "is-equipped",
      )}
    >
      <div className="v12-item-spine" aria-hidden="true">
        <span className="v12-item-glyph">{item.itemType.slice(0, 1).toUpperCase()}</span>
        <span className="v12-item-spine-line" />
        <small>{optimisticEquipped ? "READY" : displayRole === "pack" ? "PACK" : "GEAR"}</small>
      </div>

      <div className="v12-item-core">
        <header className="v12-item-identity">
          <div className="v12-item-heading-copy">
            <p className="v12-item-classification">{optimisticEquipped ? "Readied equipment" : item.isNotEquippable || item.isConsumable ? "Pack inventory" : "Carried equipment"}</p>
            <h4 className="v12-item-title">
              <button type="button" onClick={() => void openItemPreview()} disabled={previewPending} aria-label={`Open preview for ${item.name}`} title="Open preview">
                {item.name}
              </button>
              {quantityControl}
            </h4>
            <p className="v12-item-meta">
              <span>{item.rarity}</span>
              {item.isTwoHanded && <span>Two-handed</span>}
              {item.isConsumable && <span>Consumable</span>}
            </p>
          </div>
          <span className="v12-item-type">{item.itemType}</span>
        </header>

        <div className="v12-item-readings" aria-label="Item measurements">
          <span><small>SIZE</small><b>{itemSize}</b></span>
          <span><small>LOAD</small><b>{itemLoad}</b></span>
          {!item.isNotEquippable && <span><small>SLOTS</small><b>{equippedSlots}</b></span>}
          <span><small>BUILD</small><b>{constructionCount}</b></span>
        </div>

        {item.description && <Markdown className="v12-inventory-description line-clamp-2">{item.description}</Markdown>}

        <div className="v12-item-command-rail">
          <div className="v12-item-version">
            <SlotSourceBadge
              slotSource={item.slotSource}
              versionId={item.versionId}
              latestVersionId={item.latestVersionId}
              targetType="ITEM"
              targetId={item.id}
              characterId={characterId}
              slotKind="item"
              slotEntityId={item.id}
            />
          </div>
          <div className="v12-item-actions">
            {!item.isNotEquippable ? (
              <button
                type="button"
                onClick={handleToggleEquip}
                disabled={readOnly || pending || (!optimisticEquipped && atCapacity)}
                aria-pressed={optimisticEquipped}
                title={!optimisticEquipped && atCapacity ? "Equip slots are full — unequip something first" : optimisticEquipped ? "Click to unequip" : "Click to equip"}
              >
                {optimisticEquipped ? <Shield /> : <ShieldOff />}
                {pending ? (optimisticEquipped ? "Unequipping…" : "Equipping…") : optimisticEquipped ? "Equipped" : "Equip"}
              </button>
            ) : (
              <span className="v12-item-carried-state">Carried only</span>
            )}
          </div>
        </div>
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
          <details className="v12-inventory-construction">
            <summary>
              <span>Granted abilities &amp; construction</span>
              <b>
                {nested.capabilityLinks.length + nested.effectLinks.length + nested.primitiveLinks.length}
              </b>
            </summary>
            <div className="v12-inventory-construction-body v12-item-composition">
              {nested.capabilityLinks.length > 0 && (
                <section className="v12-item-composition-group">
                  <h5>Capabilities <span>{nested.capabilityLinks.length}</span></h5>
                  <div className="v12-item-composition-stack">
                    {nested.capabilityLinks.map((cl) => (
                      <ItemCapabilityComposition
                        key={cl.capabilityId}
                        link={cl}
                        characterId={characterId}
                        itemId={item.id}
                        onOpenCapability={openCapabilityPreview}
                        onOpenEffect={openEffectPreview}
                        onOpenPrimitive={openPrimitivePreview}
                      />
                    ))}
                  </div>
                </section>
              )}
              {nested.effectLinks.length > 0 && (
                <section className="v12-item-composition-group">
                  <h5>Effects <span>{nested.effectLinks.length}</span></h5>
                  <div className="v12-item-composition-stack">
                    {nested.effectLinks.map((el) => (
                      <ItemEffectComposition
                        key={el.effectId}
                        link={el}
                        onOpenEffect={openEffectPreview}
                        onOpenPrimitive={openPrimitivePreview}
                        hydrate
                      />
                    ))}
                  </div>
                </section>
              )}
              {nested.primitiveLinks.length > 0 && (
                <section className="v12-item-composition-group">
                  <h5>Primitives <span>{nested.primitiveLinks.length}</span></h5>
                  <div className="v12-item-composition-stack is-rules v12-canonical-primitive-list">
                    {nested.primitiveLinks.map((pl) => (
                      <ItemPrimitiveCompositionRow
                        key={pl.primitiveId}
                        link={pl}
                        onOpen={openPrimitivePreview}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </details>
        )}
    </div>
  );
}
