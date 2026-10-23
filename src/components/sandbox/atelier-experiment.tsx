"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { approveNavigation } from "@/components/character-modal/character-modal-store";
import { decodeCharacterFormRecovery } from "@/lib/sandbox/character-form-recovery";
import { ATELIER_FLUSH_EVENT, clearAtelierExperiment, readAtelierExperiment, writeAtelierExperiment } from "@/lib/sandbox/atelier-experiment-session";

type Experiment = { anonymous: boolean; recover: boolean; requireAccount: (action?: string) => boolean };
const Context = createContext<Experiment | null>(null);
const Scope = createContext("primary:new");
const STORAGE_FAILURE = "sw-atelier-experiment-storage-failure";
export const useAtelierExperiment = () => useContext(Context);

export function AtelierExperimentProvider({ children, initialSignedIn }: { children: ReactNode; initialSignedIn: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { redirectToSignIn, redirectToSignUp } = useClerk();
  const [resuming] = useState(() => { try { return (readAtelierExperiment(sessionStorage, "auth-resume") as { requested?: unknown } | null)?.requested === true; } catch { return false; } });
  const [action, setAction] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  const storageFailed = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const title = useId();
  // Never treat an authenticated server payload as a guest draft while Clerk initializes.
  const anonymous = !initialSignedIn && !isSignedIn;
  useEffect(() => { if (action) dialog.current?.showModal(); }, [action]);
  useEffect(() => {
    const failed = () => { storageFailed.current = true; setStorageError("This browser could not keep the temporary draft. Free browser storage or copy your work before signing in."); };
    window.addEventListener(STORAGE_FAILURE, failed); return () => window.removeEventListener(STORAGE_FAILURE, failed);
  }, []);
  function requireAccount(reason = "save this draft") {
    if (isLoaded && isSignedIn) return true;
    setStorageError(""); window.dispatchEvent(new Event(ATELIER_FLUSH_EVENT));
    opener.current = document.activeElement as HTMLElement;
    setAction(reason);
    return false;
  }
  function close() { dialog.current?.close(); setAction(null); opener.current?.focus(); }
  async function authenticate(signUp = false) {
    storageFailed.current = false;
    window.dispatchEvent(new Event(ATELIER_FLUSH_EVENT));
    let stored = false;
    try { stored = writeAtelierExperiment(sessionStorage, "auth-resume", { requested: true }); } catch { /* Block a lossy auth redirect. */ }
    if (!stored || storageFailed.current) { setStorageError("This browser could not keep the temporary draft. Free browser storage or copy your work before signing in."); return; }
    // This is the explicit auth navigation, not permission to discard a draft.
    approveNavigation();
    const redirectUrl = window.location.href;
    try { if (signUp) await redirectToSignUp({ redirectUrl }); else await redirectToSignIn({ redirectUrl }); }
    catch { setStorageError("Sign-in could not open. Your draft is still here. Please try again."); }
  }
  return <Context.Provider value={{ anonymous, recover: anonymous || resuming, requireAccount }}>
    {anonymous && <aside className="border-b border-border bg-card px-4 py-3 text-sm" role="status"><strong>Experiment freely.</strong> Browse public pieces and try your own drafts. Sign in when you want to save. Temporary drafts stay in this browser tab.<button type="button" className="ml-3 rounded border border-border px-3 py-2" onClick={() => requireAccount("save your work")}>Sign in</button></aside>}
    {children}
    {action && <dialog ref={dialog} className="m-auto max-w-[calc(100vw-32px)] rounded-lg border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/70" aria-labelledby={title} onCancel={event => { event.preventDefault(); close(); }}>
      <h2 id={title} className="text-xl font-bold">Sign in to {action}</h2>
      <p className="my-4 max-w-md">Your experiment stays in this tab through sign-in. Nothing is saved or published automatically; review your draft and choose Save when you return.</p>
      {storageError && <p className="my-3 text-sm text-destructive" role="alert">{storageError}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" className="rounded border px-3 py-3" onClick={close}>Continue experimenting</button><button type="button" className="rounded bg-primary px-3 py-3 text-primary-foreground" disabled={!isLoaded} onClick={() => void authenticate()}>Sign in</button><button type="button" className="rounded border px-3 py-3" disabled={!isLoaded} onClick={() => void authenticate(true)}>Create account</button></div>
    </dialog>}
  </Context.Provider>;
}

/** Explicit bridge keeps the recovery/auth context when the drawer renders outside Atelier's tree. */
export function AtelierExperimentScope({ scope, experiment, children }: { scope: string; experiment?: Experiment | null; children: ReactNode }) {
  const parent = useAtelierExperiment();
  return <Context.Provider value={experiment ?? parent}><Scope.Provider key={scope} value={scope}>{children}</Scope.Provider></Context.Provider>;
}

export function useAtelierDraftRecovery<T extends Record<string, unknown>>(kind: string, state: T, dirty: boolean, restore: (value: T) => void, scopeOverride?: string, enabled = true) {
  const experiment = useAtelierExperiment();
  const scope = useContext(Scope);
  const key = `${scopeOverride ?? scope}:${kind}`;
  const [saved] = useState<T | null>(() => {
    if (!enabled || !experiment?.recover || typeof window === "undefined") return null;
    try {
      const stored = readAtelierExperiment(sessionStorage, key);
      return decodeCharacterFormRecovery(JSON.stringify({ version: 1, state: stored }), state);
    } catch { return null; }
  });
  const current = useRef({ state, dirty });
  useLayoutEffect(() => { current.current = { state, dirty }; }, [state, dirty]);
  const cleared = useRef<string | null>(null);
  useEffect(() => { if (saved) restore(saved); /* One restore per mounted editor. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const serialized = JSON.stringify(state);
  useEffect(() => {
    if (!enabled || !experiment?.anonymous) return;
    const flush = () => {
      if (!current.current.dirty || JSON.stringify(current.current.state) === cleared.current) return;
      let stored = false; try {
        stored = writeAtelierExperiment(sessionStorage, key, current.current.state);
        // Also restore after a header/menu sign-in, not only this page's Save gate.
        if (stored) stored = writeAtelierExperiment(sessionStorage, "auth-resume", { requested: true });
      } catch { /* Storage may be disabled. */ }
      if (!stored) window.dispatchEvent(new Event(STORAGE_FAILURE));
    };
    flush(); window.addEventListener(ATELIER_FLUSH_EVENT, flush);
    return () => window.removeEventListener(ATELIER_FLUSH_EVENT, flush);
  }, [enabled, experiment?.anonymous, key, serialized, dirty]);
  return { active: enabled && Boolean(experiment?.recover), restored: saved !== null, clear: () => {
    cleared.current = JSON.stringify(current.current.state);
    try {
      clearAtelierExperiment(sessionStorage, key);
      if (!scopeOverride) clearAtelierExperiment(sessionStorage, `workspace:${scope.startsWith("secondary:") ? "secondary" : "primary"}`);
    } catch { /* Recovery storage is optional. */ }
  } };
}
