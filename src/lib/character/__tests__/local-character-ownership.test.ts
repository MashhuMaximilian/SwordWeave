import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  character: vi.fn(), userId: vi.fn(), localIdentity: vi.fn(), account: vi.fn(), shares: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.account }));
vi.mock("@/lib/auth/author-resolver", () => ({ resolveUserIdByClerkId: mocks.userId, resolveLocalAuthorIdentity: mocks.localIdentity }));
vi.mock("@/db/client", () => ({ db: {
  query: { characters: { findFirst: mocks.character } },
  select: () => ({ from: () => ({ where: () => ({ limit: mocks.shares }) }) }),
} }));
import { canResolveCharacterForPage } from "../can-resolve-character";

describe("character access after recreating a local Clerk session", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.userId.mockResolvedValue(null);
    mocks.account.mockResolvedValue({ username: "local-player" });
    mocks.localIdentity.mockResolvedValue({ clerkUserId: "previous-clerk-id", internalUserId: "profile-id" });
    mocks.shares.mockResolvedValue([]);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it.each(["current-clerk-id", "previous-clerk-id", "profile-id"])("opens characters owned by %s", async (ownerId) => {
    mocks.character.mockResolvedValue({ id: "character-id", userId: ownerId });
    expect((await canResolveCharacterForPage("current-clerk-id", "character-id"))?.permission).toBe("OWNER");
  });

  it("does not expose unrelated characters", async () => {
    mocks.character.mockResolvedValue({ id: "character-id", userId: "someone-else" });
    expect(await canResolveCharacterForPage("current-clerk-id", "character-id")).toBeNull();
  });

  it("does not enable local-profile ownership fallback in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.character.mockResolvedValue({ id: "character-id", userId: "previous-clerk-id" });
    expect(await canResolveCharacterForPage("current-clerk-id", "character-id")).toBeNull();
    expect(mocks.localIdentity).not.toHaveBeenCalled();
  });
});
