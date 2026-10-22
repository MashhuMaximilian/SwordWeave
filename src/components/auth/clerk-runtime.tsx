'use client';

import { Component, useEffect, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/nextjs';
import { AuthMeasurement } from '@/components/analytics/auth-measurement';
import { analyticsConsent } from '@/lib/cookie-consent';
import type { AppAuthRuntimeActions, AppAuthSnapshot } from '@/lib/auth/app-auth-controller';
import type { ClerkRuntimeProps } from './app-auth-provider';

// Exactly the existing sign-in/up appearance; loading architecture alone changes.
const appearance = {
  elements: {
    cardBox: 'shadow-none', rootBox: 'w-full',
    card: 'bg-card text-foreground border border-border shadow-none',
    formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    socialButtonsBlockButton: 'bg-background border-border hover:bg-secondary/40 text-foreground',
    socialButtonsBlockButtonText: 'font-medium', dividerLine: 'bg-border',
    dividerText: 'text-muted-foreground',
    formFieldInput: 'bg-background border-border text-foreground focus:border-primary',
    formFieldLabel: 'text-foreground', footerActionLink: 'text-primary hover:text-primary/80',
  },
} as never;

class RuntimeBoundary extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { this.props.onError(error); }
  override render() { return this.state.failed ? null : this.props.children; }
}

export function ClerkRuntime(props: ClerkRuntimeProps) {
  return <RuntimeBoundary key={props.generation} onError={props.onError}>
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/atelier" signUpFallbackRedirectUrl="/atelier">
      <RuntimeBridge {...props} />
    </ClerkProvider>
  </RuntimeBoundary>;
}

function RuntimeBridge({ controller, formHost, onReady }: ClerkRuntimeProps) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const allowed = useSyncExternalStore(analyticsConsent.subscribe, analyticsConsent.getSnapshot, analyticsConsent.getServerSnapshot);
  const profileUserId = user?.id;
  const username = user?.username ?? null;
  const displayName = user?.fullName ?? user?.username ?? 'Account';
  const avatarUrl = user?.imageUrl ?? null;
  const snapshot = useMemo<AppAuthSnapshot>(() => ({
    isLoaded: isLoaded === true, isSignedIn: isSignedIn === true,
    userId: isSignedIn === true ? userId : null,
    identity: isSignedIn === true && profileUserId === userId ? { username, displayName, avatarUrl } : null,
  }), [isLoaded, isSignedIn, userId, profileUserId, username, displayName, avatarUrl]);
  const actions = useMemo<AppAuthRuntimeActions>(() => ({
    openSignIn: () => { clerk.openSignIn(); },
    openAccount: () => { clerk.openUserProfile(); },
    redirectToSignIn: async options => { await clerk.redirectToSignIn(options); },
    signOut: async options => { await clerk.signOut(options); },
    refreshSession: async () => { await clerk.session?.getToken({ skipCache: true }); },
  }), [clerk]);

  useLayoutEffect(() => {
    if (!snapshot.isLoaded) return;
    const previousUser = controller.getSnapshot().userId;
    controller.updateFromRuntime(snapshot);
    if (previousUser !== snapshot.userId) {
      try { localStorage.setItem('sw:auth-session-changed', String(Date.now())); } catch { /* Focus still rechecks other anonymous tabs. */ }
    }
  }, [controller, snapshot]);
  useEffect(() => {
    if (!isLoaded) return;
    const disconnect = controller.registerRuntime(actions);
    onReady();
    return disconnect;
  }, [controller, actions, isLoaded, onReady]);

  return <>
    <AuthMeasurement allowed={allowed} />
    {formHost && createPortal(formHost.kind === 'sign-in'
      ? <SignIn signInUrl="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/atelier" withSignUp appearance={appearance} />
      : <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/atelier" appearance={appearance} />,
    formHost.element)}
  </>;
}
