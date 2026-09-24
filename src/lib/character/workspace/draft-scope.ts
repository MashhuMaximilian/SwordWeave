import { AsyncLocalStorage } from "node:async_hooks";
// This scope is entered only after the draft endpoint validates the caller's
// sharing permission. Preview writes run in a transaction that ALWAYS rolls back.
const scope = new AsyncLocalStorage<{ characterId: string; userId: string; authored: Set<string> }>();
export function withDraftExecution<T>(characterId: string, userId: string, work: () => Promise<T>) {
  return scope.run({ characterId, userId, authored: new Set() }, work);
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
