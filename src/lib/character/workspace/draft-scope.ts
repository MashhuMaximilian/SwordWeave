import type { CharacterForkGrant } from "./fork-grants";
import { AsyncLocalStorage } from "node:async_hooks";
// This scope is entered only after the draft endpoint validates the caller's
// sharing permission. Preview writes run in a transaction that ALWAYS rolls back.
type DraftScope = { characterId: string; userId: string; authored: Set<string>; verifiedAuthor: boolean; scopedForks: readonly CharacterForkGrant[] };
const scope = new AsyncLocalStorage<DraftScope>();
const authoringRequests = new WeakMap<Request, DraftScope>();
const forkRequests = new WeakMap<Request, string>();
export function withDraftExecution<T>(characterId: string, userId: string, work: () => Promise<T>, verifiedAuthor = false, scopedForks: readonly CharacterForkGrant[] = []) {
  return scope.run({ characterId, userId, authored: new Set(), verifiedAuthor, scopedForks }, work);
}

/** Bind an internal adapter call to the already verified in-process draft actor. */
export function bindWorkspaceAuthoringRequest(request: Request, fork?: { id: string; pin: string | null }) {
  const active = scope.getStore();
  if (!active?.verifiedAuthor) return;
  authoringRequests.set(request, active);
  if (fork && active.scopedForks.some(slot => slot.capabilityId === fork.id && slot.versionId === fork.pin)) {
    forkRequests.set(request, fork.id);
  }
}

export function workspaceAuthoringUserId(request: Request): string | null {
  const active = scope.getStore();
  return active && authoringRequests.get(request) === active ? active.userId : null;
}
/** Only the internal adapter can bind a fresh request to an authorized, pinned fork source. */
export function isWorkspaceForkSource(request: Request, capabilityId: string) {
  return workspaceAuthoringUserId(request) !== null && forkRequests.get(request) === capabilityId;
}
export function isAuthorizedDraftExecution(characterId: string, userId: string): boolean {
  const active = scope.getStore();
  return active?.characterId === characterId && active?.userId === userId;
}

export function shouldIsolateDraftEntity(key: string): boolean {
  const active = scope.getStore();
  return Boolean(active && !active.authored.has(key));
}
export function markDraftAuthoredEntity(key: string): void {
  scope.getStore()?.authored.add(key);
}
export function hasDraftExecutionScope(): boolean { return Boolean(scope.getStore()); }
