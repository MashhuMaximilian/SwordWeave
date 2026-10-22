import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppAuthController, type AppAuthRuntimeActions, type AppAuthSnapshot } from "../app-auth-controller";
import type { BrowserAuthSnapshot } from "../browser-snapshot";

function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const anonymous: AppAuthSnapshot = { isLoaded: true, isSignedIn: false, userId: null, identity: null };
const user = (id = "user_a"): AppAuthSnapshot => ({ isLoaded: true, isSignedIn: true, userId: id, identity: { username: id, displayName: "Name", avatarUrl: null } });
function runtime() {
  return {
    openSignIn: vi.fn(), openAccount: vi.fn(), redirectToSignIn: vi.fn(),
    signOut: vi.fn(), refreshSession: vi.fn(),
  } satisfies AppAuthRuntimeActions;
}
function setup(loadSnapshot = vi.fn<() => Promise<BrowserAuthSnapshot>>().mockResolvedValue({ status: "anonymous" }), loadRuntime = vi.fn<() => void | Promise<void>>()) {
  const beforeAuthIntent = vi.fn();
  const controller = createAppAuthController({ loadSnapshot, loadRuntime, beforeAuthIntent });
  return { controller, loadSnapshot, loadRuntime, beforeAuthIntent };
}

afterEach(() => { vi.useRealTimers(); });

describe("app auth controller", () => {
  it("resolves anonymous without importing Clerk and keeps snapshots referentially stable", async () => {
    const { controller, loadRuntime } = setup();
    const initial = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(initial);
    expect(controller.getServerSnapshot()).toBe(initial);
    const notify = vi.fn(); controller.subscribe(notify);
    await controller.bootstrap();
    expect(controller.getSnapshot()).toEqual(anonymous);
    const resolved = controller.getSnapshot();
    await controller.bootstrap();
    expect(controller.getSnapshot()).toBe(resolved);
    expect(controller.getServerSnapshot()).toBe(initial);
    expect(loadRuntime).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledOnce();
  });

  it.each<BrowserAuthSnapshot>([
    { status: "authenticated", userId: "user_a", sessionId: "sess_a" },
    { status: "resolve-in-browser" },
  ])("keeps bootstrap loading until actual SDK identity for $status", async result => {
    const { controller, loadRuntime, beforeAuthIntent } = setup(vi.fn().mockResolvedValue(result));
    const initial = controller.getSnapshot();
    const boot = controller.bootstrap(); await tick();
    expect(loadRuntime).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toBe(initial);
    controller.registerRuntime(runtime()); await boot;
    expect(controller.getSnapshot()).toBe(initial);
    controller.updateFromRuntime(user());
    expect(controller.getSnapshot().userId).toBe("user_a");
    expect(beforeAuthIntent).not.toHaveBeenCalled();
  });

  it("activates the SDK on snapshot transport failure rather than guessing anonymous", async () => {
    const { controller, loadRuntime } = setup(vi.fn().mockRejectedValue(new Error("offline")));
    const boot = controller.bootstrap(); await tick();
    expect(loadRuntime).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().isLoaded).toBe(false);
    controller.registerRuntime(runtime()); controller.updateFromRuntime(anonymous); await boot;
    expect(controller.getSnapshot()).toEqual(anonymous);
  });

  it("coalesces concurrent snapshots and permits later anonymous focus rechecks", async () => {
    const response = pending<BrowserAuthSnapshot>();
    const loadSnapshot = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValue({ status: "anonymous" });
    const { controller } = setup(loadSnapshot);
    const first = controller.bootstrap();
    expect(controller.bootstrap()).toBe(first);
    response.resolve({ status: "anonymous" }); await first;
    await controller.bootstrap();
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
  });

  it("ignores a late anonymous response after a real runtime identity arrives", async () => {
    const response = pending<BrowserAuthSnapshot>();
    const { controller } = setup(vi.fn().mockReturnValue(response.promise));
    const boot = controller.bootstrap();
    const action = controller.openSignIn(); await tick();
    controller.registerRuntime(runtime()); controller.updateFromRuntime(user());
    await action;
    response.resolve({ status: "anonymous" }); await boot;
    expect(controller.getSnapshot().userId).toBe("user_a");
  });

  it("does not let an in-flight snapshot satisfy or reset a pending first action", async () => {
    const response = pending<BrowserAuthSnapshot>();
    const { controller } = setup(vi.fn().mockReturnValue(response.promise));
    const boot = controller.bootstrap();
    const action = controller.openAccount(); const done = vi.fn(); void action.then(done);
    response.resolve({ status: "anonymous" }); await boot; await tick();
    expect(controller.getSnapshot().isLoaded).toBe(false);
    expect(done).not.toHaveBeenCalled();
    const actions = runtime(); controller.registerRuntime(actions); await action;
    expect(actions.openAccount).toHaveBeenCalledOnce();
  });

  it("shares module loading and real readiness between queued commands", async () => {
    const imported = pending<void>(); const loadRuntime = vi.fn(() => imported.promise);
    const { controller, beforeAuthIntent } = setup(undefined, loadRuntime);
    const signIn = controller.openSignIn(); const account = controller.openAccount();
    const redirect = controller.redirectToSignIn({ redirectUrl: "/atelier" });
    const signOut = controller.signOut({ redirectUrl: "/" }); const refresh = controller.refreshSession();
    await tick(); expect(loadRuntime).toHaveBeenCalledOnce();
    const actions = runtime(); controller.registerRuntime(actions); await tick();
    expect(actions.openSignIn).not.toHaveBeenCalled();
    imported.resolve(); await Promise.all([signIn, account, redirect, signOut, refresh]);
    expect(actions.openSignIn).toHaveBeenCalledOnce();
    expect(actions.openAccount).toHaveBeenCalledOnce();
    expect(actions.redirectToSignIn).toHaveBeenCalledWith({ redirectUrl: "/atelier" });
    expect(actions.signOut).toHaveBeenCalledWith({ redirectUrl: "/" });
    expect(actions.refreshSession).toHaveBeenCalledOnce();
    expect(beforeAuthIntent).toHaveBeenCalledTimes(2);
  });

  it("retains anonymous/editor identity during activation and ignores transient SDK loading", async () => {
    const { controller } = setup(); await controller.bootstrap();
    const resolved = controller.getSnapshot(); const notify = vi.fn(); controller.subscribe(notify);
    const activation = controller.activateRuntime(); await tick();
    expect(controller.getSnapshot()).toBe(resolved);
    controller.updateFromRuntime({ isLoaded: false, isSignedIn: false, userId: null, identity: null });
    expect(controller.getSnapshot()).toBe(resolved);
    const disconnect = controller.registerRuntime(runtime()); await activation; disconnect();
    expect(controller.getSnapshot()).toBe(resolved);
    expect(notify).not.toHaveBeenCalled();
  });

  it("publishes genuine account changes but not duplicate identity snapshots", () => {
    const { controller } = setup(); const notify = vi.fn(); controller.subscribe(notify);
    controller.updateFromRuntime(user()); const first = controller.getSnapshot();
    controller.updateFromRuntime(user()); expect(controller.getSnapshot()).toBe(first);
    controller.updateFromRuntime(user("user_b"));
    expect(controller.getSnapshot().userId).toBe("user_b");
    controller.updateFromRuntime(anonymous);
    expect(controller.getSnapshot()).toEqual(anonymous);
    expect(notify).toHaveBeenCalledTimes(3);
  });

  it("waits for reconnection instead of dispatching through a stale registration", async () => {
    const { controller, loadRuntime } = setup(); const old = runtime(); const fresh = runtime();
    const disconnect = controller.registerRuntime(old);
    const command = controller.openAccount(); disconnect(); await tick();
    expect(old.openAccount).not.toHaveBeenCalled();
    controller.registerRuntime(fresh); await command;
    expect(fresh.openAccount).toHaveBeenCalledOnce();
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it("ignores cleanup from a superseded runtime registration", async () => {
    const { controller } = setup(); const old = runtime(); const fresh = runtime();
    const disconnectOld = controller.registerRuntime(old); controller.registerRuntime(fresh); disconnectOld();
    await controller.openAccount();
    expect(fresh.openAccount).toHaveBeenCalledOnce();
    expect(old.openAccount).not.toHaveBeenCalled();
  });

  it("rejects all queued actions on import failure and permits a later retry", async () => {
    const failed = pending<void>();
    const loadRuntime = vi.fn<() => void | Promise<void>>().mockReturnValueOnce(failed.promise).mockResolvedValue(undefined);
    const { controller } = setup(undefined, loadRuntime);
    const first = controller.openSignIn(); const second = controller.openAccount();
    const outcomes = Promise.allSettled([first, second]); await tick();
    failed.reject(new Error("chunk unavailable"));
    expect(await outcomes).toEqual([
      { status: "rejected", reason: expect.objectContaining({ message: "chunk unavailable" }) },
      { status: "rejected", reason: expect.objectContaining({ message: "chunk unavailable" }) },
    ]);
    expect(controller.getSnapshot().isLoaded).toBe(false);
    const retry = controller.openAccount(); await tick();
    const actions = runtime(); controller.registerRuntime(actions); await retry;
    expect(loadRuntime).toHaveBeenCalledTimes(2);
    expect(actions.openAccount).toHaveBeenCalledOnce();
  });

  it("does not publish a stale anonymous snapshot even after import rejection", async () => {
    const response = pending<BrowserAuthSnapshot>();
    const { controller } = setup(vi.fn().mockReturnValue(response.promise), vi.fn().mockRejectedValue(new Error("chunk unavailable")));
    const boot = controller.bootstrap();
    await expect(controller.openAccount()).rejects.toThrow("chunk unavailable");
    response.resolve({ status: "anonymous" }); await boot;
    expect(controller.getSnapshot().isLoaded).toBe(false);
  });

  it("records only explicit sign-in intent and survives an optional observer failure", async () => {
    const beforeAuthIntent = vi.fn(() => { throw new Error("storage blocked"); });
    const controller = createAppAuthController({ loadSnapshot: async () => ({ status: "anonymous" }), loadRuntime: vi.fn(), beforeAuthIntent });
    await controller.bootstrap(); const actions = runtime(); controller.registerRuntime(actions);
    await controller.openAccount(); await controller.refreshSession(); await controller.signOut({ redirectUrl: "/" });
    expect(beforeAuthIntent).not.toHaveBeenCalled();
    await controller.openSignIn(); await controller.redirectToSignIn({ redirectUrl: "/atelier" });
    expect(beforeAuthIntent).toHaveBeenCalledTimes(2);
    expect(actions.openSignIn).toHaveBeenCalledOnce();
  });


  it("rejects startup waiters on explicit runtime failure and retries without clearing identity", async () => {
    const { controller, loadRuntime } = setup(); controller.updateFromRuntime(user());
    const resolved = controller.getSnapshot(); const notify = vi.fn(); controller.subscribe(notify);
    const command = controller.openAccount(); const rejected = expect(command).rejects.toThrow("SDK startup failed");
    await tick(); controller.failRuntime(new Error("SDK startup failed")); await rejected;
    expect(controller.getSnapshot()).toBe(resolved); expect(notify).not.toHaveBeenCalled();
    const retry = controller.openAccount(); await tick();
    const actions = runtime(); controller.registerRuntime(actions); await retry;
    expect(loadRuntime).toHaveBeenCalledTimes(2);
    expect(actions.openAccount).toHaveBeenCalledOnce();
  });

  it("cancels a superseded import before its loader microtask starts", async () => {
    const { controller, loadRuntime } = setup();
    const activated = controller.activateRuntime(); const rejected = expect(activated).rejects.toThrow("cancelled startup");
    controller.failRuntime(new Error("cancelled startup")); await rejected; await tick();
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it("does not dispatch a command if readiness resolves immediately before startup fails", async () => {
    const { controller } = setup(); const actions = runtime();
    const command = controller.openAccount(); const rejected = expect(command).rejects.toThrow("render failed");
    await tick(); controller.registerRuntime(actions); controller.failRuntime(new Error("render failed"));
    await rejected; expect(actions.openAccount).not.toHaveBeenCalled();
  });

  it("expires an unregistered runtime after 30 seconds and allows explicit retry", async () => {
    vi.useFakeTimers();
    const { controller, loadRuntime } = setup();
    const command = controller.openSignIn(); const rejected = expect(command).rejects.toThrow("too long");
    await tick(); await vi.advanceTimersByTimeAsync(30_000); await rejected;
    expect(controller.getSnapshot().isLoaded).toBe(false);
    const retry = controller.openSignIn(); await tick(); controller.registerRuntime(runtime()); await retry;
    expect(loadRuntime).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears readiness timers on registration, failure and disposal", async () => {
    vi.useFakeTimers();
    const first = setup().controller; const activated = first.activateRuntime(); await tick();
    expect(vi.getTimerCount()).toBe(1); first.registerRuntime(runtime()); await activated;
    expect(vi.getTimerCount()).toBe(0);
    const second = setup().controller; const failed = second.activateRuntime(); const handled = expect(failed).rejects.toThrow("failed");
    await tick(); second.failRuntime(new Error("failed")); await handled;
    expect(vi.getTimerCount()).toBe(0);
    const third = setup().controller; const disposed = third.activateRuntime(); const ended = expect(disposed).rejects.toThrow("disposed");
    await tick(); third.dispose(); await ended;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes subscribers and ignores late bootstrap/runtime work after disposal", async () => {
    const response = pending<BrowserAuthSnapshot>();
    const { controller } = setup(vi.fn().mockReturnValue(response.promise));
    const initial = controller.getSnapshot(); const notify = vi.fn(); const removed = vi.fn();
    controller.subscribe(notify); const unsubscribe = controller.subscribe(removed); unsubscribe();
    const boot = controller.bootstrap(); const action = controller.openAccount();
    const rejected = expect(action).rejects.toThrow("disposed");
    controller.dispose(); controller.dispose(); response.resolve({ status: "anonymous" });
    await boot; await rejected;
    controller.registerRuntime(runtime()); controller.updateFromRuntime(user());
    expect(controller.getSnapshot()).toBe(initial);
    expect(notify).not.toHaveBeenCalled(); expect(removed).not.toHaveBeenCalled();
    await expect(controller.openAccount()).rejects.toThrow("disposed");
  });
});
