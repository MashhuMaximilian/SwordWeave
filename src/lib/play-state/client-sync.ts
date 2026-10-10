"use client";
import { consequenceJson } from "@/lib/character/consequences/json";
import { browserUuid } from "@/lib/browser-uuid";
import type { VitalityRuntimeUpdate } from "@/lib/character/vitality-update";
import { emitCharacterLogAdded, emitVitalityChanged } from "@/lib/character/character-events";
import { emptyPlayState, type PlayMutation, type PlayOverrides, type PlayState, type SubjectKind } from "./model";
export type PlaySessionSnapshot = { state: PlayState; buildRefs: string[]; ready: boolean; pending: number; status: "loading" | "saved" | "pending" | "offline" | "conflict" | "legacy" | "error"; error: string | null; conflicts: string[] };
type Session = { accountId: string; controller: AbortController; verified: boolean; kind: SubjectKind; id: string; endpoint: string; method: "POST" | "PATCH"; users: number; snapshot: PlaySessionSnapshot; queue: PlayMutation[]; acknowledged: string[]; legacy: PlayOverrides | null; busy: boolean; applying: boolean; listeners: Set<() => void>; timer?: ReturnType<typeof setTimeout>; stop: () => void; delay: number; runtime?: VitalityRuntimeUpdate; max?: number };
const sessions = new Map<string, Session>();
const key = (kind: SubjectKind, id: string) => `${kind}:${id}`;
let accountId: string | null = null;
const sessionKey = (account: string, kind: SubjectKind, id: string) => `${encodeURIComponent(account)}:${key(kind, id)}`;
const storageKey = (s: Session) => `sw:session:${sessionKey(s.accountId, s.kind, s.id)}`;
const legacyOwnerKey = (kind: SubjectKind, id: string) => `sw:session-legacy-owner:${key(kind, id)}`;
const activeSession = (kind: SubjectKind, id: string) => accountId ? sessions.get(sessionKey(accountId, kind, id)) : undefined;
const active = (s: Session) => !s.controller.signal.aborted && s.accountId === accountId && sessions.get(sessionKey(s.accountId, s.kind, s.id)) === s;
export const getPlaySessionAccountId = () => accountId;
export function setPlaySessionAccount(next: string | null) {
  if (next === accountId) return;
  for (const s of sessions.values()) { s.stop(); s.controller.abort(); }
  const previous = [...sessions.values()];
  sessions.clear(); accountId = next;
  previous.forEach(s => s.listeners.forEach(listener => listener()));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sw:toggle-changed"));
    window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
    window.dispatchEvent(new CustomEvent("sw:consequences-sync"));
  }
}
export function playFieldStoragePrefix(type: "cap" | "eff" | "cond" | "itemcap", id: string, account = accountId) {
  return `sw:play-fields:${encodeURIComponent(account ?? "signed-out")}:${type}:${id}:`;
}
export function playFieldStorageKey(type: "cap" | "eff" | "cond" | "itemcap", id: string, field: string) {
  return playFieldStoragePrefix(type, id) + field;
}
export const emptyPlaySessionSnapshot: PlaySessionSnapshot = { state: emptyPlayState(), buildRefs: [], ready: false, pending: 0, status: "loading", error: null, conflicts: [] };
const equal = (a: unknown, b: unknown) => consequenceJson(a) === consequenceJson(b);
function announce(s: Session, patch: Partial<PlaySessionSnapshot> = {}) {
  s.snapshot = { ...s.snapshot, ...patch, pending: s.queue.length };
  s.listeners.forEach(fn => fn());
  if (s.kind === "CHARACTER") window.dispatchEvent(new CustomEvent("sw:consequences-sync"));
}
function persist(s: Session) {
  try { localStorage.setItem(storageKey(s), JSON.stringify({ state: s.snapshot.state, buildRefs: s.snapshot.buildRefs, ready: s.snapshot.ready, runtime: s.runtime, max: s.max, queue: s.queue, acknowledged: s.acknowledged, legacy: s.legacy })); return true; }
  catch { announce(s, { status: "error", error: "Browser storage is unavailable. Keep this tab open and export a session backup." }); return false; }
}
function readLocal(id: string, account?: string): PlayOverrides {
  const overrides: PlayOverrides = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i); if (!k) continue;
    for (const [type, field] of [["cap", "cap:"], ["eff", "eff:"], ["cond", "consequence:"], ["itemcap", "itemcap:"]] as const) {
      const prefix = account ? playFieldStoragePrefix(type, id, account) : `sw:${type}:${id}:`;
      if (!k.startsWith(prefix)) continue;
      const value = localStorage.getItem(k);
      try { if (field === "consequence:") { if (value) overrides[field + k.slice(prefix.length)] = JSON.parse(value); } else if (value === "1") overrides[field + k.slice(prefix.length)] = true; } catch { /* Preserve malformed backups. */ }
    }
  }
  return overrides;
}
function effective(s: Session): PlayState {
  const overrides = { ...s.snapshot.state.overrides };
  for (const operation of s.queue) for (const c of operation.changes) { if (c.value === null) delete overrides[c.field]; else overrides[c.field] = c.value; }
  return { ...s.snapshot.state, overrides };
}
export function getEffectivePlayState(kind: SubjectKind, id: string): PlayState { const s = activeSession(kind, id); return s ? effective(s) : emptyPlayState(); }
/** Lightweight controls use the same authoritative maximum as their sheet session. */
export function getPlaySessionMaximum(kind: SubjectKind, id: string): number | undefined { return activeSession(kind, id)?.max; }
function install(s: Session) {
  if (s.kind !== "CHARACTER") return;
  s.applying = true;
  try {
    const values = effective(s).overrides;
    const local = readLocal(s.id, s.accountId);
    for (const field of new Set([...Object.keys(local), ...Object.keys(values)])) {
      const match = /^(cap|eff|consequence|itemcap):(.*)$/.exec(field); if (!match) continue;
      const storage = playFieldStoragePrefix(match[1] === "consequence" ? "cond" : match[1] as "cap" | "eff" | "itemcap", s.id, s.accountId) + match[2];
      if (values[field] === undefined) localStorage.removeItem(storage);
      else localStorage.setItem(storage, match[1] === "consequence" ? JSON.stringify(values[field]) : "1");
    }
    const vitality = values["currentVitality"] ?? s.max;
    if (s.runtime && s.max !== undefined && typeof vitality === "number") emitVitalityChanged(s.id, vitality, s.max, s.runtime);
    window.dispatchEvent(new CustomEvent("sw:toggle-changed"));
    window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
  } catch { announce(s, { status: "error", error: "Unable to cache session state. Export a backup before closing this tab." }); }
  finally { s.applying = false; }
}
async function request(s: Session, operation?: PlayMutation) {
  if (!active(s)) throw new DOMException("Session disconnected", "AbortError");
  const response = await fetch(s.endpoint, operation ? { signal: s.controller.signal, method: s.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation) } : { cache: "no-store", signal: s.controller.signal });
  const result = await response.json();
  if (!active(s)) throw new DOMException("Session disconnected", "AbortError");
  if (!response.ok) throw Object.assign(new Error(result.error ?? "Session sync failed."), { status: response.status, result });
  return result;
}
function schedule(s: Session) {
  if (!active(s)) return;
  clearTimeout(s.timer);
  s.timer = setTimeout(() => { if (document.visibilityState === "visible") void sync(s); else schedule(s); }, s.delay);
}
async function sync(s: Session) {
  if (s.busy || !active(s) || ["conflict", "legacy"].includes(s.snapshot.status)) return;
  if (!navigator.onLine) { announce(s, { status: "offline" }); schedule(s); return; }
  s.busy = true;
  try {
    // Always establish authoritative state before sending unknown browser data.
    if (!s.verified) {
      const result = await request(s); if (!active(s)) return; const state: PlayState = result.state; s.verified = true;
      if (result.runtime) s.runtime = result.runtime; if (typeof result.max === "number") s.max = result.max;
      s.snapshot = { ...s.snapshot, state, buildRefs: result.buildRefs ?? s.snapshot.buildRefs, ready: true };
      const owner = localStorage.getItem(legacyOwnerKey(s.kind, s.id));
      if (owner && owner !== s.accountId) s.legacy = null;
      const legacy = s.legacy;
      if (legacy) localStorage.setItem(legacyOwnerKey(s.kind, s.id), s.accountId);
      if (legacy && Object.keys(legacy).some(field => !equal(legacy[field], state.overrides[field]))) {
        announce(s, { status: "legacy", error: null }); persist(s); return;
      }
      s.legacy = null; install(s); persist(s);
    }
    const operation = s.queue[0];
    const before = s.snapshot.state.revision;
    const result = await request(s, operation); if (!active(s)) return;
    if (result.runtime) s.runtime = result.runtime; if (typeof result.max === "number") s.max = result.max;
    if (operation) { s.acknowledged = [...new Set([...s.acknowledged, operation.opId])].slice(-256); s.queue = s.queue.filter(op => op.opId !== operation.opId); if (s.kind === "CHARACTER") emitCharacterLogAdded(s.id); }
    s.snapshot = { ...s.snapshot, state: result.state, buildRefs: result.buildRefs ?? s.snapshot.buildRefs };
    // Later locally queued operations retain their original conflict baseline.
    // Only rebase fields changed by this device's acknowledged operation.
    if (operation) for (const later of s.queue) {
      if (later.baseRevision === operation.baseRevision && later.changes.every(c => (result.state.fieldRevisions[c.field] ?? 0) <= operation.baseRevision || operation.changes.some(sent => sent.field === c.field))) later.baseRevision = result.state.revision;
    }
    install(s);
    if (s.kind === "CHARACTER" && result.runtime && typeof result.state.overrides.currentVitality === "number") emitVitalityChanged(s.id, result.state.overrides.currentVitality, result.max, result.runtime);
    announce(s, { status: s.queue.length ? "pending" : "saved", error: null, conflicts: [] });
    persist(s);
    s.delay = before === result.state.revision && !operation ? Math.min(60000, s.delay * 1.5) : 10000;
  } catch (error) {
    if (!active(s)) return;
    const e = error as Error & { status?: number; result?: { state?: PlayState; conflicts?: string[] } };
    if (e.status === 409 && e.result?.state) {
      s.snapshot = { ...s.snapshot, state: e.result.state }; install(s);
      announce(s, { status: "conflict", error: e.message, conflicts: e.result.conflicts ?? [] });
    } else announce(s, { status: !navigator.onLine || !e.status ? "offline" : "error", error: e.message });
    persist(s); s.delay = Math.min(60000, Math.max(10000, s.delay * 2));
  } finally {
    s.busy = false; schedule(s);
    if (active(s) && s.queue.length && s.snapshot.status === "pending") queueMicrotask(() => void sync(s));
  }
}
export function connectPlayState(kind: SubjectKind, id: string, endpoint = `/api/characters/${id}/play-state`, buildRefs: string[] = [], options: { accountId?: string; method?: "POST" | "PATCH" } = {}) {
  if (!options.accountId) throw new Error("Sign in before opening a session.");
  setPlaySessionAccount(options.accountId);
  const k = sessionKey(options.accountId, kind, id); let s = sessions.get(k);
  if (!s) {
    s = { accountId: options.accountId, controller: new AbortController(), verified: false, kind, id, endpoint, method: options.method ?? "POST", users: 0, snapshot: { ...emptyPlaySessionSnapshot, state: emptyPlayState(), buildRefs }, queue: [], acknowledged: [], legacy: null, busy: false, applying: false, listeners: new Set(), stop: () => {}, delay: 10000 };
    try {
      const raw = localStorage.getItem(storageKey(s));
      if (raw) { const saved = JSON.parse(raw); s.snapshot = { ...s.snapshot, state: saved.state, buildRefs: saved.buildRefs ?? buildRefs, ready: saved.ready ?? true }; s.queue = saved.queue ?? []; s.acknowledged = saved.acknowledged ?? []; s.legacy = saved.legacy ?? null; if (saved.runtime) s.runtime = saved.runtime; if (typeof saved.max === "number") s.max = saved.max; }
      else if (!localStorage.getItem(legacyOwnerKey(kind, id)) || localStorage.getItem(legacyOwnerKey(kind, id)) === s.accountId) {
        const old = localStorage.getItem(`sw:session:${key(kind, id)}`);
        if (old) {
          const saved = JSON.parse(old);
          s.legacy = { ...saved.state?.overrides, ...saved.legacy };
          for (const operation of saved.queue ?? []) for (const change of operation.changes) {
            if (change.value === null) delete s.legacy![change.field]; else s.legacy![change.field] = change.value;
          }
        } else if (kind === "CHARACTER") s.legacy = readLocal(id);
      }
    } catch { s.snapshot = { ...s.snapshot, error: "Session cache could not be read. Export legacy session data before clearing browser storage." }; }
    const current = s;
    const wake = () => { current.delay = 10000; if (document.visibilityState === "visible") void sync(current); else schedule(current); };
    const changed = () => {
      if (!active(current) || current.applying || !current.snapshot.ready || current.snapshot.status === "legacy" || current.kind !== "CHARACTER") return;
      const local = readLocal(id, current.accountId), previous = effective(current).overrides;
      const fields = new Set([...Object.keys(local), ...Object.keys(previous).filter(f => /^(cap|eff|consequence|itemcap):/.test(f))]);
      const changes = [...fields].filter(f => !equal(local[f], previous[f])).map(field => ({ field, value: local[field] ?? null }));
      if (changes.length) queuePlayChanges(kind, id, changes);
    };
    const storage = (event: StorageEvent) => {
      if (!active(current)) return;
      if (event.key === storageKey(current) && event.newValue) {
        try {
          const saved = JSON.parse(event.newValue);
          current.acknowledged = [...new Set([...current.acknowledged, ...(saved.acknowledged ?? [])])].slice(-256);
          const combined = new Map<string, PlayMutation>([...current.queue, ...(saved.queue ?? [])].map(op => [op.opId, op]));
          current.queue = [...combined.values()].filter(op => !current.acknowledged.includes(op.opId));
          if (saved.state.revision >= current.snapshot.state.revision) current.snapshot = { ...current.snapshot, state: saved.state, ready: saved.ready, buildRefs: saved.buildRefs };
          install(current); announce(current);
          // Merge rather than dropping a second tab's unacknowledged work.
          if (!equal(current.queue, saved.queue)) persist(current);
          wake();
        } catch { /* Ignore malformed external data. */ }
      } else if (["cap", "eff", "cond", "itemcap"].some(type => event.key?.startsWith(playFieldStoragePrefix(type as "cap" | "eff" | "cond" | "itemcap", id, current.accountId)))) changed();
    };
    sessions.set(k, current);
    window.addEventListener("focus", wake); window.addEventListener("online", wake); window.addEventListener("offline", wake); document.addEventListener("visibilitychange", wake);
    window.addEventListener("sw:toggle-changed", changed); window.addEventListener("sw:conditions-changed", changed); window.addEventListener("storage", storage);
    current.stop = () => { current.controller.abort(); clearTimeout(current.timer); window.removeEventListener("focus", wake); window.removeEventListener("online", wake); window.removeEventListener("offline", wake); document.removeEventListener("visibilitychange", wake); window.removeEventListener("sw:toggle-changed", changed); window.removeEventListener("sw:conditions-changed", changed); window.removeEventListener("storage", storage); };
    if (current.snapshot.ready) { install(current); announce(current, { status: navigator.onLine ? current.queue.length ? "pending" : "saved" : "offline" }); }
    if (current.legacy && current.snapshot.ready) announce(current, { status: "legacy" });
    void sync(current);
  }
  s.users++; const current = s;
  return () => { current.users--; if (!current.users) { current.stop(); if (sessions.get(k) === current) sessions.delete(k); } };
}
export function getPlaySession(kind: SubjectKind, id: string) { return activeSession(kind, id)?.snapshot ?? emptyPlaySessionSnapshot; }
export function subscribePlaySession(kind: SubjectKind, id: string, listener: () => void) {
  const s = activeSession(kind, id); if (!s) return () => {};
  s.listeners.add(listener); return () => { s.listeners.delete(listener); };
}
export function queuePlayChanges(kind: SubjectKind, id: string, changes: PlayMutation["changes"], source?: "manual" | "long_rest" | "short_rest") {
  const s = activeSession(kind, id); if (!s) throw new Error("Open the sheet before editing session state.");
  if (!s.snapshot.ready || s.snapshot.status === "legacy") throw new Error("Choose the session to continue before editing.");
  for (let offset = 0; offset < changes.length; offset += 64) s.queue.push({ ...(source ? { source } : {}), opId: browserUuid(), baseRevision: s.snapshot.state.revision, changes: changes.slice(offset, offset + 64) });
  const status = s.snapshot.status === "conflict" ? "conflict" : navigator.onLine ? "pending" : "offline";
  announce(s, { status }); persist(s); install(s); void sync(s);
}
export async function resolvePlayConflict(kind: SubjectKind, id: string, choice: "local" | "server") {
  const s = activeSession(kind, id); if (!s || s.busy) return;
  s.busy = true;
  try {
  const legacy = s.legacy;
  const desired = effective(s).overrides;
  const queuedFields = new Set(s.queue.flatMap(operation => operation.changes.map(c => c.field)));
  const conflictingFields = new Set(s.snapshot.conflicts);
  const result = await request(s); if (!active(s)) return;
  localStorage.setItem(`sw:session-recovery:${sessionKey(s.accountId, kind, id)}:${Date.now()}`, JSON.stringify({ state: s.snapshot.state, queue: s.queue, acknowledged: s.acknowledged, legacy: s.legacy }));
  s.snapshot = { ...s.snapshot, state: result.state, buildRefs: result.buildRefs ?? s.snapshot.buildRefs, ready: true }; s.acknowledged = [...new Set([...s.acknowledged, ...s.queue.map(op => op.opId)])].slice(-256); s.queue = []; s.legacy = null;
  announce(s, { status: "saved", error: null, conflicts: [] });
  let fields = [...queuedFields];
  let values = desired;
  if (legacy) {
    fields = choice === "local" ? [...new Set([...Object.keys(legacy), ...Object.keys(result.state.overrides).filter(f => /^(cap|eff|consequence|itemcap):/.test(f))])] : [];
    values = legacy;
  } else if (choice === "server") fields = fields.filter(field => !conflictingFields.has(field));
  const changes = fields.filter(field => !equal(values[field], result.state.overrides[field])).map(field => ({ field, value: values[field] ?? null }));
  if (changes.length) queuePlayChanges(kind, id, changes);
  install(s); persist(s);
  } catch (error) {
    if (active(s)) throw error;
  } finally {
    s.busy = false;
    if (active(s)) void sync(s);
  }
}
export function getPlaySessionComparison(kind: SubjectKind, id: string) {
  const s = activeSession(kind, id);
  if (!s) return [];
  const local = s.legacy ?? effective(s).overrides;
  const saved = s.snapshot.state.overrides;
  const fields = s.legacy ? [...new Set([...Object.keys(local), ...Object.keys(saved).filter(field => /^(cap|eff|consequence|itemcap):/.test(field))])] : s.snapshot.conflicts;
  return fields.filter(field => !equal(local[field], saved[field])).map(field => ({ field, local: local[field], saved: saved[field] }));
}
export function retryPlaySync(kind: SubjectKind, id: string) { const s = activeSession(kind, id); if (s) void sync(s); }
