import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  identity: vi.fn(),
  write: vi.fn(),
  values: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: async () => ({ username: "viewer" }),
}));
vi.mock("@/lib/auth/author-resolver", () => ({
  resolveLocalAuthorIdentity: mocks.identity,
}));
vi.mock("@/db/client", () => ({ db: { update: mocks.write } }));
import { PATCH } from "@/app/api/users/me/preferences/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "authenticated-viewer" });
  mocks.identity.mockResolvedValue({ clerkUserId: "authenticated-viewer" });
  mocks.write.mockReturnValue({ set: mocks.values });
  mocks.values.mockReturnValue({ where: mocks.where });
  mocks.where.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ isGameMaster: true }]);
});
const request = (value: unknown) =>
  new Request("http://localhost/api/users/me/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
describe("GM interface preference API", () => {
  it("requires sign-in", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await PATCH(request({ isGameMaster: true }))).status).toBe(401);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each([
    { isGameMaster: "true" },
    { isGameMaster: true, isAdmin: true },
    { isGameMaster: true, userId: "other" },
    {},
  ])("rejects non-boolean or additional permissions: %j", async (value) => {
    expect((await PATCH(request(value))).status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("saves only the preference and returns private uncached data", async () => {
    const response = await PATCH(request({ isGameMaster: true }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.values).toHaveBeenCalledWith({
      isGameMaster: true,
      updatedAt: expect.any(Date),
    });
    expect(await response.json()).toEqual({ isGameMaster: true });
    expect(mocks.identity).toHaveBeenCalledWith(
      "authenticated-viewer",
      "viewer",
    );
  });
  it("reports a missing profile instead of creating a privileged account", async () => {
    mocks.returning.mockResolvedValue([]);
    expect((await PATCH(request({ isGameMaster: false }))).status).toBe(404);
  });
  it("reports failed persistence", async () => {
    mocks.returning.mockRejectedValue(new Error("Database unavailable"));
    expect((await PATCH(request({ isGameMaster: true }))).status).toBe(400);
  });
});
