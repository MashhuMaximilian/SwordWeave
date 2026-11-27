import { auth } from "@clerk/nextjs/server";
import { resolveMcpActor } from "./auth";
import { getBrowserReviewMcpConfig } from "./config";
import { browserReviewEnabled, canUseBrowserReview } from "./operation-policy";

export async function resolveCompanionBrowserActor(config = getBrowserReviewMcpConfig()) {
  if (!config || !browserReviewEnabled(config)) return null;
  const session = await auth();
  if (!session.userId || !session.sessionId) return null;
  const actor = await resolveMcpActor({ clerkId: session.userId, scopes: [] });
  return actor && canUseBrowserReview(config, actor) ? actor : null;
}
