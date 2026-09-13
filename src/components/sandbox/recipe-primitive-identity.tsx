"use client";
import { useState } from "react";
import { libraryFamilyGlyph, libraryFamilyLabel } from "@/components/library/library-market-rail";
import { FetchedEntityPreview } from "@/components/preview/entity-preview";

/** The same primitive identity and readable rule inside every composite author. */
export function RecipePrimitiveIdentity({primitive}:{primitive:{id:number;name:string;category:string;mechanicalOutputText?:string|null;narrativeRule?:string|null}}) {
  const [inspect,setInspect]=useState(false);
  return <div className="v12-recipe-identity min-w-0 flex-1">
    <span className="v12-recipe-medallion" aria-hidden="true">{libraryFamilyGlyph(primitive.category)}</span>
    <div className="v12-recipe-copy min-w-0">
      <p className="v12-kicker">Direct primitive</p>
      <h3>{primitive.name}</h3>
      {primitive.mechanicalOutputText ? <p data-readable-rule>{primitive.mechanicalOutputText}</p> : primitive.narrativeRule ? <p data-readable-rule>{primitive.narrativeRule}</p> : null}
      <p className="v12-recipe-family">{libraryFamilyLabel({value:primitive.category,label:primitive.category})}</p>
      <details onToggle={event=>setInspect(event.currentTarget.open)}>
        <summary>Full primitive details</summary>
        {primitive.mechanicalOutputText && primitive.narrativeRule && primitive.narrativeRule !== primitive.mechanicalOutputText ? <p>{primitive.narrativeRule}</p> : null}
        {inspect ? <FetchedEntityPreview targetType="PRIMITIVE" targetId={String(primitive.id)}/> : null}
      </details>
    </div>
  </div>;
}
