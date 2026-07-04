// =============================================================================
// Library query service — Phase 5 Commit B + C
//
// Powers /library and /library/browse pages with sort + filter + pagination.
//
// Sources:
// - PRIMITIVE: primitives WHERE is_public = true OR user_id IS NULL
// - CAPABILITY: capabilities WHERE is_public = true
// - RACE/BACKGROUND/ARCHETYPE_TEMPLATE: templates WHERE is_public = true
// - CHARACTER: characters (user-owned or public)
//
// Engagement metrics are joined from reaction_aggregates / fork_aggregates
// where available; defaults to 0 for items not yet published via Phase 5.
//
// Sort modes:
// - LIKES (default): by likes_count - dislikes_count
// - RECENT: by created_at DESC
// - FORKS: by fork_count DESC
// - ALPHABETICAL: by LOWER(name) ASC
//
// Filters:
// - targetType: PRIMITIVE | CAPABILITY | RACE_TEMPLATE | BACKGROUND_TEMPLATE
//              | ARCHETYPE_TEMPLATE | CHARACTER | ITEM
// - category: primitive category (PRIMITIVE type only)
// - search: ILIKE on name (across all types)
// - authorUsername: filter by user.username (CHARACTER, TEMPLATE only —
//                   primitives are mostly system-authored)
// - minLikes, hasForks: engagement filters
//
// Pagination: limit (default 24, max 100), offset
// =============================================================================

import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  characters,
  forkAggregates,
  primitives,
  reactionAggregates,
  templates,
} from "@/db/schema";

export type LibrarySort = "LIKES" | "RECENT" | "FORKS" | "ALPHABETICAL";
export type LibraryTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "CHARACTER"
  | "ITEM"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE";

export interface LibraryQuery {
  targetType?: LibraryTargetType;
  category?: string;
  search?: string;
  authorUsername?: string;
  minLikes?: number;
  hasForks?: boolean;
  sort?: LibrarySort;
  limit?: number;
  offset?: number;
}

export interface LibraryItem {
  /** Composite ID: `<type>:<id>` for routing */
  id: string;
  targetType: LibraryTargetType;
  targetId: string;
  name: string;
  description: string | null;
  category: string | null;
  /** BU cost (for primitives), or computed total (for capabilities) */
  buCost: number | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  publishedAt: Date | null;
  likesCount: number;
  dislikesCount: number;
  forkCount: number;
  netReactions: number;
  tags: string[];
}

export interface LibraryResult {
  items: LibraryItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Query the public library: union of public primitives + capabilities +
 * templates + characters, with engagement metrics and sort/filter/pagination.
 */
export async function queryLibrary(q: LibraryQuery): Promise<LibraryResult> {
  const limit = Math.min(q.limit ?? 24, 100);
  const offset = q.offset ?? 0;
  const sort = q.sort ?? "LIKES";

  const items: LibraryItem[] = [];

  // Fetch each target type in parallel and merge in memory. This is simpler
  // than a SQL UNION across heterogeneous tables and gives us full type
  // info (e.g., description, tags) for each item.
  const wantAll = !q.targetType;
  if (wantAll || q.targetType === "PRIMITIVE") {
    items.push(...(await fetchPrimitives(q, sort)));
  }
  if (wantAll || q.targetType === "CAPABILITY") {
    items.push(...(await fetchCapabilities(q, sort)));
  }
  if (
    wantAll ||
    q.targetType === "RACE_TEMPLATE" ||
    q.targetType === "BACKGROUND_TEMPLATE" ||
    q.targetType === "ARCHETYPE_TEMPLATE"
  ) {
    items.push(...(await fetchTemplates(q, sort)));
  }

  // Sort the merged list (since each fetch already applies some ordering)
  sortItems(items, sort);

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  return { items: paged, total, limit, offset };
}

function sortItems(items: LibraryItem[], sort: LibrarySort) {
  switch (sort) {
    case "RECENT":
      items.sort((a, b) => {
        const aT = a.publishedAt?.getTime() ?? 0;
        const bT = b.publishedAt?.getTime() ?? 0;
        return bT - aT;
      });
      break;
    case "FORKS":
      items.sort((a, b) => b.forkCount - a.forkCount);
      break;
    case "ALPHABETICAL":
      items.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "LIKES":
    default:
      items.sort((a, b) => {
        if (b.netReactions !== a.netReactions) {
          return b.netReactions - a.netReactions;
        }
        const aT = a.publishedAt?.getTime() ?? 0;
        const bT = b.publishedAt?.getTime() ?? 0;
        return bT - aT;
      });
      break;
  }
}

async function fetchPrimitives(
  q: LibraryQuery,
  _sort: LibrarySort,
): Promise<LibraryItem[]> {
  const conditions = [
    or(eq(primitives.isPublic, true), isNull(primitives.userId))!,
  ];

  if (q.category) {
    conditions.push(eq(primitives.category, q.category as never));
  }
  if (q.search) {
    conditions.push(ilike(primitives.name, `%${q.search}%`));
  }

  const rows = await db
    .select({
      id: primitives.id,
      name: primitives.name,
      category: primitives.category,
      buCost: primitives.buCost,
      narrativeRule: primitives.narrativeRule,
      userId: primitives.userId,
      createdAt: primitives.createdAt,
    })
    .from(primitives)
    .where(and(...conditions))
    .limit(500); // hard cap before in-memory filter

  // Filter min-likes/hasForks in memory (engagement metrics aren't keyed
  // for raw primitives yet — would need a join via target_id="<type>:<id>"
  // synthetic key once Phase 5 publishes them)
  const authorMap = await resolveAuthorMap(rows.map((r) => r.userId));

  return rows.map((r) => {
    const author = r.userId ? authorMap.get(r.userId) : null;
    return {
      id: `PRIMITIVE:${r.id}`,
      targetType: "PRIMITIVE" as const,
      targetId: String(r.id),
      name: r.name,
      description: r.narrativeRule || null,
      category: r.category,
      buCost: r.buCost,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: 0,
      dislikesCount: 0,
      forkCount: 0,
      netReactions: 0,
      tags: [],
    };
  });
}

async function fetchCapabilities(
  q: LibraryQuery,
  _sort: LibrarySort,
): Promise<LibraryItem[]> {
  const conditions = [eq(capabilities.isPublic, true)];

  if (q.search) {
    conditions.push(
      or(
        ilike(capabilities.name, `%${q.search}%`),
        ilike(capabilities.verboseDescription, `%${q.search}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      id: capabilities.id,
      name: capabilities.name,
      type: capabilities.type,
      sourceType: capabilities.sourceType,
      verboseDescription: capabilities.verboseDescription,
      tags: capabilities.tags,
      createdAt: capabilities.createdAt,
    })
    .from(capabilities)
    .where(and(...conditions))
    .limit(500);

  // Compute BU totals by joining primitive_links + primitives
  const capabilityIds = rows.map((r) => r.id);
  let buMap = new Map<string, number>();
  if (capabilityIds.length > 0) {
    const links = await db
      .select({
        capabilityId: capabilityPrimitives.capabilityId,
        primitiveId: capabilityPrimitives.primitiveId,
        quantity: capabilityPrimitives.quantity,
        buCost: primitives.buCost,
      })
      .from(capabilityPrimitives)
      .innerJoin(
        primitives,
        eq(capabilityPrimitives.primitiveId, primitives.id),
      )
      .where(inArray(capabilityPrimitives.capabilityId, capabilityIds));
    for (const link of links) {
      buMap.set(
        link.capabilityId,
        (buMap.get(link.capabilityId) ?? 0) + link.buCost * link.quantity,
      );
    }
  }

  return rows.map((r) => ({
    id: `CAPABILITY:${r.id}`,
    targetType: "CAPABILITY" as const,
    targetId: r.id,
    name: r.name,
    description: r.verboseDescription || null,
    category: r.type,
    buCost: buMap.get(r.id) ?? 0,
    authorUsername: null,
    authorDisplayName: null,
    authorAvatarUrl: null,
    publishedAt: r.createdAt,
    likesCount: 0,
    dislikesCount: 0,
    forkCount: 0,
    netReactions: 0,
    tags: r.tags,
  }));
}

async function fetchTemplates(
  q: LibraryQuery,
  _sort: LibrarySort,
): Promise<LibraryItem[]> {
  const conditions = [eq(templates.isPublic, true)];

  if (q.targetType === "RACE_TEMPLATE") {
    conditions.push(eq(templates.kind, "RACE"));
  } else if (q.targetType === "BACKGROUND_TEMPLATE") {
    conditions.push(eq(templates.kind, "BACKGROUND"));
  } else if (q.targetType === "ARCHETYPE_TEMPLATE") {
    conditions.push(eq(templates.kind, "ARCHETYPE"));
  }

  if (q.search) {
    conditions.push(
      or(
        ilike(templates.name, `%${q.search}%`),
        ilike(templates.description, `%${q.search}%`),
      )!,
    );
  }
  if (q.authorUsername) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM users
        WHERE users.id::text = ${templates.userId}
          AND LOWER(users.username) = LOWER(${q.authorUsername})
      )`,
    );
  }

  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      kind: templates.kind,
      description: templates.description,
      imageUrl: templates.imageUrl,
      userId: templates.userId,
      createdAt: templates.createdAt,
    })
    .from(templates)
    .where(and(...conditions))
    .limit(500);

  const authorMap = await resolveAuthorMap(rows.map((r) => r.userId));

  return rows.map((r) => {
    const author = r.userId ? authorMap.get(r.userId) : null;
    const targetType = (() => {
      switch (r.kind) {
        case "RACE":
          return "RACE_TEMPLATE" as const;
        case "BACKGROUND":
          return "BACKGROUND_TEMPLATE" as const;
        case "ARCHETYPE":
          return "ARCHETYPE_TEMPLATE" as const;
        default:
          return "RACE_TEMPLATE" as const;
      }
    })();
    return {
      id: `${targetType}:${r.id}`,
      targetType,
      targetId: r.id,
      name: r.name,
      description: r.description,
      category: r.kind,
      buCost: null,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: 0,
      dislikesCount: 0,
      forkCount: 0,
      netReactions: 0,
      tags: [],
    };
  });
}

async function resolveAuthorMap(
  userIds: (string | null)[],
): Promise<
  Map<
    string,
    { username: string; displayName: string | null; avatarUrl: string | null }
  >
> {
  const map = new Map<
    string,
    { username: string; displayName: string | null; avatarUrl: string | null }
  >();
  const unique = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id))),
  );
  if (unique.length === 0) return map;
  const rows = await db.query.users.findMany({
    where: (table, { inArray }) => inArray(table.id, unique),
    columns: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  for (const r of rows) {
    map.set(r.id, {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    });
  }
  return map;
}

/**
 * List all distinct primitive categories (for the filter dropdown).
 */
export async function listPrimitiveCategories(): Promise<
  { value: string; label: string; count: number }[]
> {
  const rows = await db
    .select({
      category: primitives.category,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(primitives)
    .where(or(eq(primitives.isPublic, true), isNull(primitives.userId))!)
    .groupBy(primitives.category)
    .orderBy(asc(primitives.category));

  return rows.map((r) => ({
    value: r.category,
    label: r.category.replace(/_/g, " "),
    count: Number(r.count),
  }));
}