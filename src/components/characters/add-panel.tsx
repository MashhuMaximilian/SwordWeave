"use client";

/**
 * Phase 9.4 + 9.5 (Mashu 2026-09-07): the right-side "Add Panel" + the
 * mobile FAB that opens the same content as a bottom sheet.
 *
 * Phase 9.5 changes:
 *   - Each mode button routes to its OWN sheet/tab:
 *       library     → InlinePrimitiveSheet (search tab)
 *       quick       → InlinePrimitiveSheet (quick-author tab)
 *       promote     → InlinePrimitiveSheet (promote-condition tab)
 *       capability  → InlineCapabilitySheet (EmbeddedCapabilityForm)
 *       effect      → InlineEffectSheet (EmbeddedEffectForm)
 *       item        → InlineItemSheet (EmbeddedItemForm)
 *       formalize   → HeritageFormalizeSheet / ItemFormalizeSheet
 *   - AddPanel now manages which "active mode" is in use so the next
 *     time the panel re-opens it remembers the last pick.
 *   - The accordion-kind target is editable in the panel header so
 *     library/quick/promote slots land in the right accordion
 *     (previously the kind was hardcoded to the one from props).
 */

import { useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Library,
  Sparkles,
  Wand2,
  Layers,
  Zap,
  Hammer,
  ScrollText,
} from "lucide-react";
import { InlinePrimitiveSheet } from "./inline-primitive-sheet";
import { HeritageFormalizeSheet } from "./heritage-formalize-sheet";
import { ItemFormalizeSheet } from "./item-formalize-sheet";
import {
  EmbeddedCapabilityForm,
  EmbeddedEffectForm,
  EmbeddedItemForm,
} from "./workspace/embedded-atelier-forms";

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
  /** Which accordion the panel is targeting right now. When omitted
   *  the panel maintains its own internal target (default MANIFEST). */
  targetAccordion?: AccordionKind;
  onTargetAccordionChange?: ((next: AccordionKind) => void) | undefined;
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
  /** The PickerMode to pass as `initialMode` to InlinePrimitiveSheet.
   *  null for modes that open a different sheet entirely. */
  primitiveMode:
    | "search"
    | "quick"
    | "promote"
    | "capability"
    | "effect"
    | null;
  /** Accordion kinds this mode is meaningful for. capability/effect
   *  /item work for any kind; library/quick/promote respect the
   *  target accordion. formalize is per-kind. */
  allowAccordionSwitch: boolean;
}> = [
  {
    id: "library",
    label: "Library",
    icon: <Library className="size-3.5" />,
    primitiveMode: "search",
    allowAccordionSwitch: true,
  },
  {
    id: "quick",
    label: "Quick author",
    icon: <Sparkles className="size-3.5" />,
    primitiveMode: "quick",
    allowAccordionSwitch: true,
  },
  {
    id: "promote",
    label: "Promote condition",
    icon: <Wand2 className="size-3.5" />,
    primitiveMode: "promote",
    allowAccordionSwitch: true,
  },
  {
    id: "capability",
    label: "Author capability",
    icon: <Layers className="size-3.5" />,
    primitiveMode: "capability",
    allowAccordionSwitch: true,
  },
  {
    id: "effect",
    label: "Author effect",
    icon: <Zap className="size-3.5" />,
    primitiveMode: "effect",
    allowAccordionSwitch: true,
  },
  {
    id: "item",
    label: "Author item",
    icon: <Hammer className="size-3.5" />,
    primitiveMode: null, // opens ItemForm sheet
    allowAccordionSwitch: true,
  },
  {
    id: "formalize",
    label: "Formalize heritage",
    icon: <ScrollText className="size-3.5" />,
    primitiveMode: null, // opens formalize sheet
    allowAccordionSwitch: true,
  },
];

export function AddPanel({
  characterId,
  targetAccordion: controlledAccordion,
  onTargetAccordionChange,
  directPrimitives,
}: AddPanelProps) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInitialMode, setPickerInitialMode] = useState<
    "search" | "quick" | "promote" | "capability" | "effect"
  >("search");
  const [capabilityOpen, setCapabilityOpen] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  // Phase 9.5: own the target accordion in the panel so the user can
  // switch the slot destination from the right column without a parent
  // round-trip. The page can still pass `targetAccordion` + an optional
  // change callback to keep its own state in sync.
  const [internalAccordion, setInternalAccordion] =
    useState<AccordionKind>(controlledAccordion ?? "MANIFEST");
  const targetAccordion = controlledAccordion ?? internalAccordion;
  const setTargetAccordion = useCallback(
    (next: AccordionKind) => {
      if (onTargetAccordionChange) {
        onTargetAccordionChange(next);
      } else {
        setInternalAccordion(next);
      }
    },
    [onTargetAccordionChange],
  );

  // Phase 9.5: a single dispatcher that opens the right sheet for
  // the chosen mode. The right-column buttons + the mobile FAB use
  // this so they always route to the correct surface.
  const openMode = useCallback((mode: AddPanelMode) => {
    const def = MODES.find((m) => m.id === mode);
    if (!def) return;
    if (mode === "formalize") {
      setFormalizeOpen(true);
      return;
    }
    if (mode === "item") {
      setItemOpen(true);
      return;
    }
    if (mode === "capability") {
      setCapabilityOpen(true);
      return;
    }
    if (mode === "effect") {
      setEffectOpen(true);
      return;
    }
    // library / quick / promote all go through the primitive picker
    if (def.primitiveMode && def.primitiveMode !== "capability" && def.primitiveMode !== "effect") {
      setPickerInitialMode(def.primitiveMode);
      setPickerOpen(true);
      return;
    }
    // fall-through for capability/effect (defensive)
    if (def.primitiveMode === "capability") {
      setCapabilityOpen(true);
      return;
    }
    if (def.primitiveMode === "effect") {
      setEffectOpen(true);
      return;
    }
  }, []);

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
          targetAccordion={targetAccordion}
          onTargetAccordionChange={setTargetAccordion}
          onModeClick={(mode) => {
            openMode(mode);
            setOpen(false); // close the side panel once the sheet takes over
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
                targetAccordion={targetAccordion}
                onTargetAccordionChange={setTargetAccordion}
                onModeClick={(mode) => {
                  openMode(mode);
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Primitive picker (library / quick / promote) */}
      <InlinePrimitiveSheet
        characterId={characterId}
        accordionKind={targetAccordion}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialMode={pickerInitialMode}
        onAccordionChange={setTargetAccordion}
        {...(directPrimitives ? { directPrimitives } : {})}
      />

      {/* Capability author sheet */}
      {capabilityOpen && (
        <CapabilitySheetWrapper
          characterId={characterId}
          targetSlotTab={targetAccordion}
          onClose={() => setCapabilityOpen(false)}
        />
      )}

      {/* Effect author sheet */}
      {effectOpen && (
        <EffectSheetWrapper
          characterId={characterId}
          targetSlotTab={targetAccordion}
          onClose={() => setEffectOpen(false)}
        />
      )}

      {/* Item author sheet */}
      {itemOpen && (
        <ItemSheetWrapper
          characterId={characterId}
          onClose={() => setItemOpen(false)}
        />
      )}

      {/* Formalize sheets */}
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
    </>
  );
}

interface PanelBodyProps {
  targetAccordion: AccordionKind;
  onTargetAccordionChange?: ((next: AccordionKind) => void) | undefined;
  onModeClick: (mode: AddPanelMode) => void;
}

function PanelBody({
  targetAccordion,
  onTargetAccordionChange,
  onModeClick,
}: PanelBodyProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold">Add to character</h2>
      <p className="text-xs text-muted-foreground">
        Pick a target accordion, then choose what to add. On desktop you can
        also drag rows from the Library directly onto an accordion.
      </p>
      <AccordionPicker
        value={targetAccordion}
        onChange={onTargetAccordionChange ?? (() => {})}
      />
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
        remove it. Drop targets in each accordion show a blue outline on hover.
      </p>
    </div>
  );
}

const ACCORDION_LABELS: Record<AccordionKind, string> = {
  LINEAGE: "Lineage",
  UPBRINGING: "Upbringing",
  MANIFEST: "Manifest",
  PERSONAL: "Item (PERSONAL)",
};

function AccordionPicker({
  value,
  onChange,
}: {
  value: AccordionKind;
  onChange: (next: AccordionKind) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Target accordion
      </span>
      <div
        className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background/60 p-1"
        role="radiogroup"
        aria-label="Target accordion"
      >
        {(Object.keys(ACCORDION_LABELS) as AccordionKind[]).map((kind) => {
          const active = kind === value;
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(kind)}
              className={
                "rounded px-2 py-1 text-xs font-medium transition " +
                (active
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-card hover:text-foreground")
              }
            >
              {ACCORDION_LABELS[kind]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wrapper sheets for capability / effect / item
// ---------------------------------------------------------------------------
// The embedded forms are designed for the full-screen atelier route, not
// a bottom-sheet. We wrap them in a minimal modal here so the AddPanel
// can dispatch to them.

function CapabilitySheetWrapper({
  characterId,
  targetSlotTab,
  onClose,
}: {
  characterId: string;
  targetSlotTab: AccordionKind;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="sticky right-3 top-3 z-10 float-right rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground backdrop-blur transition hover:bg-card hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="p-4">
          <EmbeddedCapabilityForm
            characterId={characterId}
            targetSlotTab={targetSlotTab}
            onAttached={() => {
              // Phase 9.5: refresh the page after the capability
              // attaches so the new card appears in the sheet
              // without a manual reload.
              router.refresh();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EffectSheetWrapper({
  characterId,
  targetSlotTab,
  onClose,
}: {
  characterId: string;
  targetSlotTab: AccordionKind;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="sticky right-3 top-3 z-10 float-right rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground backdrop-blur transition hover:bg-card hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="p-4">
          <EmbeddedEffectForm
            characterId={characterId}
            onAttached={() => {
              router.refresh();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ItemSheetWrapper({
  characterId,
  onClose,
}: {
  characterId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="sticky right-3 top-3 z-10 float-right rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground backdrop-blur transition hover:bg-card hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="p-4">
          <EmbeddedItemForm
            characterId={characterId}
            onAttached={() => {
              router.refresh();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Re-export the accordion kind type so callers don't import twice.
export type { AccordionKind as AddPanelAccordionKind };
