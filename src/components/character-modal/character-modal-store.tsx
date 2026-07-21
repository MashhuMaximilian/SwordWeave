"use client";

// =============================================================================
// CharacterModalStore — persistent client-side state for the character
// creation modal (Phase 8.1, rework).
//
// The store lives at the AppShell level so it survives tab navigation
// between /atelier?build=grammar / heritage / blueprint. It does NOT use
// Zustand (not installed) — React Context is enough because the host
// provider never unmounts during navigation.
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
  useState,
  type ReactNode,
} from "react";

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
  open: () => void;
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
   * Reset everything: activeStep → identity, pendingSlots → empty.
   * Called after successful create so the next open is fresh.
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeStep, setActiveStepState] = useState<CharacterTabId>("identity");
  const [pendingSlots, setPendingSlots] = useState<PendingSlotsByTab>(EMPTY_PENDING);
  // Override for cases where dirty needs to be true outside of pending
  // slots (e.g. the wizard has typed identity/backstory/attributes).
  const [dirtyOverride, setDirtyOverride] = useState(false);

  // Hydrate activeStep from localStorage on mount.
  useEffect(() => {
    setActiveStepState(loadActiveStep());
  }, []);

  // Persist activeStep to localStorage on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_STEP_STORAGE_KEY, activeStep);
    } catch {
      // ignore
    }
  }, [activeStep]);

  const open = useCallback(() => setIsOpen(true), []);
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

  const setDirty = useCallback((dirty: boolean) => setDirtyOverride(dirty), []);

  const resetDraft = useCallback(() => {
    setPendingSlots(EMPTY_PENDING);
    setDirtyOverride(false);
    setActiveStepState("identity");
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
      open,
      close,
      toggle,
      setActiveStep,
      queueSlot,
      removeSlot,
      clearSlots,
      resetDraft,
      setDirty,
      setSlotMirror,
    }),
    [
      isOpen,
      activeStep,
      pendingSlots,
      isDirty,
      open,
      close,
      toggle,
      setActiveStep,
      queueSlot,
      removeSlot,
      clearSlots,
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
      open: () => {},
      close: () => {},
      toggle: () => {},
      setActiveStep: () => {},
      queueSlot: () => {},
      removeSlot: () => {},
      clearSlots: () => {},
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

void isSlotTab; // currently unused — exported for future helpers