"use client";

import { useCharacterAuthoring } from "./character-authoring-context";
import { VisibilitySelect } from "@/components/library/visibility-select";
import { useState, useEffect, useId } from "react";

type AuthorPublishFieldsProps = {
  sourceCollectionId?: string | null;
  onSourceCollectionChange?: (id:string|null)=>void;
  tags: string;
  sourceOrigin: string;
  isPublic: boolean;
  onTagsChange: (value: string) => void;
  onSourceOriginChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  tagsPlaceholder?: string;
  sourcePlaceholder?: string;
};

/** Shared publishing controls for every Atelier entity author. */
export function AuthorPublishFields({
  sourceCollectionId,
  onSourceCollectionChange,
  tags,
  sourceOrigin,
  isPublic,
  onTagsChange,
  onSourceOriginChange,
  onPublicChange,
  tagsPlaceholder = "fire, ranged, condition",
  sourcePlaceholder = "World, book, or setting",
}: AuthorPublishFieldsProps) {
  const [sourceCollections,setSourceCollections]=useState<{id:string;name:string}[]>([]);
  useEffect(()=>{fetch("/api/collections?own=true").then(r=>r.json()).then(d=>setSourceCollections((d.collections??[]).filter((c:{system_kind:string|null})=>!c.system_kind))).catch(()=>{});},[]);
  const visibilityLabelId = useId();
  const characterAuthoring = useCharacterAuthoring();
  if (characterAuthoring) return <section className="v12-character-author-finish">
    <h3>Ready for {characterAuthoring.destinationLabel}</h3>
    <p>{characterAuthoring.isEditing ? "Update" : "Add to"} your draft using the button below. You can review the rule, its placement, and the complete budget before applying changes.</p>
    <p>This stays within the character. It is not published to the Library.</p>
  </section>;
  return (
    <div className="v12-author-publish">
      <section
        className="v12-publish-visibility"
        aria-labelledby={visibilityLabelId}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 id={visibilityLabelId}>Visibility</h3>
            <p>Controls who can find this entry in the Library.</p>
          </div>
          <VisibilitySelect compact value={isPublic ? "PUBLIC" : "PRIVATE"} onChange={(next) => onPublicChange(next === "PUBLIC")} />
        </div>
      </section>
      <div className="v12-publish-supporting">
        <label className="v12-publish-field">
          Tags
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Comma-separated
          </span>
          <input
            className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={tags}
            onChange={(event) => onTagsChange(event.target.value)}
            placeholder={tagsPlaceholder}
          />
        </label>

        <label className="v12-publish-field">
          Source
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            World, book, or setting
          </span>
          <input
            className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            disabled={!!sourceCollectionId}
            value={sourceOrigin}
            onChange={(event) => onSourceOriginChange(event.target.value)}
            placeholder={sourcePlaceholder}
          />
          {onSourceCollectionChange&&<select aria-label="Source collection" value={sourceCollectionId??""} onChange={e=>onSourceCollectionChange(e.target.value||null)} className="mt-2 w-full rounded border bg-background p-2 text-sm"><option value="">Free text source</option>{sourceCollections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        </label>
      </div>
    </div>
  );
}
