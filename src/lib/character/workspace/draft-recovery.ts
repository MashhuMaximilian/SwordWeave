import type { DraftOperation, WorkspaceDraft } from "./draft-types";

export interface DraftSaveRequest {
  draftId?: string;
  expectedVersion: number;
  baseRevision: number;
  operations: DraftOperation[];
}
export interface DraftRecoveryJournal {
  schema: 1;
  authorId: string;
  characterId: string;
  savedAt: string;
  request: DraftSaveRequest;
}
export function draftRecoveryKey(authorId: string, characterId: string): string {
  return `sw:character-draft-pending:v1:${encodeURIComponent(authorId)}:${encodeURIComponent(characterId)}`;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
/** Treat recovery as untrusted input. The normal draft endpoint still validates every operation. */
export function parseDraftRecovery(raw: string | null, authorId: string, characterId: string): DraftRecoveryJournal | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as DraftRecoveryJournal;
    const request = value?.request;
    if (value?.schema !== 1 || value.authorId !== authorId || value.characterId !== characterId || typeof value.savedAt !== "string" || !request) return null;
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 0 || !Number.isInteger(request.baseRevision) || request.baseRevision < 0 || (request.draftId !== undefined && typeof request.draftId !== "string")) return null;
    if (!Array.isArray(request.operations) || request.operations.length > 100 || !request.operations.every(operation => operation && typeof operation.id === "string" && typeof operation.type === "string")) return null;
    return value;
  } catch { return null; }
}
/** Avoid clearing an unrelated recovery written by another tab in the same millisecond. */
export function sameDraftRecovery(left: DraftRecoveryJournal | null, right: DraftRecoveryJournal): boolean {
  return left !== null && left.authorId === right.authorId && left.characterId === right.characterId && left.savedAt === right.savedAt && stable(left.request) === stable(right.request);
}
export type DraftRecoveryMatch = { status: "saved" | "recoverable" } | { status: "conflict"; message: string };
/** A lost HTTP response must never duplicate an action or replace a newer draft. */
export function compareDraftRecovery(journal: DraftRecoveryJournal, server: WorkspaceDraft | null, characterRevision: number): DraftRecoveryMatch {
  const request = journal.request;
  if (server && server.authorId !== journal.authorId) return { status: "conflict", message: "This recovery belongs to a different account." };
  if (server?.status === "editing" && server.baseRevision === request.baseRevision && (!request.draftId || request.draftId === server.id) && server.version > request.expectedVersion && stable(server.operations) === stable(request.operations)) return { status: "saved" };
  if (characterRevision !== request.baseRevision) return { status: "conflict", message: "The character changed after this local draft was saved. Your current character and server draft have been preserved." };
  if (request.draftId) {
    if (!server || server.status !== "editing" || server.id !== request.draftId || server.version !== request.expectedVersion || server.baseRevision !== request.baseRevision) return { status: "conflict", message: "The server draft changed in another session. The local recovery cannot replace it." };
  } else if (server || request.expectedVersion !== 0) return { status: "conflict", message: "A different server draft already exists. The local recovery cannot replace it." };
  return { status: "recoverable" };
}
