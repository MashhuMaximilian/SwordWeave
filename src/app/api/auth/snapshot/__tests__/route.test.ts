import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ clerkClient: vi.fn(), authenticateRequest: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: mocks.clerkClient }));
import { GET } from "../route";

beforeEach(() => {
  mocks.clerkClient.mockReset().mockResolvedValue({ authenticateRequest: mocks.authenticateRequest });
  mocks.authenticateRequest.mockReset();
});

async function snapshot() {
  const request = new Request("https://www.swordweave.quest/api/auth/snapshot");
  const response = await GET(request);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  return { request, body: await response.json() };
}

describe("GET /api/auth/snapshot", () => {
  it("uses explicit session-token authentication for an anonymous request", async () => {
    mocks.authenticateRequest.mockResolvedValue({ status: "signed-out", isAuthenticated: false, tokenType: "session_token", reason: "session-token-and-uat-missing" });
    const { request, body } = await snapshot();
    expect(mocks.authenticateRequest).toHaveBeenCalledWith(request, { acceptsToken: "session_token" });
    expect(body).toEqual({ status: "anonymous" });
  });

  it("returns only SDK-verified scalar identity for an authenticated request", async () => {
    mocks.authenticateRequest.mockResolvedValue({ status: "signed-in", isAuthenticated: true, tokenType: "session_token", token: "never-expose", toAuth: () => ({ userId: "user_verified", sessionId: "sess_verified" }) });
    expect((await snapshot()).body).toEqual({ status: "authenticated", userId: "user_verified", sessionId: "sess_verified" });
  });

  it.each(["signed-out", "handshake"])("sends an expired %s request to browser resolution", async status => {
    mocks.authenticateRequest.mockResolvedValue({ status, isAuthenticated: false, tokenType: "session_token", reason: "session-token-expired" });
    expect((await snapshot()).body).toEqual({ status: "resolve-in-browser" });
  });

  it("does not classify malformed SDK output as signed out", async () => {
    mocks.authenticateRequest.mockResolvedValue({ status: "signed-in", isAuthenticated: true, tokenType: "session_token", toAuth: () => ({ userId: null, sessionId: null }) });
    expect((await snapshot()).body).toEqual({ status: "resolve-in-browser" });
  });

  it("contains verification failure without leaking its message", async () => {
    mocks.authenticateRequest.mockRejectedValue(new Error("sensitive verification detail"));
    expect((await snapshot()).body).toEqual({ status: "resolve-in-browser" });
  });

  it("contains a client initialization failure", async () => {
    mocks.clerkClient.mockRejectedValue(new Error("keys unavailable"));
    expect((await snapshot()).body).toEqual({ status: "resolve-in-browser" });
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
  });
});
