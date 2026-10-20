'use client';
import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { completedAuthAttempt } from '@/lib/analytics/auth';
import { track } from '@/lib/analytics/client';
import { analyticsConsent } from '@/lib/cookie-consent';

// Count only a completed Clerk attempt whose created session is now active.
// A signed-in snapshot, reload or an OAuth return without this proof is not a conversion.
const seen = new Set<string>();
export function AuthMeasurement({ allowed }: { allowed: boolean }) {
  const clerk = useClerk();
  useEffect(() => {
    if (!allowed) return;
    // Existing/restored sessions present at mount are never new completions.
    const baselineSession = clerk.session?.id;
    let ready = clerk.loaded;
    return clerk.addListener(({ client, session, user }) => {
      if (!analyticsConsent.getSnapshot() || !session || !user) return;
      if (!ready) { ready = true; return; }
      if (session.id === baselineSession) return;
      const name = completedAuthAttempt({ client, session, user });
      if (!name) return;
      const key = `${name}:${session.id}`;
      try { if (sessionStorage.getItem('sw-auth-measured') === key) return; } catch { /* In-memory guard remains. */ }
      if (seen.has(key)) return;
      seen.add(key);
      try { sessionStorage.setItem('sw-auth-measured', key); } catch { /* Optional storage. */ }
      track({ name, params: { method: 'unknown' } });
    }, { skipInitialEmit: true });
  }, [allowed, clerk]);
  return null;
}
