"use client";
import { useCharacterReadOnly, useReadOnlyGraph } from "@/components/characters/character-read-only";
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
  const readOnly = useCharacterReadOnly();
  const savedGraph = useReadOnlyGraph();
  const subscribe = useCallback((listener: () => void) => readOnly ? () => {} : store.subscribe(characterId, listener), [characterId, readOnly]);
  const snapshot = useCallback(() => readOnly ? null : store.getSnapshot(characterId), [characterId, readOnly]);
  const graph = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return readOnly ? savedGraph : graph;
}
