type Attempt = { status: string | null; createdSessionId: string | null; createdUserId?: string | null };
export type Completion = { session?: { id: string; createdAt?: Date } | null; user?: { id: string; createdAt?: Date | null } | null; client?: { signUp?: Attempt; signIn?: Attempt } | null };
export const AUTH_PENDING_KEY = 'sw-auth-pending';
const MAX_ATTEMPT_AGE = 30 * 60 * 1000;
type Pending = { startedAt: number; existingSessionIds: string[] };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function pendingAuth(storage: Storage, now = Date.now()): Pending | null {
  try {
    const value = JSON.parse(storage.getItem(AUTH_PENDING_KEY) ?? 'null');
    if (value && Number.isFinite(value.startedAt) && value.startedAt <= now && now - value.startedAt <= MAX_ATTEMPT_AGE && Array.isArray(value.existingSessionIds) && value.existingSessionIds.length < 100 && value.existingSessionIds.every((id: unknown) => typeof id === 'string')) return value;
    storage.removeItem(AUTH_PENDING_KEY);
  } catch { try { storage.removeItem(AUTH_PENDING_KEY); } catch { /* Storage is optional. */ } }
  return null;
}

// Called only on a loaded, signed-out auth page with analytics consent.
// The marker and session IDs stay on this browser tab; they are never GA fields.
export function beginAuthMeasurement(storage: Storage, existingSessionIds: string[], now = Date.now()) {
  if (pendingAuth(storage, now)) return;
  try { storage.setItem(AUTH_PENDING_KEY, JSON.stringify({ startedAt: now, existingSessionIds })); } catch { /* Exact Clerk attempt proof remains available. */ }
}

// OAuth may clear Clerk's completed attempt before the application mounts.
// Require a prior signed-out visit and a session created since that visit;
// restoring an older session, merely opening /sign-up, or reloading cannot pass.
export function redirectedAuthCompletion({ session, user }: Completion, pending: Pending | null, now = Date.now()) {
  if (!pending || !session || !user || pending.startedAt > now || now - pending.startedAt > MAX_ATTEMPT_AGE || pending.existingSessionIds.includes(session.id)) return null;
  const sessionCreated = session.createdAt?.getTime();
  const userCreated = user.createdAt?.getTime();
  if (typeof sessionCreated !== 'number' || typeof userCreated !== 'number' || !Number.isFinite(sessionCreated) || !Number.isFinite(userCreated) || sessionCreated < pending.startedAt || sessionCreated > now + 60_000 || userCreated > sessionCreated) return null;
  return userCreated >= pending.startedAt ? 'sign_up' : 'login';
}
export function completedAuthAttempt({ client, session, user }: Completion) {
  if (!session || !user) return null;
  if (client?.signUp?.status === 'complete' && client.signUp.createdSessionId === session.id && client.signUp.createdUserId === user.id) return 'sign_up';
  if (client?.signIn?.status === 'complete' && client.signIn.createdSessionId === session.id) return 'login';
  return null;
}
