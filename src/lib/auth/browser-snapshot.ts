/** A load hint for the browser runtime, never authorization for an API action. */
export type BrowserAuthSnapshot =
  | { status: "anonymous" }
  | { status: "resolve-in-browser" }
  | { status: "authenticated"; userId: string; sessionId: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

/**
 * Classify only documented authenticateRequest() fields. Expiration is not
 * proof of sign-out: Clerk's browser SDK may still refresh an active session.
 * Unknown/malformed results therefore request the real SDK instead.
 */
export function browserSnapshotFromRequestState(state: unknown): BrowserAuthSnapshot {
  try {
    if (!record(state) || state["tokenType"] !== "session_token") {
      return { status: "resolve-in-browser" };
    }
    if (
      state["status"] === "signed-out" &&
      state["isAuthenticated"] === false &&
      state["reason"] === "session-token-and-uat-missing"
    ) {
      return { status: "anonymous" };
    }
    if (
      state["status"] === "signed-in" &&
      state["isAuthenticated"] === true &&
      typeof state["toAuth"] === "function"
    ) {
      const auth: unknown = state["toAuth"]();
      if (record(auth) && identifier(auth["userId"]) && identifier(auth["sessionId"])) {
        return {
          status: "authenticated",
          userId: auth["userId"],
          sessionId: auth["sessionId"],
        };
      }
    }
  } catch {
    // A classifier failure must never turn an uncertain session into anonymous.
  }
  return { status: "resolve-in-browser" };
}
