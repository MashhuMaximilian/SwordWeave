"use client";
import type { ConsequenceOccurrence } from "./types";

type RecordState = {
  id: string;
  revision: number;
  occurrence: ConsequenceOccurrence | null;
};
type Session = {
  users: number;
  base: Map<string, RecordState>;
  ready: boolean;
  busy: boolean;
  dirty: boolean;
  error: string | null;
  conflict: boolean;
  pending?: { body: unknown; snapshot: Map<string, ConsequenceOccurrence> };
  timer: ReturnType<typeof setInterval>;
  stop: () => void;
};
const sessions = new Map<string, Session>();
const prefix = (id: string) => `sw:cond:${id}:`;
const encoded = (value: unknown) => JSON.stringify(value ?? null);
function local(id: string): Map<string, ConsequenceOccurrence> {
  const result = new Map<string, ConsequenceOccurrence>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix(id))) continue;
    try {
      const c = JSON.parse(localStorage.getItem(key)!);
      if (c.id) result.set(c.id, c);
    } catch {
      /* Keep malformed local backup untouched. */
    }
  }
  return result;
}
function announce() {
  window.dispatchEvent(new CustomEvent("sw:consequences-sync"));
}
export function consequenceSyncError(id: string): string | null {
  return sessions.get(id)?.error ?? null;
}
async function request(id: string, body?: unknown): Promise<RecordState[]> {
  const response = await fetch(
    `/api/characters/${id}/consequences`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(result.error ?? "Unable to sync Consequences."),
      { status: response.status },
    );
  return result.records;
}
function install(
  id: string,
  session: Session,
  records: RecordState[],
  sent: Map<string, ConsequenceOccurrence>,
) {
  const current = local(id);
  for (const record of records) {
    // A user may edit while the request is in flight. Never overwrite that input.
    if (encoded(current.get(record.id)) !== encoded(sent.get(record.id)))
      continue;
    if (record.occurrence)
      localStorage.setItem(prefix(id) + record.id, encoded(record.occurrence));
    else localStorage.removeItem(prefix(id) + record.id);
  }
  session.base = new Map(records.map((r) => [r.id, r]));
  localStorage.setItem(`sw:consequence-base:${id}`, JSON.stringify(records));
  announce();
}
async function sync(id: string, session: Session) {
  if (session.busy || session.conflict || sessions.get(id) !== session) return;
  session.busy = true;
  try {
    const snapshot = local(id);
    if (!session.ready) {
      const backupKey = `sw:consequence-import:${id}`;
      let backup = localStorage.getItem(backupKey);
      if (!backup) {
        backup = JSON.stringify({
          commandId: crypto.randomUUID(),
          occurrences: [...snapshot.values()],
        });
        localStorage.setItem(backupKey, backup);
      }
      const imported = JSON.parse(backup);
      const records = await request(id, { operation: "import", ...imported });
      // Retain the backup even after acknowledgement, for recovery.
      localStorage.setItem(`${backupKey}:ack`, "true");
      const importedSnapshot = new Map<string, ConsequenceOccurrence>(
        (imported.occurrences as ConsequenceOccurrence[]).map((c) => [c.id, c]),
      );
      install(id, session, records, importedSnapshot);
      session.dirty = true;
      session.ready = true;
    } else {
      const ids = new Set([...snapshot.keys(), ...session.base.keys()]);
      const changes = [...ids]
        .filter(
          (key) =>
            encoded(snapshot.get(key)) !==
            encoded(session.base.get(key)?.occurrence),
        )
        .map((key) => ({
          id: key,
          expectedRevision: session.base.get(key)?.revision ?? 0,
          occurrence: snapshot.get(key) ?? null,
        }));
      if (!session.pending && changes.length)
        session.pending = {
          body: { operation: "save", commandId: crypto.randomUUID(), changes },
          snapshot,
        };
      const pending = session.pending;
      if (pending)
        localStorage.setItem(
          `sw:consequence-pending:${id}`,
          JSON.stringify({
            body: pending.body,
            snapshot: [...pending.snapshot],
          }),
        );
      const records = pending
        ? await request(id, pending.body)
        : await request(id);
      install(id, session, records, pending?.snapshot ?? snapshot);
      delete session.pending;
      localStorage.removeItem(`sw:consequence-pending:${id}`);
    }
    session.error = null;
  } catch (error) {
    session.error =
      error instanceof Error
        ? error.message
        : "Unable to sync Consequences. Local edits are retained.";
    session.conflict = (error as { status?: number }).status === 409;
  } finally {
    session.busy = false;
    announce();
    if (session.dirty) {
      session.dirty = false;
      void sync(id, session);
    }
  }
}
export function connectConsequenceSync(id: string): () => void {
  let session = sessions.get(id);
  if (!session) {
    const change = () => {
      const s = sessions.get(id);
      if (!s) return;
      if (s.busy) s.dirty = true;
      else void sync(id, s);
    };
    const poll = () => {
      if (document.visibilityState === "visible") change();
    };
    session = {
      users: 0,
      base: new Map(),
      ready: false,
      busy: false,
      dirty: false,
      error: null,
      conflict: false,
      timer: setInterval(poll, 15000),
      stop: () => {
        window.removeEventListener("sw:conditions-changed", change);
        window.removeEventListener("storage", change);
        window.removeEventListener("focus", poll);
      },
    };
    try {
      const base = localStorage.getItem(`sw:consequence-base:${id}`);
      if (base) {
        session.base = new Map(
          (JSON.parse(base) as RecordState[]).map((r) => [r.id, r]),
        );
        session.ready = true;
      }
      const pending = localStorage.getItem(`sw:consequence-pending:${id}`);
      if (pending) {
        const saved = JSON.parse(pending);
        session.pending = {
          body: saved.body,
          snapshot: new Map(saved.snapshot),
        };
      }
    } catch {
      /* Import backup remains available if browser metadata is corrupt. */
    }
    sessions.set(id, session);
    window.addEventListener("sw:conditions-changed", change);
    window.addEventListener("storage", change);
    window.addEventListener("focus", poll);
    void sync(id, session);
  }
  session.users++;
  return () => {
    session.users--;
    if (!session.users) {
      clearInterval(session.timer);
      session.stop();
      sessions.delete(id);
    }
  };
}

/** Explicit conflict resolution. Keep a backup before applying the player's choice. */
export async function resolveConsequenceConflict(
  id: string,
  choice: "local" | "server",
): Promise<void> {
  const session = sessions.get(id);
  if (!session || session.busy) return;
  const snapshot = local(id);
  localStorage.setItem(
    `sw:consequence-conflict:${id}:${Date.now()}`,
    JSON.stringify([...snapshot.values()]),
  );
  const records = await request(id);
  session.base = new Map(records.map((r) => [r.id, r]));
  localStorage.setItem(`sw:consequence-base:${id}`, JSON.stringify(records));
  localStorage.removeItem(`sw:consequence-pending:${id}`);
  session.conflict = false;
  session.error = null;
  delete session.pending;
  if (choice === "server") {
    for (const key of snapshot.keys())
      localStorage.removeItem(prefix(id) + key);
    for (const r of records)
      if (r.occurrence)
        localStorage.setItem(prefix(id) + r.id, encoded(r.occurrence));
    announce();
  } else await sync(id, session);
}
