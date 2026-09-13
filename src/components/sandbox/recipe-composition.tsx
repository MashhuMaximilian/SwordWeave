"use client";
import { useState } from "react";
import { FetchedEntityPreview } from "@/components/preview/entity-preview";

export type RecipePrimitive = { id: number; name: string; category?: string; buCost: number; mechanicalOutputText?: string | null; narrativeRule?: string | null };
export type RecipePrimitiveLink = { primitiveId: number; quantity?: number; primitive: RecipePrimitive };
export type RecipeEffectLink = { effectId: string; effect: { name: string; narrativeDescription?: string | null; primitiveLinks?: RecipePrimitiveLink[] } };

export function RecipeComposition({ id, primitiveLinks, effectLinks }: { id: string; primitiveLinks?: RecipePrimitiveLink[]; effectLinks?: RecipeEffectLink[] }) {
  const [inspect, setInspect] = useState(false);
  return <div className="v12-recipe-composition">
    {primitiveLinks?.map((link, index) => <div className="v12-nested-rule" key={`${link.primitiveId}:${index}`}><span>{link.primitive.buCost} BU{(link.quantity ?? 1) > 1 ? ` × ${link.quantity}` : ""}</span><b>{link.primitive.name}</b><p data-readable-rule>{link.primitive.mechanicalOutputText || link.primitive.narrativeRule}</p></div>)}
    {effectLinks?.map((link, index) => <details key={`${link.effectId}:${index}`} className="v12-recipe-effect"><summary>Effect · {link.effect.name}{link.effect.primitiveLinks ? ` · ${link.effect.primitiveLinks.length} primitive${link.effect.primitiveLinks.length === 1 ? "" : "s"}` : ""}</summary>{link.effect.narrativeDescription ? <p>{link.effect.narrativeDescription}</p> : null}{link.effect.primitiveLinks?.map((primitive, childIndex) => <div className="v12-nested-rule" key={`${primitive.primitiveId}:${childIndex}`}><b>{primitive.primitive.name}</b><span>{primitive.primitive.buCost} BU{(primitive.quantity ?? 1) > 1 ? ` × ${primitive.quantity}` : ""}</span><p data-readable-rule>{primitive.primitive.mechanicalOutputText || primitive.primitive.narrativeRule}</p></div>)}</details>)}
    <details onToggle={event => setInspect(event.currentTarget.open)}><summary>Full capability details</summary>{inspect ? <FetchedEntityPreview targetType="CAPABILITY" targetId={id} /> : null}</details>
  </div>;
}
