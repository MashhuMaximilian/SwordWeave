"use client";
import { useAuth } from "@clerk/nextjs";
import { useLayoutEffect, useState } from "react";
import { connectPlayState, emptyPlaySessionSnapshot, getPlaySession, setPlaySessionAccount, subscribePlaySession, type PlaySessionSnapshot } from "@/lib/play-state/client-sync";
import type { SubjectKind } from "@/lib/play-state/model";

/** Every sheet consumer shares one coordinator for the signed-in account. */
export function usePlaySession(kind: SubjectKind, id: string | null, endpoint?: string, buildRefs?: string[], options: { method?: "POST" | "PATCH"; enabled?: boolean } = {}) {
  const { isLoaded, userId } = useAuth();
  const accountId = isLoaded ? userId ?? null : null;
  const { method, enabled = true } = options;
  const [value, setValue] = useState<{ accountId: string; id: string; kind: SubjectKind; session: PlaySessionSnapshot } | null>(null);
  useLayoutEffect(() => {
    setPlaySessionAccount(accountId);
    if (!accountId || !id || !enabled) return;
    const disconnect = connectPlayState(kind, id, endpoint, buildRefs, { accountId, ...(method ? { method } : {}) });
    const update = () => setValue({ accountId, id, kind, session: getPlaySession(kind, id) });
    const unsubscribe = subscribePlaySession(kind, id, update);
    update();
    return () => { unsubscribe(); disconnect(); };
    // Server responses refresh build references without restarting the coordinator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, kind, id, endpoint, method, enabled]);
  const session = accountId && enabled && value?.accountId === accountId && value.id === id && value.kind === kind ? value.session : emptyPlaySessionSnapshot;
  return { session, accountId, isLoaded };
}
