"use client";

import { EntityPreview } from "@/components/preview/entity-preview";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { LiveEffect, LivePrimitiveSlot } from "./live-recipe-card";

/** Draft relations use the same shape and renderer as saved-entry previews. */
export function draftEffectLinks(effects: LiveEffect[]) {
  return effects.map((effect, sortOrder) => ({
    effectId: effect.id, sortOrder, slotLabel: null, notes: null,
    primitiveLinks: (effect.primitiveLinks ?? []).map(draftPrimitiveLink),
    effect: { ...effect, narrativeDescription: effect.narrativeDescription ?? null, sourceOrigin: null,
      primitiveLinks: (effect.primitiveLinks ?? []).map(draftPrimitiveLink) },
  }));
}

export function draftPrimitiveLink(slot: LivePrimitiveSlot) {
  return { ...slot, quantity: slot.quantity ?? 1 };
}

export function PhoneDraftPreview({ item }: { item: SandboxPreviewItem }) {
  return <div className="sw-phone-draft-preview">
    <h2 className="sw-phone-draft-title">{item.row.name || "Untitled build"}</h2>
    <EntityPreview item={item} variant="build" />
  </div>;
}
