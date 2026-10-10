import { afterEach, describe, expect, it, vi } from "vitest";
import { connectPlayState, getEffectivePlayState, getPlaySession, queuePlayChanges, resolvePlayConflict, retryPlaySync, setPlaySessionAccount, playFieldStorageKey, getPlaySessionComparison, getPlaySessionMaximum } from "../client-sync";
import { emptyPlayState } from "../model";
function browser(values = new Map<string, string>()) {
  const online = { onLine: true };
  vi.stubGlobal("navigator", online); vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("localStorage", { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, value: string) => values.set(k, value), removeItem: (k: string) => values.delete(k) });
  return { values, online };
}
afterEach(() => { setPlaySessionAccount(null); vi.unstubAllGlobals(); });
describe("coordinated session client", () => {
  it("keeps authoritative monster Vitality maximum offline and isolates it by account", async () => {
    const { online } = browser();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state: emptyPlayState(), max: 42 })));
    let disconnect = connectPlayState("MONSTER_PLAY_COPY", "maximum-test", undefined, undefined, { accountId: "account-a" });
    await vi.waitFor(() => expect(getPlaySession("MONSTER_PLAY_COPY", "maximum-test").status).toBe("saved"));
    expect(getPlaySessionMaximum("MONSTER_PLAY_COPY", "maximum-test")).toBe(42);
    disconnect(); online.onLine = false;
    disconnect = connectPlayState("MONSTER_PLAY_COPY", "maximum-test", undefined, undefined, { accountId: "account-a" });
    expect(getPlaySessionMaximum("MONSTER_PLAY_COPY", "maximum-test")).toBe(42);
    const other = connectPlayState("MONSTER_PLAY_COPY", "maximum-test", undefined, undefined, { accountId: "account-b" });
    try { expect(getPlaySessionMaximum("MONSTER_PLAY_COPY", "maximum-test")).toBeUndefined(); }
    finally { disconnect(); other(); }
  });
  it("restores encounter markers offline and uses the separate run endpoint", async()=>{
    const {values,online}=browser();let server=emptyPlayState();const writes:unknown[]=[];vi.stubGlobal("fetch",vi.fn(async(url,init)=>{expect(url).toBe("/api/encounters/runs/run?session=1");if(init?.body){expect(init.method).toBe("PATCH");const op=JSON.parse(init.body);writes.push(op);server={revision:1,overrides:{phase:"Heavy"},fieldRevisions:{phase:1}};}return Response.json({state:server});}));
    let disconnect=connectPlayState("ENCOUNTER_RUN","run","/api/encounters/runs/run?session=1",[],{accountId:"gm-account",method:"PATCH"});
    await vi.waitFor(()=>expect(getPlaySession("ENCOUNTER_RUN","run").status).toBe("saved"));online.onLine=false;queuePlayChanges("ENCOUNTER_RUN","run",[{field:"phase",value:"Heavy"}]);const cached=JSON.parse(values.get("sw:session:gm-account:ENCOUNTER_RUN:run")!);disconnect();disconnect=connectPlayState("ENCOUNTER_RUN","run","/api/encounters/runs/run?session=1",[],{accountId:"gm-account",method:"PATCH"});try{expect(getEffectivePlayState("ENCOUNTER_RUN","run").overrides["phase"]).toBe("Heavy");online.onLine=true;retryPlaySync("ENCOUNTER_RUN","run");await vi.waitFor(()=>expect(getPlaySession("ENCOUNTER_RUN","run").pending).toBe(0));expect(writes).toMatchObject([{opId:cached.queue[0].opId,changes:[{field:"phase",value:"Heavy"}]}]);}finally{disconnect();}
  });
  it("restores a durable offline queue and retries the identical operation ID", async () => {
    const { values, online } = browser();
    let server = emptyPlayState(); const sent: string[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      if (init?.body) { const operation = JSON.parse(init.body); sent.push(operation.opId); server = { revision: 1, overrides: { "cap:a": true }, fieldRevisions: { "cap:a": 1 } }; }
      return Response.json({ state: server });
    }); vi.stubGlobal("fetch", fetcher);
    let disconnect = connectPlayState("CHARACTER", "offline-test", undefined, undefined, { accountId: "account-a" });
    await vi.waitFor(() => expect(getPlaySession("CHARACTER", "offline-test").status).toBe("saved"));
    online.onLine = false;
    queuePlayChanges("CHARACTER", "offline-test", [{ field: "cap:a", value: true }]);
    expect(getPlaySession("CHARACTER", "offline-test").status).toBe("offline");
    const saved = JSON.parse(values.get("sw:session:account-a:CHARACTER:offline-test")!);
    expect(saved.queue).toHaveLength(1); expect(values.get(playFieldStorageKey("cap", "offline-test", "a"))).toBe("1");
    disconnect();
    disconnect = connectPlayState("CHARACTER", "offline-test", undefined, undefined, { accountId: "account-a" });
    try {
      expect(getEffectivePlayState("CHARACTER", "offline-test").overrides["cap:a"]).toBe(true);
      online.onLine = true; retryPlaySync("CHARACTER", "offline-test");
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "offline-test").pending).toBe(0));
      expect(sent).toEqual([saved.queue[0].opId]);
    } finally { disconnect(); }
  });
  it("keeps independent queued changes when choosing server for a same-field conflict", async () => {
    browser(); let conflict = false;
    const remote = { revision: 1, overrides: { currentVitality: 30 }, fieldRevisions: { currentVitality: 1 } };
    const writes: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      if (!init?.body) return Response.json({ state: conflict ? remote : emptyPlayState() });
      const operation = JSON.parse(init.body);
      if (!conflict) { conflict = true; return Response.json({ error: "Same field changed", state: remote, conflicts: ["currentVitality"] }, { status: 409 }); }
      writes.push(operation); return Response.json({ state: { revision: 2, overrides: { ...remote.overrides, "cap:a": true }, fieldRevisions: { ...remote.fieldRevisions, "cap:a": 2 } } });
    }));
    const disconnect = connectPlayState("CHARACTER", "conflict-test", undefined, undefined, { accountId: "account-a" });
    try {
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "conflict-test").status).toBe("saved"));
      queuePlayChanges("CHARACTER", "conflict-test", [{ field: "currentVitality", value: 10 }, { field: "cap:a", value: true }]);
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "conflict-test").status).toBe("conflict"));
      expect(getEffectivePlayState("CHARACTER", "conflict-test").overrides["currentVitality"]).toBe(10);
      expect(getPlaySessionComparison("CHARACTER", "conflict-test")).toEqual([{ field: "currentVitality", local: 10, saved: 30 }]);
      await resolvePlayConflict("CHARACTER", "conflict-test", "server");
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "conflict-test").status).toBe("saved"));
      expect(writes).toMatchObject([{ baseRevision: 1, changes: [{ field: "cap:a", value: true }] }]);
      expect(getEffectivePlayState("CHARACTER", "conflict-test").overrides).toEqual({ currentVitality: 30, "cap:a": true });
    } finally { disconnect(); }
  });
  it("merges pending changes from another tab instead of dropping local work", async () => {
    const { online, values } = browser();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state: emptyPlayState() })));
    const disconnect = connectPlayState("CHARACTER", "tabs-test", undefined, undefined, { accountId: "account-a" });
    try {
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "tabs-test").status).toBe("saved"));
      online.onLine = false;
      queuePlayChanges("CHARACTER", "tabs-test", [{ field: "cap:local", value: true }]);
      const remote = { state: emptyPlayState(), ready: true, buildRefs: [], queue: [{ opId: "22222222-2222-4222-8222-222222222222", baseRevision: 0, changes: [{ field: "eff:other", value: true }] }] };
      window.dispatchEvent(Object.assign(new Event("storage"), { key: "sw:session:account-a:CHARACTER:tabs-test", newValue: JSON.stringify(remote) }));
      expect(getEffectivePlayState("CHARACTER", "tabs-test").overrides).toEqual({ "cap:local": true, "eff:other": true });
      expect(JSON.parse(values.get("sw:session:account-a:CHARACTER:tabs-test")!).queue).toHaveLength(2);
    } finally { disconnect(); }
  });
  it("asks before replacing differing legacy toggles and keeps server vitality on local choice", async () => {
    const { values } = browser(new Map([["sw:cap:legacy-test:a", "1"]]));
    const server = { revision: 1, overrides: { currentVitality: 22 }, fieldRevisions: { currentVitality: 1 } };
    const writes: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      if (init?.body) { const operation = JSON.parse(init.body); writes.push(operation); return Response.json({ state: { ...server, revision: 2, overrides: { ...server.overrides, "cap:a": true }, fieldRevisions: { ...server.fieldRevisions, "cap:a": 2 } } }); }
      return Response.json({ state: server });
    }));
    const disconnect = connectPlayState("CHARACTER", "legacy-test", undefined, undefined, { accountId: "account-a" });
    try {
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "legacy-test").status).toBe("legacy"));
      expect(writes).toHaveLength(0); expect(values.get("sw:cap:legacy-test:a")).toBe("1");
      expect(getPlaySessionComparison("CHARACTER", "legacy-test")).toEqual([{ field: "cap:a", local: true, saved: undefined }]);
      await resolvePlayConflict("CHARACTER", "legacy-test", "local");
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "legacy-test").status).toBe("saved"));
      expect(writes).toMatchObject([{ changes: [{ field: "cap:a", value: true }] }]);
      expect(getEffectivePlayState("CHARACTER", "legacy-test").overrides["currentVitality"]).toBe(22);
    } finally { disconnect(); }
  });
  it("retains each account's offline queue without replaying it for another account", async () => {
    const { values, online } = browser();
    const writes: string[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      if (init?.body) writes.push(JSON.parse(init.body).opId);
      return Response.json({ state: emptyPlayState() });
    });
    vi.stubGlobal("fetch", fetcher);
    const first = connectPlayState("CHARACTER", "shared", undefined, undefined, { accountId: "account-a" });
    await vi.waitFor(() => expect(getPlaySession("CHARACTER", "shared").status).toBe("saved"));
    online.onLine = false;
    queuePlayChanges("CHARACTER", "shared", [{ field: "cap:a", value: true }]);
    const original = JSON.parse(values.get("sw:session:account-a:CHARACTER:shared")!).queue[0];
    const second = connectPlayState("CHARACTER", "shared", undefined, undefined, { accountId: "account-b" });
    first(); // A stale cleanup must not remove the new coordinator.
    expect(getPlaySession("CHARACTER", "shared").ready).toBe(false);
    expect(getEffectivePlayState("CHARACTER", "shared").overrides).toEqual({});
    expect(() => queuePlayChanges("CHARACTER", "shared", [{ field: "cap:b", value: true }])).toThrow();
    online.onLine = true;
    retryPlaySync("CHARACTER", "shared");
    await vi.waitFor(() => expect(getPlaySession("CHARACTER", "shared").status).toBe("saved"));
    window.dispatchEvent(Object.assign(new Event("storage"), {
      key: "sw:session:account-a:CHARACTER:shared", newValue: values.get("sw:session:account-a:CHARACTER:shared"),
    }));
    values.set("sw:play-fields:account-a:cap:shared:other", "1");
    window.dispatchEvent(Object.assign(new Event("storage"), { key: "sw:play-fields:account-a:cap:shared:other" }));
    expect(getPlaySession("CHARACTER", "shared").pending).toBe(0);
    expect(writes).toEqual([]);
    second();
    online.onLine = false;
    const returned = connectPlayState("CHARACTER", "shared", undefined, undefined, { accountId: "account-a" });
    try {
      expect(getPlaySession("CHARACTER", "shared").ready).toBe(true);
      expect(getEffectivePlayState("CHARACTER", "shared").overrides).toEqual({ "cap:a": true });
      online.onLine = true;
      fetcher.mockClear();
      retryPlaySync("CHARACTER", "shared");
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "shared").pending).toBe(0));
      expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined();
      expect(writes).toEqual([original.opId]);
    } finally { returned(); }
  });

  it("aborts and ignores an old account response even if the transport still resolves", async () => {
    const { values } = browser();
    let finish!: (response: Response) => void;
    let oldSignal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce((_url, init) => {
      oldSignal = init.signal;
      return new Promise(resolve => { finish = resolve; });
    }).mockImplementation(async () => Response.json({ state: emptyPlayState() })));
    const first = connectPlayState("CHARACTER", "switching", undefined, undefined, { accountId: "account-a" });
    const second = connectPlayState("CHARACTER", "switching", undefined, undefined, { accountId: "account-b" });
    expect(oldSignal.aborted).toBe(true);
    finish(Response.json({ state: { revision: 5, overrides: { "cap:old": true }, fieldRevisions: { "cap:old": 5 } } }));
    try {
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "switching").status).toBe("saved"));
      expect(getEffectivePlayState("CHARACTER", "switching").overrides).toEqual({});
      expect(values.has("sw:session:account-a:CHARACTER:switching")).toBe(false);
      expect(values.has("sw:play-fields:account-a:cap:switching:old")).toBe(false);
    } finally { first(); second(); }
  });

  it("keeps one coordinator per sheet and cancels its final disconnected request", async () => {
    browser();
    let finish!: (response: Response) => void;
    let signal!: AbortSignal;
    const fetcher = vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise(resolve => { finish = resolve; });
    });
    vi.stubGlobal("fetch", fetcher);
    const first = connectPlayState("CHARACTER", "coordinated", undefined, undefined, { accountId: "account-a" });
    const second = connectPlayState("CHARACTER", "coordinated", undefined, undefined, { accountId: "account-a" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    first(); expect(signal.aborted).toBe(false);
    second(); expect(signal.aborted).toBe(true);
    finish(Response.json({ state: emptyPlayState() }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getPlaySession("CHARACTER", "coordinated").ready).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("offers an unowned legacy queue explicitly and never reuses it for another account", async () => {
    const legacy = { state: emptyPlayState(), ready: true, queue: [{ opId: "22222222-2222-4222-8222-222222222222", baseRevision: 0, changes: [{ field: "cap:legacy", value: true }] }] };
    const { values } = browser(new Map([["sw:session:CHARACTER:migration", JSON.stringify(legacy)]]));
    const writes: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      if (init?.body) writes.push(JSON.parse(init.body));
      return Response.json({ state: emptyPlayState() });
    }));
    const first = connectPlayState("CHARACTER", "migration", undefined, undefined, { accountId: "account-a" });
    await vi.waitFor(() => expect(getPlaySession("CHARACTER", "migration").status).toBe("legacy"));
    expect(writes).toEqual([]);
    expect(getPlaySession("CHARACTER", "migration").pending).toBe(0);
    expect(values.get("sw:session:CHARACTER:migration")).toBe(JSON.stringify(legacy));
    first();
    const second = connectPlayState("CHARACTER", "migration", undefined, undefined, { accountId: "account-b" });
    try {
      await vi.waitFor(() => expect(getPlaySession("CHARACTER", "migration").status).toBe("saved"));
      expect(getEffectivePlayState("CHARACTER", "migration").overrides).toEqual({});
      expect(writes).toEqual([]);
    } finally { second(); }
  });

  it("requires an authenticated account and stops requests when signed out", async () => {
    browser();
    const fetcher = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    expect(() => connectPlayState("CHARACTER", "auth-not-ready")).toThrow("Sign in");
    expect(fetcher).not.toHaveBeenCalled();
    const disconnect = connectPlayState("CHARACTER", "auth-not-ready", undefined, undefined, { accountId: "account-a" });
    setPlaySessionAccount(null);
    expect(getPlaySession("CHARACTER", "auth-not-ready").ready).toBe(false);
    expect(() => queuePlayChanges("CHARACTER", "auth-not-ready", [{ field: "cap:a", value: true }])).toThrow();
    disconnect();
  });

  it("preserves an in-flight mutation for its account when an old acknowledgement arrives after switching", async () => {
    const { values, online } = browser();
    let finish!: (response: Response) => void;
    let signal!: AbortSignal;
    let operationId = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      if (init?.body) {
        operationId = JSON.parse(init.body).opId;
        signal = init.signal;
        return new Promise<Response>(resolve => { finish = resolve; });
      }
      return Response.json({ state: emptyPlayState() });
    }));
    const first = connectPlayState("CHARACTER", "mutation-switch", undefined, undefined, { accountId: "account-a" });
    await vi.waitFor(() => expect(getPlaySession("CHARACTER", "mutation-switch").status).toBe("saved"));
    queuePlayChanges("CHARACTER", "mutation-switch", [{ field: "currentVitality", value: 3 }]);
    expect(operationId).not.toBe("");
    online.onLine = false;
    const second = connectPlayState("CHARACTER", "mutation-switch", undefined, undefined, { accountId: "account-b" });
    expect(signal.aborted).toBe(true);
    finish(Response.json({ state: { revision: 1, overrides: { currentVitality: 3 }, fieldRevisions: { currentVitality: 1 } } }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getPlaySession("CHARACTER", "mutation-switch").pending).toBe(0);
    const saved = JSON.parse(values.get("sw:session:account-a:CHARACTER:mutation-switch")!);
    expect(saved.queue).toMatchObject([{ opId: operationId }]);
    expect(saved.acknowledged).toEqual([]);
    second(); first();
    const returned = connectPlayState("CHARACTER", "mutation-switch", undefined, undefined, { accountId: "account-a" });
    try {
      expect(getEffectivePlayState("CHARACTER", "mutation-switch").overrides["currentVitality"]).toBe(3);
      expect(getPlaySession("CHARACTER", "mutation-switch").pending).toBe(1);
    } finally { returned(); }
  });

});
