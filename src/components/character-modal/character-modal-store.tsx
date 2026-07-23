"use client";

// =============================================================================
// CharacterModalStore — persistent client-side state for the character
// creation modal (Phase 8.1, rework).
//
// The store lives at the AppShell level so it survives tab navigation
// between /atelier?build=grammar / heritage / blueprint. It does NOT use
// Zustand (not installed) — React Context is enough because the host
// provider never unmounts during navigation.
// =============================================================================
//
// === Re-spec (Mashu 2026-07-21) ===
//
// The modal is now a 7-TAB interface (not the legacy 5-step wizard):
//   identity, backstory, attributes, lineage, upbringing, manifest, items
//
// State model:
//   - activeStep: which tab is open. Persists across open/close so the
//     user lands on the same tab they were on. Persisted to
//     localStorage (per the spec).
//   - pendingSlots: per-tab queues of things the user wants to slot from
//     /atelier. Heritage slots go to the tab matching the heritage's
//     kind (LINEAGE → lineage tab, etc.). Primitives / capabilities /
//     effects go to the activeStep's tab. Items go to the items tab.
//     Cleared on successful create. NOT yet persisted to localStorage
//     in batch 5 (pendingSlots only exist while the user is actively
//     browsing /atelier — they hydrate from there, not from the modal).
//   - isDirty: derived flag (true when pendingSlots has anything OR
//     identity/backstory/attributes has typed content).
//
// What does NOT live here in 8.1 batch 5:
//   - Saved characters (server side).
//   - Per-field form state (Identity/Backstory/Attributes inputs) —
//     those live in local components and persist via localStorage
//     separately (existing usePersistedState pattern from batch 4).
//
// Modal-stack integration: the character modal does NOT use useModalStack.
// Route-change stack-clear in ModalStackHost would clobber the modal,
// which the spec forbids.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CharacterSeed } from "./character-seed";

/**
 * The 7 tabs in their display order. Tab ids are stable strings so they
 * serialize cleanly to localStorage.
 */
export const CHARACTER_TABS = [
  "identity",
  "backstory",
  "attributes",
  "lineage",
  "upbringing",
  "manifest",
  "items",
] as const;
export type CharacterTabId = (typeof CHARACTER_TABS)[number];

/** Human-readable labels for the tab bar. */
export const CHARACTER_TAB_LABELS: Record<CharacterTabId, string> = {
  identity: "Identity",
  backstory: "Backstory",
  attributes: "Attributes",
  lineage: "Lineage",
  upbringing: "Upbringing",
  manifest: "Manifest",
  items: "Items",
};

/**
 * One pending slot — the user clicked "Slot into [step]" on a library
 * preview. Discriminated union so each kind carries the right shape.
 *
 * Phase 8.1 batch 10: every slot carries a stable `slotId` (assigned
 * at queue time) and an optional `mirror` flag. The mirror flag is
 * only meaningful for primitive slots whose primitive has
 * `isMirrorable = true` — when true, the primitive's `mirrorBuCredit`
 * contributes negative BU to the character's volatility rating and
 * counts against `maxBuDebtForLevel(level)`. Mirror state lives on
 * the slot (not on the primitive itself) because the same primitive
 * can appear multiple times in different slots and the user toggles
 * each independently.
 */
export type PendingSlot = {
  /** Stable id assigned when the slot was queued. Used as React key
   * and as the lookup key for mirror toggles. The store stamps this
   * automatically when it's missing, so call sites don't need to
   * supply one — but it's always populated after queueSlot. */
  slotId?: string;
  /** True if this slot's primitive is mirrored (BU debt). Only
   * meaningful for kind="primitive" where the primitive's
   * isMirrorable is true. False / ignored for other kinds. */
  mirror?: boolean;
} & (
  | {
      kind: "heritage";
      heritageId: string;
      /** Heritage's own kind = the tab it slots into (LINEAGE/UPBRINGING/MANIFEST). */
      heritageKind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
      name: string;
    }
  | {
      kind: "primitive";
      primitiveId: number;
      /** Always equals the activeStep at queue time (snapshot). */
      tab: CharacterTabId;
      name: string;
      /**
       * Phase 8.1 batch 10: mirror metadata captured at queue time so
       * the slot receiver can render the mirror toggle without
       * refetching. isMirrorable=false means the mirror toggle is
       * hidden. mirrorBuCredit is the negative-BU contribution when
       * mirrored (typically == buCost but the canon allows DM override
       * to set it lower).
       */
      isMirrorable?: boolean;
      mirrorBuCredit?: number;
      buCost?: number;
    }
  | {
      kind: "capability";
      capabilityId: string;
      tab: CharacterTabId;
      name: string;
    }
  | {
      kind: "effect";
      effectId: string;
      tab: CharacterTabId;
      name: string;
    }
  | {
      kind: "item";
      itemId: string;
      /** Always "items". Kept as CharacterTabId for uniform shape. */
      tab: "items";
      name: string;
    }
);

/** Pending slots bucketed by tab — makes per-tab rendering trivial. */
export type PendingSlotsByTab = Record<CharacterTabId, PendingSlot[]>;

const EMPTY_PENDING: PendingSlotsByTab = {
  identity: [],
  backstory: [],
  attributes: [],
  lineage: [],
  upbringing: [],
  manifest: [],
  items: [],
};

const ACTIVE_STEP_STORAGE_KEY = "swordweave:character-modal:active-step";
/**
 * Phase 8.2 batch 7 rev 2: persisted edit-session id. The /characters
 * Edit button writes here, navigates to /atelier, and the atelier
 * client reads + clears this on mount to seed the modal.
 */
const PENDING_EDIT_STORAGE_KEY = "swordweave:character-modal:pending-edit-id";

// Phase 8.1 batch 10: stable slot ids. We assign a fresh id per
// queueSlot() call so the mirror toggle (and any future per-slot
// edits) has a stable handle. Counter + timestamp keeps ids
// monotonic across the session; crypto.randomUUID() provides the
// uniqueness across tabs.
let _slotCounter = 0;
function makeSlotId(): string {
  _slotCounter += 1;
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `slot-${_slotCounter}-${uuid}`;
}

function loadActiveStep(): CharacterTabId {
  if (typeof window === "undefined") return "identity";
  try {
    const raw = window.localStorage.getItem(ACTIVE_STEP_STORAGE_KEY);
    if (raw && (CHARACTER_TABS as readonly string[]).includes(raw)) {
      return raw as CharacterTabId;
    }
  } catch {
    // localStorage disabled — fall through to default.
  }
  return "identity";
}

interface CharacterModalState {
  isOpen: boolean;
  activeStep: CharacterTabId;
  pendingSlots: PendingSlotsByTab;
  isDirty: boolean;
  /**
   * Phase 8.2 batch 7 rev 2: pending edit session. Persisted in
   * localStorage so it survives the navigation from /characters
   * to /atelier. When non-null on atelier mount, the client
   * bootstraps the modal via `openForEditFromStore` to seed the
   * pre-filled editor.
   *
   * Why localStorage and not URL params? Per Mashu 2026-07-23:
   * the atelier URL is already volatile (build=primitive,
   * build=heritage, kind=lineage, intent=fork, etc.). Adding
   * ?edit=<id> on top of those would clash when the user forks
   * or loads primitives into a build. LocalStorage is the
   * session-scoped right place.
   */
  pendingEditId: string | null;
  /**
   * Phase 8.2 batch 7: when non-null, the modal is in EDIT mode
   * (loaded from an existing character). When null, the modal is in
   * CREATE mode (empty draft). Drives:
   *   - Title bar: "Edit: <name>" vs "New Character"
   *   - Save button label: "Save changes" vs "Create"
   *   - Save endpoint: PATCH /api/characters/[id] vs POST /api/characters
   */
  editCharacterId: string | null;
  /**
   * Cached name of the character being edited, so the modal can
   * show "Edit: <name>" while the fetch is in flight and after the
   * store has been seeded.
   */
  editCharacterName: string | null;
  /**
   * True while openForEdit() is fetching + seeding the store. The
   * modal uses this to render a spinner instead of an empty form.
   */
  isSeedingEdit: boolean;
  /**
   * Error from the most recent openForEdit() call, if any.
   * Cleared on the next successful open.
   */
  editSeedError: string | null;
  /**
   * Internal: the most-recently-fetched character in edit mode.
   * Exposed so the form can read it via useEffect and seed itself
   * exactly once per open. Null when not in edit mode or after
   * resetDraft.
   */
  seededCharacter: CharacterSeed | null;
  open: () => void;
  /**
   * Phase 8.2 batch 8: open the modal in a way that's safe to call
   * from a library's "Slot into character" button when the modal
   * may already be open in EDIT mode. Plain `open()` resets
   * editCharacterId to null, which was the cause of the bug
   * where clicking "Add" on a primitive/heritage in /atelier
   * silently flipped an active edit session into create mode.
   * openForSlot does the same thing as `open()` but skips the
   * state reset when the modal is already open.
   */
  openForSlot: () => void;
  /**
   * Phase 8.2 batch 7 rev 2: open the modal in EDIT mode for an
   * existing character. Writes the id to localStorage so the
   * /atelier client can pick it up on mount, then navigates to
   * /atelier. The atelier client calls openForEditFromStore(id)
   * to do the actual fetch + seed.
   *
   * Returns immediately; the fetch + seed happens on the atelier
   * side. If we were already on /atelier, we still write
   * localStorage and let the atelier's existing effect pick it up.
   *
   * Per Mashu 2026-07-23: the Edit flow navigates to atelier.
   * The character modal is the destination — atelier is the
   * surface where you browse mechanics/heritages/items to slot.
   * Same UX as clicking the Mona Lisa FAB from elsewhere: the
   * atelier's bottom bar is where slotting happens.
   */
  openForEdit: (characterId: string) => Promise<void>;
  /**
   * Internal: do the actual fetch + seed for an edit session.
   * Called by the /atelier client on mount when pendingEditId is
   * non-null. Also called directly by tests / other entry points
   * that don't need the navigation step.
   */
  openForEditFromStore: (characterId: string) => Promise<void>;
  /**
   * Phase 8.2 batch 7 rev 2: clear the persisted edit session.
   * Called after the atelier has consumed it, after a successful
   * save, and on explicit discard.
   */
  clearPendingEdit: () => void;
  close: () => void;
  toggle: () => void;
  setActiveStep: (tab: CharacterTabId) => void;
  /**
   * Queue a slot from /atelier. Called by the library preview's
   * context-aware "Slot into [step]" button. The caller passes the
   * destination tab (for primitives/capabilities/effects) or lets the
   * store route the slot based on its kind (for heritage/items).
   */
  queueSlot: (slot: PendingSlot) => void;
  /**
   * Remove a queued slot. Used when the user removes a primitive from
   * the modal's slot list before saving.
   */
  removeSlot: (tab: CharacterTabId, index: number) => void;
  /**
   * Clear all pending slots (e.g. after successful create).
   */
  clearSlots: () => void;
  /**
   * Phase 8.2 batch 7: apply a freshly-fetched character to the
   * pending slots queue. Called by TabbedCharacterForm in response
   * to seededCharacter arriving from openForEdit(). Also resets
   * the dirty override to false (the seeded state is the user's
   * editing starting point, not a dirty change).
   *
   * Does NOT touch activeStep (we want to land on identity, but
   * the form can override).
   */
  applySeed: (slots: PendingSlotsByTab) => void;
  /**
   * Reset everything: activeStep → identity, pendingSlots → empty,
   * editCharacterId → null. Called after successful create OR after
   * the user discards changes in edit mode.
   */
  resetDraft: () => void;
  /**
   * Explicit dirty override. Use sparingly — the store normally
   * derives isDirty from pendingSlots.
   */
  setDirty: (dirty: boolean) => void;
  /**
   * Phase 8.1 batch 10: toggle the mirror flag on a specific slot.
   * Mirror only applies to primitive slots whose primitive has
   * isMirrorable=true; calling on other slot kinds is a no-op.
   */
  setSlotMirror: (slotId: string, mirror: boolean) => void;
}

const CharacterModalCtx = createContext<CharacterModalState | null>(null);

function isSlotTab(
  tab: CharacterTabId,
  slot: PendingSlot,
): boolean {
  if (slot.kind === "heritage") {
    return (
      (slot.heritageKind === "LINEAGE" && tab === "lineage") ||
      (slot.heritageKind === "UPBRINGING" && tab === "upbringing") ||
      (slot.heritageKind === "MANIFEST" && tab === "manifest")
    );
  }
  return slot.tab === tab;
}

function totalSlots(slots: PendingSlotsByTab): number {
  return CHARACTER_TABS.reduce((acc, t) => acc + slots[t].length, 0);
}

export function CharacterModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpenState] = useState(false);
  // Phase 8.2 batch 9: keep a synchronous ref in lockstep with
  // isOpen state. The ref is what openForSlot() reads so it can
  // decide whether to do nothing (preserving edit mode) vs call
  // open() (fresh create-mode open). State setters from inside
  // another setter's updater fn were fragile in StrictMode (the
  // previous bug). The ref is side-effect-free.
  const isOpenRef = useRef(false);

  // Phase 8.2 batch 14 fix: update the ref SYNCHRONOUSLY so
  // openForSlot() sees the correct value immediately, not on the
  // next render. Previously the ref was updated inside the updater
  // (which runs during render), creating a race window where
  // isOpenRef.current was stale between setIsOpen() call and the
  // next render. If the user clicked "Slot into character" in that
  // window, openForSlot() would see isOpenRef.current === false
  // and call open(), which resets editCharacterId → "Save changes → Create" flip.
  const setIsOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: boolean) => boolean)(isOpenRef.current)
          : next;
      isOpenRef.current = resolved;

      setIsOpenState((prev) => {
        // Phase 8.2 batch 14 (Mashu 2026-07-23, "save changes still flips
        // to create after I add things"): instrument isOpen transitions
        // alongside editCharacterId transitions so we can see the FULL
        // lifecycle, not just the one field that "looks wrong". The
        // Edit→Create flip happens when editCharacterId goes null, but
        // that flip is usually a downstream effect of a wider re-open
        // (open() does setIsOpen(false) → reset → setIsOpen(true) in one
        // synchronous block). Logging just editCharacterId missed the
        // isOpen transitions that preceded it.
        if (prev !== resolved) {
          // eslint-disable-next-line no-console
          console.warn(
            "[character-modal] isOpen changed",
            JSON.stringify({ from: prev, to: resolved }),
            "\nStack:\n",
            new Error().stack,
          );
        }
        return resolved;
      });
    },
    [],
  );

  const [activeStep, setActiveStepState] = useState<CharacterTabId>("identity");
  const [pendingSlots, setPendingSlots] = useState<PendingSlotsByTab>(EMPTY_PENDING);
  // Override for cases where dirty needs to be true outside of pending
  // slots (e.g. the wizard has typed identity/backstory/attributes).
  const [dirtyOverride, setDirtyOverride] = useState(false);
  // Phase 8.2 batch 7: edit-mode state. See CharacterModalState above.
  const [editCharacterId, setEditCharacterIdState] = useState<string | null>(null);
  // Phase 8.2 batch 10: wrap setEditCharacterId so every transition
  // logs a stack trace to the browser console. Mashu 2026-07-23:
  // "It still doesn't keep save changes button and it changes to
  // create button instead after I add some things but I cannot
  // exactly describe the behavior or why and how it happens." A
  // silent flip from "Save changes" → "Create" means something
  // called setEditCharacterId(null) mid-edit. To find the
  // offender we log every setter call with its stack — the line
  // that flipped state will be obvious in the console.
  const setEditCharacterId = useCallback(
    (next: string | null | ((prev: string | null) => string | null)) => {
      setEditCharacterIdState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: string | null) => string | null)(prev)
            : next;
        if (prev !== resolved) {
          // eslint-disable-next-line no-console
          console.warn(
            "[character-modal] editCharacterId changed",
            JSON.stringify({ from: prev, to: resolved }),
            "\nStack:\n",
            new Error().stack,
          );
        }
        return resolved;
      });
    },
    [],
  );
  const [editCharacterName, setEditCharacterName] = useState<string | null>(null);
  const [isSeedingEdit, setIsSeedingEdit] = useState(false);
  const [editSeedError, setEditSeedError] = useState<string | null>(null);
  /**
   * Stash the fetched character payload here so the form can read
   * it via useEffect when ready to seed. Cleared on close/reset.
   */
  const [seededCharacter, setSeededCharacter] = useState<CharacterSeed | null>(
    null,
  );
  /**
   * Phase 8.2 batch 7 rev 2: persistent pending-edit id from
   * localStorage. Hydrated on mount. The /atelier client reads
   * this and calls openForEditFromStore() once to seed the modal.
   */
  const [pendingEditId, _setPendingEditId] = useState<string | null>(null);

  // Hydrate activeStep from localStorage on mount.
  useEffect(() => {
    setActiveStepState(loadActiveStep());
  }, []);

  // Phase 8.2 batch 7 rev 2: hydrate pendingEditId from localStorage
  // on mount. The atelier client uses this to know which character
  // the user clicked Edit on so it can auto-seed the modal.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PENDING_EDIT_STORAGE_KEY);
      if (raw && raw.length > 0) {
        _setPendingEditId(raw);
      }
    } catch {
      // localStorage disabled — fall through.
    }
  }, []);

  // Persist activeStep to localStorage on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_STEP_STORAGE_KEY, activeStep);
    } catch {
      // ignore
    }
  }, [activeStep]);

  const open = useCallback(() => {
    // Phase 8.2 batch 10: defence in depth against silent
    // Edit→Create flips. Log every editCharacterId transition
    // (already wrapped above) AND, here at the only legitimate
    // "open in fresh CREATE mode" entry point, set isOpen first
    // so the modal is unambiguously closed when we reset state.
    setIsOpen(false);
    setEditCharacterId(null);
    setEditCharacterName(null);
    setIsSeedingEdit(false);
    setEditSeedError(null);
    setSeededCharacter(null);
    setIsOpen(true);
  }, []);

  /**
   * Phase 8.2 batch 8 + 9: open the modal in a way that's safe to
   * call from a library's "Slot into character" button when the
   * modal may already be open in EDIT mode. Plain `open()` resets
   * editCharacterId to null, which was the cause of the bug where
   * clicking "Add" on a primitive/heritage in /atelier silently
   * flipped an active edit session into create mode.
   *
   * Implementation: a tiny ref tracks "did we last open in create
   * mode". Library callers always pass through `openForSlot()` —
   * if the modal is currently closed, we open in CREATE mode
   * (fresh). If it's already open, we do NOTHING. This is the
   * simplest invariant that preserves edit state.
   *
   * Why the ref instead of reading `isOpen` from state: the previous
   * implementation used `setIsOpen((currentOpen) => ...)` and called
   * state setters from inside the updater fn. React 18 StrictMode
   * runs updaters twice in dev, which double-fired the reset and
   * could clobber edit state even when the modal was already open.
   * The ref is a synchronous, side-effect-free flag.
   */
  const openForSlot = useCallback(() => {
    if (isOpenRef.current) return; // modal already open, do nothing
    open();
  }, [open]);

  /**
   * Phase 8.2 batch 7 rev 2: open the modal in EDIT mode for an
   * existing character. Writes the id to localStorage so the
   * /atelier client can pick it up on mount, then navigates to
   * /atelier. The atelier client calls openForEditFromStore(id)
   * to do the actual fetch + seed.
   *
   * Returns immediately; the fetch + seed happens on the atelier
   * side. If we were already on /atelier, we still write
   * localStorage and let the atelier's existing effect pick it up.
   *
   * Per Mashu 2026-07-23: the Edit flow navigates to atelier.
   * The character modal is the destination — atelier is the
   * surface where you browse mechanics/heritages/items to slot.
   * Same UX as clicking the Mona Lisa FAB from elsewhere: the
   * atelier's bottom bar is where slotting happens.
   */
  const openForEdit = useCallback(async (characterId: string) => {
    try {
      window.localStorage.setItem(PENDING_EDIT_STORAGE_KEY, characterId);
    } catch {
      // localStorage disabled — degrade silently; the user will
      // still see the modal but it won't be pre-filled.
    }
    _setPendingEditId(characterId);
    // Navigate to /atelier. The next-router router has to be
    // called from a hook context, so the caller (Edit button) is
    // responsible for routing after this returns.
    // We import router from next/navigation at the call site and
    // call router.push('/atelier') there. This avoids forcing
    // every consumer of openForEdit to also navigate.
  }, []);

  /**
   * Internal: do the actual fetch + seed for an edit session.
   * Called by the /atelier client on mount when pendingEditId is
   * non-null. Also called directly by tests / other entry points
   * that don't need the navigation step.
   */
  const openForEditFromStore = useCallback(async (characterId: string) => {
    setIsSeedingEdit(true);
    setEditSeedError(null);
    setEditCharacterId(characterId);
    setEditCharacterName(null);
    setSeededCharacter(null);
    setIsOpen(true);

    try {
      const res = await fetch(`/api/characters/${characterId}`, {
        method: "GET",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to load character.";
        setEditSeedError(msg);
        setIsSeedingEdit(false);
        return;
      }
      const data = (await res.json()) as { character: CharacterSeed };
      setEditCharacterName(data.character.name);
      setSeededCharacter(data.character);
      setIsSeedingEdit(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error.";
      setEditSeedError(msg);
      setIsSeedingEdit(false);
    }
  }, []);

  /**
   * Phase 8.2 batch 7 rev 2: clear the persisted edit id.
   * Called after the atelier has consumed it, after a successful
   * save, and on explicit discard.
   */
  const clearPendingEdit = useCallback(() => {
    try {
      window.localStorage.removeItem(PENDING_EDIT_STORAGE_KEY);
    } catch {
      // ignore
    }
    _setPendingEditId(null);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const setActiveStep = useCallback((tab: CharacterTabId) => {
    setActiveStepState(tab);
  }, []);

  const queueSlot = useCallback((slot: PendingSlot) => {
    setPendingSlots((current) => {
      // Determine which tab the slot belongs to.
      let tab: CharacterTabId;
      if (slot.kind === "heritage") {
        if (slot.heritageKind === "LINEAGE") tab = "lineage";
        else if (slot.heritageKind === "UPBRINGING") tab = "upbringing";
        else tab = "manifest";
      } else if (slot.kind === "item") {
        tab = "items";
      } else {
        tab = slot.tab;
      }
      // Assign a stable slotId if the caller didn't supply one (it
      // shouldn't, but we guard so old call sites don't break).
      const stamped: PendingSlot = { ...slot, slotId: makeSlotId() };
      return { ...current, [tab]: [...current[tab], stamped] };
    });
  }, []);

  // Phase 8.1 batch 10: toggle the mirror flag on a specific slot.
  // Mirror only applies to primitive slots whose primitive is
  // mirrorable; calling this on other kinds is a no-op.
  const setSlotMirror = useCallback(
    (slotId: string, mirror: boolean) => {
      setPendingSlots((current) => {
        const next: PendingSlotsByTab = { ...current };
        for (const tab of CHARACTER_TABS) {
          const idx = next[tab].findIndex((s) => s.slotId === slotId);
          if (idx === -1) continue;
          const target = next[tab][idx]!;
          if (target.kind !== "primitive") {
            // Mirror only meaningful for primitives.
            return current;
          }
          const updated: PendingSlot =
            mirror === target.mirror
              ? target
              : { ...target, mirror };
          next[tab] = [
            ...next[tab].slice(0, idx),
            updated,
            ...next[tab].slice(idx + 1),
          ];
          return next;
        }
        return current;
      });
    },
    [],
  );

  const removeSlot = useCallback((tab: CharacterTabId, index: number) => {
    setPendingSlots((current) => ({
      ...current,
      [tab]: current[tab].filter((_, i) => i !== index),
    }));
  }, []);

  const clearSlots = useCallback(() => setPendingSlots(EMPTY_PENDING), []);

  const applySeed = useCallback((slots: PendingSlotsByTab) => {
    setPendingSlots(slots);
    setDirtyOverride(false);
  }, []);

  const setDirty = useCallback((dirty: boolean) => setDirtyOverride(dirty), []);

  const resetDraft = useCallback(() => {
    setPendingSlots(EMPTY_PENDING);
    setDirtyOverride(false);
    setActiveStepState("identity");
    // Phase 8.2 batch 7: clearing edit state too, so a subsequent
    // open() is fully clean.
    setEditCharacterId(null);
    setEditCharacterName(null);
    setIsSeedingEdit(false);
    setEditSeedError(null);
    setSeededCharacter(null);
    try {
      window.localStorage.removeItem(ACTIVE_STEP_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const isDirty = dirtyOverride || totalSlots(pendingSlots) > 0;

  const value = useMemo<CharacterModalState>(
    () => ({
      isOpen,
      activeStep,
      pendingSlots,
      isDirty,
      pendingEditId,
      editCharacterId,
      editCharacterName,
      isSeedingEdit,
      editSeedError,
      seededCharacter,
      open,
      openForSlot,
      openForEdit,
      openForEditFromStore,
      clearPendingEdit,
      close,
      toggle,
      setActiveStep,
      queueSlot,
      removeSlot,
      clearSlots,
      applySeed,
      resetDraft,
      setDirty,
      setSlotMirror,
    }),
    [
      isOpen,
      activeStep,
      pendingSlots,
      isDirty,
      pendingEditId,
      editCharacterId,
      editCharacterName,
      isSeedingEdit,
      editSeedError,
      seededCharacter,
      open,
      openForSlot,
      openForEdit,
      openForEditFromStore,
      clearPendingEdit,
      close,
      toggle,
      setActiveStep,
      queueSlot,
      removeSlot,
      clearSlots,
      applySeed,
      resetDraft,
      setDirty,
    ],
  );

  return (
    <CharacterModalCtx.Provider value={value}>{children}</CharacterModalCtx.Provider>
  );
}

export function useCharacterModal(): CharacterModalState {
  const ctx = useContext(CharacterModalCtx);
  if (!ctx) {
    return {
      isOpen: false,
      activeStep: "identity",
      pendingSlots: EMPTY_PENDING,
      isDirty: false,
      pendingEditId: null,
      editCharacterId: null,
      editCharacterName: null,
      isSeedingEdit: false,
      editSeedError: null,
      seededCharacter: null,
      open: () => {},
      openForSlot: () => {},
      openForEdit: async () => {},
      openForEditFromStore: async () => {},
      clearPendingEdit: () => {},
      close: () => {},
      toggle: () => {},
      setActiveStep: () => {},
      queueSlot: () => {},
      removeSlot: () => {},
      clearSlots: () => {},
      applySeed: () => {},
      resetDraft: () => {},
      setDirty: () => {},
      setSlotMirror: () => {},
    };
  }
  return ctx;
}

/**
 * Helper: pick the right tab for a "Slot into" button label based on
 * the modal's activeStep. The label reads "Slot into <tab>". If the
 * modal is closed, defaults to "Slot into Character" for clarity.
 */
export function tabLabelForActiveStep(
  activeStep: CharacterTabId,
  _isOpen: boolean,
): string {
  // Phase 8.1 fix-up (round 2): always return the tab label.
  // Previously we returned "Character" when the modal was closed,
  // but Mashu 2026-07-21 wants the slot button to read "Slot into
  // [step]" everywhere — the modal's last activeStep is still the
  // destination, so advertising it is more informative.
  return CHARACTER_TAB_LABELS[activeStep];
}

/**
 * Phase 8.1 batch 10: BU accounting for the in-progress character.
 * Sums up the BU cost of every queued slot and reports:
 *   - positiveSpent: sum of positive BU (non-mirrored primitives +
 *     capability / effect / heritage / item bundle costs)
 *   - mirrorCredit:  sum of negative BU from mirrored primitives
 *     (always <= 0)
 *   - debtUsed:      absolute value of mirrorCredit
 *   - netSpent:      positiveSpent + mirrorCredit (can be negative)
 *
 * Caveats (intentional, called out in code comments):
 *   - The modal store doesn't currently fetch primitive buCost
 *     metadata for capability/effect slots — those slots land in the
 *     API as `{ capabilityId, ... }` and the API resolves the bundle.
 *     Here we count them as 0 (caller treats BU > budget via the API
 *     response). Heritage cards display their bundle's computedBu in
 *     the receiver UI; we add those when present in batch 10f.
 *   - This helper is for live preview only. The authoritative BU
 *     accounting happens server-side at character-create time via
 *     the validateMirrorSet / evaluateBuLedger pipeline.
 */
export interface SlotBuSummary {
  positiveSpent: number;
  mirrorCredit: number;
  debtUsed: number;
  netSpent: number;
}

export function summarizeSlotBu(
  slots: PendingSlot[],
  heritageBundleBu?: Map<string, number>,
  capabilityBundleBu?: Map<string, number>,
): SlotBuSummary {
  let positiveSpent = 0;
  let mirrorCredit = 0;
  for (const slot of slots) {
    if (slot.kind === "primitive") {
      if (slot.mirror === true) {
        mirrorCredit -= slot.mirrorBuCredit ?? slot.buCost ?? 0;
      } else {
        positiveSpent += slot.buCost ?? 0;
      }
    } else if (slot.kind === "heritage") {
      // Heritage bundles contribute their computedBu as positive
      // cost. Caller passes a map of heritageId → computedBu (the
      // SlotReceiverTab keeps this map in session cache). If the
      // bundle hasn't been fetched yet, we treat it as 0 to avoid
      // double-counting or hanging the UI on stale values.
      const bu = heritageBundleBu?.get(slot.heritageId) ?? 0;
      positiveSpent += bu;
    } else if (slot.kind === "capability") {
      // Phase 8.1 batch 13.6 follow-up: capability bundles also
      // contribute their computedBu as positive cost. Same caching
      // pattern as heritages — see getCapabilityBundleBuMap().
      // Mashu 2026-07-22: "if I slot into anything primitives
      // capabilities or heritages the BU budget does not update."
      const bu = capabilityBundleBu?.get(slot.capabilityId) ?? 0;
      positiveSpent += bu;
    } else if (slot.kind === "effect") {
      // Effects aren't slotted standalone in v1 (see tabbed-character-form
      // line ~322). If/when they are, the same cache pattern applies —
      // we'd add an effectBundleBu map here. Today this branch never
      // executes; we keep it for forward-compat.
    }
    // item: bundle cost is tracked separately. Items don't
    // contribute to the progression pool per the canonical spec
    // (see src/app/api/characters/route.ts comment line 153).
  }
  const debtUsed = -mirrorCredit; // mirrorCredit <= 0
  const netSpent = positiveSpent + mirrorCredit;
  return { positiveSpent, mirrorCredit, debtUsed, netSpent };
}

void isSlotTab; // currently unused — exported for future helpers