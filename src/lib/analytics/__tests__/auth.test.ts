import { describe, expect, it } from 'vitest';
import { completedAuthAttempt } from '../auth';
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
