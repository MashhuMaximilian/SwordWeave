'use client';
import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { AUTH_PENDING_KEY, beginAuthMeasurement, completedAuthAttempt, pendingAuth, redirectedAuthCompletion, type Completion } from '@/lib/analytics/auth';
import { track } from '@/lib/analytics/client';
import { analyticsConsent } from '@/lib/cookie-consent';

const seen = new Set<string>();
export function AuthMeasurement({ allowed }: { allowed: boolean }) {
  const clerk = useClerk();
  const path = usePathname();
  useEffect(() => {
    if (!allowed) return;
    const baselineSession = clerk.session?.id;
    const observe = ({ client, session, user }: Completion) => {
      if (!clerk.loaded || !analyticsConsent.getSnapshot()) return;
      if (!session || !user) {
        if (/^\/sign-(in|up)(\/|$)/.test(path)) {
          try { beginAuthMeasurement(sessionStorage, clerk.client?.sessions.map(item => item.id) ?? []); } catch { /* Optional storage. */ }
        }
        return;
      }
      let redirected: ReturnType<typeof redirectedAuthCompletion> = null;
      try { redirected = redirectedAuthCompletion({ session, user }, pendingAuth(sessionStorage)); } catch { /* Exact attempt proof remains. */ }
      const name = redirected ?? (session.id !== baselineSession ? completedAuthAttempt({ client: client ?? null, session, user }) : null);
      if (!name) return;
      try { sessionStorage.removeItem(AUTH_PENDING_KEY); } catch {}
      const key = `${name}:${session.id}`;
      try { if (sessionStorage.getItem('sw-auth-measured') === key) return; } catch { /* In-memory guard remains. */ }
      if (seen.has(key)) return;
      seen.add(key);
      try { sessionStorage.setItem('sw-auth-measured', key); } catch { /* Optional storage. */ }
      track({ name, params: { method: 'unknown' } });
    };
    const unsubscribe = clerk.addListener(observe, { skipInitialEmit: true });
    observe({ client: clerk.client, session: clerk.session ?? null, user: clerk.user ?? null });
    return unsubscribe;
  }, [allowed, clerk, path]);
  return null;
}
