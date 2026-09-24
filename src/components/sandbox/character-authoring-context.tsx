"use client";

import { createContext, useContext, useMemo, useEffect, useRef, useState, type ReactNode } from "react";

export interface CharacterSlotMetadata {
  isMirrored?: boolean;
  quantity?: number;
  role?: string;
  slotLabel?: string | null;
  notes?: string;
}

import { characterFormRecoveryKey, decodeCharacterFormRecovery } from "@/lib/sandbox/character-form-recovery";

interface CharacterAuthoringContextValue {
  /** Isolates temporary form state from standalone Atelier and other characters. */
  namespace: string;
  isEditing: boolean;
  destinationLabel: string;
}
const CharacterAuthoringContext = createContext<CharacterAuthoringContextValue | null>(null);

/** Shared Atelier forms retain one implementation; the sheet supplies its save context. */
export function CharacterAuthoringProvider({ characterId, sessionKey, isEditing = false, destinationLabel = "this character", children }: {
  characterId: string;
  sessionKey: string;
  isEditing?: boolean;
  destinationLabel?: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ namespace: `character:${characterId}:${sessionKey}`, isEditing, destinationLabel }), [characterId, sessionKey, isEditing, destinationLabel]);
  return <CharacterAuthoringContext.Provider key={value.namespace} value={value}>{children}</CharacterAuthoringContext.Provider>;
}
export function useCharacterAuthoring() { return useContext(CharacterAuthoringContext); }


/** Complete, private-browser recovery for sheet authoring. Standalone Atelier is untouched. */
export function useCharacterFormRecovery<T extends Record<string, unknown>>(kind: string, state: T, dirty: boolean, restore: (state: T) => void, namespaceOverride?: string) {
  const context = useCharacterAuthoring();
  const namespace = namespaceOverride ?? context?.namespace;
  const key = namespace ? characterFormRecoveryKey(namespace, kind) : null;
  const [saved] = useState<T | null>(() => {
    if (!key || typeof window === "undefined") return null;
    try {
      return decodeCharacterFormRecovery(window.localStorage.getItem(key), state);
    } catch { return null; }
  });
  const restored = useRef(false);
  const cleared = useRef<string | null>(null);
  const current = JSON.stringify(state);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (saved) restore(saved);
    // Recovery belongs to this mounted editor session, never to incoming graph refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!key || !dirty || current === cleared.current) return;
    try { window.localStorage.setItem(key, JSON.stringify({ version: 1, state: JSON.parse(current) })); }
    catch { /* Private browsing or quota limits must not block authoring. */ }
  }, [key, current, dirty]);
  function clear() {
    cleared.current = current;
    if (key) try { window.localStorage.removeItem(key); } catch { /* Optional recovery. */ }
  }
  return { restored: saved !== null, clear };
}
