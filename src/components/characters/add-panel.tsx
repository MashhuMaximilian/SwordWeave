"use client";

/**
 * Phase 9.4 (Mashu 2026-09-07): the right-side "Add Panel" + the
 * mobile FAB that opens the same content as a bottom sheet.
 *
 * Design goal: a single persistent surface where the user can
 *   - search the primitive library
 *   - quick-author a primitive inline
 *   - promote a runtime condition to a primitive
 *   - author a capability, effect, or item
 *   - formalize the current accordion as a heritage
 *
 * Desktop (≥ lg): a fixed 360px column on the right edge. Slides
 * in from a chevron toggle in the page header. The main content
 * shifts left to make room.
 *
 * Mobile (< lg): collapsed into a FAB (bottom-right, above the
 * sticky bar). Tapping opens the picker as a bottom sheet that
 * takes the lower half of the screen.
 *
 * Why two surfaces (panel + modal):
 *   - The panel supports drag-and-drop on desktop. The user drags
 *     a library row onto an accordion.
 *   - The modal is for mobile / when the user wants the picker
 *     without committing screen real estate. In modal mode, drag
 *     is disabled (modal → background DnD is blocked by the
 *     overlay anyway), so library rows expose a "Slot" button
 *     instead.
 */

import { useState, useCallback, type ReactNode } from "react";
import {
  Plus,
  X,
  Library,
  Search,
  Sparkles,
  Layers,
  Zap,
  Wand2,
  Hammer,
  ScrollText,
} from "lucide-react";
import { InlinePrimitiveSheet } from "./inline-primitive-sheet";
import { HeritageFormalizeSheet } from "./heritage-formalize-sheet";
import { ItemFormalizeSheet } from "./item-formalize-sheet";

export type AccordionKind = "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";

export type AddPanelMode =
  | "library"
  | "quick"
  | "promote"
  | "capability"
  | "effect"
  | "item"
  | "formalize";

export interface AddPanelProps {
  characterId: string;
  /** Which accordion the panel is targeting right now (for slot/finalize). */
  targetAccordion: AccordionKind;
  onTargetAccordionChange?: (next: AccordionKind) => void;
  /**
   * Phase 9.4 (Mashu 2026-09-07): forwarded to the picker's
   * Promote tab so the conditions list is filtered down to
   * those that originated from a DIRECT primitive on this
   * character (per Mashu: "not those nested in capabilities
   * and effects"). Optional — when omitted, the Promote tab
   * shows every condition (legacy behavior).
   */
  directPrimitives?: import("./inline-primitive-sheet").DirectPrimitivesIndex | null;
}

const MODES: ReadonlyArray<{
  id: AddPanelMode;
  label: string;
  icon: ReactNode;
}> = [
  { id: "library", label: "Library", icon: <Library className="size-3.5" /> },
  { id: "quick", label: "Quick author", icon: <Sparkles className="size-3.5" /> },
  { id: "promote", label: "Promote condition", icon: <Wand2 className="size-3.5" /> },
  { id: "capability", label: "Author capability", icon: <Layers className="size-3.5" /> },
  { id: "effect", label: "Author effect", icon: <Zap className="size-3.5" /> },
  { id: "item", label: "Author item", icon: <Hammer className="size-3.5" /> },
  { id: "formalize", label: "Formalize heritage", icon: <ScrollText className="size-3.5" /> },
];

export function AddPanel({
  characterId,
  targetAccordion,
  onTargetAccordionChange,
  directPrimitives,
}: AddPanelProps) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formalizeOpen, setFormalizeOpen] = useState(false);

  const openMode = useCallback(
    (mode: AddPanelMode) => {
      if (mode === "formalize") {
        setFormalizeOpen(true);
        return;
      }
      setPickerOpen(true);
    },
    [],
  );

  return (
    <>
      {/* Right-edge desktop panel */}
      <aside
        className={
          "hidden lg:flex lg:flex-col lg:w-[360px] lg:shrink-0 " +
          "lg:border-l lg:border-border lg:bg-card/30"
        }
        aria-label="Add panel"
      >
        <PanelBody
          onModeClick={(mode) => {
            openMode(mode);
            setOpen(true);
          }}
        />
      </aside>

      {/* Mobile FAB + bottom sheet */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/50 transition hover:bg-primary/90 active:scale-95"
          aria-label="Open add panel"
        >
          <Plus className="size-6" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Add panel (mobile)"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Add to character</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <PanelBody
                onModeClick={(mode) => {
                  openMode(mode);
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* The picker + formalize sheets are reused from the existing
          per-accordion footer actions. They open from any entry
          point (panel button, FAB, per-accordion + button). */}
      <InlinePrimitiveSheet
        characterId={characterId}
        accordionKind={targetAccordion}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        {...(directPrimitives ? { directPrimitives } : {})}
      />
      {targetAccordion !== "PERSONAL" ? (
        <HeritageFormalizeSheet
          characterId={characterId}
          kind={targetAccordion}
          open={formalizeOpen}
          onClose={() => setFormalizeOpen(false)}
        />
      ) : (
        <ItemFormalizeSheet
          characterId={characterId}
          open={formalizeOpen}
          onClose={() => setFormalizeOpen(false)}
        />
      )}

      {/* Hidden search input — placeholder for the library panel
          content. Wired in task #6 / #8. For now the panel shows
          only the mode tabs; clicking each opens the same sheet
          the per-accordion + button opens. */}
      <input type="hidden" data-add-panel-target={targetAccordion} />
    </>
  );
}

interface PanelBodyProps {
  onModeClick: (mode: AddPanelMode) => void;
}

function PanelBody({ onModeClick }: PanelBodyProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Add to character</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Pick a mode to add primitives, capabilities, effects, or items. On
        desktop you can also drag rows from the Library directly onto an
        accordion.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeClick(m.id)}
            className="group flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-card"
          >
            <span className="text-primary transition group-hover:text-primary">
              {m.icon}
            </span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Tip: long-press any primitive on a mobile device to move, mirror, or
        remove it.
      </p>
    </div>
  );
}

// Re-export the accordion kind type so callers don't import twice.
export type { AccordionKind as AddPanelAccordionKind };
