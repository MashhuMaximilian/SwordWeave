"use client";

/** Local cache with character-scoped server synchronization. Legacy browser
 * records are imported idempotently and retained as an acknowledged backup. */

import { useCharacterReadOnly, useReadOnlyConditions } from "@/components/characters/character-read-only";
import { useState, useEffect, useCallback } from "react";
import { consequenceSyncReady, consequenceSyncError } from "@/lib/character/consequences/client-sync";

import { usePlaySession } from "./use-play-session";
import { getPlaySessionAccountId, playFieldStorageKey, playFieldStoragePrefix } from "@/lib/play-state/client-sync";

export type DurationTier = "long_rest" | "short_rest" | "manual";

export type RuntimeCondition = import("@/lib/character/consequences/types").ConsequenceOccurrence;

export function condStorageKey(characterId: string, conditionId: string): string {
  return playFieldStorageKey("cond", characterId, conditionId);
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
  const prefix = playFieldStoragePrefix("cond", characterId);
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
  readonly syncError: string | null;
  readonly create: (
    input: Omit<RuntimeCondition, "id" | "createdAt" | "active"> & {
      active?: boolean;
    },
  ) => RuntimeCondition;
  readonly update: (id: string, patch: Partial<RuntimeCondition>) => void;
  readonly remove: (id: string) => void;
  readonly toggle: (id: string, currentActive?: boolean) => void;
  readonly refresh: () => void;
}

export function useRuntimeConditions(
  characterId: string | null,
): UseRuntimeConditionsResult {
  const readOnly = useCharacterReadOnly();
  const savedConditions = useReadOnlyConditions();
  const { session, accountId } = usePlaySession("CHARACTER", characterId, undefined, undefined, { enabled: !readOnly });
  const canEdit = useCallback(() => !!accountId && getPlaySessionAccountId() === accountId && !!characterId && consequenceSyncReady(characterId), [accountId, characterId]);
  const [conditions, setConditions] = useState<readonly RuntimeCondition[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadedCharacterId, setLoadedCharacterId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoadedCharacterId(characterId);
    if (!characterId) {
      setConditions([]);
      setHydrated(true);
      return;
    }
    const next = accountId && getPlaySessionAccountId() === accountId && consequenceSyncReady(characterId) ? readAllConditions(characterId) : [];
    // Sync acknowledgements and polling often contain identical data. Preserve
    // the reference so the entire stat resolver does not rerun for a no-op.
    setConditions(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    setSyncError(consequenceSyncError(characterId));
    // The sheet scanner must wait for saved overrides before creating defaults.
    setHydrated(!!accountId && getPlaySessionAccountId() === accountId && consequenceSyncReady(characterId));
  }, [characterId, accountId]);

  useEffect(() => {
    if (!characterId || readOnly || !canEdit()) return;
    // Hydrate this external localStorage source after subscribing to a character.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    function onChange() {
      refresh();
    }

    window.addEventListener("sw:consequences-sync", onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("sw:conditions-changed", onChange);
    return () => {
      window.removeEventListener("sw:consequences-sync", onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("sw:conditions-changed", onChange);
    };
  }, [characterId, refresh, readOnly, session, canEdit]);

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
      if (readOnly) return cond;
      if (!canEdit()) throw new Error("Wait for your signed-in session before editing Consequences.");
      if (characterId) writeCondition(characterId, cond);
      window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
      refresh();
      return cond;
    },
    [characterId, refresh, readOnly, canEdit],
  );

  const update = useCallback<UseRuntimeConditionsResult["update"]>(
    (id, patch) => {
      if (!characterId || readOnly || !canEdit()) return;
      const existing = readCondition(characterId, id);
      if (!existing) return;
      const merged: RuntimeCondition = { ...existing, ...patch };
      writeCondition(characterId, merged);
      window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
      refresh();
    },
    [characterId, refresh, readOnly, canEdit],
  );

  const remove = useCallback<UseRuntimeConditionsResult["remove"]>(
    (id) => {
      if (!characterId || readOnly || !canEdit()) return;
      deleteCondition(characterId, id);
      window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
      refresh();
    },
    [characterId, refresh, readOnly, canEdit],
  );

  const toggle = useCallback<UseRuntimeConditionsResult["toggle"]>(
    (id, currentActive) => {
      if (!characterId || readOnly || !canEdit()) return;
      const existing = readCondition(characterId, id);
      if (!existing) return;
      const active = !(currentActive ?? existing.manualOverride ?? existing.active);
      update(id, { manualOverride: active });
    },
    [characterId, update, readOnly, canEdit],
  );

  if (readOnly) return { syncError: null, conditions: savedConditions, hydrated: true, create, update, remove, toggle, refresh: () => {} };
  return { syncError, conditions: accountId && session.ready && session.status !== "legacy" && loadedCharacterId === characterId ? conditions : [],
    hydrated: !!accountId && session.ready && session.status !== "legacy" && hydrated && loadedCharacterId === characterId, create, update, remove, toggle, refresh };
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