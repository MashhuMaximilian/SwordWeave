"use client";

/**
 * Phase 8.3e (Mashu 2026-07-27): PrimitivePreviewCard
 *
 * Compact card for a primitive slotted on a character sheet.
 * Click anywhere on the card (not on a button) to open the
 * unified EntityPreview modal in read mode, populated via
 * `useEntityPreview`. No trigger/active buttons — primitives
 * are passive modifiers, not actions.
 *
 * Pattern mirrors CapabilityCard (src/components/characters/
 * capability-card.tsx) but is simpler:
 *   - No trigger button (no action semantics)
 *   - No active toggle (primitives apply unconditionally
 *     per their authored modifiers, modulo future condition
 *     evaluation)
 *   - Same click-to-preview affordance
 *
 * Phase 8.3d (Mashu 2026-07-27) commit 2 follow-up: when the
 * primitive has authored hard_modifiers with conditions, we
 * render each modifier's condition as a row of pill badges
 * beneath the name. The pills were previously rendered
 * inline in the AllPrimitivesAccordion; moving them into the
 * card keeps the layout consistent (card owns the row).
 */

import { useCallback, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { useEntityPreview } from "@/components/characters/preview-modal";
import { ConditionBadges } from "@/components/library/condition-badges";
import {
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
} from "@/components/library/library-item-preview";

export interface PrimitivePreviewCardProps {
  /** The primitive link data the sheet already has. We use this
   * to render immediately (no fetch needed) and as a fallback
   * if the detail fetch fails. */
  readonly primitiveLink: {
    readonly primitiveId: number;
    readonly source: string;
    readonly acquiredAtLevel: number;
    readonly isMirrored: boolean;
    readonly primitive: {
      readonly id: number;
      readonly name: string;
      readonly category: string;
      readonly buCost: number;
      readonly isMirrorable: boolean;
      readonly mirrorBuCredit: number;
      readonly narrativeRule: string;
      readonly hardModifiers: readonly unknown[];
    };
  };
}

export function PrimitivePreviewCard({
  primitiveLink,
}: PrimitivePreviewCardProps) {
  const p = primitiveLink.primitive;
  const { showToast } = useToasts();
  const { openPreview } = useEntityPreview();

  const [fetching, setFetching] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      // Don't trigger preview if click landed on a button or link.
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a")
      ) {
        return;
      }

      setFetching(true);
      try {
        const res = await fetch(`/api/primitives/${p.id}`);
        if (!res.ok) {
          throw new Error("Failed to load primitive preview");
        }
        const data = await res.json();
        const primitive = data.primitive as SandboxPrimitiveRow;
        const item: SandboxPreviewItem = {
          kind: "primitive",
          row: primitive,
        };
        openPreview({ item });
      } catch (err) {
        // Fallback: build a minimal preview from the data we
        // already have on the sheet. This won't have icon /
        // tags / etc, but at least the user gets a preview
        // modal with name + category + BU + narrative rule.
        const fallback: SandboxPrimitiveRow = {
          id: p.id,
          name: p.name,
          category: p.category,
          buCost: p.buCost,
          isPublic: false,
          costTier: "Tier 1: Minor (4 BU anchor)",
          mechanicalOutputText: "",
          narrativeRule: p.narrativeRule,
          isMirrorable: p.isMirrorable,
          mirrorVector: "STANDARD_ONLY",
          mirrorBuCredit: p.mirrorBuCredit,
          mirrorEligibilityNotes: "",
          sourceOrigin: null,
          tags: [],
          hardModifiers: p.hardModifiers,
          iconSource: null,
          iconKey: null,
          iconUrl: null,
          iconColor: "#ffffff",
        };
        openPreview({
          item: { kind: "primitive", row: fallback },
        });
        showToast(
          err instanceof Error
            ? `${err.message} — showing partial preview.`
            : "Preview load failed — showing partial preview.",
          "error",
        );
      } finally {
        setFetching(false);
      }
    },
    [p, openPreview, showToast],
  );

  // Keyboard accessibility: Enter / Space should also open the
  // preview, since the card is the click target.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void handleClick(e as unknown as React.MouseEvent);
      }
    },
    [handleClick],
  );

  const modifiers = p.hardModifiers;
  const hasConditions =
    Array.isArray(modifiers) && modifiers.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-1 rounded border border-border bg-card/40 px-3 py-2 text-sm transition-colors hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
      data-testid="primitive-preview-card"
      data-primitive-id={p.id}
      data-primitive-name={p.name}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-medium truncate">{p.name}</span>
          <span className="text-xs text-muted-foreground">
            {p.category}
          </span>
          {primitiveLink.isMirrored && (
            <span className="inline-flex items-center gap-0.5 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              <RotateCcw className="size-2.5" />
              Mirrored (−{p.mirrorBuCredit} BU)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span className="font-mono text-foreground">{p.buCost} BU</span>
          {primitiveLink.isMirrored && (
            <span className="text-destructive">
              mirror: −{p.mirrorBuCredit} BU
            </span>
          )}
        </div>
      </div>
      {fetching ? (
        <span className="text-[10px] text-muted-foreground">
          Loading preview…
        </span>
      ) : null}
      {/* Phase 8.3d follow-up: condition pills live inside the
          card so they stay attached to the row. Renders nothing
          when the primitive has no authored hard_modifiers. */}
      {hasConditions ? (
        <div
          className="ml-1 space-y-0.5"
          data-testid="primitive-conditions"
        >
          {modifiers.map((mod: unknown, modIndex: number) => {
            // Phase 8.4 v2 (Mashu 2026-07-28): pull the `.condition`
            // field off the HardModifier before passing it to
            // ConditionBadges. Previously we passed the whole
            // modifier — but ConditionBadges.parseCondition saw
            // `kind: "modify"` (the HardModifier's own kind, not
            // a condition kind) and threw "unknown condition kind:
            // modify", which crashed the entire Capabilities tab.
            // The .condition field is the actual condition blob
            // (legacy or v1) that parseCondition knows about.
            const cond = (mod as { condition?: unknown })?.condition;
            if (cond === undefined || cond === null) return null;
            return (
              <ConditionBadges
                key={modIndex}
                condition={cond}
                showNarrative={true}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export type { SandboxPrimitiveRow };