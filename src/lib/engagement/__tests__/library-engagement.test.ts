import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { select: mocks.select } }));
import { loadLibraryEngagement } from "../library-engagement";
const item = { id: "CAPABILITY:cap", targetType: "CAPABILITY", targetId: "cap", authorId: "clerk-author" };

beforeEach(() => {
  mocks.select.mockReset();
  mocks.select.mockImplementationOnce(() => {
    const chain = { from: () => chain, where: async () => [{ targetType: "CAPABILITY", targetId: "cap", kind: "LIKE" }] };
    return chain;
  }).mockImplementationOnce(() => {
    const chain = { from: () => chain, innerJoin: () => chain, where: async () => [{ clerkUserId: "clerk-author" }] };
    return chain;
  });
});

it("resolves reaction and joined follow state keyed by Clerk author ID", async () => {
  const result = await loadLibraryEngagement("internal-viewer", [item, { ...item, id: "CAPABILITY:other", targetId: "other", authorId: "unfollowed" }]);
  expect(result.reactions).toEqual({ "CAPABILITY:cap": "LIKE", "CAPABILITY:other": null });
  expect(result.following).toEqual({ "clerk-author": true, unfollowed: false });
  expect(mocks.select).toHaveBeenCalledTimes(2);
});

it("does not query personalized engagement for anonymous viewers", async () => {
  expect(await loadLibraryEngagement(null, [item])).toEqual({ reactions: { "CAPABILITY:cap": null }, following: {} });
  expect(mocks.select).not.toHaveBeenCalled();
});
