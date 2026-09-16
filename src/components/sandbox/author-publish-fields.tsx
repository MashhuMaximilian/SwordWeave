"use client";

import { VisibilitySelect } from "@/components/library/visibility-select";
import { useId } from "react";

type AuthorPublishFieldsProps = {
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
  tags,
  sourceOrigin,
  isPublic,
  onTagsChange,
  onSourceOriginChange,
  onPublicChange,
  tagsPlaceholder = "fire, ranged, condition",
  sourcePlaceholder = "World, book, or setting",
}: AuthorPublishFieldsProps) {
  const visibilityLabelId = useId();
  return (
    <div className="v12-author-publish grid gap-3">
      <section
        className="v12-field-visibility rounded-lg border border-border bg-background p-2.5"
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
      <div className="v12-supporting-fields grid gap-3 sm:grid-cols-2">
        <label className="v12-field-market block text-sm font-medium">
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

        <label className="v12-field-market block text-sm font-medium">
          Source origin
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            World, book, or setting
          </span>
          <input
            className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={sourceOrigin}
            onChange={(event) => onSourceOriginChange(event.target.value)}
            placeholder={sourcePlaceholder}
          />
        </label>
      </div>
    </div>
  );
}
