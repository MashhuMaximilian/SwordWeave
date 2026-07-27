"use client";

/**
 * Phase 8.3e commit 3 (Mashu 2026-07-27): HeritagePreviewCard
 *
 * Compact card for a heritage (lineage / upbringing / manifest)
 * on a character sheet. Mirrors PrimitivePreviewCard's
 * pattern (click to preview) but adds an OriginBadge to show
 * the heritage's kind (LINEAGE / UPBRINGING / MANIFEST) and
 * the chain of capabilities / effects that brought it in.
 *
 * Heritages are passive containers — no trigger, no toggle.
 * Just preview + breadcrumb.
 */

import { useCallback, useState } from "react";
import { useToasts } from "@/components/ui/toast";
import { useEntityPreview } from "@/components/characters/preview-modal";
import {
  type SandboxPreviewItem,
  type SandboxTemplateRow,
} from "@/components/library/library-item-preview";

export interface HeritagePreviewCardProps {
  readonly heritageLink: {
    readonly heritageId: string;
    readonly name: string;
    readonly kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
    /** Origin chain from bundle expansion. */
    readonly originChain?: ReadonlyArray<{
      readonly heritageId?: string | null;
      readonly capabilityId?: string | null;
      readonly effectId?: string | null;
    }>;
  };
}

export function HeritagePreviewCard({
  heritageLink,
}: HeritagePreviewCardProps) {
  const { showToast } = useToasts();
  const { openPreview } = useEntityPreview();
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a")
      ) {
        return;
      }

      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/heritage/${heritageLink.heritageId}`);
        if (!res.ok) {
          throw new Error("Failed to load heritage preview");
        }
        const data = await res.json();
        const heritage = data.template as SandboxTemplateRow;
        const item: SandboxPreviewItem = {
          kind: "heritage",
          row: heritage,
        };
        openPreview({ item });
      } catch (err) {
        // Fallback: build a minimal preview from the data we
        // have on the card. Won't have capabilities or effects
        // expanded, but at least the user sees name + kind.
        const fallback: SandboxTemplateRow = {
          id: heritageLink.heritageId,
          kind: heritageLink.kind,
          name: heritageLink.name,
          description: null,
          suggestedTraits: null,
          isPublic: false,
          primitiveLinks: [],
          capabilityLinks: [],
          iconSource: null,
          iconKey: null,
          iconUrl: null,
          iconColor: "#ffffff",
        };
        openPreview({
          item: { kind: "heritage", row: fallback },
        });
        showToast(
          err instanceof Error
            ? `${err.message} — showing partial preview.`
            : "Preview load failed — showing partial preview.",
          "error",
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [heritageLink, openPreview, showToast],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void handleClick(e as unknown as React.MouseEvent);
      }
    },
    [handleClick],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-1 rounded border border-border bg-card/40 px-3 py-2 text-sm transition-colors hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
      data-testid="heritage-preview-card"
      data-heritage-id={heritageLink.heritageId}
      data-heritage-name={heritageLink.name}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-medium truncate">
            {heritageLink.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {heritageLink.kind}
          </span>
        </div>
      </div>
      {heritageLink.originChain && heritageLink.originChain.length > 0 ? (
        // Phase 8.3e: light metadata about origin chain.
        // Full breadcrumb with resolved names happens at the
        // sheet-page level (where label lookup is possible);
        // here we just surface the depth so the user knows
        // the heritage was brought in via a chain rather
        // than slotted directly.
        <span className="text-[10px] text-muted-foreground">
          via {heritageLink.originChain.length}-step chain
        </span>
      ) : null}
      {previewLoading ? (
        <span className="text-[10px] text-muted-foreground">
          Loading preview…
        </span>
      ) : null}
    </div>
  );
}