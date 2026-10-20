import { describe, expect, it } from 'vitest';
import { AUTH_PENDING_KEY, beginAuthMeasurement, completedAuthAttempt, pendingAuth, redirectedAuthCompletion } from '../auth';
describe('authentication completion proof', () => {
  const current = { session: { id: 'new-session' }, user: { id: 'new-user' } };
  it('does not label signed-in snapshots, incomplete attempts or stale attempts as conversions', () => {
    expect(completedAuthAttempt(current)).toBeNull();
    expect(completedAuthAttempt({ ...current, client: { signUp: { status: 'missing_requirements', createdSessionId: null } } })).toBeNull();
    expect(completedAuthAttempt({ ...current, client: { signUp: { status: 'complete', createdSessionId: 'old-session', createdUserId: 'new-user' } } })).toBeNull();
  });
  it('distinguishes exact new-user completion from existing-user login', () => {
    expect(completedAuthAttempt({ ...current, client: { signUp: { status: 'complete', createdSessionId: 'new-session', createdUserId: 'new-user' } } })).toBe('sign_up');
    expect(completedAuthAttempt({ ...current, client: { signIn: { status: 'complete', createdSessionId: 'new-session' } } })).toBe('login');
  });
});

describe('consented OAuth redirect measurement', () => {
  const now = 10_000_000;
  const marker = { startedAt: now - 10_000, existingSessionIds: ['restored'] };
  const signedIn = { session: { id: 'fresh', createdAt: new Date(now - 1_000) }, user: { id: 'account', createdAt: new Date(1) } };
  it('measures a new session after a signed-out visit, even when Clerk cleared its attempt', () => {
    expect(redirectedAuthCompletion(signedIn, marker, now)).toBe('login');
    expect(redirectedAuthCompletion({ ...signedIn, user: { id: 'new', createdAt: new Date(now - 2_000) } }, marker, now)).toBe('sign_up');
  });
  it('rejects restored sessions, old or absent markers, missing dates and future timestamps', () => {
    expect(redirectedAuthCompletion(signedIn, null, now)).toBeNull();
    expect(redirectedAuthCompletion({ ...signedIn, session: { ...signedIn.session, id: 'restored' } }, marker, now)).toBeNull();
    expect(redirectedAuthCompletion({ ...signedIn, session: { id: 'old', createdAt: new Date(marker.startedAt - 1) } }, marker, now)).toBeNull();
    expect(redirectedAuthCompletion(signedIn, marker, now + 31 * 60_000)).toBeNull();
    expect(redirectedAuthCompletion({ ...signedIn, session: { id: 'missing' } }, marker, now)).toBeNull();
    expect(redirectedAuthCompletion({ ...signedIn, session: { id: 'future', createdAt: new Date(now + 61_000) } }, marker, now)).toBeNull();
  });
  it('keeps the original attempt across auth steps, consumes it once, and expires corrupt data', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    beginAuthMeasurement(storage, ['restored'], marker.startedAt);
    beginAuthMeasurement(storage, [], now);
    expect(pendingAuth(storage, now)).toEqual(marker);
    storage.removeItem(AUTH_PENDING_KEY);
    expect(redirectedAuthCompletion(signedIn, pendingAuth(storage, now), now)).toBeNull();
    storage.setItem(AUTH_PENDING_KEY, '{broken');
    expect(pendingAuth(storage, now)).toBeNull();
    beginAuthMeasurement(storage, [], now);
    expect(pendingAuth(storage, now + 31 * 60_000)).toBeNull();
    expect(data.has(AUTH_PENDING_KEY)).toBe(false);
  });
});
