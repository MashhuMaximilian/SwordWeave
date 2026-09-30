"use client";
import { useCallback, useSyncExternalStore } from "react";
import { createCharacterSupplyStore } from "./character-supply-store";

const store = createCharacterSupplyStore(async (id, signal) => {
  const response = await fetch(`/api/characters/${id}/workspace`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Unable to load character supply graph.");
  return response.json();
}, invalidate => {
  window.addEventListener("sw:workspace-changed", invalidate);
  return () => window.removeEventListener("sw:workspace-changed", invalidate);
});
const serverSnapshot = () => null;

export function useCharacterSupplyGraph(characterId: string) {
  const subscribe = useCallback((listener: () => void) => store.subscribe(characterId, listener), [characterId]);
  const snapshot = useCallback(() => store.getSnapshot(characterId), [characterId]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
