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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCharacterModal,
  CHARACTER_TABS,
  CHARACTER_TAB_LABELS,
  approveNavigation,
  type CharacterTabId,
  type PendingSlot,
  type PendingSlotsByTab,
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
// Phase 8.4 v21 (Mashu 2026-07-29): T2 — items tab uses its
// own component (per Mashu's spec, items work differently
// than other tabs: item-scoped primitives/caps/effects,
// equipped toggle, no per-slot mirror).
import { ItemsTab } from "./tabs/items-tab";
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

const PENDING_SLOTS_STORAGE_KEY_PREFIX = "swordweave:character-modal:draft:pendingSlots";

/**
 * Phase 8.4 v24.11 (Mashu 2026-07-30): localStorage persistence
 * for pendingSlots. Each character (or the "new" create-mode
 * session) gets its own key so multiple in-flight edits don't
 * collide. Without this, the modal's slot state lives only in
 * memory and is discarded the moment the user closes the modal
 * — re-opening always re-seeded from DB, so any "remove this
 * thing and look at it later" workflow was impossible.
 *
 * Mashu 2026-07-30: "I remove something it gets removed, I
 * close modal, I open modal, not removed anymore" + "we have
 * to keep the last update state in localstorage or cache or
 * something."
 *
 * Lifecycle:
 *   - On mount, the seed effect checks localStorage FIRST; if a
 *     draft exists for the current character (or "new"), it
 *     hydrates from there instead of the DB.
 *   - On any pendingSlots change, a debounced 500ms write
 *     pushes the new state to localStorage.
 *   - On save success, the key for this character is cleared
 *     (next open = fresh seed from DB).
 *   - On save failure, the key is left intact so the user
 *     can retry without losing work.
 *   - On close-without-save, the key is left intact so reopen
 *     resumes the previous edit session.
 */
function pendingSlotsKey(characterId: string | null): string {
  return `${PENDING_SLOTS_STORAGE_KEY_PREFIX}:${characterId ?? "new"}`;
}

function clearAllDraftStorage() {
  try {
    window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
    window.localStorage.removeItem(BACKSTORY_STORAGE_KEY);
    window.localStorage.removeItem(ATTRIBUTES_STORAGE_KEY);
    // Note: PENDING_SLOTS is per-character, cleared explicitly
    // in the save handler (so failed saves don't lose work).
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
    close,
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
    // Phase 8.4 v26 (Mashu 2026-07-30): removed localStorage draft for
    // pendingSlots. pendingSlots now always comes from DB seed, consistent
    // with how identity/backstory/attributes are handled. localStorage draft
    // for pendingSlots was causing data-loss bugs when draft had fewer slots
    // than DB (stale draft from previous failed edit), causing Save to
    // overwrite DB with incomplete data and delete heritage/primitive rows.
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
  //
  // Phase 8.4 v25.3 (Mashu 2026-07-30): the old version only
  // reset on `editCharacterId === null`, which doesn't fire when
  // the user switches directly from editing Tessy3 to editing
  // Pumnu (the store goes tessy3Id → pumnuId without a null
  // transition). Result: identity/backstory/attributes stayed
  // as Tessy3's data in Pumnu's modal because the seed effect
  // returned early on the `seededOnce === true` guard. Now we
  // Reset seededOnce and seededSnapshotRef whenever editCharacterId CHANGES (any value).
  useEffect(() => {
    setSeededOnce(false);
    seededSnapshotRef.current = null;
  }, [editCharacterId]);

  // If seeding failed, surface the error via toast and close.
  useEffect(() => {
    if (editSeedError) {
      showToast(editSeedError, "error");
    }
  }, [editSeedError, showToast]);

  // Phase 8.3b UI fix #2 (Mashu 2026-07-27):
  //   When the user slots in a heritage or capability from the
  //   library, the active-primitives list in Section 1 wouldn't show
  //   the bundle's primitives until the user toggled tabs — because
  //   the bundle fetch lived inside HeritageSlotCard / CapabilitySlotCard
  //   in Section 2, which only mounted on first render of Section 2.
  //
  //   We now eagerly preload bundles the moment their heritage/
  //   capability appears in pendingSlots. The preloader writes into
  //   the same module-level cache the cards read from + dispatches the
  //   same sw-character-bundle-loaded event, so Section 1's
  //   useTabPrimitives recomputes without waiting for Section 2 to
  //   mount.
  useEffect(() => {
    const heritageIds: string[] = [];
    const capabilityIds: string[] = [];
    for (const tab of Object.keys(pendingSlots) as Array<
      keyof typeof pendingSlots
    >) {
      for (const slot of pendingSlots[tab] ?? []) {
        if (slot.kind === "heritage" && slot.heritageId) {
          heritageIds.push(slot.heritageId);
        } else if (slot.kind === "capability" && slot.capabilityId) {
          capabilityIds.push(slot.capabilityId);
        }
      }
    }
    if (heritageIds.length === 0 && capabilityIds.length === 0) return;
    void (async () => {
      await Promise.all([
        preloadHeritageBundles(heritageIds),
        preloadCapabilityBundles(capabilityIds),
      ]);
    })();
  }, [pendingSlots]);

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
    // Phase 8.4 v26 (Mashu 2026-07-30): removed localStorage draft for
    // pendingSlots. pendingSlots now always comes from DB seed, consistent
    // with how identity/backstory/attributes are handled.
    setHydrated(true);
  }, [editCharacterId]);

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

  // Phase 8.4 v24.11 (Mashu 2026-07-30): debounced localStorage
  // write for pendingSlots, keyed by character id (or "new" for
  // create-mode). Without this the slot state is purely in-memory
  // and lost on close. The 500ms debounce matches the identity/
  // backstory/attributes tabs above — keeps the write rate low
  // during heavy slot/remove activity.
  //
  // We write ONLY when seededOnce is true — otherwise the initial
  // EMPTY_PENDING from useState would clobber any draft on the
  // very first render (the seed effect is what stamps the actual
  // slots, and it happens AFTER initial render).
  //
  // Write synchronously (no debounce) so that removals are
  // persisted immediately. A debounce here caused the exact
  // bug Mashu reported: remove a cap, close modal within
  // 500ms, debounce fires after unmount (or gets cancelled),
  // localStorage draft never updated, reopen re-seeds from
  // DB and the removed cap reappears.
  useEffect(() => {
    if (!hydrated || !seededOnce) return;
    const key = pendingSlotsKey(editCharacterId);
    try {
      window.localStorage.setItem(key, JSON.stringify(pendingSlots));
    } catch {
      // ignore quota / serialization failures
    }
  }, [pendingSlots, hydrated, seededOnce, editCharacterId]);

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

  // Phase 8.2 batch 19 (Mashu 2026-07-27): BU DEBT chip now follows
  // the carry-over model.
  //   - mirror primitives EARN debt (their sum is the available pool)
  //   - non-mirror primitives fill the budget; overflow absorbs into
  //     the available pool up to its size (hard cap is maxBuDebtForLevel)
  //   - the budget display subtracts the absorbed overflow so the
  //     visible budget number only reflects what's actually NOT been
  //     absorbed by debt; any remainder overflow still shows as +N
  // The chip format is `X/Y (max Z BU)`:
  //   X = overflow absorbed by debt (= min(overflow, mirrorTotal))
  //   Y = mirrorTotal (the earned/available debt pool)
  //   Z = maxBuDebtForLevel(level)
  const budgetOverflow = Math.max(0, buSummary.positiveSpent - budget);
  const debtX = Math.min(budgetOverflow, buSummary.debtUsed);
  const debtY = buSummary.debtUsed;
  const budgetAbsorbed = debtX;
  const budgetVisible = Math.max(0, buSummary.positiveSpent - budgetAbsorbed);
  const budgetOverflowRemainder = Math.max(0, budgetVisible - budget);

  const overBudget = budgetOverflowRemainder > 0;
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

  // Phase 8.4 v25.x (Mashu 2026-07-30): detect whether any edits have been
  // made to the character in the modal. Compare pendingSlots + form state
  // against the seeded snapshot right after seeding completes. This powers
  // the "no changes to save" UI state on the Save button.
  const seededSnapshotRef = useRef<{
    pendingSlots: PendingSlotsByTab;
    identity: IdentityState;
    backstory: BackstoryState;
    attributes: AttributesState;
  } | null>(null);
  if (seededOnce && seededSnapshotRef.current === null) {
    seededSnapshotRef.current = {
      pendingSlots: structuredClone(pendingSlots),
      identity: { ...identity },
      backstory: { ...backstory },
      attributes: { ...attributes },
    };
  }

  const hasEdits = useMemo(() => {
    const snap = seededSnapshotRef.current;
    if (!snap) return false;
    for (const tab of CHARACTER_TABS) {
      const cur = pendingSlots[tab] ?? [];
      const ref = snap.pendingSlots[tab] ?? [];
      if (cur.length !== ref.length) return true;
      for (let i = 0; i < cur.length; i++) {
        if (JSON.stringify(cur[i]) !== JSON.stringify(ref[i])) return true;
      }
    }
    return (
      identity.name.trim() !== snap.identity.name.trim() ||
      identity.size !== snap.identity.size ||
      identity.portraitUrl.trim() !== snap.identity.portraitUrl.trim() ||
      identity.notes.trim() !== snap.identity.notes.trim() ||
      backstory.origin !== snap.backstory.origin ||
      backstory.motivation !== snap.backstory.motivation ||
      backstory.ties !== snap.backstory.ties ||
      backstory.flaw !== snap.backstory.flaw ||
      attributes.attrPhysical !== snap.attributes.attrPhysical ||
      attributes.attrMental !== snap.attributes.attrMental ||
      attributes.attrMagical !== snap.attributes.attrMagical ||
      attributes.attrProficient !== snap.attributes.attrProficient ||
      attributes.level !== snap.attributes.level ||
      attributes.buBudget !== snap.attributes.buBudget
    );
  }, [pendingSlots, identity, backstory, attributes, seededOnce]);

  /**
   * Phase 8.2 batch 7: unified submit (was handleCreate).
   *
   *   - edit mode (editCharacterId set): PATCH /api/characters/[id]
   *   - create mode (editCharacterId null): POST /api/characters
   *
   * The two endpoints accept different field shapes:
   *   - POST accepts "primitivesBySource" / "capabilitiesBySource"
   *     / "heritages" arrays (heritage bundle model)
   *   - PATCH accepts "primitiveInstances" (Phase 8.3b; legacy
   *     "primitiveIds" + "mirroredPrimitiveIds" still supported for
   *     back-compat)
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
      // understand. Phase 8.3b: primitiveInstances preserves the
      // per-slot shape (multiple direct-paid copies of the same
      // primitive_id can coexist for stacking). We extract primitive
      // ids, capability ids, item ids, and heritage ids separately.
      //
      // Phase 8.4 v24.7 (Mashu 2026-07-30): per-tab routing. The
      // modal keeps primitives + capabilities in
      // pendingSlots[lineage|upbringing|manifest] — which tab the
      // user picked. We preserve that here so the saver can
      // stamp `slot_tab` correctly. legacy `primitiveInstances` +
      // `capabilityIds` flat arrays still go out for
      // back-compat with the saver's PERSONAL coalescing.
      const primitiveInstances: Array<{ primitiveId: number; isMirrored: boolean }> = [];
      const capabilityIds: string[] = [];
      // Phase 8.4 v21 (Mashu 2026-07-29): T2 — items now carry
      // an `equipped` flag so the modal can save it
      // atomically with the rest of the bundle.
      const itemsForSave: Array<{ id: string; equipped: boolean }> = [];
      const itemIds: string[] = [];
      const heritages: Array<{ id: string; isMirrored: boolean }> = [];

      // Phase 8.4 v24.7: per-tab buckets. Keys are uppercase
      // LINEAGE / UPBRINGING / MANIFEST — matching the
      // character's heritage_kind enum. Caps + primitives slot
      // in their user-picked tab; the saver writes slot_tab
      // from this.
      const primitivesByTab = {
        LINEAGE: [] as Array<{ id: number; isMirrored: boolean }>,
        UPBRINGING: [] as Array<{ id: number; isMirrored: boolean }>,
        MANIFEST: [] as Array<{ id: number; isMirrored: boolean }>,
      };
      const capabilitiesByTab = {
        LINEAGE: [] as Array<{ id: string; isMirrored: boolean }>,
        UPBRINGING: [] as Array<{ id: string; isMirrored: boolean }>,
        MANIFEST: [] as Array<{ id: string; isMirrored: boolean }>,
      };

      for (const tab of CHARACTER_TABS) {
        for (const slot of pendingSlots[tab]) {
          if (slot.kind === "heritage") {
            heritages.push({ id: slot.heritageId, isMirrored: false });
          } else if (slot.kind === "primitive") {
            primitiveInstances.push({
              primitiveId: slot.primitiveId,
              isMirrored: slot.mirror === true,
            });
            // Phase 8.4 v24.7: also push into the per-tab bucket.
            // Items tab primitives are skipped (they're item-
            // scoped, not character-scoped — see T15).
            const bucket =
              tab === "lineage"
                ? "LINEAGE"
                : tab === "upbringing"
                  ? "UPBRINGING"
                  : tab === "manifest"
                    ? "MANIFEST"
                    : null;
            if (bucket) {
              primitivesByTab[bucket].push({
                id: slot.primitiveId,
                isMirrored: slot.mirror === true,
              });
            }
          } else if (slot.kind === "capability") {
            capabilityIds.push(slot.capabilityId);
            // Phase 8.4 v24.7: per-tab bucket. This is the
            // fix for the per-tab accordion routing — without
            // this, every cap was being saved with slot_tab
            // = MANIFEST because the modal collapsed them all
            // into PERSONAL.
            const bucket =
              tab === "lineage"
                ? "LINEAGE"
                : tab === "upbringing"
                  ? "UPBRINGING"
                  : tab === "manifest"
                    ? "MANIFEST"
                    : null;
            if (bucket) {
              capabilitiesByTab[bucket].push({
                id: slot.capabilityId,
                isMirrored: false,
              });
            }
          } else if (slot.kind === "item") {
            itemsForSave.push({
              id: slot.itemId,
              equipped: slot.equipped === true,
            });
            itemIds.push(slot.itemId);
          }
          // effects: not slotted separately in v1 (placeholder)
        }
      }

      // Compute the buSummary from primitiveInstances so the footer
      // matches what the server will charge. (Not currently used here
      // since buSummary is already computed above via the useMemo —
      // but kept as a sanity check during development.)
      const primitiveBuCostById = new Map<number, number>();
      for (const tab of CHARACTER_TABS) {
        for (const slot of pendingSlots[tab]) {
          if (slot.kind === "primitive" && typeof slot.buCost === "number") {
            if (!primitiveBuCostById.has(slot.primitiveId)) {
              primitiveBuCostById.set(slot.primitiveId, slot.buCost);
            }
          }
        }
      }
      // Phase 8.3b: positiveSpent should equal sum of non-mirror
      // instance BU costs. The footer already computes this via
      // buSummary. Sanity-check that our local computation agrees.
      const localPositiveSpent = primitiveInstances
        .filter((inst) => !inst.isMirrored)
        .reduce((sum, inst) => sum + (primitiveBuCostById.get(inst.primitiveId) ?? 0), 0);
      if (localPositiveSpent !== buSummary.positiveSpent) {
        console.warn(
          `[character save] buSummary mismatch: local=${localPositiveSpent} footer=${buSummary.positiveSpent}`,
        );
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
        // Edit: PATCH the existing character. Phase 8.4 v18
        // (Mashu 2026-07-28): send the SAME bundled shape as
        // POST so heritage changes (add / remove / replace) get
        // persisted. Previously PATCH only sent the flat
        // primitiveInstances / capabilityIds / itemIds arrays
        // and IGNORED heritages — meaning removing all
        // heritages in edit mode and clicking Save left the
        // character_heritages rows untouched.
        //
        // Phase 8.4 v24.8 (Mashu 2026-07-30): per-tab routing
        // fix v2. v24.7 populated PERSONAL in addition to the
        // per-tab keys, which meant the bundle-expander's
        // capabilityMap (Map keyed by capabilityId) dedup'd
        // each cap by overwriting the per-tab entry with the
        // PERSONAL one (insertion order: UPBRINGING → PERSONAL
        // in `for (const [source, list] of Object.entries…)`).
        // The PERSONAL source then coerced to slot_tab='MANIFEST'
        // — exactly what Mashu was seeing despite my v24.7 fix.
        //
        // Fix: do NOT include the legacy flat arrays in
        // PERSONAL when the bundled per-tab keys are populated.
        // PERSONAL is now ONLY a fallback for old clients that
        // haven't been updated; the modal always populates
        // per-tab buckets and should never put anything in
        // PERSONAL. The route also has a "bundled non-empty"
        // guard (F6) that discards legacy capabilityIds when
        // bundled is present — we trust that here and
        // simplify by not populating PERSONAL at all.
        url = `/api/characters/${editCharacterId}`;
        method = "PATCH";
        const primBySourceEdit: Record<string, Array<{ id: number; isMirrored: boolean }>> = {
          LINEAGE: [...primitivesByTab["LINEAGE"]],
          UPBRINGING: [...primitivesByTab["UPBRINGING"]],
          MANIFEST: [...primitivesByTab["MANIFEST"]],
          PERSONAL: [],
        };
        const capsBySourceEdit: Record<string, Array<{ id: string; isMirrored: boolean }>> = {
          LINEAGE: [...capabilitiesByTab["LINEAGE"]],
          UPBRINGING: [...capabilitiesByTab["UPBRINGING"]],
          MANIFEST: [...capabilitiesByTab["MANIFEST"]],
          PERSONAL: [],
        };
        const itemsBySourceEdit: Record<
          string,
          Array<{ id: string; quantity: number; equipped: boolean }>
        > = {
          // Items are character-scoped only (no per-tab routing
          // for items in v24.x). Sending them in PERSONAL
          // matches the route's expectations.
          PERSONAL: itemsForSave.map((i) => ({
            id: i.id,
            quantity: 1,
            equipped: i.equipped,
          })),
        };
        body = {
          ...baseBody,
          heritages,
          primitivesBySource: primBySourceEdit,
          capabilitiesBySource: capsBySourceEdit,
          itemsBySource: itemsBySourceEdit,
          // Phase 8.4 v24.8 (Mashu 2026-07-30): the route
          // supports per-tab routing for primitives via
          // primitivesBySource, AND the legacy flat shape
          // primitiveInstances. Sending both causes
          // duplicate inserts in the saver's expansionInput
          // (each primitive gets pushed twice → 2 rows in
          // character_primitives). Mashu's repro:
          // "I deleted most of them, saved. Edited again,
          // they were again duplicated quite a few times."
          //
          // The route's F6 guard for caps rebuilds
          // capabilitiesBySource from the bundled shape
          // alone. There's no equivalent for primitives yet,
          // so the safest move is to NOT send the legacy
          // primitiveInstances at all — the modal is the
          // only caller and it always populates
          // primitivesBySource. capabilityIds gets the same
          // treatment (F6 already drops it, but sending
          // nothing is cleaner and removes the warn log).
          primitiveInstances: [],
          capabilityIds: [],
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
          LINEAGE: [...primitivesByTab["LINEAGE"]],
          UPBRINGING: [...primitivesByTab["UPBRINGING"]],
          MANIFEST: [...primitivesByTab["MANIFEST"]],
          PERSONAL: [],
        };
        const capsBySource: Record<string, Array<{ id: string; isMirrored: boolean }>> = {
          LINEAGE: [...capabilitiesByTab["LINEAGE"]],
          UPBRINGING: [...capabilitiesByTab["UPBRINGING"]],
          MANIFEST: [...capabilitiesByTab["MANIFEST"]],
          PERSONAL: [],
        };
        const itemsBySource: Record<
          string,
          Array<{ id: string; quantity: number; equipped: boolean }>
        > = {
          PERSONAL: itemsForSave.map((i) => ({
            id: i.id,
            quantity: 1,
            equipped: i.equipped,
          })),
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

      // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — save regression
      // debug. Log exactly what the modal is about to send so
      // we can see the bundled caps + legacy capabilityIds
      // shape. The server has matching logs at the route +
      // saver level — paste both sides to triangulate.
      console.log(
        `[character save ${editCharacterId ?? "NEW"}] PATCH body:`,
        {
          ...(body as Record<string, unknown>),
          // Trim noisy arrays to keep the log readable.
          heritages: "see server log for details",
        },
        {
          capabilityIdsSent: capabilityIds,
          capBundledCounts: Object.fromEntries(
            Object.entries(
              (body as Record<string, unknown>)[
                "capabilitiesBySource"
              ] as Record<string, Array<unknown>>,
            ).map(([k, v]) => [k, v.length]),
          ),
        },
      );

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

      // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — log the
      // POST-SAVE state of the response. The server's
      // console.log was being lost when the modal
      // hard-navigated to /characters/[id] and cleared the
      // console. The PATCH response carries the FULL
      // character payload (capabilityLinks, primitiveLinks,
      // heritageLinks) — that's the authoritative
      // post-insert state from inside the same transaction.
      // If capability count here matches what we sent,
      // save worked. If it doesn't, save didn't.
      console.log(
        `[character save ${charId}] POST-SAVE response state:`,
        {
          capabilityCount: data.character.capabilityLinks?.length ?? 0,
          capabilityIds: (data.character.capabilityLinks ?? []).map(
            (l: { capabilityId: string; originHeritageId: string | null }) => ({
              id: l.capabilityId,
              originHeritageId: l.originHeritageId,
            }),
          ),
          primitiveCount: data.character.primitiveLinks?.length ?? 0,
          heritageCount: data.character.heritageLinks?.length ?? 0,
        },
      );

      // Phase 8.3b UI fix #1 rev 3 (Mashu 2026-07-27):
      //   "After I save, I still don't get redirected to
      //   https://www.swordweave.quest/characters/[id]" — even after
      //   flipping to router.push() FIRST (rev 2), the redirect still
      //   didn't land. Root cause: router.push() schedules a soft-
      //   transition + updates history.pushState synchronously, but
      //   the follow-up close() flips isOpen=false which causes the
      //   modal root (character-modal.tsx) to unmount on the same
      //   render batch. Next.js's App Router soft-transition was
      //   racing the unmount and losing.
      //
      //   Fix: just navigate. Don't close. The current page
      //   (e.g. /atelier) holds the modal; the new page
      //   (/characters/[id]) does not. When the route changes,
      //   Next.js unmounts the old page's tree (which includes the
      //   modal) and mounts the new page's tree. No manual close()
      //   needed — the navigation IS the cleanup.
      //
      //   We await router.push() to confirm the navigation actually
      //   started; if it throws, we fall back to hard navigation
      //   via window.location so the user isn't stranded on a
      //   dangling modal.
      showToast(
        editCharacterId
          ? `Saved changes to "${charName}".`
          : `Created character "${charName}"!`,
        "success",
      );
      clearAllDraftStorage();
      // Phase 8.4 v24.11 (Mashu 2026-07-30): the save just
      // committed to DB, so the localStorage draft for this
      // character is now stale. Clear it so the next edit-open
      // re-seeds from DB instead of replaying the just-saved
      // state. (We deliberately did NOT clear it before the
      // fetch — a failed save leaves the draft intact, letting
      // the user retry without losing work.)
      try {
        window.localStorage.removeItem(pendingSlotsKey(editCharacterId));
        // Also clear the "new" key if we just transitioned
        // from create-mode → save → DB row created. The new
        // character's id is in `charId` (the response payload).
        if (charId) {
          window.localStorage.removeItem(pendingSlotsKey(charId));
        }
      } catch {
        // ignore
      }
      if (editCharacterId) {
        clearPendingEdit();
      }
      resetDraft();
      // Phase 8.3b rev 4 (Mashu 2026-07-27):
      //   After three rounds of trying to make soft-nav (router.push)
      //   work, the console log shows it RESOLVES CLEANLY but the
      //   page never actually changes. Root cause unclear — could be
      //   a React 19 + Next.js 16 race where the soft-nav RSC
      //   payload finishes but the tree swap is suppressed by a
      //   concurrent state update from resetDraft() (editCharacterId
      //   going to null). The modal is in a portal on AppShell so it
      //   survives the soft-nav and keeps us "stranded" on /atelier.
      //
      //   Fix: hard-navigate via window.location.assign. We accept
      //   the page reload cost in exchange for a redirect that
      //   actually lands. The form data is already saved to the DB,
      //   and resetDraft() cleared the modal state, so there is
      //   nothing to lose in the reload.
      const target = `/characters/${charId}`;
      // eslint-disable-next-line no-console
      console.log("[SW save] hard-navigating to", target);
      // Phase 8.3d (Mashu 2026-07-27): approve the navigation so the
      // browser's native beforeunload dialog doesn't fire after a
      // successful save. The character-modal guard reads this flag
      // synchronously and skips preventDefault if it's set.
      approveNavigation();
      window.location.assign(target);
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

  // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — per-render
  // log of canCreate's preconditions. Was useful as a
  // one-off diagnostic; left in place because it's the
  // only way to debug "why is Save disabled?" without
  // a custom devtools panel. Fires once per render of
  // the footer (cheap).
  if (editCharacterId) {
    console.log(
      `[character-modal] Save render — canCreate=${canCreate}`,
      {
        editCharacterId,
        isPending,
        nameValid,
        attrValid,
        debtExceeded,
        debtUsed: buSummary.debtUsed,
        debtCeiling,
        overBudget,
      },
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
          // Phase 8.4 v21 (Mashu 2026-07-29): T2 — items tab
          // now renders via the dedicated ItemsTab component
          // (item containers with nested primitives/caps/
          // effects + equipped toggle + cap active/trigger).
          // Per Mashu's spec, items are item-scoped — their
          // nested content does NOT enter the character's
          // general primitive pool.
          <ItemsTab
            characterSeedItemLinks={seededCharacter?.itemLinks ?? []}
          />
        )}
      </div>

      {/* Footer — compact stats + Create button. Pinned to bottom of
          modal scroll container.
          Phase 8.2 batch 18 (Mashu 2026-07-27): BU DEBT format is `X/Y`
          with a small grey `(max Y BU)` subtitle. Dropped the
          `- X used` suffix.
          Phase 8.2 batch 19 (Mashu 2026-07-27): wrap stats in their
          own container so the Save/Create button stays anchored right
          on mobile (stats can wrap inside, button never does). Also
          wired the carry-over rule:
            - mirror primitives earn debt (Y = their sum)
            - non-mirror overflow absorbs into that pool (X = min(overflow, Y))
            - any overflow past available stays in budget overflow (+N). */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FooterStat label="Lvl" value={String(attributes.level)} />
          <FooterStat
            label="BU"
            value={
              budgetOverflowRemainder > 0
                ? `${budgetVisible}/${budget} (+${budgetOverflowRemainder})`
                : `${budgetVisible}/${budget}`
            }
            tone={overBudget ? "warn" : "default"}
          />
          {buSummary.debtUsed > 0 || debtCeiling > 0 ? (
            <FooterStat
              label="BU debt"
              value={`${debtX}/${debtY}`}
              sublabel={`(max ${debtCeiling} BU)`}
              tone={debtExceeded ? "warn" : "default"}
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — if
            // canCreate is false, show a toast with the
            // specific reason. The button was silently
            // doing nothing before, which made it look
            // like the save "worked" when it didn't.
            if (!canCreate) {
              showToast(
                `Save blocked: ${
                  !nameValid
                    ? "name required"
                    : !attrValid
                      ? "attributes must sum to 10"
                      : isPending
                        ? "save already in progress"
                        : debtExceeded
                          ? `BU debt exceeds ceiling (${buSummary.debtUsed} > ${debtCeiling})`
                          : "unknown"
                }`,
                "error",
              );
              return;
            }
            if (!hasEdits) {
              showToast("No changes to save.", "info");
              return;
            }
            void handleSubmit();
          }}
          disabled={!canCreate || !hasEdits}
          className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {/* Phase 8.2 batch 7: button label flips with mode. */}
          {isPending
            ? editCharacterId
              ? "Saving…"
              : "Creating…"
            : editCharacterId
            ? hasEdits
              ? "Save changes"
              : "No changes"
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
  sublabel,
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
  /** Optional small-grey caption rendered after the value, e.g. "(max 20 BU)". */
  sublabel?: string;
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
      {sublabel && (
        <span className="font-sans text-[10px] font-normal normal-case text-muted-foreground">
          {sublabel}
        </span>
      )}
    </span>
  );
}

