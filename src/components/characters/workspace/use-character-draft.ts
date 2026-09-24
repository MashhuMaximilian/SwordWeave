"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftOperation, WorkspaceDraft, WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";
import { popDraftAction } from "@/lib/character/workspace/draft-history";

async function json<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Unable to update this draft.");
  return value as T;
}

/** One session controller for operations, persisted revisions and authoritative previews. */
export function useCharacterDraft(characterId: string) {
  const [draft, setDraft] = useState<WorkspaceDraft | null>(null);
  const current = useRef<WorkspaceDraft | null>(null);
  const [baseSheet, setBaseSheet] = useState<WorkspaceDraftPreview["sheet"] | null>(null);
  const [preview, setPreview] = useState<WorkspaceDraftPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [future, setFuture] = useState<DraftOperation[][]>([]);
  const [appliedDraft, setAppliedDraft] = useState<WorkspaceDraft | null>(null);
  const locked = useRef(false);
  const endpoint = `/api/characters/${characterId}/workspace/draft`;
  const generation = useRef(0);
  const readPreview = useCallback(async (value: WorkspaceDraft) => {
    const request = ++generation.current;
    const result = await json<WorkspaceDraftPreview>(await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", draftId: value.id, expectedVersion: value.version }),
    }));
    if (request === generation.current) setPreview(result);
    return result;
  }, [endpoint]);
  const reload = useCallback(async (signal?: AbortSignal) => {
    setError(""); setPreview(null); setFuture([]);
    await fetch(endpoint, { ...(signal ? {signal} : {}), cache: "no-store" })
      .then(json<{ draft: WorkspaceDraft | null; sheet: WorkspaceDraftPreview["sheet"] }>).then(async ({ draft: saved, sheet }) => {
        if (signal?.aborted) return;
        setBaseSheet(sheet);
        current.current = saved?.status === "editing" ? saved : null;
        setDraft(current.current);
        if (current.current) await readPreview(current.current);
      }).catch((cause) => { if (!signal?.aborted) setError(cause.message); })
      .finally(() => { if (!signal?.aborted) setReady(true); });
  }, [endpoint, readPreview]);
  useEffect(() => {
    const controller = new AbortController();
    // Hydrate the server-backed draft when character identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false); void reload(controller.signal);
    return () => { controller.abort(); };
  }, [reload]);
  const save = useCallback(async (operations: DraftOperation[], baseRevision: number) => {
    if (locked.current) throw new Error("Wait for the current draft change to finish.");
    locked.current = true;
    setBusy(true); setError("");
    try {
      const old = current.current;
      const { draft: saved } = await json<{ draft: WorkspaceDraft }>(await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(old ? { draftId: old.id } : {}), expectedVersion: old?.version ?? 0,
          baseRevision: old?.baseRevision ?? baseRevision, operations }),
      }));
      current.current = saved; setDraft(saved);
      return await readPreview(saved);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Unable to save draft.");
      throw cause;
    } finally { locked.current = false; setBusy(false); }
  }, [endpoint, readPreview]);
  const stage = useCallback(async (operation: DraftOperation, baseRevision: number) => {
    const result = await save([...(current.current?.operations ?? []), operation], baseRevision);
    setFuture([]); return result;
  }, [save]);
  const stageMany = useCallback(async (operations: DraftOperation[], baseRevision: number) => {
    const groupId = crypto.randomUUID();
    const result = await save([...(current.current?.operations ?? []), ...operations.map(operation => ({...operation,groupId}))], baseRevision);
    setFuture([]); return result;
  }, [save]);
  const undo = useCallback(async () => {
    const value = current.current;
    if (!value?.operations.length) return;
    const {remaining,action} = popDraftAction(value.operations);
    await save(remaining, value.baseRevision);
    setFuture((previous) => [...previous, action]);
  }, [save]);
  const redo = useCallback(async () => {
    const value = current.current, next = future.at(-1);
    if (!value || !next) return;
    await save([...value.operations, ...next], value.baseRevision);
    setFuture((previous) => previous.slice(0, -1));
  }, [save, future]);
  const apply = useCallback(async () => {
    const value = current.current;
    if (!value || locked.current) return null;
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await json<WorkspaceDraftPreview>(await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", draftId: value.id, expectedVersion: value.version }),
      }));
      setAppliedDraft(value);
      current.current = null; setDraft(null); setBaseSheet(result.sheet); setPreview(null); setFuture([]);
      return result;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to apply changes."); throw cause; }
    finally { locked.current = false; setBusy(false); }
  }, [endpoint]);
  const discard = useCallback(async () => {
    const value = current.current;
    if (!value || locked.current) return;
    locked.current = true; setBusy(true);
    try {
      await json(await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: value.id, expectedVersion: value.version }) }));
      current.current = null; setDraft(null); setPreview(null); setFuture([]); setError("");
      await reload();
    } finally { locked.current = false; setBusy(false); }
  }, [endpoint, reload]);
  const undoApplied = useCallback(async () => {
    if (!appliedDraft || locked.current) return null;
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await json<WorkspaceDraftPreview>(await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"undo",draftId:appliedDraft.id,expectedVersion:appliedDraft.version})}));
      setAppliedDraft(null); await reload(); return result;
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Could not undo this build.");throw cause;}
    finally {locked.current=false;setBusy(false);}
  },[appliedDraft,endpoint,reload]);
  return { draft, preview, baseSheet, stageMany, ready, busy, error, stage, undo, redo, apply, discard, reload, undoApplied, canUndoApplied:!!appliedDraft, canRedo: future.length > 0 };
}
