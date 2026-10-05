import { afterEach, describe, it, expect, vi } from "vitest";
import { BookmarkStore } from "@/components/collections/bookmark-state";
afterEach(() => vi.useRealTimers());
describe("bookmark controls", () => {
  it("batches duplicate cards and previews, then publishes initial saved state to both", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            userId: "owner",
            memberships: [
              {
                targetType: "PRIMITIVE",
                targetId: "1",
                collectionId: "favorites",
              },
            ],
          }),
        ),
    );
    const store = new BookmarkStore(fetcher as typeof fetch);
    const first = vi.fn(),
      duplicate = vi.fn(),
      second = vi.fn();
    store.subscribe("owner", { targetType: "PRIMITIVE", targetId: "1" }, first);
    store.subscribe(
      "owner",
      { targetType: "PRIMITIVE", targetId: "1" },
      duplicate,
    );
    store.subscribe("owner", { targetType: "EFFECT", targetId: "2" }, second);
    await vi.advanceTimersByTimeAsync(21);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const init = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init[1].body)).entries).toHaveLength(2);
    expect(first).toHaveBeenLastCalledWith(true);
    expect(duplicate).toHaveBeenLastCalledWith(true);
    expect(second).toHaveBeenLastCalledWith(false);
  });
  it("keeps newly toggled bookmark controls in sync", () => {
    const store = new BookmarkStore();
    const first = vi.fn(),
      second = vi.fn();
    const a = store.subscribe(
      "owner",
      { targetType: "ITEM", targetId: "1" },
      first,
    );
    const b = store.subscribe(
      "owner",
      { targetType: "ITEM", targetId: "1" },
      second,
    );
    store.set("owner", { targetType: "ITEM", targetId: "1" }, true);
    expect(first).toHaveBeenLastCalledWith(true);
    expect(second).toHaveBeenLastCalledWith(true);
    a();
    b();
  });
  it("does not apply another signed-in user's saved state after an account switch", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            userId: "different-account",
            memberships: [{ targetType: "ITEM", targetId: "1" }],
          }),
        ),
    );
    const store = new BookmarkStore(fetcher as typeof fetch);
    const listener = vi.fn();
    store.subscribe("owner", { targetType: "ITEM", targetId: "1" }, listener);
    await vi.advanceTimersByTimeAsync(21);
    expect(listener).toHaveBeenLastCalledWith(false);
  });
});
