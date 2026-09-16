"use client";

// Live preview for the item being composed in ItemForm.

import { dispatchOpenPreview } from "@/lib/sandbox/slot-events";
import { SIZE_LOAD, computeLoad, type CharacterSize } from "@/lib/engine/encumbrance";
import { computeTransitiveBu } from "@/lib/engine/transitive-bu";
import { LiveRecipeCard, LivePrimitiveRules, LiveEffectRules, LiveMechanicalSummary, type LivePrimitive, type LivePrimitiveSlot, type LiveEffect } from "./live-recipe-card";

export type ItemFormState = {
  name: string;
  itemType: string;
  rarity: string;
  // Phase 8.5 / Session H1: item size for encumbrance.
  size: string;
  buCost: string;
  description: string;
  slotCost: string;
  /**
   * How many of this item a character holds. Default 1; consumables and
   * stackable types use higher values. The form doesn't restrict this
   * (per the user's spec) so any positive integer is valid.
   */
  quantity: string;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  // Phase 8.5 / Session H6 (Mashu 2026-08-03): carried but
  // never equipped. Character sheet ItemsTab hides the equip
  // button when this is true; the engine omits the item from
  // equip-slot accounting (Load still adds).
  isNotEquippable: boolean;
  isPublic: boolean;
  sourceOrigin: string;
  tags: string;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type ItemPrimitiveSlot = {
  primitiveId: number;
  /**
   * Per-slot mirror flag (Phase 7 Q-M-UX). Drives the BU debt at
   * template/character-creation time when this item is consumed.
   */
  isMirrored?: boolean | undefined;
  primitive: LivePrimitive;
};

export type ItemCapabilitySlot = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  description?: string | null;
  primitiveLinks?: LivePrimitiveSlot[];
  effects?: LiveEffect[];
};

export type ItemEffectSlot = LiveEffect;

export function ItemFormPreview({form, primitiveSlots, capabilitySlots, effectSlots}: {
  form:ItemFormState; primitiveSlots:ItemPrimitiveSlot[]; capabilitySlots:ItemCapabilitySlot[]; effectSlots:ItemEffectSlot[];
}) {
  const allSlots = [...primitiveSlots, ...effectSlots.flatMap(effect=>effect.primitiveLinks ?? []), ...capabilitySlots.flatMap(capability=>[...(capability.primitiveLinks ?? []), ...(capability.effects ?? []).flatMap(effect=>effect.primitiveLinks ?? [])])];
  const completeCost = effectSlots.every(effect=>effect.primitiveLinks !== undefined) && capabilitySlots.every(capability=>capability.primitiveLinks !== undefined && capability.effects !== undefined && capability.effects.every(effect=>effect.primitiveLinks !== undefined));
  const {transitiveBu} = computeTransitiveBu({primitiveLinks:allSlots});
  const extraBu = Math.max(0,Number(form.buCost)||0);
  const quantity = Math.max(1,Number(form.quantity)||1);
  const size = (Object.hasOwn(SIZE_LOAD,form.size) ? form.size : "SMALL") as CharacterSize;
  const load = computeLoad([{size,loadValue:SIZE_LOAD[size],quantity,slotCount:0,capacityBonus:0,ignoreLoadBonus:0,equipped:false}]);
  return <LiveRecipeCard name={form.name} kind="Item" icon={form} description={form.description} sourceOrigin={form.sourceOrigin} tags={form.tags} badges={<>
    <span data-tone="violet">{form.itemType}</span><span>{form.rarity}</span><span data-tone="teal">{form.isPublic ? "Public" : "Private draft"}</span><span>{transitiveBu+extraBu} BU{completeCost ? "" : " · loaded rules"}</span>
  </>}>
    <dl className="v12-live-item-facts"><div><dt>Equip slots</dt><dd>{form.isNotEquippable ? "Not equippable" : form.slotCost || "1"}</dd></div><div><dt>Total Load</dt><dd>{load}</dd></div><div><dt>Size</dt><dd>{size.toLowerCase()}</dd></div><div><dt>Quantity</dt><dd>×{quantity}</dd></div></dl>
    {size === "TINY" ? <p className="v12-live-note">Pouch system · 1,000 tiny items per Load.</p> : <p className="v12-live-note">{SIZE_LOAD[size]} Load per item.</p>}
    <div className="v12-live-badges">{form.isTwoHanded ? <span>Two-handed</span> : null}{form.isConsumable ? <span>Consumable</span> : null}{form.actsAsFocus ? <span>Focus</span> : null}{extraBu ? <span>Extra cost · {extraBu} BU</span> : null}</div>
    <LiveMechanicalSummary slots={allSlots} />
    <details className="v12-live-composition" open><summary>Item-augment primitives · {primitiveSlots.length}</summary><LivePrimitiveRules slots={primitiveSlots}/></details>
    {effectSlots.length ? <section className="v12-live-composition"><h3 className="v12-kicker">Granted effects · {effectSlots.length}</h3><LiveEffectRules effects={effectSlots}/></section> : null}
    {capabilitySlots.length ? <section className="v12-live-composition"><h3 className="v12-kicker">Granted capabilities · {capabilitySlots.length}</h3>{capabilitySlots.map((capability,index)=>{const capabilityBu=[...(capability.primitiveLinks ?? []),...(capability.effects ?? []).flatMap(effect=>effect.primitiveLinks ?? [])].reduce((sum,slot)=>sum+Math.abs(slot.primitive.buCost*(slot.quantity ?? 1)),0);return <article className="v12-live-effect" key={`${capability.id}:${index}`}><button type="button" className="v12-live-effect-open" onClick={()=>dispatchOpenPreview({targetType:"CAPABILITY",targetId:capability.id,label:capability.name})}><span className="v12-kicker">{capability.type} · {capability.sourceType}</span><strong>{capability.name}</strong><small>{capabilityBu} BU</small><span aria-hidden="true">↗</span></button><LivePrimitiveRules slots={capability.primitiveLinks ?? []}/><LiveEffectRules effects={capability.effects ?? []}/></article>})}</section> : null}
  </LiveRecipeCard>;
}
