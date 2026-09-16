"use client";

import type { MouseEvent } from "react";
import { Markdown } from "@/components/ui/markdown";

export type RecipePrimitive = { id: number; name: string; category?: string; buCost: number; mechanicalOutputText?: string | null; narrativeRule?: string | null };
export type RecipePrimitiveLink = { primitiveId: number; quantity?: number; primitive: RecipePrimitive };
export type RecipeEffectLink = { effectId: string; effect: { name: string; narrativeDescription?: string | null; primitiveLinks?: RecipePrimitiveLink[] } };

export function primitiveLinksBu(links: RecipePrimitiveLink[] | undefined): number {
  return (links ?? []).reduce((sum, link) => sum + Math.abs(link.primitive.buCost * (link.quantity ?? 1)), 0);
}

export function recipeCompositionBu(primitiveLinks: RecipePrimitiveLink[] | undefined, effectLinks: RecipeEffectLink[] | undefined): number {
  return primitiveLinksBu(primitiveLinks) + (effectLinks ?? []).reduce((sum, link) => sum + primitiveLinksBu(link.effect.primitiveLinks), 0);
}

function PrimitiveRule({ link, index }: { link: RecipePrimitiveLink; index: number }) {
  return <button type="button" className="v12-nested-rule text-left" onClick={(event) => openPreview(event, "PRIMITIVE", String(link.primitiveId), link.primitive.name)} aria-label={`Open ${link.primitive.name}`}>
    <b>{link.primitive.name}</b>
    <small>{link.primitive.buCost} BU{(link.quantity ?? 1) > 1 ? ` × ${link.quantity}` : ""}</small>
    {link.primitive.mechanicalOutputText ? <Markdown className="v12-recipe-mechanical">{link.primitive.mechanicalOutputText}</Markdown> : null}
    <span className="sr-only">Rule {index + 1}</span>
  </button>;
}

function openPreview(event: MouseEvent<HTMLElement>, targetType: string, targetId: string, label: string) {
  event.stopPropagation();
  const detail = { targetType, targetId, label };
  if (event.currentTarget.closest("[data-drawer-build]")) {
    window.dispatchEvent(new CustomEvent("sw-close-build-drawer"));
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("sw-sandbox-open-preview", { detail })), 0);
  } else {
    window.dispatchEvent(new CustomEvent("sw-sandbox-open-preview", { detail }));
  }
}

export function RecipeComposition({ id, primitiveLinks, effectLinks }: { id: string; primitiveLinks?: RecipePrimitiveLink[]; effectLinks?: RecipeEffectLink[] }) {
  return <div className="v12-recipe-composition" data-capability-id={id}>
    {primitiveLinks?.map((link, index) => <PrimitiveRule link={link} index={index} key={`${link.primitiveId}:${index}`} />)}
    {effectLinks?.map((link, index) => <div key={`${link.effectId}:${index}`} className="v12-recipe-effect-group">
      <button type="button" className="v12-recipe-effect text-left" onClick={(event) => openPreview(event, "EFFECT", link.effectId, link.effect.name)} aria-label={`Open ${link.effect.name}`}>
        <small>Effect</small><b>{link.effect.name}</b><small>{primitiveLinksBu(link.effect.primitiveLinks)} BU · {link.effect.primitiveLinks?.length ?? 0} {(link.effect.primitiveLinks?.length ?? 0) === 1 ? "primitive" : "primitives"}</small>
      </button>
      {link.effect.primitiveLinks?.map((primitiveLink, primitiveIndex) => <PrimitiveRule link={primitiveLink} index={primitiveIndex} key={`${link.effectId}:${primitiveLink.primitiveId}:${primitiveIndex}`} />)}
    </div>)}
  </div>;
}

export function RecipeEntryDetails({targetType,id,label}:{targetType:string;id:string;label:string}) {
  return <button type="button" className="v12-recipe-open-card" onClick={(event)=>openPreview(event,targetType,id,label)} aria-label={`Open ${label}`} title={`Open ${label}`}>↗</button>;
}

export function RecipeEntityIdentity({targetType,id,kicker,name,buCost}:{targetType:"CAPABILITY"|"EFFECT";id:string;kicker:string;name:string;buCost:number}) {
  return <button type="button" className="v12-recipe-entity-identity min-w-0 flex-1 text-left hover:text-primary focus-visible:text-primary" onClick={(event)=>openPreview(event,targetType,id,name)} aria-label={`Open ${name}`}>
    <span className="v12-kicker">{kicker}</span>
    <span className="flex min-w-0 items-start justify-between gap-2"><strong className="min-w-0 truncate font-normal">{name}</strong><small className="shrink-0">{buCost} BU</small></span>
  </button>;
}
