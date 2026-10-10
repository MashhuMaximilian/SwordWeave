import { and, eq, inArray, sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  collections,
  collectionEntries,
  collectionFollows,
  collectionSources,
} from "@/db/schema/collections";
import { visibilityCondition } from "@/lib/publishing/library-query";
export const COLLECTION_TARGETS = [
  "PRIMITIVE",
  "EFFECT",
  "CAPABILITY",
  "ITEM",
  "CHARACTER",
  "LINEAGE_TEMPLATE",
  "UPBRINGING_TEMPLATE",
  "MANIFEST_TEMPLATE",
  "BUILD_TEMPLATE",
  "MONSTER",
  "ENCOUNTER",
  "COLLECTION",
] as const;
export const SYSTEM_COLLECTIONS = {
  ORIGINAL: "Original Creations",
  FORKS: "Forks",
  FAVORITES: "Community Favorites",
} as const;
export function collectionReadable(
  visibility: string,
  ownerId: string,
  viewerId: string | null,
  followsOwner: boolean,
) {
  return (
    ownerId === viewerId ||
    visibility === "PUBLIC" ||
    (visibility === "FOLLOWERS_ONLY" && !!viewerId && followsOwner)
  );
}
export function wouldCreateCycle(
  id: string,
  parentId: string | null,
  nodes: { id: string; parentId: string | null }[],
) {
  const seen = new Set([id]);
  let current = parentId;
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = nodes.find((n) => n.id === current)?.parentId ?? null;
  }
  return false;
}
export async function ensureSystemCollections(userId: string) {
  await db
    .insert(collections)
    .values(
      Object.entries(SYSTEM_COLLECTIONS).map(([systemKind, name]) => ({
        ownerId: userId,
        name,
        systemKind,
        visibility: "PRIVATE" as const,
      })),
    )
    .onConflictDoNothing();
}
const readableSql = (viewer: string | null) =>
  sql`(c.visibility='PUBLIC' OR c.owner_id=${viewer} OR (c.visibility='FOLLOWERS_ONLY' AND EXISTS (SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=c.owner_id AND v.clerk_user_id=${viewer})))`;
export async function listCollections(viewer: string | null, owner?: string) {
  if (viewer) await ensureSystemCollections(viewer);
  const result = await db.execute(
    sql`SELECT c.*, EXISTS(SELECT 1 FROM collection_follows cf WHERE cf.collection_id=c.id AND cf.user_id=${viewer}) AS followed FROM collections c WHERE ${readableSql(viewer)} AND ${owner ? sql`c.owner_id=${owner}` : sql`(c.owner_id=${viewer} OR EXISTS(SELECT 1 FROM collection_follows cf WHERE cf.collection_id=c.id AND cf.user_id=${viewer}))`} ORDER BY c.created_at LIMIT 300`,
  );
  const all = result.rows;
  // Parent metadata is returned only if the parent itself is readable.
  const parentIds = all.map((c) => c["parent_id"]).filter(Boolean) as string[];
  const visibleParents = parentIds.length
    ? await db.execute(
        sql`SELECT c.id FROM collections c WHERE c.id IN (${sql.join(
          parentIds.map((id) => sql`${id}::uuid`),
          sql`,`,
        )}) AND ${readableSql(viewer)}`,
      )
    : { rows: [] };
  const allowed = new Set(visibleParents.rows.map((c) => c["id"]));
  return all.map((c) => ({
    ...c,
    parent_id: allowed.has(c["parent_id"]) ? c["parent_id"] : null,
  }));
}
export async function getCollection(id: string, viewer: string | null) {
  const r = await db.execute(
    sql`SELECT c.*, EXISTS(SELECT 1 FROM collection_follows cf WHERE cf.collection_id=c.id AND cf.user_id=${viewer}) AS followed FROM collections c WHERE c.id=${id}::uuid AND ${readableSql(viewer)}`,
  );
  const c = r.rows[0];
  if (!c) throw new Error("Collection not found");
  if (c["parent_id"]) {
    const p = await db.execute(
      sql`SELECT c.id FROM collections c WHERE c.id=${c["parent_id"]}::uuid AND ${readableSql(viewer)}`,
    );
    if (!p.rows.length) c["parent_id"] = null;
  }
  return c;
}
export const collectionTargetTables: Record<string, string> = {
  PRIMITIVE: "primitives",
  EFFECT: "effects",
  CAPABILITY: "capabilities",
  ITEM: "items",
  CHARACTER: "characters",
  LINEAGE_TEMPLATE: "heritage",
  UPBRINGING_TEMPLATE: "heritage",
  MANIFEST_TEMPLATE: "heritage",
  BUILD_TEMPLATE: "builds",
  MONSTER: "monsters",
  ENCOUNTER: "encounters",
  COLLECTION: "collections",
};
function entryAccess(type: string, viewer: string | null) {
  if (type === "COLLECTION")
    return sql`(e.owner_id=${viewer} OR e.visibility='PUBLIC' OR (e.visibility='FOLLOWERS_ONLY' AND EXISTS(SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=e.owner_id AND v.clerk_user_id=${viewer})))`;
  if (type === "ENCOUNTER")
    return sql`(e.owner_id=${viewer} OR e.visibility='PUBLIC' OR (e.visibility='FOLLOWERS_ONLY' AND EXISTS(SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=e.owner_id AND v.clerk_user_id=${viewer})))`;
  if (type === "MONSTER")
    return sql`(e.user_id=${viewer} OR e.visibility='PUBLIC' OR (e.visibility='FOLLOWERS_ONLY' AND EXISTS(SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=e.user_id AND v.clerk_user_id=${viewer})))`;
  const visibility = visibilityCondition(
    type,
    sql`e.id`,
    sql`e.user_id`,
    viewer ?? undefined,
    sql`e.is_public`,
  );
  if (type === "CHARACTER" && viewer)
    return sql`(${visibility} OR EXISTS(SELECT 1 FROM character_shares cs JOIN users u ON u.id=cs.shared_with_user_id WHERE cs.character_id=e.id AND cs.revoked_at IS NULL AND u.clerk_user_id=${viewer}))`;
  return visibility;
}
export async function visibleEntries(
  refs: { targetType: string; targetId: string }[],
  viewer: string | null,
) {
  const groups = new Map<string, string[]>();
  for (const ref of refs) {
    if (collectionTargetTables[ref.targetType])
      groups.set(ref.targetType, [
        ...(groups.get(ref.targetType) ?? []),
        ref.targetId,
      ]);
  }
  const rows = await Promise.all(
    [...groups].map(async ([type, ids]) => {
      const t = sql.identifier(collectionTargetTables[type]!);
      const access = entryAccess(type, viewer);
      const heritageGate=collectionTargetTables[type]==="heritage"?sql`AND e.kind=${type.replace("_TEMPLATE","")}`:sql``;
      const r = await db.execute(
        sql`SELECT e.id::text AS "targetId", ${type} AS "targetType", e.name FROM ${t} e WHERE e.id::text IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`,`,
        )}) AND ${access} ${heritageGate}`,
      );
      return r.rows as unknown as {
        targetId: string;
        targetType: string;
        name: string;
      }[];
    }),
  );
  return rows.flat();
}
export async function collectionContents(
  id: string,
  viewer: string | null,
  page = 0,
  candidates?: { targetType: string; targetId: string }[],
  limit = 40,
) {
  const collection = await getCollection(id, viewer);
  const kind = collection["system_kind"];
  const queries = Object.entries(collectionTargetTables).map(
    ([type, table]) => {
      const access = entryAccess(type, viewer);
      const heritage =
        type.endsWith("_TEMPLATE") && table === "heritage"
          ? sql`AND e.kind=${type.replace("_TEMPLATE", "")}`
          : sql``;
      const origin =
        type === "COLLECTION" ? sql`false` : type === "ENCOUNTER" ? (kind === "FORKS" ? sql`false` : sql`true`) : type === "MONSTER"
          ? kind === "FORKS"
            ? sql`e.forked_from_id IS NOT NULL`
            : sql`e.forked_from_id IS NULL`
          : kind === "FORKS"
            ? sql`e.source_origin LIKE 'fork:%'`
            : sql`(e.source_origin IS NULL OR e.source_origin NOT LIKE 'fork:%')`;
      const member =
        kind === "ORIGINAL" || kind === "FORKS"
          ? sql`${type === "ENCOUNTER" || type === "COLLECTION" ? sql`e.owner_id` : sql`e.user_id`}=${collection["owner_id"]} AND ${origin}`
          : sql`EXISTS (SELECT 1 FROM collection_entries ce WHERE ce.collection_id=${id}::uuid AND ce.target_type=${type} AND ce.target_id=e.id::text)`;
      const ids = candidates
        ?.filter((c) => c.targetType === type)
        .map((c) => c.targetId);
      const candidateGate = ids
        ? ids.length
          ? sql`AND e.id::text IN (${sql.join(
              ids.map((id) => sql`${id}`),
              sql`,`,
            )})`
          : sql`AND false`
        : sql``;
      return sql`SELECT e.id::text AS "targetId", ${type} AS "targetType", e.name, e.created_at FROM ${sql.identifier(table)} e WHERE ${member} AND ${access} ${heritage} ${candidateGate}`;
    },
  );
  const union = sql.join(queries, sql` UNION ALL `);
  const [result, count] = await Promise.all([
    db.execute(
      sql`SELECT "targetId","targetType",name FROM (${union}) entries ORDER BY created_at DESC,"targetId" LIMIT ${limit} OFFSET ${page * limit}`,
    ),
    db.execute(sql`SELECT count(*)::int AS total FROM (${union}) entries`),
  ]);
  const total = Number(count.rows[0]?.["total"] ?? 0);
  return {
    collection,
    entries: result.rows,
    total,
    page,
    hasMore: total > (page + 1) * limit,
  };
}
export async function saveMemberships(
  userId: string,
  type: string,
  targetId: string,
  ids: string[],
) {
  if (!COLLECTION_TARGETS.includes(type as (typeof COLLECTION_TARGETS)[number]))
    throw new Error("Invalid target type");
  if (!(await visibleEntries([{ targetType: type, targetId }], userId)).length)
    throw new Error("Entry not found");
  const owned = await db
    .select()
    .from(collections)
    .where(eq(collections.ownerId, userId));
  if (
    ids.some(
      (id) =>
        !owned.some(
          (c) => c.id === id && (!c.systemKind || c.systemKind === "FAVORITES"),
        ),
    )
  )
    throw new Error("Choose your own custom collection or favorites");
  await withDatabaseTransaction(async (tx) => {
    if (type === "COLLECTION") {
      // Serialize collection graph updates so concurrent saves cannot create a cycle.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(7341291)`);
      const links = await tx.execute(sql`WITH RECURSIVE descendants(id) AS (
        SELECT ${targetId}::text UNION SELECT ce.target_id FROM collection_entries ce JOIN descendants d ON ce.collection_id::text=d.id WHERE ce.target_type='COLLECTION'
      ) SELECT id FROM descendants`);
      if(ids.some(id=>links.rows.some(row=>row["id"]===id)))throw new Error("A collection cannot contain itself or a collection that already contains it.");
      if(ids.length) await tx.insert(collectionFollows).values({userId,collectionId:targetId}).onConflictDoNothing();
      else await tx.delete(collectionFollows).where(and(eq(collectionFollows.userId,userId),eq(collectionFollows.collectionId,targetId)));
    }
    const editable = owned
      .filter((c) => !c.systemKind || c.systemKind === "FAVORITES")
      .map((c) => c.id);
    if (editable.length)
      await tx
        .delete(collectionEntries)
        .where(
          and(
            inArray(collectionEntries.collectionId, editable),
            eq(collectionEntries.targetType, type),
            eq(collectionEntries.targetId, targetId),
          ),
        );
    if (ids.length)
      await tx
        .insert(collectionEntries)
        .values(
          [...new Set(ids)].map((collectionId) => ({
            collectionId,
            targetType: type,
            targetId,
          })),
        )
        .onConflictDoNothing();
  });
}
export async function setSourceCollection(
  userId: string,
  type: string,
  targetId: string,
  collectionId: string | null | undefined,
) {
  if (collectionId === undefined) return;
  if (collectionId === null) {
    await db
      .delete(collectionSources)
      .where(
        and(
          eq(collectionSources.targetType, type),
          eq(collectionSources.targetId, targetId),
          inArray(
            collectionSources.collectionId,
            db
              .select({ id: collections.id })
              .from(collections)
              .where(eq(collections.ownerId, userId)),
          ),
        ),
      );
    return;
  }
  const [c] = await db
    .select()
    .from(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.ownerId, userId)),
    );
  if (!c || c.systemKind)
    throw new Error("Source must be your custom collection");
  await db
    .insert(collectionEntries)
    .values({ collectionId, targetType: type, targetId })
    .onConflictDoNothing();
  await db
    .insert(collectionSources)
    .values({ collectionId, targetType: type, targetId })
    .onConflictDoUpdate({
      target: [collectionSources.targetType, collectionSources.targetId],
      set: { collectionId },
    });
}
export { collections, collectionEntries, collectionFollows };
