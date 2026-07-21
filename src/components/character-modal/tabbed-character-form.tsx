"use client";

// =============================================================================
// TabbedCharacterForm — 7-tab character creation modal body
// (Phase 8.1 batch 7).
//
// Tab bar pinned at top (sticky). 7 tabs in display order:
//   identity, backstory, attributes, lineage, upbringing, manifest, items
//
// Tab bodies:
//   - Identity / Backstory / Attributes: form tabs (typed inputs)
//   - Lineage / Upbringing / Manifest / Items: SlotReceiverTab
//
// Footer (sticky at bottom of scroll container):
//   - Compact ATTR X/10 + LEVEL + BUDGET used/total
//   - Single Create button on the right (POST /api/characters)
//
// Save flow:
//   - Reads identity/backstory/attributes from localStorage
//   - Reads pendingSlots from store
//   - POSTs to /api/characters with the assembled payload
//   - On success: opens /characters/[id] in new tab + resets store
//     + clears localStorage draft keys
//
// What does NOT live here yet:
//   - Heritage slot expansion (showing what each heritage bundles —
//     batch 9).
//   - Capability auto-expand (slotting a capability auto-adds its
//     primitives — batch 10).
//   - "Slot into [step]" library buttons (batch 8).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCharacterModal,
  CHARACTER_TABS,
  CHARACTER_TAB_LABELS,
  type CharacterTabId,
} from "./character-modal-store";
import { IdentityTab, IDENTITY_STORAGE_KEY, type IdentityState } from "./tabs/identity-tab";
import {
  BackstoryTab,
  BACKSTORY_STORAGE_KEY,
  type BackstoryState,
} from "./tabs/backstory-tab";
import {
  AttributesTab,
  ATTRIBUTES_STORAGE_KEY,
  type AttributesState,
} from "./tabs/attributes-tab";
import { SlotReceiverTab } from "./tabs/slot-receiver-tab";
import { ToastViewport, useToasts } from "@/components/ui/toast";

const SLOT_RECEIVER_CONFIG: Record<
  CharacterTabId,
  { title: string; help: string; ctaPrimary: string; ctaSecondary: string } | null
> = {
  identity: null,
  backstory: null,
  attributes: null,
  lineage: {
    title: "Lineage",
    help: "Where your character comes from. The lineage heritage bundles its primitives and capabilities — you don't pick sub-pieces.",
    ctaPrimary: "No lineage slotted yet",
    ctaSecondary:
      "Close the modal, browse Lineages in /atelier, and click 'Slot into Lineage' on the one you want.",
  },
  upbringing: {
    title: "Upbringing",
    help: "How your character grew up. Same pattern as Lineage.",
    ctaPrimary: "No upbringing slotted yet",
    ctaSecondary:
      "Close the modal, browse Upbringings in /atelier, and click 'Slot into Upbringing' on the one you want.",
  },
  manifest: {
    title: "Manifest",
    help: "What your character becomes — their archetype. Same pattern as Lineage.",
    ctaPrimary: "No manifest slotted yet",
    ctaSecondary:
      "Close the modal, browse Manifests in /atelier, and click 'Slot into Manifest' on the one you want.",
  },
  items: {
    title: "Items",
    help: "Gear the character carries. Items are slotted whole from the library.",
    ctaPrimary: "No items slotted yet",
    ctaSecondary:
      "Close the modal, browse Items in /atelier, and click 'Slot into Items' on the ones you want.",
  },
};

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clearAllDraftStorage() {
  try {
    window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
    window.localStorage.removeItem(BACKSTORY_STORAGE_KEY);
    window.localStorage.removeItem(ATTRIBUTES_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function TabbedCharacterForm() {
  const {
    setDirty,
    activeStep,
    setActiveStep,
    pendingSlots,
    resetDraft,
  } = useCharacterModal();
  const { toasts, showToast, dismissToast } = useToasts();

  const [isPending, setIsPending] = useState(false);
  const [identity, setIdentity] = useState<IdentityState | null>(null);
  const [backstory, setBackstory] = useState<BackstoryState | null>(null);
  const [attributes, setAttributes] = useState<AttributesState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Mark dirty on mount; keep dot on until resetDraft clears it.
  useEffect(() => {
    setDirty(true);
  }, [setDirty]);

  // Hydrate form data from localStorage on mount. We do this once and
  // pass the snapshot to Create — the per-tab components keep their
  // own live state from there.
  useEffect(() => {
    setIdentity(readLocalStorage<IdentityState>(IDENTITY_STORAGE_KEY, {
      name: "",
      portraitUrl: "",
      size: "MEDIUM",
      notes: "",
    }));
    setBackstory(readLocalStorage<BackstoryState>(BACKSTORY_STORAGE_KEY, {
      origin: "",
      motivation: "",
      ties: "",
      flaw: "",
    }));
    setAttributes(readLocalStorage<AttributesState>(ATTRIBUTES_STORAGE_KEY, {
      attrPhysical: 0,
      attrMental: 0,
      attrMagical: 0,
      attrProficient: null,
      level: 1,
      startingBu: 25,
    }));
    setHydrated(true);
  }, []);

  const totalSlotsCount = useMemo(
    () =>
      CHARACTER_TABS.reduce((acc, t) => acc + pendingSlots[t].length, 0),
    [pendingSlots],
  );

  const attrSum = useMemo(() => {
    if (!attributes) return 0;
    return attributes.attrPhysical + attributes.attrMental + attributes.attrMagical;
  }, [attributes]);
  const attrValid = attrSum === 10;
  const nameValid = (identity?.name ?? "").trim().length > 0;
  const canCreate = nameValid && attrValid && !isPending;

  const handleCreate = useCallback(async () => {
    if (!identity || !attributes) return;
    if (!nameValid) {
      showToast("Name is required.", "error");
      setActiveStep("identity");
      return;
    }
    if (!attrValid) {
      showToast(`Attributes must sum to exactly 10 (currently ${attrSum}).`, "error");
      setActiveStep("attributes");
      return;
    }

    setIsPending(true);
    try {
      // Assemble slots by source — primitives/caps split by their
      // queue tab (which we treat as the source for v1).
      const primBySource: Record<string, Array<{ id: number; isMirrored: boolean }>> = {
        LINEAGE: [],
        UPBRINGING: [],
        MANIFEST: [],
        PERSONAL: [],
      };
      const capsBySource: Record<string, Array<{ id: string; isMirrored: boolean }>> = {
        LINEAGE: [],
        UPBRINGING: [],
        MANIFEST: [],
        PERSONAL: [],
      };
      const itemsBySource: Record<string, Array<{ id: string; quantity: number }>> = {
        PERSONAL: [],
      };
      const heritages: Array<{ id: string; isMirrored: boolean }> = [];

      for (const tab of CHARACTER_TABS) {
        for (const slot of pendingSlots[tab]) {
          if (slot.kind === "heritage") {
            heritages.push({ id: slot.heritageId, isMirrored: false });
          } else if (slot.kind === "primitive") {
            const src = sourceFromTab(tab);
            primBySource[src]?.push({ id: slot.primitiveId, isMirrored: false });
          } else if (slot.kind === "capability") {
            const src = sourceFromTab(tab);
            capsBySource[src]?.push({ id: slot.capabilityId, isMirrored: false });
          } else if (slot.kind === "effect") {
            // Effects aren't slotted separately in v1. Treated as a
            // primitive slot at the same tab (placeholder — batch 10
            // handles capability auto-expand properly).
            const src = sourceFromTab(tab);
            // No primitive id available — skip for now.
            void src;
          } else if (slot.kind === "item") {
            (itemsBySource["PERSONAL"] ??= []).push({ id: slot.itemId, quantity: 1 });
          }
        }
      }

      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: identity.name.trim(),
          size: identity.size,
          portraitUrl: identity.portraitUrl.trim() || null,
          notes: identity.notes.trim() || null,
          level: attributes.level,
          startingBu: attributes.startingBu,
          attrPhysical: attributes.attrPhysical,
          attrMental: attributes.attrMental,
          attrMagical: attributes.attrMagical,
          attrProficient: attributes.attrProficient,
          // Legacy freeform fields kept for the existing schema's
          // columns. New backstory lives in the JSONB column.
          lineageName: null,
          lineageImageUrl: null,
          lineageDescription: null,
          upbringingName: null,
          upbringingImageUrl: null,
          upbringingDescription: null,
          manifestName: null,
          enforceTemplateCaps: false,
          practiceSlices: {},
          backstory: {
            origin: backstory?.origin.trim() ?? "",
            motivation: backstory?.motivation.trim() ?? "",
            ties: backstory?.ties.trim() ?? "",
            flaw: backstory?.flaw.trim() ?? "",
          },
          heritages,
          primitivesBySource: primBySource,
          capabilitiesBySource: capsBySource,
          itemsBySource,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? "Failed to create character.";
        showToast(errMsg, "error");
        return;
      }

      const createdId = data.character?.id as string | undefined;
      const createdName = (data.character?.name as string | undefined) ?? identity.name.trim();
      if (!createdId) {
        showToast("Character created but no id returned.", "error");
        return;
      }
      showToast(`Created character "${createdName}"!`, "success");
      clearAllDraftStorage();
      resetDraft();
      window.open(`/characters/${createdId}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error.";
      showToast(errMsg, "error");
    } finally {
      setIsPending(false);
    }
  }, [
    identity,
    attributes,
    backstory,
    nameValid,
    attrValid,
    attrSum,
    pendingSlots,
    showToast,
    setActiveStep,
    resetDraft,
  ]);

  if (!hydrated || !identity || !backstory || !attributes) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar — sticky at top of scroll container */}
      <nav
        role="tablist"
        aria-label="Character creation tabs"
        className="sticky top-0 z-10 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2"
      >
        {CHARACTER_TABS.map((tab) => {
          const isActive = tab === activeStep;
          const count = pendingSlots[tab].length;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveStep(tab)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span>{CHARACTER_TAB_LABELS[tab]}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Tab body */}
      <div className="px-1">
        {activeStep === "identity" && <IdentityTab />}
        {activeStep === "backstory" && <BackstoryTab />}
        {activeStep === "attributes" && <AttributesTab />}
        {activeStep === "lineage" && (
          <SlotReceiverTab
            tabId="lineage"
            title="Lineage"
            help={SLOT_RECEIVER_CONFIG.lineage!.help}
            ctaPrimary={SLOT_RECEIVER_CONFIG.lineage!.ctaPrimary}
            ctaSecondary={SLOT_RECEIVER_CONFIG.lineage!.ctaSecondary}
          />
        )}
        {activeStep === "upbringing" && (
          <SlotReceiverTab
            tabId="upbringing"
            title="Upbringing"
            help={SLOT_RECEIVER_CONFIG.upbringing!.help}
            ctaPrimary={SLOT_RECEIVER_CONFIG.upbringing!.ctaPrimary}
            ctaSecondary={SLOT_RECEIVER_CONFIG.upbringing!.ctaSecondary}
          />
        )}
        {activeStep === "manifest" && (
          <SlotReceiverTab
            tabId="manifest"
            title="Manifest"
            help={SLOT_RECEIVER_CONFIG.manifest!.help}
            ctaPrimary={SLOT_RECEIVER_CONFIG.manifest!.ctaPrimary}
            ctaSecondary={SLOT_RECEIVER_CONFIG.manifest!.ctaSecondary}
          />
        )}
        {activeStep === "items" && (
          <SlotReceiverTab
            tabId="items"
            title="Items"
            help={SLOT_RECEIVER_CONFIG.items!.help}
            ctaPrimary={SLOT_RECEIVER_CONFIG.items!.ctaPrimary}
            ctaSecondary={SLOT_RECEIVER_CONFIG.items!.ctaSecondary}
          />
        )}
      </div>

      {/* Footer — compact stats + Create button. Pinned to bottom of
          modal scroll container. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FooterStat
            label="Attr"
            value={`${attrSum}/10`}
            tone={attrValid ? "ok" : "warn"}
          />
          <FooterStat label="Lvl" value={String(attributes.level)} />
          <FooterStat
            label="BU"
            value={`${totalSlotsCount}/${attributes.startingBu + (attributes.level - 1) * 5}`}
          />
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create"}
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function sourceFromTab(tab: CharacterTabId): string {
  if (tab === "lineage") return "LINEAGE";
  if (tab === "upbringing") return "UPBRINGING";
  if (tab === "manifest") return "MANIFEST";
  return "PERSONAL";
}

function FooterStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-bold",
        tone === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warn" && "bg-destructive/10 text-destructive",
        tone === "default" && "bg-secondary text-secondary-foreground",
      )}
    >
      <span className="font-sans text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      {value}
    </span>
  );
}

