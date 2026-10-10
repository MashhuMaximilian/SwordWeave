import { sql, type SQL } from "drizzle-orm";
import type { Visibility } from "@/lib/publishing/visibility";

/** Entity owners are Clerk IDs; follow relationships use internal UUIDs. */
export function directVisibilityCondition(
  owner: SQL,
  visibility: SQL,
  viewer: string | null,
) {
  return sql`(${owner}=${viewer} OR ${visibility}='PUBLIC' OR (${visibility}='FOLLOWERS_ONLY' AND EXISTS(SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=${owner} AND v.clerk_user_id=${viewer})))`;
}
export function audienceIncludes(
  audience: Visibility,
  author: string,
  source: { userId: string; visibility: Visibility },
) {
  return (
    audience === "PRIVATE" ||
    source.visibility === "PUBLIC" ||
    (audience === "FOLLOWERS_ONLY" &&
      source.userId === author &&
      source.visibility === "FOLLOWERS_ONLY")
  );
}
/** Linked sheets and live state never travel with shared preparation. */
export function sharePreparation<
  T extends { characterIds: string[]; budgetSource: string },
>(definition: T): T {
  return { ...definition, characterIds: [], budgetSource: "manual" };
}
