"use client";

/**
 * use-toggle-state.ts — Phase 8.L round 38 (Mashu 2026-08-13)
 *
 * Centralized read of localStorage toggle state for capabilities
 * AND effects. The capability card UI writes to localStorage;
 * this hook reads it on mount, watches for changes (via the
 * 'storage' event + a custom event for same-tab writes), and
 * exposes the active state to the resolver.
 *
 * Why centralize:
 *   - The resolver needs to know which capabilities/effects are
 *     active so it can suppress primitive contributions from
 *     inactive ones. Without this, "active" was a UI-only flag.
 *   - Each capability card used to read its own slice. That
 *     works for the card itself, but the resolver runs at a
 *     different lifecycle (character-sheet-view) and needs ALL
 *     active states at once.
 *
 * Storage format:
 *   - `sw:cap:<characterId>:<capabilityId>` = "1" when capability OFF
 *   - `sw:eff:<characterId>:<effectId>` = "1" when effect OFF
 *
 * Note: The L26 fix inverted the semantics. The current value "1"
 * means "OFF" (capability is toggled to inactive). The default
 * (no key) is "active" / "ON". This is the convention the existing
 * capability-card uses.
 *
 * Why OFF is the explicit state:
 *   - Inactivity is the user explicitly opting OUT of a cap's
 *     contribution. The natural read of "I want to turn this off"
 *     is the user-facing action.
 *   - Active state defaults to "all on" so the resolver can
 *     safely pipe primitives through without explicit gating.
 */

import { useState, useEffect, useCallback } from "react";

/**
 * Capability eff-key (storage) — separate from capabilityId.
 * Used to avoid collisions across the localStorage namespace.
 */
export function capStorageKey(characterId: string, capabilityId: string): string {
  return `sw:cap:${characterId}:${capabilityId}`;
}

export function effStorageKey(characterId: string, effectId: string): string {
  return `sw:eff:${characterId}:${effectId}`;
}

/**
 * Read a single key. Returns true if the key is set to "1"
 * (= explicitly OFF). Returns false otherwise (default ON).
 */
function readKey(characterId: string, prefix: "cap" | "eff", id: string): boolean {
  if (typeof window === "undefined") return false;
  const key = prefix === "cap"
    ? capStorageKey(characterId, id)
    : effStorageKey(characterId, id);
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * Mass-read all OFF capability + effect keys for one character.
 * Returns Sets of IDs that are explicitly OFF.
 *
 * Called once on mount and on the `storage` event (cross-tab)
 * or `sw:toggle-changed` event (same-tab, dispatched by writers).
 */
function readAllOffKeys(characterId: string): {
  offCapabilityIds: Set<string>;
  offEffectIds: Set<string>;
} {
  const offCapabilityIds = new Set<string>();
  const offEffectIds = new Set<string>();
  if (typeof window === "undefined") return { offCapabilityIds, offEffectIds };

  const capPrefix = `sw:cap:${characterId}:`;
  const effPrefix = `sw:eff:${characterId}:`;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(capPrefix) && window.localStorage.getItem(key) === "1") {
        offCapabilityIds.add(key.slice(capPrefix.length));
      } else if (key.startsWith(effPrefix) && window.localStorage.getItem(key) === "1") {
        offEffectIds.add(key.slice(effPrefix.length));
      }
    }
  } catch {
    // localStorage disabled; fall back to empty sets.
  }
  return { offCapabilityIds, offEffectIds };
}

export interface ToggleState {
  /** Set of capability IDs that are explicitly OFF. */
  offCapabilityIds: Set<string>;
  /** Set of effect IDs that are explicitly OFF. */
  offEffectIds: Set<string>;
  /** True before initial hydration completes (server-render / SSR). */
  hydrated: boolean;
}

export interface UseToggleStateResult extends ToggleState {
  /** Manual refresh — also called automatically on storage events. */
  refresh: () => void;
}

/**
 * Hook: read + watch the localStorage toggle state for a character.
 *
 * Returns:
 *   - offCapabilityIds: Set of capability IDs marked OFF
 *   - offEffectIds: Set of effect IDs marked OFF
 *   - hydrated: false until the first client-side read completes
 *   - refresh: force a re-read (call after toggling)
 *
 * The hook listens for:
 *   1. `storage` event — fires when another tab updates the keys
 *   2. `sw:toggle-changed` event — fires when capability-card (or
 *      similar) writes to localStorage in the SAME tab. Dispatch
 *      with `window.dispatchEvent(new CustomEvent('sw:toggle-changed'))`.
 */
export function useToggleState(characterId: string | null): UseToggleStateResult {
  const [state, setState] = useState<ToggleState>({
    offCapabilityIds: new Set(),
    offEffectIds: new Set(),
    hydrated: false,
  });

  const refresh = useCallback(() => {
    if (!characterId) {
      setState({
        offCapabilityIds: new Set(),
        offEffectIds: new Set(),
        hydrated: true,
      });
      return;
    }
    const { offCapabilityIds, offEffectIds } = readAllOffKeys(characterId);
    setState({ offCapabilityIds, offEffectIds, hydrated: true });
  }, [characterId]);

  useEffect(() => {
    if (!characterId) return;
    refresh();

    function onChange() {
      refresh();
    }
    window.addEventListener("storage", onChange);
    window.addEventListener("sw:toggle-changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("sw:toggle-changed", onChange);
    };
  }, [characterId, refresh]);

  return { ...state, refresh };
}

/**
 * Dispatch the same-tab toggle change event. Call this from any
 * writer (capability card, effect card, scratchpad) after
 * writing to localStorage so the resolver hook re-reads.
 */
export function notifyToggleChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sw:toggle-changed"));
}
