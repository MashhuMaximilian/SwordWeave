import { auth } from "@clerk/nextjs/server";
import { resolveMcpActor } from "./auth";
import { getMcpConfig } from "./config";
import { isStagingOperationActor, stagingReviewEnabled } from "./operation-policy";

export async function resolveCompanionBrowserActor() {
  const config = getMcpConfig();
  if (!config || !stagingReviewEnabled(config)) return null;
  const session = await auth();
  if (!session.userId || !session.sessionId) return null;
  const actor = await resolveMcpActor({ clerkId: session.userId, scopes: [] });
  return actor && isStagingOperationActor(config, actor) ? actor : null;
}
