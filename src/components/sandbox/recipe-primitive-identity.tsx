"use client";
import type { MouseEvent } from "react";
import { libraryFamilyGlyph } from "@/components/library/library-market-rail";
import { Markdown } from "@/components/ui/markdown";

/** The same primitive identity and readable rule inside every composite author. */
export function RecipePrimitiveIdentity({primitive}:{primitive:{id:number;name:string;category:string;mechanicalOutputText?:string|null;narrativeRule?:string|null}}) {
  const inspect=(event:MouseEvent<HTMLButtonElement>)=>{
    const detail={targetType:"PRIMITIVE",targetId:String(primitive.id),label:primitive.name};
    if(event.currentTarget.closest("[data-drawer-build]")) {
      window.dispatchEvent(new CustomEvent("sw-close-build-drawer"));
      window.setTimeout(()=>window.dispatchEvent(new CustomEvent("sw-sandbox-open-preview",{detail})),0);
      return;
    }
    window.dispatchEvent(new CustomEvent("sw-sandbox-open-preview",{detail}));
  };
  return <button type="button" className="v12-recipe-identity min-w-0 flex-1 text-left" onClick={inspect} aria-label={`View ${primitive.name}`}>
    <span className="v12-recipe-medallion" aria-hidden="true">{libraryFamilyGlyph(primitive.category)}</span>
    <div className="v12-recipe-copy min-w-0">
      <p className="v12-kicker">Direct · {primitive.category.replaceAll("_", " ")}</p>
      <h3>{primitive.name}</h3>
      {primitive.mechanicalOutputText ? <Markdown className="v12-recipe-mechanical">{primitive.mechanicalOutputText}</Markdown> : null}
    </div>
  </button>;
}
