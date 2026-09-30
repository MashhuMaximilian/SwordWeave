import type { VitalityRuntimeUpdate } from "./vitality-update";
/**
 * character-events.ts — global event bus for character-sheet events.
 *
 * Phase 8.4 v14 (Mashu 2026-07-28): lets any component on the
 * sheet notify other components (e.g. HistoryTab) that a new
 * log entry was just written, so they can refresh without
 * a full router refresh (which was unmounting CapabilityCards
 * and resetting their local state).
 *
 * Usage:
 *   emitCharacterLogAdded(characterId);
 *   onCharacterLogAdded(characterId, () => { ...refetch });
 */

export type CharacterEvent = {
  readonly type: "log_added";
  readonly characterId: string;
};

type Listener = (event: CharacterEvent) => void;

// Per-character listener lists. Use a plain Map (no
// re-rendering needed). Listeners are called in the order
// they were added.
const listeners: Map<string, Set<Listener>> = new Map();

export function emitCharacterLogAdded(characterId: string): void {
  const set = listeners.get(characterId);
  if (!set) return;
  const event: CharacterEvent = { type: "log_added", characterId };
  for (const listener of set) {
    try {
      listener(event);
    } catch (err) {
      // Don't let one listener break others.
      // eslint-disable-next-line no-console
      console.error("character-events listener error:", err);
    }
  }
}

export function onCharacterLogAdded(
  characterId: string,
  listener: Listener,
): () => void {
  let set = listeners.get(characterId);
  if (!set) {
    set = new Set();
    listeners.set(characterId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(characterId);
  };
}
/** Confirmed server values only; optimistic readouts remain local to the tracker. */
export function emitVitalityChanged(characterId: string, current: number, max: number, runtime: VitalityRuntimeUpdate) {
  window.dispatchEvent(new CustomEvent("sw:vitality-changed", { detail: { characterId, current, max, runtime } }));
}
export function onVitalityChanged(characterId: string, listener: (value: { current: number; max: number; runtime: VitalityRuntimeUpdate }) => void) {
  const receive = (event: Event) => {
    const value = (event as CustomEvent<{ characterId: string; current: number; max: number; runtime: VitalityRuntimeUpdate }>).detail;
    if (value?.characterId === characterId && Number.isFinite(value.current) && Number.isFinite(value.max)) listener(value);
  };
  window.addEventListener("sw:vitality-changed", receive);
  return () => window.removeEventListener("sw:vitality-changed", receive);
}
