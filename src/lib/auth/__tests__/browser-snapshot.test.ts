import { describe, expect, it, vi } from "vitest";
import { browserSnapshotFromRequestState } from "../browser-snapshot";

const signedOut = (reason = "session-token-and-uat-missing") => ({
  status: "signed-out", isAuthenticated: false, tokenType: "session_token", reason,
});

describe("browser auth snapshot classification", () => {
  it("recognizes only a definitive absent session as anonymous", () => {
    expect(browserSnapshotFromRequestState(signedOut())).toEqual({ status: "anonymous" });
  });

  it("projects verified principal IDs without copying tokens or SDK resources", () => {
    const toAuth = vi.fn(() => ({ userId: "user_verified", sessionId: "sess_verified", getToken: vi.fn(), sessionClaims: { private: true } }));
    expect(browserSnapshotFromRequestState({ status: "signed-in", isAuthenticated: true, tokenType: "session_token", token: "never-expose", toAuth })).toEqual({
      status: "authenticated", userId: "user_verified", sessionId: "sess_verified",
    });
    expect(toAuth).toHaveBeenCalledOnce();
  });

  it.each([
    "session-token-expired", "client-uat-but-no-session-token", "session-token-missing",
    "session-token-but-no-client-uat", "unexpected-error", "unknown-future-reason",
  ])("leaves %s for the browser SDK", reason => {
    expect(browserSnapshotFromRequestState(signedOut(reason))).toEqual({ status: "resolve-in-browser" });
  });

  it("keeps handshake state uncertain even with an absent-session reason", () => {
    expect(browserSnapshotFromRequestState({ ...signedOut(), status: "handshake" })).toEqual({ status: "resolve-in-browser" });
  });

  it.each([null, undefined, "anonymous", {}, { ...signedOut(), isAuthenticated: undefined }, { ...signedOut(), tokenType: "api_key" }, { ...signedOut(), status: "signed-in" }])("does not infer anonymous from malformed state %#", state => {
    expect(browserSnapshotFromRequestState(state)).toEqual({ status: "resolve-in-browser" });
  });

  it.each([{}, { userId: "user_verified" }, { userId: " ", sessionId: "sess_verified" }, { userId: "user_verified", sessionId: "" }, null])("requires both verified identifiers %#", auth => {
    expect(browserSnapshotFromRequestState({ status: "signed-in", isAuthenticated: true, tokenType: "session_token", toAuth: () => auth })).toEqual({ status: "resolve-in-browser" });
  });

  it("contains a throwing auth projection", () => {
    expect(browserSnapshotFromRequestState({ status: "signed-in", isAuthenticated: true, tokenType: "session_token", toAuth: () => { throw new Error("verification unavailable"); } })).toEqual({ status: "resolve-in-browser" });
  });
});
