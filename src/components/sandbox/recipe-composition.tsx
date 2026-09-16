"use client";

import type { MouseEvent } from "react";
import { Markdown } from "@/components/ui/markdown";

export type RecipePrimitive = { id: number; name: string; category?: string; buCost: number; mechanicalOutputText?: string | null; narrativeRule?: string | null };
export type RecipePrimitiveLink = { primitiveId: number; quantity?: number; primitive: RecipePrimitive };
export type RecipeEffectLink = { effectId: string; effect: { name: string; narrativeDescription?: string | null; primitiveLinks?: RecipePrimitiveLink[] } };

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
  return <button type="button" className="v12-recipe-composition" onClick={(event) => openPreview(event, "CAPABILITY", id, "Capability details")}>
    {primitiveLinks?.map((link, index) => <span className="v12-nested-rule" key={`${link.primitiveId}:${index}`}><b>{link.primitive.name}</b><small>{link.primitive.buCost} BU{(link.quantity ?? 1) > 1 ? ` × ${link.quantity}` : ""}</small>{link.primitive.mechanicalOutputText ? <Markdown className="v12-recipe-mechanical">{link.primitive.mechanicalOutputText}</Markdown> : null}</span>)}
    {effectLinks?.map((link, index) => <span key={`${link.effectId}:${index}`} className="v12-recipe-effect"><small>Effect</small><b>{link.effect.name}</b><small>{link.effect.primitiveLinks?.length ?? 0} primitives</small></span>)}
  </button>;
}

export function RecipeEntryDetails({targetType,id,label}:{targetType:string;id:string;label:string}) {
  return <button type="button" className="v12-recipe-open-card" onClick={(event)=>openPreview(event,targetType,id,label)} aria-label={`Open ${label}`} title={`Open ${label}`}>↗</button>;
}
