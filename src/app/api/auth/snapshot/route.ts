import { clerkClient } from "@clerk/nextjs/server";
import { browserSnapshotFromRequestState, type BrowserAuthSnapshot } from "@/lib/auth/browser-snapshot";
import { privateJson } from "@/lib/http/private-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public load hint only. All protected actions retain their own server auth. */
export async function GET(request: Request) {
  let snapshot: BrowserAuthSnapshot = { status: "resolve-in-browser" };
  try {
    const client = await clerkClient();
    // Retain the existing clerkMiddleware verification configuration, including
    // its deployment keys/origins, rather than restricting preview or local URLs.
    // No browser cookie names or client-supplied identity are interpreted here.
    const state = await client.authenticateRequest(request, { acceptsToken: "session_token" });
    snapshot = browserSnapshotFromRequestState(state);
  } catch {
    // Network/verification failures request Clerk's real browser resolution.
  }
  return privateJson(snapshot, { headers: { "X-Robots-Tag": "noindex, nofollow" } });
}
