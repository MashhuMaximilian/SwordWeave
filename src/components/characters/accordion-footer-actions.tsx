"use client";

/**
 * Phase 9.1 (Mashu 2026-09-06): accordion footer actions.
 *
 * Renders the BUILD-mode affordances at the bottom of each
 * character-sheet accordion:
 *   - "+ Add primitive" (opens InlinePrimitiveSheet picker)
 *   - "Formalize as heritage" (for LINEAGE/UPBRINGING/MANIFEST)
 *   - "Wrap as item" (for PERSONAL = items accordion)
 *
 * In PLAY mode this component renders nothing — the user sees the
 * chips as a clean read-only list.
 *
 * Used by HeritageKindAccordion + the items accordion to keep the
 * build-mode affordances consistent.
 */

import {
  useCallback,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Hammer, Loader2, Package, Plus } from "lucide-react";

export type AccordionKind = "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";

interface AccordionFooterActionsProps {
  characterId: string;
  accordionKind: AccordionKind;
  /** Current slotted primitives count, used to gate Formalize (≥ 1). */
  slottedCount: number;
  onAfterChange?: () => void;
  /**
   * Phase 9.4 (Mashu 2026-09-07): forwarded to the picker so the
   * Promote tab filters to DIRECT-only conditions.
   */
  directPrimitives?: import("./inline-primitive-sheet").DirectPrimitivesIndex | null;
}

export function AccordionFooterActions({
  characterId,
  accordionKind,
  slottedCount,
  onAfterChange,
  directPrimitives,
}: AccordionFooterActionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  const router = useRouter();

  const handleSlot = useCallback(() => {
    onAfterChange?.();
    router.refresh();
  }, [onAfterChange, router]);

  const handleFormalized = useCallback(() => {
    setFormalizeOpen(false);
    onAfterChange?.();
    router.refresh();
  }, [onAfterChange, router]);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
        >
          <Plus className="size-3.5" />
          Add primitive
        </button>
        {(accordionKind === "LINEAGE" ||
          accordionKind === "UPBRINGING" ||
          accordionKind === "MANIFEST") && (
          <button
            type="button"
            onClick={() => setFormalizeOpen(true)}
            disabled={slottedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Hammer className="size-3.5" />
            Formalize as heritage
            <span className="ml-1 text-[10px] font-mono text-muted-foreground">
              ({slottedCount})
            </span>
          </button>
        )}
        {accordionKind === "PERSONAL" && (
          <button
            type="button"
            onClick={() => setFormalizeOpen(true)}
            disabled={slottedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Package className="size-3.5" />
            Wrap as item
            <span className="ml-1 text-[10px] font-mono text-muted-foreground">
              ({slottedCount})
            </span>
          </button>
        )}
      </div>

      <InlinePrimitiveSheet
        characterId={characterId}
        accordionKind={accordionKind}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSlot={handleSlot}
        {...(directPrimitives ? { directPrimitives } : {})}
      />

      {accordionKind !== "PERSONAL" ? (
        <HeritageFormalizeSheet
          characterId={characterId}
          kind={accordionKind}
          open={formalizeOpen}
          onClose={() => setFormalizeOpen(false)}
          onFormalized={handleFormalized}
        />
      ) : (
        <ItemFormalizeSheet
          characterId={characterId}
          open={formalizeOpen}
          onClose={() => setFormalizeOpen(false)}
          onFormalized={handleFormalized}
        />
      )}
    </>
  );
}

// Phase 9.1 (Mashu 2026-09-06): import the sheets we built so the
// accordion footer is one-stop. They live in their own files for
// clarity but are colocated at the import site to keep the
// per-accordion surface area small.
import { InlinePrimitiveSheet } from "./inline-primitive-sheet";
import { HeritageFormalizeSheet } from "./heritage-formalize-sheet";
import { ItemFormalizeSheet } from "./item-formalize-sheet";
