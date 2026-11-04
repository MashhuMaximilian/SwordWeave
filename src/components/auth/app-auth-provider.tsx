'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import { createAppAuthController, type AppAuthSnapshot } from '@/lib/auth/app-auth-controller';
import type { BrowserAuthSnapshot } from '@/lib/auth/browser-snapshot';
import { beginAuthMeasurement } from '@/lib/analytics/auth';
import { analyticsConsent } from '@/lib/cookie-consent';
import { modePolicy, signupUnavailable, signInUnavailable, type ModePolicy } from '@/lib/runtime/mode-policy';

export type AppAuthController = ReturnType<typeof createAppAuthController>;
export type NativeAuthHost = { kind: 'sign-in' | 'sign-up'; element: HTMLDivElement };
export type ClerkRuntimeProps = {
  controller: AppAuthController;
  formHost: NativeAuthHost | null;
  generation: number;
  onReady: () => void;
  onError: (error: unknown) => void;
  policy: ModePolicy;
};
type AppAuth = AppAuthSnapshot & Pick<AppAuthController,
  'openSignIn' | 'openAccount' | 'redirectToSignIn' | 'redirectToSignUp' | 'signOut' | 'refreshSession'> & {
  registerAuthHost: (kind: NativeAuthHost['kind'], element: HTMLDivElement) => () => void;
  retryRuntime: () => void;
  runtimeError: string;
  policy: ModePolicy;
};
const defaultPolicy = modePolicy('production');
const Context = createContext<AppAuth | null>(null);
export function useAppAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('App authentication requires AppAuthProvider');
  return value;
}

function recordAuthIntent() {
  if (!analyticsConsent.getSnapshot()) return;
  try { beginAuthMeasurement(sessionStorage, []); } catch { /* Optional measurement. */ }
}

async function browserSnapshot(): Promise<BrowserAuthSnapshot> {
  const response = await fetch('/api/auth/snapshot', {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('Session needs browser resolution');
  }
  const value: unknown = await response.json();
  // Only this exact positive result can avoid loading the SDK. No private action
  // accepts this browser hint as authorization; every API still checks Clerk.
  return typeof value === 'object' && value !== null &&
    'status' in value && value.status === 'anonymous'
    ? { status: 'anonymous' } : { status: 'resolve-in-browser' };
}

/** Persistent app state is never wrapped/reparented when the SDK is activated. */
export function AppAuthProvider({ children, policy = defaultPolicy }: { children: React.ReactNode; policy?: ModePolicy }) {
  const path = usePathname();
  const [Runtime, setRuntime] = useState<ComponentType<ClerkRuntimeProps> | null>(null);
  const [formHost, setFormHost] = useState<NativeAuthHost | null>(null);
  const [generation, setGeneration] = useState(0);
  const [runtimeError, setRuntimeError] = useState('');
  const [restrictedNotice, setRestrictedNotice] = useState('');
  const alive = useRef(false);
  // This lazy initializer stores callbacks; it does not read the lifecycle ref during render.
  // eslint-disable-next-line react-hooks/refs
  const [controller] = useState(() => createAppAuthController({
    policy,
    onRestrictedAction: setRestrictedNotice,
    loadSnapshot: browserSnapshot,
    beforeAuthIntent: recordAuthIntent,
    loadRuntime: async () => {
      setRuntimeError('');
      try {
        const runtimeModule = await import('./clerk-runtime');
        if (!alive.current) return;
        setGeneration(value => value + 1);
        setRuntime(() => runtimeModule.ClerkRuntime);
      } catch (error) {
        if (alive.current) setRuntimeError('Account controls could not load. Please try again.');
        throw error;
      }
    },
  }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);

  const onReady = useCallback(() => {
    setRuntimeError('');
  }, []);
  const onError = useCallback((error: unknown) => {
    setRuntimeError('Account controls could not load. Please try again.');
    controller.failRuntime(error);
  }, [controller]);
  const retryRuntime = useCallback(() => {
    void controller.activateRuntime().catch(() => setRuntimeError('Account controls could not load. Please try again.'));
  }, [controller]);
  const registerAuthHost = useCallback((kind: NativeAuthHost['kind'], element: HTMLDivElement) => {
    if (!policy.canUseIdentity || (kind === 'sign-up' && !policy.canSignUp)) return () => {};
    const registration = { kind, element };
    setFormHost(registration);
    recordAuthIntent();
    void controller.activateRuntime().catch(() => setRuntimeError('Account controls could not load. Please try again.'));
    return () => setFormHost(current => current === registration ? null : current);
  }, [controller, policy]);

  useEffect(() => {
    alive.current = true;
    const check = () => { void controller.bootstrap().catch(() => setRuntimeError('Account controls could not load. Please try again.')); };
    const visible = () => { if (document.visibilityState === 'visible') check(); };
    const changed = (event: StorageEvent) => { if (event.key === 'sw:auth-session-changed') check(); };
    check();
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('storage', changed);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('storage', changed);
      // Strict Mode reattaches effects in this same task. A true unmount must
      // cancel queued work without disposing the reused development controller.
      queueMicrotask(() => {
        if (!alive.current) {
          controller.dispose();
        }
      });
    };
  }, [controller]);
  useEffect(() => {
    if (policy.canUseIdentity && (/^\/sign-in(\/|$)/.test(path) || (policy.canSignUp && /^\/sign-up(\/|$)/.test(path)))) {
      recordAuthIntent();
      void controller.activateRuntime().catch(() => setRuntimeError('Account controls could not load. Please try again.'));
    }
  }, [controller, path, policy]);

  const value = useMemo<AppAuth>(() => ({
    ...snapshot,
    openSignIn: controller.openSignIn,
    openAccount: controller.openAccount,
    redirectToSignIn: controller.redirectToSignIn,
    redirectToSignUp: controller.redirectToSignUp,
    signOut: controller.signOut,
    refreshSession: controller.refreshSession,
    registerAuthHost, retryRuntime, runtimeError, policy,
  }), [controller, snapshot, registerAuthHost, retryRuntime, runtimeError, policy]);
  return <Context.Provider value={value}>
    {children}
    {restrictedNotice && <p role="status" className="fixed bottom-4 left-4 z-50 rounded border bg-card p-3">
      {restrictedNotice} <button type="button" onClick={() => setRestrictedNotice('')}>Dismiss</button>
    </p>}
    {Runtime && policy.canUseIdentity && <Runtime controller={controller} formHost={formHost} generation={generation} onReady={onReady} onError={onError} policy={policy} />}
  </Context.Provider>;
}

/** Replaces the auth page's existing flex wrapper; adds no extra layout box. */
export function NativeAuthFormHost({ kind, className }: { kind: NativeAuthHost['kind']; className: string }) {
  const { registerAuthHost, retryRuntime, runtimeError, policy } = useAppAuth();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => element ? registerAuthHost(kind, element) : undefined, [registerAuthHost, kind, element]);
  if (!policy.canUseIdentity || (kind === 'sign-up' && !policy.canSignUp)) {
    return <p role="status" className={className}>{kind === 'sign-up' ? signupUnavailable : signInUnavailable}</p>;
  }
  return <div className={className} ref={setElement}>
    {runtimeError && <p role="alert" className="text-sm text-destructive">
      {runtimeError} <button type="button" onClick={retryRuntime}>Try again</button>
    </p>}
  </div>;
}
