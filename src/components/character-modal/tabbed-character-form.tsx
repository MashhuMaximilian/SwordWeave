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
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCharacterModal,
  CHARACTER_TABS,
  CHARACTER_TAB_LABELS,
  type CharacterTabId,
  type PendingSlot,
  summarizeSlotBu,
} from "./character-modal-store";
import {
  buildCharacterSeeds,
  type AttributesDraftSeed,
  type BackstoryDraftSeed,
  type IdentityDraftSeed,
} from "./character-seed";
import {
  getCapabilityBundleBuMap,
  getHeritageBundleBuMap,
  preloadCapabilityBundles,
  preloadHeritageBundles,
} from "./tabs/slot-receiver-tab";
import { maxBuDebtForLevel } from "@/lib/engine/bu";
import { computeMaxVitality } from "@/lib/engine/vitality";
import {
  IdentityTab,
  IDENTITY_STORAGE_KEY,
  IDENTITY_EMPTY,
  type IdentityState,
} from "./tabs/identity-tab";
import {
  BackstoryTab,
  BACKSTORY_STORAGE_KEY,
  BACKSTORY_EMPTY,
  type BackstoryState,
} from "./tabs/backstory-tab";
import {
  AttributesTab,
  ATTRIBUTES_STORAGE_KEY,
  ATTRIBUTES_EMPTY,
  activeBuBudget,
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

/**
 * Phase 8.1 batch 10: migrate legacy AttributesState (which had
 * `startingBu: number`) into the new shape with `mode` +
 * `buBudget`. Old drafts hydrate cleanly so users don't lose
 * partial progress.
 */
function migrateAttributesState(input: unknown): AttributesState {
  if (input == null || typeof input !== "object") return ATTRIBUTES_EMPTY;
  const obj = input as Record<string, unknown>;
  // New shape — pass through.
  if (typeof obj["mode"] === "string" && "buBudget" in obj) {
    return obj as unknown as AttributesState;
  }
  // Legacy: startingBu. Derive mode from it: anything other than 25
  // means the user was customising; default to "buBudget" mode.
  const legacyStart = Number(obj["startingBu"] ?? 25);
  const mode: AttributesState["mode"] = legacyStart === 25 ? "level" : "buBudget";
  return {
    attrPhysical: Number(obj["attrPhysical"] ?? 0),
    attrMental: Number(obj["attrMental"] ?? 0),
    attrMagical: Number(obj["attrMagical"] ?? 0),
    attrProficient:
      (obj["attrProficient"] as AttributesState["attrProficient"]) ?? null,
    mode,
    level: Number(obj["level"] ?? 1) || 1,
    buBudget: mode === "buBudget" ? legacyStart : 25,
  };
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
    editCharacterId,
    seededCharacter,
    editSeedError,
    applySeed,
    isSeedingEdit,
    clearPendingEdit,
  } = useCharacterModal();
  const { toasts, showToast, dismissToast } = useToasts();
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  // Form state — owned here, lifted from the per-tab components so
  // the footer's ATTR counter stays in sync as the user types. The
  // per-tab components are now controlled; localStorage persistence
  // is handled here with debounced writes.
  const [identity, setIdentity] = useState<IdentityState>(IDENTITY_EMPTY);
  const [backstory, setBackstory] = useState<BackstoryState>(BACKSTORY_EMPTY);
  const [attributes, setAttributes] = useState<AttributesState>(ATTRIBUTES_EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [seededOnce, setSeededOnce] = useState(false);

  // Mark dirty on mount; keep dot on until resetDraft clears it.
  useEffect(() => {
    setDirty(true);
  }, [setDirty]);

  /**
   * Phase 8.2 batch 7: apply the fetched character to local form
   * state exactly once per open. The store stashes the character
   * in `seededCharacter`; we listen for it, build the seeds,
   * apply them to the per-tab controlled inputs AND pendingSlots,
   * then flip `seededOnce` so we don't re-apply on subsequent
   * store updates.
   */
  useEffect(() => {
    if (!editCharacterId || !seededCharacter || seededOnce) return;
    if (seededCharacter.id !== editCharacterId) return;
    const seeds = buildCharacterSeeds(seededCharacter);
    setIdentity(seeds.identity as IdentityState);
    setBackstory(seeds.backstory as BackstoryState);
    setAttributes(seeds.attributes as AttributesState);
    applySeed(seeds.pendingSlots);
    setSeededOnce(true);
    // Phase 8.2 batch 10: warm the heritage + capability bundle
    // caches so the footer BU summary reflects seeded characters
    // on first render, instead of waiting for the user to click
    // into each tab (which mounts the slot card, fetches the
    // bundle, and only then bumps bundleVersion). Mashu 2026-07-23:
    // "It doesn't calculate budget when i enter edit only if if
    // go through each tab of builder."
    void (async () => {
      const heritageIds: string[] = [];
      const capabilityIds: string[] = [];
      for (const h of seededCharacter.heritageLinks ?? []) {
        if (h.heritageId) heritageIds.push(h.heritageId);
      }
      for (const c of seededCharacter.capabilityLinks ?? []) {
        if (c.capabilityId) capabilityIds.push(c.capabilityId);
      }
      await Promise.all([
        preloadHeritageBundles(heritageIds),
        preloadCapabilityBundles(capabilityIds),
      ]);
    })();
    // We deliberately do NOT mark dirty here — the seeded state
    // is the user's editing starting point, not a change.
  }, [
    editCharacterId,
    seededCharacter,
    seededOnce,
  ]);

  // Reset the seeded-once latch whenever the modal closes (so a
  // re-open for a different character seeds fresh).
  useEffect(() => {
    if (!editCharacterId) setSeededOnce(false);
  }, [editCharacterId]);

  // If seeding failed, surface the error via toast and close.
  useEffect(() => {
    if (editSeedError) {
      showToast(editSeedError, "error");
    }
  }, [editSeedError, showToast]);

  // Hydrate form data from localStorage on mount. We do this once and
  // pass the snapshot to Create.
  useEffect(() => {
    setIdentity(
      readLocalStorage<IdentityState>(IDENTITY_STORAGE_KEY, IDENTITY_EMPTY),
    );
    setBackstory(
      readLocalStorage<BackstoryState>(BACKSTORY_STORAGE_KEY, BACKSTORY_EMPTY),
    );
    setAttributes(
      migrateAttributesState(
        readLocalStorage<unknown>(ATTRIBUTES_STORAGE_KEY, ATTRIBUTES_EMPTY),
      ),
    );
    setHydrated(true);
  }, []);

  // Debounced persistence for each tab's state. Each setter triggers
  // a 500ms-debounced write to its own localStorage slot so a reload
  // restores the user mid-edit.
  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
      } catch {
        // ignore
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [identity, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(BACKSTORY_STORAGE_KEY, JSON.stringify(backstory));
      } catch {
        // ignore
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [backstory, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(ATTRIBUTES_STORAGE_KEY, JSON.stringify(attributes));
      } catch {
        // ignore
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [attributes, hydrated]);

  // Phase 8.1 batch 10: live BU summary for the footer. The summary
  // flattens every pending slot across all tabs and asks
  // summarizeSlotBu() for positiveSpent / mirrorCredit / debt /
  // netSpent. Heritage bundles are pulled from the session cache in
  // slot-receiver-tab via getHeritageBundleBuMap(). Capability bundles
  // use the parallel getCapabilityBundleBuMap() (batch 13.6 follow-up —
  // Mashu 2026-07-22: "if I slot into anything primitives capabilities
  // or heritages the BU budget does not update").
  const allSlots = useMemo(
    () => CHARACTER_TABS.flatMap((t) => pendingSlots[t]),
    [pendingSlots],
  );
  // Phase 8.1 batch 13.6 follow-up (Mashu 2026-07-22):
  // "if I add anything else into character first, it won't
  // calculate until I add a primitive in the character."
  //
  // Bug: buSummary was a useMemo with deps [allSlots, pendingSlots].
  // When the user adds a heritage or capability first (no primitive),
  // pendingSlots doesn't change when the bundle finishes fetching, so
  // the useMemo returned the cached result (0 BU). Adding a primitive
  // later would change pendingSlots, invalidate the cache, and the
  // count would "snap" into place.
  //
  // Fix: bump a `bundleVersion` counter when any slot card finishes
  // fetching its bundle (HeritageSlotCard + CapabilitySlotCard
  // dispatch `sw-character-bundle-loaded`). The counter is read inside
  // the summary computation, which depends on it through the
  // useMemo dep list. We still useMemo here — the maps are
  // module-level mutable, so reading them without a signal would
  // miss updates.
  const [bundleVersion, setBundleVersion] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setBundleVersion((v) => v + 1);
    window.addEventListener("sw-character-bundle-loaded", handler);
    return () =>
      window.removeEventListener("sw-character-bundle-loaded", handler);
  }, []);
  const buSummary = useMemo(
    () =>
      summarizeSlotBu(
        allSlots,
        getHeritageBundleBuMap(),
        getCapabilityBundleBuMap(),
      ),
    [allSlots, pendingSlots, bundleVersion],
  );
  const budget = activeBuBudget(attributes);
  const debtCeiling = maxBuDebtForLevel(attributes.level);
  const overBudget = buSummary.positiveSpent > budget;
  const debtExceeded = buSummary.debtUsed > debtCeiling;

  // Phase 8.2 batch 8: vitality max for the new character. The modal
  // doesn't currently compute vitality_modifiers from slotted primitives
  // (those are computed by the engine on the server). For the modal-side
  // initial-value we use the base formula only — the server-side GET /
  // PATCH path will recompute with full modifiers if/when we wire that.
  // Phase 8.1 batch 13.6 follow-up Mashu 2026-07-22: "Vitality is 0 not
  // full (or the amount last set before editing) on creation". So we
  // initialize currentVitality = vitalityMax on CREATE; on EDIT we keep
  // the seeded value (see initializeCurrentVitality below).
  const vitalityMax = computeMaxVitality(attributes.level);
  const seededCurrentVitality =
    editCharacterId && seededCharacter ? seededCharacter.currentVitality : null;
  const initialCurrentVitality =
    typeof seededCurrentVitality === "number"
      ? seededCurrentVitality
      : vitalityMax;

  const nameValid = identity.name.trim().length > 0;
  const attrSum = attributes.attrPhysical + attributes.attrMental + attributes.attrMagical;
  const attrValid = attrSum === 10;
  // Phase 8.1 batch 13.6 follow-up (Mashu 2026-07-22):
  // "When a player is above budget soft warning only."
  //
  // `overBudget` no longer blocks Create — the footer just renders
  // it in warn tone (red). The debt ceiling is still a hard block
  // because exceeding it breaks the canon (see maxBuDebtForLevel).
  // Server-side `buSpent > progressionPool` validation still exists
  // as a safety net; the server returns 400 if the user somehow
  // tries to save an over-budget build (shouldn't happen via UI now).
  const canCreate = nameValid && attrValid && !isPending && !debtExceeded;

  /**
   * Phase 8.2 batch 7: unified submit (was handleCreate).
   *
   *   - edit mode (editCharacterId set): PATCH /api/characters/[id]
   *   - create mode (editCharacterId null): POST /api/characters
   *
   * The two endpoints accept different field shapes:
   *   - POST accepts "primitivesBySource" / "capabilitiesBySource"
   *     / "heritages" arrays (heritage bundle model)
   *   - PATCH accepts flat "primitiveIds" / "mirroredPrimitiveIds"
   *     / "capabilityIds" / "itemIds" arrays (no heritage bundles;
   *     heritage fields come from the legacy flat columns)
   *
   * For now, edit mode only supports the flat arrays. The
   * heritage bundle expansion lives in the POST handler and is
   * out of scope for the PATCH path — heritage columns are still
   * updated via the legacy flat-name fields (lineageName etc.).
   * That's a known gap; we'll address it in a follow-up.
   */
  const handleSubmit = useCallback(async () => {
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
      // Flatten pendingSlots into the arrays the API endpoints
      // understand. We extract primitive ids, capability ids,
      // item ids, and heritage ids separately.
      const primitiveIds: number[] = [];
      const mirroredPrimitiveIds: number[] = [];
      const capabilityIds: string[] = [];
      const itemIds: string[] = [];
      const heritages: Array<{ id: string; isMirrored: boolean }> = [];

      for (const tab of CHARACTER_TABS) {
        for (const slot of pendingSlots[tab]) {
          if (slot.kind === "heritage") {
            heritages.push({ id: slot.heritageId, isMirrored: false });
          } else if (slot.kind === "primitive") {
            primitiveIds.push(slot.primitiveId);
            if (slot.mirror === true) {
              mirroredPrimitiveIds.push(slot.primitiveId);
            }
          } else if (slot.kind === "capability") {
            capabilityIds.push(slot.capabilityId);
          } else if (slot.kind === "item") {
            itemIds.push(slot.itemId);
          }
          // effects: not slotted separately in v1 (placeholder)
        }
      }

      const baseBody: Record<string, unknown> = {
        name: identity.name.trim(),
        size: identity.size,
        portraitUrl: identity.portraitUrl.trim() || null,
        notes: identity.notes.trim() || null,
        level: attributes.level,
        attrPhysical: attributes.attrPhysical,
        attrMental: attributes.attrMental,
        attrMagical: attributes.attrMagical,
        attrProficient: attributes.attrProficient,
        // Phase 8.2 batch 8: server derives lineageName / lineageImageUrl /
        // lineageDescription / upbringingName / upbringingImageUrl /
        // upbringingDescription / manifestName from the slotted heritage
        // bundle (POST path), or preserves existing values (PATCH path).
        // Sending null from the client is a footgun that wipes the
        // values on every save — so we just omit them from the body and
        // let the server do the right thing.
        enforceTemplateCaps: false,
        practiceSlices: {},
        // Phase 8.2 batch 8: persist the BU we currently have slotted.
        // Phase 8.1 batch 13.6 follow-up Mashu 2026-07-22: "BU budget is
        // 0 not saved from character creation". We send positiveSpent
        // (the sum of non-mirror slot BU) as buSpent. Mirrored primitives
        // don't add to buSpent — they're paid out of the debt pool.
        buSpent: buSummary.positiveSpent,
        // Phase 8.2 batch 8: dmBonusBu is set on the character row
        // via /api/characters/[id]/dm-bonus (separate flow). The
        // modal doesn't edit it — sending 0 here would overwrite the
        // server-side value on every save, so we OMIT it instead.
        currentVitality: initialCurrentVitality,
        backstory: {
          origin: backstory?.origin.trim() ?? "",
          motivation: backstory?.motivation.trim() ?? "",
          ties: backstory?.ties.trim() ?? "",
          flaw: backstory?.flaw.trim() ?? "",
        },
      };

      let url: string;
      let method: "POST" | "PATCH";
      let body: Record<string, unknown>;

      if (editCharacterId) {
        // Edit: PATCH the existing character with flat ids.
        url = `/api/characters/${editCharacterId}`;
        method = "PATCH";
        body = {
          ...baseBody,
          primitiveIds,
          mirroredPrimitiveIds,
          capabilityIds,
          itemIds,
        };
      } else {
        // Create: POST with the legacy grouped shape. The POST
        // route accepts primitivesBySource / capabilitiesBySource
        // / itemsBySource / heritages arrays — we derive them
        // from the same flat lists (treat all primitives as
        // PERSONAL, since v1 doesn't track per-slot source).
        url = "/api/characters";
        method = "POST";
        const primBySource: Record<string, Array<{ id: number; isMirrored: boolean }>> = {
          LINEAGE: [],
          UPBRINGING: [],
          MANIFEST: [],
          PERSONAL: primitiveIds.map((id) => ({
            id,
            isMirrored: mirroredPrimitiveIds.includes(id),
          })),
        };
        const capsBySource: Record<string, Array<{ id: string; isMirrored: boolean }>> = {
          LINEAGE: [],
          UPBRINGING: [],
          MANIFEST: [],
          PERSONAL: capabilityIds.map((id) => ({ id, isMirrored: false })),
        };
        const itemsBySource: Record<string, Array<{ id: string; quantity: number }>> = {
          PERSONAL: itemIds.map((id) => ({ id, quantity: 1 })),
        };
        body = {
          ...baseBody,
          startingBu: 25,
          buBudget:
            attributes.mode === "buBudget" ? attributes.buBudget : null,
          heritages,
          primitivesBySource: primBySource,
          capabilitiesBySource: capsBySource,
          itemsBySource,
        };
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? "Failed to save character.";
        // Phase 8.2 batch 7 rev 3: surface the underlying pg
        // error too — Drizzle wraps FK violations in a generic
        // "Failed query" message, hiding the actual constraint.
        const pg = data.pgError as string | undefined;
        showToast(pg ? `${errMsg}\n\n${pg}` : errMsg, "error");
        return;
      }

      const charId = data.character?.id as string | undefined;
      const charName =
        (data.character?.name as string | undefined) ??
        identity.name.trim();
      if (!charId) {
        showToast("Saved but no character id returned.", "error");
        return;
      }

      if (editCharacterId) {
        // Edit success — close the modal + clear the persisted
        // edit session + refresh the page so the sheet (if open)
        // reflects the new state.
        showToast(`Saved changes to "${charName}".`, "success");
        clearAllDraftStorage();
        clearPendingEdit();
        resetDraft();
        router.refresh();
      } else {
        // Create success — open the new sheet in a new tab.
        showToast(`Created character "${charName}"!`, "success");
        clearAllDraftStorage();
        resetDraft();
        window.open(`/characters/${charId}`, "_blank", "noopener,noreferrer");
      }
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
    editCharacterId,
    router,
  ]);

  // Phase 8.2 batch 7 rev 2: the dirty-confirm dialog has been
  // removed (closing the modal is now non-destructive). The save
  // event listener is no longer needed — the user clicks the
  // explicit Save/Save changes button, which calls handleSubmit
  // directly.

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Phase 8.2 batch 7: while openForEdit() is fetching the
  // character, the form should show a spinner instead of an empty
  // create draft. The user clicks Edit → modal pops up → briefly
  // empty → spinner while GET runs → modal pre-fills.
  if (isSeedingEdit) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading character…
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
        {activeStep === "identity" && (
          <IdentityTab state={identity} onChange={setIdentity} />
        )}
        {activeStep === "backstory" && (
          <BackstoryTab state={backstory} onChange={setBackstory} />
        )}
        {activeStep === "attributes" && (
          <AttributesTab state={attributes} onChange={setAttributes} />
        )}
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
          modal scroll container. Phase 8.1 batch 11 (Mashu
          2026-07-22): footer now shows just BU and Debt — Attr
          lives only in the Attributes tab, Rem is dropped because
          `BU used/budget` already tells the user how much room is
          left. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FooterStat label="Lvl" value={String(attributes.level)} />
          <FooterStat
            label="BU"
            value={`${buSummary.positiveSpent}/${budget}`}
            tone={overBudget ? "warn" : "default"}
          />
          {buSummary.debtUsed > 0 || debtCeiling > 0 ? (
            <FooterStat
              label="Debt"
              value={`${buSummary.debtUsed}/${debtCeiling}`}
              tone={debtExceeded ? "warn" : "default"}
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canCreate}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {/* Phase 8.2 batch 7: button label flips with mode. */}
          {isPending
            ? editCharacterId
              ? "Saving…"
              : "Creating…"
            : editCharacterId
              ? "Save changes"
              : "Create"}
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
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

