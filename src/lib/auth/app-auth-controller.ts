import type { BrowserAuthSnapshot } from "./browser-snapshot";

export type AppAuthIdentity = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};
export type AppAuthSnapshot = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  identity: AppAuthIdentity | null;
};
export type AppAuthRuntimeActions = {
  openSignIn: () => void | Promise<void>;
  openAccount: () => void | Promise<void>;
  redirectToSignIn: (options: { redirectUrl: string }) => void | Promise<void>;
  signOut: (options: { redirectUrl: string }) => void | Promise<void>;
  refreshSession: () => void | Promise<void>;
};

type Options = {
  loadSnapshot: () => Promise<BrowserAuthSnapshot>;
  loadRuntime: () => void | Promise<void>;
  beforeAuthIntent?: () => void;
};
type Readiness = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};
const LOADING: AppAuthSnapshot = Object.freeze({
  isLoaded: false, isSignedIn: false, userId: null, identity: null,
});
const ANONYMOUS: AppAuthSnapshot = Object.freeze({
  isLoaded: true, isSignedIn: false, userId: null, identity: null,
});

function deferred(): Readiness {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function sameIdentity(a: AppAuthIdentity | null, b: AppAuthIdentity | null) {
  return a === b || Boolean(a && b && a.username === b.username &&
    a.displayName === b.displayName && a.avatarUrl === b.avatarUrl);
}

/**
 * App-owned identity and commands stay outside the optional SDK island. Loading
 * that island never reparents the app or temporarily clears a resolved identity.
 */
export function createAppAuthController(options: Options) {
  let snapshot = LOADING;
  let disposed = false;
  let runtimeRequested = false;
  let bootstrapPromise: Promise<void> | null = null;
  let modulePromise: Promise<void> | null = null;
  let activationPromise: Promise<void> | null = null;
  let readiness: Readiness | null = null;
  let actions: AppAuthRuntimeActions | null = null;
  let connection: object | null = null;
  let startupTimer: ReturnType<typeof setTimeout> | null = null;
  let failureVersion = 0;
  let lastFailure: unknown;
  const subscribers = new Set<() => void>();
  const disposedError = () => new Error("Authentication controller disposed");

  function publish(next: AppAuthSnapshot) {
    if (disposed || (snapshot.isLoaded === next.isLoaded &&
      snapshot.isSignedIn === next.isSignedIn && snapshot.userId === next.userId &&
      sameIdentity(snapshot.identity, next.identity))) return;
    snapshot = next;
    for (const notify of [...subscribers]) notify();
  }

  function clearStartupTimer() {
    if (startupTimer !== null) clearTimeout(startupTimer);
    startupTimer = null;
  }

  function failRuntime(error: unknown) {
    if (disposed) return;
    failureVersion++;
    lastFailure = error;
    clearStartupTimer();
    actions = null;
    connection = null;
    modulePromise = null;
    readiness?.reject(error);
    readiness = null;
    activationPromise = null;
    // Retain snapshot: an SDK startup error is not proof of sign-out.
  }

  function loadModule() {
    if (modulePromise) return modulePromise;
    const pending = Promise.resolve().then(() => {
      if (disposed) throw disposedError();
      if (modulePromise !== pending) throw lastFailure;
      return options.loadRuntime();
    });
    modulePromise = pending;
    // Keep successful imports for the lifetime of this controller. A rejected
    // import clears only the attempt, so the next explicit action can retry.
    void pending.catch(error => {
      if (disposed || modulePromise !== pending) return;
      failRuntime(error);
    });
    return pending;
  }

  function activateRuntime(): Promise<void> {
    if (disposed) return Promise.reject(disposedError());
    // This latch deliberately survives an import failure: an old anonymous
    // bootstrap response must not overwrite a newer auth intent or identity.
    runtimeRequested = true;
    if (activationPromise) return activationPromise;
    const ready = actions ? Promise.resolve() : (readiness ??= deferred()).promise;
    if (!actions && startupTimer === null) {
      startupTimer = setTimeout(() => {
        failRuntime(new Error("Account services took too long to load. Please try again."));
      }, 30_000);
    }
    const attempt = failureVersion;
    activationPromise = Promise.all([loadModule(), ready]).then(() => {
      if (disposed) throw disposedError();
      if (failureVersion !== attempt) throw lastFailure;
    });
    return activationPromise;
  }

  function bootstrap(): Promise<void> {
    if (disposed || runtimeRequested) return Promise.resolve();
    if (bootstrapPromise) return bootstrapPromise;
    const pending = (async () => {
      let result: BrowserAuthSnapshot;
      try { result = await options.loadSnapshot(); }
      catch { result = { status: "resolve-in-browser" }; }
      if (disposed || runtimeRequested) return;
      if (result?.status === "anonymous") publish(ANONYMOUS);
      else await activateRuntime();
    })();
    bootstrapPromise = pending;
    const clear = () => { if (bootstrapPromise === pending) bootstrapPromise = null; };
    void pending.then(clear, clear);
    return pending;
  }

  function registerRuntime(runtimeActions: AppAuthRuntimeActions): () => void {
    if (disposed) return () => {};
    runtimeRequested = true;
    const registered = {};
    connection = registered;
    actions = runtimeActions;
    clearStartupTimer();
    // A runtime mounted directly by an embedded auth route is already imported.
    modulePromise ??= Promise.resolve();
    readiness?.resolve();
    return () => {
      if (disposed || connection !== registered) return;
      actions = null;
      connection = null;
      readiness = null;
      activationPromise = null;
      // Keep the last real identity during Strict Mode/reconnection cleanup.
    };
  }

  function updateFromRuntime(next: AppAuthSnapshot) {
    if (disposed) return;
    runtimeRequested = true;
    if (!next.isLoaded) return;
    if (!next.isSignedIn) {
      publish(ANONYMOUS);
      return;
    }
    if (!next.userId) return;
    publish(Object.freeze({
      isLoaded: true, isSignedIn: true, userId: next.userId,
      identity: next.identity ? Object.freeze({ ...next.identity }) : null,
    }));
  }

  async function invoke(run: (runtime: AppAuthRuntimeActions) => void | Promise<void>) {
    const attempt = failureVersion;
    while (!disposed) {
      await activateRuntime();
      if (disposed) throw disposedError();
      if (failureVersion !== attempt) throw lastFailure;
      // Cleanup may run between readiness resolution and this microtask. Wait
      // for the next live registration rather than calling a stale SDK handle.
      if (!actions) continue;
      await run(actions);
      return;
    }
    throw disposedError();
  }

  function authIntent() {
    if (disposed) return;
    try { options.beforeAuthIntent?.(); }
    catch { /* Optional measurement/storage must not prevent authentication. */ }
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => LOADING,
    subscribe(notify: () => void) {
      if (disposed) return () => {};
      subscribers.add(notify);
      return () => { subscribers.delete(notify); };
    },
    bootstrap,
    activateRuntime,
    registerRuntime,
    updateFromRuntime,
    failRuntime,
    openSignIn(): Promise<void> {
      authIntent();
      return invoke(runtime => runtime.openSignIn());
    },
    openAccount: () => invoke(runtime => runtime.openAccount()),
    redirectToSignIn(redirect: { redirectUrl: string }): Promise<void> {
      authIntent();
      return invoke(runtime => runtime.redirectToSignIn(redirect));
    },
    signOut: (redirect: { redirectUrl: string }) => invoke(runtime => runtime.signOut(redirect)),
    refreshSession: () => invoke(runtime => runtime.refreshSession()),
    dispose() {
      if (disposed) return;
      disposed = true;
      clearStartupTimer();
      subscribers.clear();
      actions = null;
      connection = null;
      readiness?.reject(disposedError());
      readiness = null;
      activationPromise = null;
    },
  };
}
