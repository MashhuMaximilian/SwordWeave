// =============================================================================
// Library query service — Phase 5 Commit B
//
// Powers /library and /library/* pages with sort + filter + pagination.
//
// Sort modes:
// - LIKES (default): by reaction_aggregates.likes_count - dislikes_count (net)
// - RECENT: by publications.published_at
// - FORKS: by fork_aggregates.fork_count
// - ALPHABETICAL: by target.name
//
// Filter inputs:
// - targetType: PRIMITIVE | CAPABILITY | RACE_TEMPLATE | etc.
// - category: primitive category
// - authorUsername: filter by author
// - visibility: PUBLIC (default), FOLLOWERS_ONLY (requires following)
// - minLikes: integer threshold
// - hasForks: boolean
//
// Pagination: limit (default 24, max 100), offset
// =============================================================================

import { and, desc, eq, sql, asc, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  forkAggregates,
  publications,
  publishTargetTypeEnum,
  reactionAggregates,
} from "@/db/schema";

export type LibrarySort = "LIKES" | "RECENT" | "FORKS" | "ALPHABETICAL";
export type LibraryTargetType =
  (typeof publishTargetTypeEnum.enumValues)[number];

export interface LibraryQuery {
  targetType?: LibraryTargetType;
  category?: string;
  authorUsername?: string;
  visibility?: "PUBLIC" | "FOLLOWERS_ONLY";
  minLikes?: number;
  hasForks?: boolean;
  sort?: LibrarySort;
  limit?: number;
  offset?: number;
  /** Internal user ID for visibility filtering (FOLLOWERS_ONLY). */
  viewerId?: string;
}

export interface LibraryItem {
  publicationId: string;
  versionId: string;
  versionNumber: number;
  targetType: LibraryTargetType;
  targetId: string;
  name: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  visibility: "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";
  publishedAt: Date;
  likesCount: number;
  dislikesCount: number;
  forkCount: number;
  netReactions: number;
  buCost?: number; // populated for primitives
}

export interface LibraryResult {
  items: LibraryItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Query the public library with sort + filter + pagination.
 */
export async function queryLibrary(q: LibraryQuery): Promise<LibraryResult> {
  const limit = Math.min(q.limit ?? 24, 100);
  const offset = q.offset ?? 0;
  const sort = q.sort ?? "LIKES";

  // Build WHERE clauses
  const conditions: SQL[] = [];

  // Only active (non-unpublished) publications
  conditions.push(sql`${publications.unpublishedAt} IS NULL`);

  // Visibility: PUBLIC always, FOLLOWERS_ONLY only if viewer follows author
  if (q.visibility === "FOLLOWERS_ONLY") {
    if (!q.viewerId) {
      // No viewer → no FOLLOWERS_ONLY content
      return { items: [], total: 0, limit, offset };
    }
    // Must be PUBLIC OR (FOLLOWERS_ONLY AND viewer follows author)
    conditions.push(
      sql`(
        ${publications.visibility} = 'PUBLIC'
        OR (
          ${publications.visibility} = 'FOLLOWERS_ONLY'
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follows.follower_id = ${q.viewerId}
              AND follows.following_id = ${publications.authorId}
          )
        )
      )`,
    );
  } else {
    // Default: PUBLIC only
    conditions.push(eq(publications.visibility, "PUBLIC"));
  }

  if (q.targetType) {
    conditions.push(eq(publications.targetType, q.targetType));
  }

  // Author username filter (requires join via users table)
  if (q.authorUsername) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM users
        WHERE users.id = ${publications.authorId}
          AND LOWER(users.username) = LOWER(${q.authorUsername})
      )`,
    );
  }

  // Min likes filter
  if (typeof q.minLikes === "number" && q.minLikes > 0) {
    conditions.push(
      sql`(
        SELECT COALESCE(reaction_aggregates.likes_count, 0)
        FROM reaction_aggregates
        WHERE reaction_aggregates.target_type = ${publications.targetType}
          AND reaction_aggregates.target_id = ${publications.targetId}
          AND reaction_aggregates.version_id = ${publications.versionId}
      ) >= ${q.minLikes}`,
    );
  }

  // Has-forks filter
  if (q.hasForks) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM fork_aggregates
        WHERE fork_aggregates.source_target_type = ${publications.targetType}
          AND fork_aggregates.source_target_id = ${publications.targetId}
          AND fork_aggregates.source_version_id = ${publications.versionId}
          AND fork_aggregates.fork_count > 0
      )`,
    );
  }

  // Category filter (primitives only — for now)
  if (q.category && q.targetType === "PRIMITIVE") {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM primitives
        WHERE primitives.id::text = ${publications.targetId}
          AND primitives.category = ${q.category}
      )`,
    );
  }

  const where = and(...conditions);

  // ORDER BY based on sort mode
  let orderBy: SQL;
  switch (sort) {
    case "RECENT":
      orderBy = desc(publications.publishedAt);
      break;
    case "FORKS":
      orderBy = sql`(
        SELECT COALESCE(fork_aggregates.fork_count, 0)
        FROM fork_aggregates
        WHERE fork_aggregates.source_target_type = ${publications.targetType}
          AND fork_aggregates.source_target_id = ${publications.targetId}
          AND fork_aggregates.source_version_id = ${publications.versionId}
      ) DESC NULLS LAST`;
      break;
    case "ALPHABETICAL":
      // Cross-table name resolution: use a subquery depending on targetType
      orderBy = sql`(CASE ${publications.targetType}
        WHEN 'CAPABILITY' THEN (
          SELECT LOWER(name) FROM capabilities WHERE capabilities.id::text = ${publications.targetId}::text
        )
        WHEN 'PRIMITIVE' THEN (
          SELECT LOWER(name) FROM primitives WHERE primitives.id::text = ${publications.targetId}::text
        )
        WHEN 'CHARACTER' THEN (
          SELECT LOWER(name) FROM characters WHERE characters.id::text = ${publications.targetId}::text
        )
        WHEN 'RACE_TEMPLATE' THEN (
          SELECT LOWER(name) FROM templates WHERE templates.id::text = ${publications.targetId}::text AND kind = 'RACE'
        )
        WHEN 'BACKGROUND_TEMPLATE' THEN (
          SELECT LOWER(name) FROM templates WHERE templates.id::text = ${publications.targetId}::text AND kind = 'BACKGROUND'
        )
        WHEN 'ARCHETYPE_TEMPLATE' THEN (
          SELECT LOWER(name) FROM templates WHERE templates.id::text = ${publications.targetId}::text AND kind = 'ARCHETYPE'
        )
        ELSE 'zzz'
      END) ASC NULLS LAST`;
      break;
    case "LIKES":
    default:
      orderBy = sql`(
        SELECT COALESCE(reaction_aggregates.likes_count, 0) - COALESCE(reaction_aggregates.dislikes_count, 0)
        FROM reaction_aggregates
        WHERE reaction_aggregates.target_type = ${publications.targetType}
          AND reaction_aggregates.target_id = ${publications.targetId}
          AND reaction_aggregates.version_id = ${publications.versionId}
      ) DESC NULLS LAST, ${publications.publishedAt} DESC`;
      break;
  }

  // Main query
  const rows = await db
    .select({
      publicationId: publications.id,
      versionId: publications.versionId,
      versionNumber: publications.versionNumber,
      targetType: publications.targetType,
      targetId: publications.targetId,
      visibility: publications.visibility,
      publishedAt: publications.publishedAt,
      authorId: publications.authorId,
    })
    .from(publications)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Enrich with author + reaction + fork aggregates
  if (rows.length === 0) {
    return { items: [], total: 0, limit, offset };
  }

  // Author info (batch)
  const authorIds = Array.from(
    new Set(rows.map((r) => r.authorId).filter(Boolean) as string[]),
  );
  const authorMap = new Map<
    string,
    { username: string; displayName: string | null; avatarUrl: string | null }
  >();
  if (authorIds.length > 0) {
    const authors = await db.query.users.findMany({
      where: (table, { inArray }) => inArray(table.id, authorIds),
      columns: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    for (const a of authors) {
      authorMap.set(a.id, {
        username: a.username,
        displayName: a.displayName,
        avatarUrl: a.avatarUrl,
      });
    }
  }

  // Reaction + fork aggregates (batch)
  const versionIds = rows.map((r) => r.versionId);
  const [reactionRows, forkRows] = await Promise.all([
    db
      .select()
      .from(reactionAggregates)
      .where(
        sql`${reactionAggregates.versionId} = ANY(${versionIds})`,
      ),
    db
      .select()
      .from(forkAggregates)
      .where(sql`${forkAggregates.sourceVersionId} = ANY(${versionIds})`),
  ]);

  const reactionMap = new Map<string, (typeof reactionRows)[number]>();
  for (const r of reactionRows) {
    reactionMap.set(r.versionId, r);
  }
  const forkMap = new Map<string, (typeof forkRows)[number]>();
  for (const f of forkRows) {
    forkMap.set(f.sourceVersionId, f);
  }

  // Target name (cross-table; do per-row lookup but cached by type+id)
  const items: LibraryItem[] = [];
  for (const row of rows) {
    const author = row.authorId ? authorMap.get(row.authorId) : null;
    const reactions = reactionMap.get(row.versionId);
    const forks = forkMap.get(row.versionId);
    const name = await resolveTargetName(row.targetType, row.targetId);
    items.push({
      publicationId: row.publicationId,
      versionId: row.versionId,
      versionNumber: row.versionNumber,
      targetType: row.targetType as LibraryTargetType,
      targetId: row.targetId,
      name,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      visibility: row.visibility as "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE",
      publishedAt: row.publishedAt,
      likesCount: reactions?.likesCount ?? 0,
      dislikesCount: reactions?.dislikesCount ?? 0,
      forkCount: forks?.forkCount ?? 0,
      netReactions:
        (reactions?.likesCount ?? 0) - (reactions?.dislikesCount ?? 0),
    });
  }

  // Total count (for pagination UI)
  const countRows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(publications)
    .where(where);
  const total = countRows[0]?.total ?? 0;

  return { items, total, limit, offset };
}

async function resolveTargetName(
  targetType: string,
  targetId: string,
): Promise<string> {
  switch (targetType) {
    case "CAPABILITY": {
      const row = await db.query.capabilities.findFirst({
        where: eq(capabilities.id, targetId),
        columns: { name: true },
      });
      return row?.name ?? "(deleted)";
    }
    case "PRIMITIVE": {
      const row = await db.query.primitives.findFirst({
        where: (table, { eq }) => eq(table.id, Number(targetId)),
        columns: { name: true },
      });
      return row?.name ?? "(deleted)";
    }
    case "CHARACTER": {
      const row = await db.query.characters.findFirst({
        where: (table, { eq }) => eq(table.id, targetId),
        columns: { name: true },
      });
      return row?.name ?? "(deleted)";
    }
    case "RACE_TEMPLATE":
    case "BACKGROUND_TEMPLATE":
    case "ARCHETYPE_TEMPLATE": {
      const row = await db.query.templates.findFirst({
        where: (table, { eq }) => eq(table.id, targetId),
        columns: { name: true },
      });
      return row?.name ?? "(deleted)";
    }
    default:
      return "(unknown)";
  }
}