"use client";

// Live preview for the template being composed in HeritageForm.

import { Markdown } from "@/components/ui/markdown";
import { dispatchOpenPreview } from "@/lib/sandbox/slot-events";
import { computeTransitiveBu } from "@/lib/engine/transitive-bu";
import { LiveRecipeCard, LivePrimitiveRules, LiveEffectRules, LiveMechanicalSummary, type LivePrimitiveSlot, type LiveEffect } from "./live-recipe-card";

export type HeritageFormState = {
  kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  name: string;
  imageUrl: string;
  description: string;
  suggestedTraits: string;
  isPublic: boolean;
  // Phase 8 rev 10: heritage parity — items/capabilities/effects already
  // carry `tags` and `sourceOrigin`; heritage was the last holdout.
  // Stored as a comma-separated string in the form (matches the
  // item-form pattern at item-form.tsx:643) and split on submit.
  sourceOrigin: string;
  tags: string;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type TemplateSlot = {
  isMirrored?: boolean;
  id: number | string;
  name: string;
  category: string;
  buCost: number;
  mechanicalOutputText?: string | null;
  narrativeRule?: string | null;
  description?: string | null;
  primitiveLinks?: LivePrimitiveSlot[];
  effects?: LiveEffect[];
};

function kindLabel(kind: string): string {
  if (kind === "LINEAGE") return "Lineage";
  if (kind === "UPBRINGING") return "Upbringing";
  if (kind === "MANIFEST") return "Manifest";
  return kind;
}

export function HeritageFormPreview({form, primitives, capabilities}: {
  form: HeritageFormState; primitives: TemplateSlot[]; capabilities: TemplateSlot[];
}) {
  const directSlots = primitives.map(primitive => ({primitiveId:Number(primitive.id), ...(primitive.isMirrored !== undefined ? {isMirrored:primitive.isMirrored}:{}), primitive:{...primitive,id:Number(primitive.id)}}));
  const allSlots = [...directSlots, ...capabilities.flatMap(capability => [...(capability.primitiveLinks ?? []), ...(capability.effects ?? []).flatMap(effect => effect.primitiveLinks ?? [])])];
  const completeCost = capabilities.every(capability => capability.primitiveLinks !== undefined && capability.effects !== undefined && capability.effects.every(effect => effect.primitiveLinks !== undefined));
  const {transitiveBu} = computeTransitiveBu({primitiveLinks: allSlots});
  return <LiveRecipeCard name={form.name} kind={kindLabel(form.kind)} icon={form} description={form.description} sourceOrigin={form.sourceOrigin} tags={form.tags} badges={<>
    <span data-tone="violet">{kindLabel(form.kind)}</span><span data-tone="teal">{form.isPublic ? "Public" : "Private draft"}</span><span>{transitiveBu} BU{completeCost ? "" : " · loaded rules"}</span>
  </>}>
    {form.imageUrl ? <img src={form.imageUrl} alt={form.name} className="v12-live-portrait" /> : null}
    <LiveMechanicalSummary slots={allSlots} />
    {capabilities.length ? <section className="v12-live-composition"><h3 className="v12-kicker">Granted capabilities · {capabilities.length}</h3>{capabilities.map((capability,index)=>{const capabilityBu=[...(capability.primitiveLinks ?? []),...(capability.effects ?? []).flatMap(effect=>effect.primitiveLinks ?? [])].reduce((sum,slot)=>sum+Math.abs(slot.primitive.buCost*(slot.quantity ?? 1)),0);return <article className="v12-live-effect" key={`${capability.id}:${index}`}><button type="button" className="v12-live-effect-open" onClick={()=>dispatchOpenPreview({targetType:"CAPABILITY",targetId:String(capability.id),label:capability.name})}><span className="v12-kicker">Capability · {capability.category}</span><strong>{capability.name}</strong><small>{capabilityBu} BU</small><span aria-hidden="true">↗</span></button>
      <LivePrimitiveRules slots={capability.primitiveLinks ?? []} /><LiveEffectRules effects={capability.effects ?? []} />
      {capability.isMirrored ? <p className="v12-live-note">Mirrored</p> : null}
    </article>})}</section> : null}
    <details className="v12-live-composition" open><summary>Direct {kindLabel(form.kind).toLowerCase()} primitives · {directSlots.length}</summary><LivePrimitiveRules slots={directSlots} />{!directSlots.length ? <p className="v12-live-note">No direct primitives added.</p> : null}</details>
    {form.suggestedTraits ? <section className="v12-live-composition"><h3 className="v12-kicker">Suggested traits</h3><Markdown>{form.suggestedTraits}</Markdown></section> : null}
  </LiveRecipeCard>;
}
