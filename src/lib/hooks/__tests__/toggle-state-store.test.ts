import { expect, it, vi } from "vitest";
import { createToggleStateStore } from "../toggle-state-store";
it("shares reads and preserves snapshot identity on unchanged acknowledgements", () => {
  const read = vi.fn(() => ({ offCapabilityIds: new Set(["cap"]), offEffectIds: new Set<string>() }));
  const store = createToggleStateStore(read, () => () => {});
  const changed = vi.fn(); store.subscribe("a", changed); store.subscribe("a", vi.fn());
  expect(read).toHaveBeenCalledTimes(1);
  const snapshot = store.getSnapshot("a"); store.refresh("a");
  expect(store.getSnapshot("a")).toBe(snapshot); expect(changed).not.toHaveBeenCalled();
  read.mockReturnValue({ offCapabilityIds: new Set(), offEffectIds: new Set(["effect"]) }); store.refresh("a");
  expect(changed).toHaveBeenCalledOnce(); expect(store.getSnapshot("a").offEffectIds.has("effect")).toBe(true);
});
it("isolates characters and releases private snapshots after the final subscriber leaves", async () => {
  const stop = vi.fn();
  const store = createToggleStateStore(() => ({ offCapabilityIds: new Set(), offEffectIds: new Set() }), () => stop);
  const a = store.subscribe("a", vi.fn()), b = store.subscribe("b", vi.fn());
  a(); await Promise.resolve();
  expect(store.getSnapshot("a").hydrated).toBe(false); expect(store.getSnapshot("b").hydrated).toBe(true);
  expect(stop).toHaveBeenCalledOnce(); b();
});
