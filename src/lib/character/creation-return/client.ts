"use client";
import { useEffect, useRef } from "react";
import {
  consumeCreationReturn,
  readCreationReturn,
  type CreationMode,
  type CreationReturnedEntry,
} from "./model";
export const pendingCreationReturnKey = (accountId: string) =>
  `swordweave-character-creation:${accountId}:pending-return`;
export function useCreationAuthoringReturn(
  accountId: string | null,
  mode: CreationMode,
  hydrated: boolean,
  draftId: string | null,
  merge: (entry: CreationReturnedEntry) => Promise<void>,
  onError: (message: string) => void,
) {
  const mergeRef = useRef(merge),
    errorRef = useRef(onError);
  mergeRef.current = merge;
  errorRef.current = onError;
  useEffect(() => {
    if (!accountId || !hydrated) return;
    let active = true,
      busy = false;
    const receive = async () => {
      if (busy) return;
      const token =
        new URL(window.location.href).searchParams.get("creationReturn") ??
        sessionStorage.getItem(pendingCreationReturnKey(accountId));
      const record = readCreationReturn(localStorage, token, accountId);
      if (
        !record ||
        record.mode !== mode ||
        record.draftId !== draftId ||
        !record.result
      )
        return;
      busy = true;
      try {
        const query = new URLSearchParams({
          targetType: record.result.targetType,
          targetId: record.result.targetId,
        });
        const response = await fetch(
          `/api/characters/creation-return?${query}`,
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error ?? "The saved entry is no longer available.",
          );
        if (!active) return;
        await mergeRef.current(data.entry);
        consumeCreationReturn(localStorage, record.token, accountId);
        sessionStorage.removeItem(pendingCreationReturnKey(accountId));
        const url = new URL(window.location.href);
        url.searchParams.delete("creationReturn");
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch (e) {
        if (active)
          errorRef.current(
            e instanceof Error
              ? e.message
              : "Unable to return the saved entry.",
          );
      } finally {
        busy = false;
      }
    };
    void receive();
    window.addEventListener("focus", receive);
    window.addEventListener("storage", receive);
    return () => {
      active = false;
      window.removeEventListener("focus", receive);
      window.removeEventListener("storage", receive);
    };
  }, [accountId, mode, hydrated, draftId]);
}
