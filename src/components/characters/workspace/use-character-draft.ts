"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftOperation, WorkspaceDraft, WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";
import { popDraftAction } from "@/lib/character/workspace/draft-history";
import { compareDraftRecovery, draftRecoveryKey, parseDraftRecovery, sameDraftRecovery, type DraftRecoveryJournal, type DraftSaveRequest } from "@/lib/character/workspace/draft-recovery";

async function json<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Unable to update this draft.");
  return value as T;
}
type DraftRead = { draft: WorkspaceDraft | null; sheet: WorkspaceDraftPreview["sheet"]; graph: WorkspaceDraftPreview["graph"]; authorId: string };
export type DraftPhase = "idle" | "loading" | "saving" | "checking" | "applying" | "discarding" | "undoing";

/** Durable server drafts plus a local journal for unconfirmed saves. Local data is never applied automatically. */
export function useCharacterDraft(characterId: string) {
  const [draft, setDraft] = useState<WorkspaceDraft | null>(null);
  const current = useRef<WorkspaceDraft | null>(null);
  const author = useRef<string | null>(null);
  const [baseSheet, setBaseSheet] = useState<WorkspaceDraftPreview["sheet"] | null>(null);
  const [preview, setPreview] = useState<WorkspaceDraftPreview | null>(null);
  const [phase, setPhase] = useState<DraftPhase>("loading");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [future, setFuture] = useState<DraftOperation[][]>([]);
  const [appliedDraft, setAppliedDraft] = useState<WorkspaceDraft | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<DraftRecoveryJournal | null>(null);
  const pending = useRef<DraftRecoveryJournal | null>(null);
  const [recoveryConflict, setRecoveryConflict] = useState("");
  const [persistenceWarning, setPersistenceWarning] = useState("");
  const locked = useRef(false);
  const endpoint = `/api/characters/${characterId}/workspace/draft`;
  const generation = useRef(0);

  const clearJournal = useCallback((journal: DraftRecoveryJournal) => {
    try {
      const key = draftRecoveryKey(journal.authorId, journal.characterId);
      const stored = parseDraftRecovery(localStorage.getItem(key), journal.authorId, journal.characterId);
      // Another tab may have written a newer recovery while this request was in flight.
      if (sameDraftRecovery(stored, journal)) localStorage.removeItem(key);
    }
    catch { setPersistenceWarning("Your server draft is saved, but this browser could not clear its local recovery copy."); }
    pending.current = null; setPendingRecovery(null); setRecoveryConflict("");
  }, []);
  const readPreview = useCallback(async (value: WorkspaceDraft, signal?: AbortSignal) => {
    const request = ++generation.current;
    setPhase("checking");
    try {
      const result = await json<WorkspaceDraftPreview>(await fetch(endpoint, {
        ...(signal ? { signal } : {}), method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", draftId: value.id, expectedVersion: value.version }),
      }));
      if (request === generation.current && !signal?.aborted) setPreview(result);
      return result;
    } finally { if (request === generation.current && !signal?.aborted) setPhase("idle"); }
  }, [endpoint]);
  const reload = useCallback(async (signal?: AbortSignal) => {
    setError(""); setPreview(null); setFuture([]); setPhase("loading");
    try {
      const { draft: saved, sheet, graph, authorId } = await json<DraftRead>(await fetch(endpoint, { ...(signal ? { signal } : {}), cache: "no-store" }));
      if (signal?.aborted) return;
      author.current = authorId; setBaseSheet(sheet);
      current.current = saved?.status === "editing" ? saved : null; setDraft(current.current);
      let journal: DraftRecoveryJournal | null = null;
      try { journal = parseDraftRecovery(localStorage.getItem(draftRecoveryKey(authorId, characterId)), authorId, characterId); }
      catch { setPersistenceWarning("Browser recovery storage is unavailable. Confirmed drafts are still saved to your account."); }
      pending.current = journal; setPendingRecovery(journal); setRecoveryConflict("");
      if (journal) {
        const match = compareDraftRecovery(journal, saved, graph.revision);
        if (match.status === "saved") clearJournal(journal);
        else if (match.status === "conflict") setRecoveryConflict(match.message);
      }
      if (current.current) await readPreview(current.current, signal);
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load draft."); }
    finally { if (!signal?.aborted) { setReady(true); setPhase("idle"); } }
  }, [characterId, endpoint, readPreview, clearJournal]);
  useEffect(() => {
    const controller = new AbortController();
    // Hydrate the account-scoped draft and recovery journal when character identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false); author.current = null; void reload(controller.signal);
    return () => { controller.abort(); };
  }, [reload]);

  const putDraft = useCallback(async (request: DraftSaveRequest, journal: DraftRecoveryJournal) => {
    setPhase("saving");
    const { draft: saved } = await json<{ draft: WorkspaceDraft }>(await fetch(endpoint, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
    }));
    current.current = saved; setDraft(saved); clearJournal(journal);
    return await readPreview(saved);
  }, [endpoint, clearJournal, readPreview]);
  const save = useCallback(async (operations: DraftOperation[], baseRevision: number) => {
    if (locked.current) throw new Error("Wait for the current draft change to finish.");
    if (pending.current) throw new Error("Recover or dismiss the unsent local change before adding more changes.");
    if (!author.current) throw new Error("Wait for your saved draft to finish loading.");
    let previousJournal: DraftRecoveryJournal | null = null;
    try { previousJournal = parseDraftRecovery(localStorage.getItem(draftRecoveryKey(author.current, characterId)), author.current, characterId); }
    catch { /* A failed storage write below will explain the recovery limitation. */ }
    if (previousJournal) {
      const match = compareDraftRecovery(previousJournal, current.current, baseRevision);
      if (match.status === "saved") clearJournal(previousJournal);
      else {
        pending.current = previousJournal; setPendingRecovery(previousJournal);
        if (match.status === "conflict") setRecoveryConflict(match.message);
        throw new Error("Another tab has an unconfirmed local change. Recover or dismiss it before saving another change.");
      }
    }
    locked.current = true; setBusy(true); setError("");
    const old = current.current;
    const request: DraftSaveRequest = { ...(old ? { draftId: old.id } : {}), expectedVersion: old?.version ?? 0, baseRevision: old?.baseRevision ?? baseRevision, operations };
    const journal: DraftRecoveryJournal = { schema: 1, authorId: author.current, characterId, savedAt: new Date().toISOString(), request };
    try {
      // Written before PUT so closing the page during a failed request does not lose the proposed operations.
      try { localStorage.setItem(draftRecoveryKey(journal.authorId, characterId), JSON.stringify(journal)); setPersistenceWarning(""); }
      catch { setPersistenceWarning("Browser recovery storage is full or unavailable. Keep this page open until the draft is saved."); }
      pending.current = journal;
      return await putDraft(request, journal);
    } catch (cause) {
      if (pending.current) setPendingRecovery(journal);
      setPreview(null); setError(cause instanceof Error ? cause.message : "Unable to save draft."); throw cause;
    } finally { locked.current = false; setBusy(false); setPhase("idle"); }
  }, [characterId, putDraft, clearJournal]);
  const recoverPending = useCallback(async () => {
    const journal = pending.current;
    if (!journal || locked.current) return null;
    locked.current = true; setBusy(true); setError(""); setPhase("checking");
    try {
      // Always compare a fresh server copy; the page may have been idle while another session edited it.
      const server = await json<DraftRead>(await fetch(endpoint, { cache: "no-store" }));
      if (server.authorId !== journal.authorId) throw new Error("Sign in to the account that saved this local recovery.");
      const match = compareDraftRecovery(journal, server.draft, server.graph.revision);
      if (match.status === "conflict") { setRecoveryConflict(match.message); throw new Error(match.message); }
      author.current = server.authorId; current.current = server.draft; setDraft(server.draft); setBaseSheet(server.sheet);
      if (match.status === "saved" && server.draft) { clearJournal(journal); return await readPreview(server.draft); }
      return await putDraft(journal.request, journal);
    } catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : "Unable to recover draft."); throw cause; }
    finally { locked.current = false; setBusy(false); setPhase("idle"); }
  }, [endpoint, clearJournal, readPreview, putDraft]);
  const dismissPending = useCallback(() => {
    if (locked.current || !pending.current) return;
    clearJournal(pending.current); setError("");
  }, [clearJournal]);
  const stage = useCallback(async (operation: DraftOperation, baseRevision: number) => {
    const result = await save([...(current.current?.operations ?? []), operation], baseRevision);
    setFuture([]); return result;
  }, [save]);
  const stageMany = useCallback(async (operations: DraftOperation[], baseRevision: number) => {
    const groupId = crypto.randomUUID();
    const result = await save([...(current.current?.operations ?? []), ...operations.map(operation => ({ ...operation, groupId }))], baseRevision);
    setFuture([]); return result;
  }, [save]);
  const undo = useCallback(async () => {
    const value = current.current;
    if (!value?.operations.length) return;
    const { remaining, action } = popDraftAction(value.operations);
    await save(remaining, value.baseRevision); setFuture((previous) => [...previous, action]);
  }, [save]);
  const redo = useCallback(async () => {
    const value = current.current, next = future.at(-1);
    if (!value || !next) return;
    await save([...value.operations, ...next], value.baseRevision); setFuture((previous) => previous.slice(0, -1));
  }, [save, future]);
  const canReview = Boolean(draft && preview && !busy && !error && !pendingRecovery && phase === "idle");
  const apply = useCallback(async () => {
    const value = current.current;
    if (!value || locked.current) return null;
    if (!preview || error || pending.current || phase !== "idle") throw new Error("Check the complete draft and resolve any recovery or validation issue before applying it.");
    locked.current = true; setBusy(true); setError(""); setPhase("applying");
    try {
      const result = await json<WorkspaceDraftPreview>(await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", draftId: value.id, expectedVersion: value.version }),
      }));
      setAppliedDraft(value); current.current = null; setDraft(null); setBaseSheet(result.sheet); setPreview(null); setFuture([]); return result;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to apply changes."); throw cause; }
    finally { locked.current = false; setBusy(false); setPhase("idle"); }
  }, [endpoint, preview, error, phase]);
  const discard = useCallback(async () => {
    const value = current.current;
    if (!value || locked.current) return;
    if (pending.current) throw new Error("Recover or dismiss the unsent local change before discarding the server draft.");
    locked.current = true; setBusy(true); setPhase("discarding");
    try {
      await json(await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: value.id, expectedVersion: value.version }) }));
      current.current = null; setDraft(null); setPreview(null); setFuture([]); setError(""); await reload();
    } finally { locked.current = false; setBusy(false); setPhase("idle"); }
  }, [endpoint, reload]);
  const undoApplied = useCallback(async () => {
    if (!appliedDraft || locked.current) return null;
    if (pending.current) throw new Error("Recover or dismiss the unsent local change before undoing the applied build.");
    locked.current = true; setBusy(true); setError(""); setPhase("undoing");
    try {
      const result = await json<WorkspaceDraftPreview>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo", draftId: appliedDraft.id, expectedVersion: appliedDraft.version }) }));
      setAppliedDraft(null); await reload(); return result;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not undo this build."); throw cause; }
    finally { locked.current = false; setBusy(false); setPhase("idle"); }
  }, [appliedDraft, endpoint, reload]);
  return { draft, preview, baseSheet, stageMany, ready, busy, phase, error, pendingRecovery, recoveryConflict, persistenceWarning, recoverPending, dismissPending, canReview, stage, undo, redo, apply, discard, reload, undoApplied, canUndoApplied: !!appliedDraft, canRedo: future.length > 0 };
}
