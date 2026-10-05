"use client";
/** Consequences share the character session's queue, refresh and conflict policy. */
import { connectPlayState, getPlaySession, resolvePlayConflict } from "@/lib/play-state/client-sync";
export function consequenceSyncReady(id: string): boolean { const s = getPlaySession("CHARACTER", id); return s.ready && s.status !== "legacy"; }
export function consequenceSyncError(id: string): string | null { return getPlaySession("CHARACTER", id).error; }
export function connectConsequenceSync(id: string, accountId: string): () => void { return connectPlayState("CHARACTER", id, undefined, undefined, { accountId }); }
export async function resolveConsequenceConflict(id: string, choice: "local" | "server") { await resolvePlayConflict("CHARACTER", id, choice); }
