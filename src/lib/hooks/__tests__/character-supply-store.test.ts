import { describe, expect, it, vi } from "vitest";
import { createCharacterSupplyStore } from "../character-supply-store";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
const graph = (id: string) => ({ characterId: id } as WorkspaceGraph);
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("shared character supply graph", () => {
  it("shares one request and result across all mounted resolver consumers", async () => {
    const load = vi.fn(async (id: string) => graph(id));
    const store = createCharacterSupplyStore(load, () => () => {});
    const first = vi.fn(); const second = vi.fn();
    const a = store.subscribe("a", first); const b = store.subscribe("a", second);
    await tick();
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot("a")?.characterId).toBe("a");
    a(); b(); await tick();
    expect(store.getSnapshot("a")).toBeNull();
  });
  it("coalesces invalidations during a request into one trailing refresh", async () => {
    let invalidate = () => {};
    const resolvers: ((value: WorkspaceGraph) => void)[] = [];
    const load = vi.fn(() => new Promise<WorkspaceGraph>(resolve => resolvers.push(resolve)));
    const store = createCharacterSupplyStore(load, cb => { invalidate = cb; return () => {}; });
    const stop = store.subscribe("a", () => {});
    invalidate(); invalidate(); invalidate();
    expect(load).toHaveBeenCalledTimes(1);
    resolvers[0]!(graph("a")); await tick();
    expect(load).toHaveBeenCalledTimes(2);
    resolvers[1]!(graph("a")); await tick();
    expect(load).toHaveBeenCalledTimes(2);
    stop(); await tick();
  });
  it("survives StrictMode resubscribe and aborts after the final unmount", async () => {
    const load = vi.fn((_id: string, _signal: AbortSignal) => new Promise<WorkspaceGraph>(() => {}));
    const detach = vi.fn();
    const store = createCharacterSupplyStore(load, () => detach);
    store.subscribe("a", () => {})();
    const stop = store.subscribe("a", () => {});
    await tick(); expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]![1].aborted).toBe(false);
    stop(); await tick();
    expect(load.mock.calls[0]![1].aborted).toBe(true); expect(detach).toHaveBeenCalledTimes(1);
  });
  it("isolates characters and retains the last verified result on failure", async () => {
    let invalidate = () => {};
    const load = vi.fn(async (id: string) => graph(id));
    const store = createCharacterSupplyStore(load, cb => { invalidate = cb; return () => {}; });
    const stop = store.subscribe("a", () => {}); await tick();
    expect(store.getSnapshot("b")).toBeNull();
    load.mockRejectedValueOnce(new Error("offline")); invalidate(); await tick();
    expect(store.getSnapshot("a")?.characterId).toBe("a");
    stop(); await tick();
  });
});
