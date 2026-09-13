"use client";

// Live preview for the effect being composed in EffectForm.
// Reads the current form state + slotted primitives and renders a read-only card.
// Empty state when no fields are filled in.

import { LiveRecipeCard, LivePrimitiveRules, LiveMechanicalSummary, type LivePrimitive } from "./live-recipe-card";

export type EffectFormState = {
  name: string;
  narrativeDescription: string;
  sourceOrigin: string;
  tags: string;
  isPublic: boolean;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type SlottedPrimitive = {
  primitiveId: number;
  quantity: number;
  /**
   * Per-slot mirror flag (Phase 7 Q-M-UX). Drives the BU debt at
   * template/character-creation time when this effect is consumed.
   * Optional so older snapshots without the field still render.
   */
  isMirrored?: boolean | undefined;
  primitive: LivePrimitive;
};

export function EffectFormPreview({ form, slots }: { form: EffectFormState; slots: SlottedPrimitive[] }) {
  const totalBu = slots.reduce((sum, slot) => sum + Math.abs(slot.primitive.buCost * slot.quantity), 0);
  return <LiveRecipeCard name={form.name} kind="Effect" icon={form} description={form.narrativeDescription} sourceOrigin={form.sourceOrigin} tags={form.tags} badges={<>
    <span data-tone="violet">Reusable effect</span><span data-tone="teal">{form.isPublic ? "Public" : "Private draft"}</span><span>{totalBu} BU</span>
  </>}>
    <LiveMechanicalSummary slots={slots} />
    <details className="v12-live-composition" open><summary>Composition · {slots.length} primitive rules</summary><LivePrimitiveRules slots={slots} />{!slots.length ? <p className="v12-live-note">Add primitives from the Library to compose this effect.</p> : null}</details>
  </LiveRecipeCard>;
}
