import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function DiagSameAsItem() {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = proc?.env;
  const results: Record<string, unknown> = {
    processType: typeof proc,
    envType: typeof env,
    dbUrlSet: !!env?.["DATABASE_URL"],
    nodeEnv: String(env?.["NODE_ENV"]),
  };

  try {
    const a = await auth();
    results["clerk"] = { userId: a.userId, sessionId: a.sessionId };
  } catch (e) {
    results["clerkError"] = e instanceof Error ? e.message : String(e);
  }

  // Same imports as the page
  try {
    const { db } = await import("@/db/client");
    const { primitives, users, reactionAggregates, forkAggregates } = await import("@/db/schema");
    const { and, eq, sql } = await import("drizzle-orm");

    // Mimic PrimitiveDetail queries
    const row = await db.query.primitives.findFirst({
      where: (table: { id: any }, { eq: eqFn }: any) => eqFn(table.id, 24),
    });
    results["primitiveQuery"] = row ? `found: ${row.name}` : "null";

    if (row) {
      try {
        const userRow = await db.query.users.findFirst({
          where: (table: { clerkUserId: any }, { eq: eqFn }: any) =>
            eqFn(table.clerkUserId, row.userId),
          columns: { id: true, username: true, displayName: true, avatarUrl: true },
        });
        results["userQuery"] = userRow ? `found: ${userRow.username}` : "null";
      } catch (e) {
        results["userQueryError"] = e instanceof Error ? e.message : String(e);
      }
    }

    // Try loadEngagement-style query
    try {
      const r = await db
        .select({
          likes: sql<number>`SUM(${reactionAggregates.likesCount})::int`,
          dislikes: sql<number>`SUM(${reactionAggregates.dislikesCount})::int`,
        })
        .from(reactionAggregates)
        .where(
          and(
            eq(reactionAggregates.targetType, "PRIMITIVE"),
            eq(reactionAggregates.targetId, "24"),
          ),
        );
      results["engagementQuery"] = JSON.stringify(r);
    } catch (e) {
      results["engagementQueryError"] = e instanceof Error ? e.message : String(e);
    }

    // Try forkAggregates query
    try {
      const f = await db
        .select({ count: sql<number>`SUM(${forkAggregates.forkCount})::int` })
        .from(forkAggregates)
        .where(
          and(
            eq(forkAggregates.sourceTargetType, "PRIMITIVE"),
            eq(forkAggregates.sourceTargetId, "24"),
          ),
        );
      results["forkQuery"] = JSON.stringify(f);
    } catch (e) {
      results["forkQueryError"] = e instanceof Error ? e.message : String(e);
    }
  } catch (e) {
    results["importError"] = e instanceof Error ? e.message : String(e);
  }

  return (
    <div style={{padding: 32, fontFamily: "monospace", fontSize: 12}}>
      <h1>Diag - Same queries as /library/item/[id]</h1>
      <pre>{JSON.stringify(results, null, 2)}</pre>
    </div>
  );
}
