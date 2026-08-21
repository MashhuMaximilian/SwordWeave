"use client";

/**
 * use-runtime-conditions.ts — Phase 8.L round 48 (Mashu 2026-08-14)
 *
 * localStorage-backed CRUD for the Play Session Scratchpad
 * (FAB-launch from R5-Q6). Each character has its own namespace
 * under `sw:cond:<characterId>:<conditionId>`.
 *
 * Storage shape:
 *   sw:cond:<characterId>:<conditionId> = JSON.stringify({
 *     id: string,
 *     title: string,
 *     description: string,
 *     tags: string[],
 *     modifiers: HardModifier[],
 *     durationTier: "long_rest" | "short_rest" | "manual",
 *     active: boolean,         // localStorage "active" state
 *     createdAt: number,       // unix ms
 *   })
 *
 * The hook watches `storage` (cross-tab) + `sw:conditions-changed`
 * (same-tab writer notifications) so all surfaces stay in sync.
 *
 * NOTE: Conditions do NOT clear on long/short rest (per Mashu R48).
 * The user explicitly clicks X to delete. Auto-clear was rejected
 * as overcomplicated.
 *
 * NOTE: Conditions are not migrated to the DB in v1 (per Mashu
 * R48 Q-D: localStorage only). They survive cache clears via
 * browser persistence but are per-device.
 */

import { useState, useEffect, useCallback } from "react";
import type { HardModifier } from "@/types/swordweave";

export type DurationTier = "long_rest" | "short_rest" | "manual";

export interface RuntimeCondition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly modifiers: readonly HardModifier[];
  readonly durationTier: DurationTier;
  readonly active: boolean;
  readonly createdAt: number;
  /**
  *Phase 8.L round 48: source label for the condition card.
  *"custom" = user-authored via composer, "sheet" = picked
  *from character sheet (capabilities/effects/etc.). Sheet-sourced
  *conditions are read-only (you can engage/disengage but not
  *edit the modifier — go to the character sheet to change).
  */
  readonly source: "custom" | "sheet";
  /**
  *Phase 8.L round 48: when source === "sheet", the originating
  *entity (capabilityId, effectId, primitiveId, etc.) for the
  *From-sheet section grouping.
  */
  readonly sourceEntityId?: string;
  readonly sourceEntityType?: "capability" | "effect" | "primitive";
}

export function condStorageKey(characterId: string, conditionId: string): string {
  return `sw:cond:${characterId}:${conditionId}`;
}

function readCondition(
  characterId: string,
  conditionId: string,
): RuntimeCondition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(condStorageKey(characterId, conditionId));
    if (!raw) return null;
    return JSON.parse(raw) as RuntimeCondition;
  } catch {
    return null;
  }
}

function writeCondition(
  characterId: string,
  cond: RuntimeCondition,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      condStorageKey(characterId, cond.id),
      JSON.stringify(cond),
    );
  } catch {
    // localStorage disabled or quota exceeded; swallow.
  }
}

function deleteCondition(characterId: string, conditionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(condStorageKey(characterId, conditionId));
  } catch {
    // ignore
  }
}

function readAllConditions(characterId: string): RuntimeCondition[] {
  if (typeof window === "undefined") return [];
  const prefix = `sw:cond:${characterId}:`;
  const out: RuntimeCondition[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as RuntimeCondition);
      } catch {
        // skip malformed entries
      }
    }
  } catch {
    // localStorage disabled
  }
  return out;
}

export interface UseRuntimeConditionsResult {
  readonly conditions: readonly RuntimeCondition[];
  readonly hydrated: boolean;
  readonly create: (
    input: Omit<RuntimeCondition, "id" | "createdAt" | "active"> & {
      active?: boolean;
    },
  ) => RuntimeCondition;
  readonly update: (id: string, patch: Partial<RuntimeCondition>) => void;
  readonly remove: (id: string) => void;
  readonly toggle: (id: string) => void;
  readonly refresh: () => void;
}

export function useRuntimeConditions(
  characterId: string | null,
): UseRuntimeConditionsResult {
  const [conditions, setConditions] = useState<readonly RuntimeCondition[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    if (!characterId) {
      setConditions([]);
      setHydrated(true);
      return;
    }
    setConditions(readAllConditions(characterId));
    setHydrated(true);
  }, [characterId]);

  useEffect(() => {
    if (!characterId) return;
    refresh();
    function onChange() {
      refresh();
    }
    window.addEventListener("storage", onChange);
    window.addEventListener("sw:conditions-changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("sw:conditions-changed", onChange);
    };
  }, [characterId, refresh]);

  const create = useCallback<UseRuntimeConditionsResult["create"]>(
    (input) => {
      // Respect caller-supplied ids. The sheet-condition scanner
      // uses deterministic ids (sheet-primitive-<id>-<idx>) so it
      // can detect "already exists" and skip the create. Without
      // this guard, every create() overwrites the caller id with
      // a fresh UUID and the scanner never matches — producing
      // an infinite create() loop on every render.
      const callerId = (input as { id?: string }).id;
      const id =
        callerId && callerId.length > 0
          ? callerId
          : typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const cond: RuntimeCondition = {
        ...input,
        id,
        createdAt: Date.now(),
        active: input.active ?? true,
      };
      if (characterId) writeCondition(characterId, cond);
      window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
      refresh();
      return cond;
    },
    [characterId, refresh],
  );

  const update = useCallback<UseRuntimeConditionsResult["update"]>(
    (id, patch) => {
      if (!characterId) return;
      const existing = readCondition(characterId, id);
      if (!existing) return;
      const merged: RuntimeCondition = { ...existing, ...patch };
      writeCondition(characterId, merged);
      window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
      refresh();
    },
    [characterId, refresh],
  );

  const remove = useCallback<UseRuntimeConditionsResult["remove"]>(
    (id) => {
      if (!characterId) return;
      deleteCondition(characterId, id);
      window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
      refresh();
    },
    [characterId, refresh],
  );

  const toggle = useCallback<UseRuntimeConditionsResult["toggle"]>(
    (id) => {
      if (!characterId) return;
      const existing = readCondition(characterId, id);
      if (!existing) return;
      update(id, { active: !existing.active });
    },
    [characterId, update],
  );

  return { conditions, hydrated, create, update, remove, toggle, refresh };
}

/**
 * Notify same-tab listeners that conditions changed. Call this
 * after writing directly to localStorage (e.g. from a writer
 * component that doesn't use the hook's create/update helpers).
 */
export function notifyConditionsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
}