"use client";

// =============================================================================
// CharacterModalStore — persistent client-side state for the character
// creation modal (Phase 8.1).
//
// The store lives at the AppShell level so it survives tab navigation
// between /atelier?build=grammar / heritage / blueprint. It does NOT use
// Zustand (not installed) — React Context is enough because the host
// provider never unmounts during navigation.
//
// What lives here in 8.1:
//   - isOpen: whether the modal is currently shown
//   - draft: the in-progress character form fields (typed loosely for now;
//     the wizard contract lands in batch 2 when the existing
//     CharacterWizard is wired in).
//   - isDirty: derived flag for unsaved-changes prompts
//
// What does NOT live here in 8.1:
//   - Saved characters (those go to the server)
//   - pendingSlots from library (that's 8.7d)
//   - Tab state (Mode B is 8.7a)
//
// Modal-stack integration: the character modal does NOT use useModalStack.
// It's a persistent overlay, not a short-lived preview. The route-change
// stack-clear in ModalStackHost would clobber the character modal when
// the user navigates between atelier tabs, which is exactly what the spec
// forbids. The character modal is its own thing; future short-lived
// modals (library picker side panel, etc.) can still use ModalStackHost.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CharacterDraft {
  name: string;
  notes: string;
  // batch 2 expands this with attributes, lineage, capabilities, etc.
  // Keeping it minimal now so the scaffold can land without forking the
  // existing CharacterWizard's state shape.
}

const EMPTY_DRAFT: CharacterDraft = {
  name: "",
  notes: "",
};

interface CharacterModalState {
  isOpen: boolean;
  draft: CharacterDraft;
  isDirty: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setField: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void;
  resetDraft: () => void;
}

const CharacterModalCtx = createContext<CharacterModalState | null>(null);

export function CharacterModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<CharacterDraft>(EMPTY_DRAFT);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const setField = useCallback(
    <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const value = useMemo<CharacterModalState>(
    () => ({
      isOpen,
      draft,
      // A draft is dirty if any field differs from the empty default.
      // Sufficient for batch 1's scaffold; batch 2 will compute it
      // against the last-saved snapshot for accuracy.
      isDirty: draft.name !== "" || draft.notes !== "",
      open,
      close,
      toggle,
      setField,
      resetDraft,
    }),
    [isOpen, draft, open, close, toggle, setField, resetDraft],
  );

  return (
    <CharacterModalCtx.Provider value={value}>{children}</CharacterModalCtx.Provider>
  );
}

export function useCharacterModal(): CharacterModalState {
  const ctx = useContext(CharacterModalCtx);
  if (!ctx) {
    // No provider — return a no-op so callers (e.g. the Character FAB
    // from a route that doesn't mount the provider) don't crash. Toggle
    // and setters silently fail. This matches the no-op pattern in
    // useModalStack.
    return {
      isOpen: false,
      draft: EMPTY_DRAFT,
      isDirty: false,
      open: () => {},
      close: () => {},
      toggle: () => {},
      setField: () => {},
      resetDraft: () => {},
    };
  }
  return ctx;
}