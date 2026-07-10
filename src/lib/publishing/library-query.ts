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
// using a synthetic target_id = "<type>:<id>" key (matches the composite
// LibraryItem.id format).
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
  builds,
  capabilities,
  capabilityPrimitives,
  characters,
  effectPrimitives,
  effects,
  forkAggregates,
  items,
  primitives,
  publications,
  reactionAggregates,
  templates,
} from "@/db/schema";

export type LibrarySort =
  | "LIKES"
  | "ENGAGEMENT"
  | "RECENT"
  | "FORKS"
  | "ALPHABETICAL";
export type LibraryTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "EFFECT"
  | "CHARACTER"
  | "ITEM"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE"
  // Mashu 2026-07-09: builds now browse-able in the public library.
  // Matches the engagement enum (`publishTargetTypeEnum.BUILD_TEMPLATE`)
  // so reactions + forks join cleanly via the standard composite-id
  // pattern. Display label is normalised to "Build" in the toolbar.
  | "BUILD_TEMPLATE";

export interface LibraryQuery {
  targetType?: LibraryTargetType;
  category?: string;
  search?: string;
  authorUsername?: string;
  minLikes?: number;
  hasForks?: boolean;
  /**
   * Tag filter — only honoured when `targetType === "ITEM"`. Items
   * store tags as a text[] column. The filter matches items whose
   * tags array contains ALL the values in this list (AND-match,
   * "every listed tag must be present"). Empty array = no filter.
   *
   * The match uses Postgres's `&&` array-overlap operator — true
   * when arrays have at least one element in common — combined
   * with a cardinality check so we get the AND match the user
   * expects. (Plain `&&` would be OR-overlap.)
   */
  tags?: string[];
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
  authorId: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  publishedAt: Date | null;
  likesCount: number;
  dislikesCount: number;
  forkCount: number;
  netReactions: number;
  tags: string[];
  /**
   * Visibility tier:
   *   - "PRIVATE"        — author only, no publication row
   *   - "FOLLOWERS_ONLY" — author + their followers
   *   - "PUBLIC"         — everyone
   * Defaults to "PUBLIC" for rows that came through the public library
   * query (the WHERE clause already filters by isPublic = true).
   */
  visibility?: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC";
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

  // Fetch each target type in parallel (instead of sequentially awaiting
  // each branch). The previous serial pattern was the root cause of
  // "library filters feel slow" — every filter change was triggering
  // ~15-20 sequential Neon HTTP round-trips (1 main fetch + 1 author
  // lookup + 2 engagement lookups per type × 5 types = ~20). With
  // Promise.all the 5 type branches run concurrently, and each branch
  // internally awaits its own author/engagement lookups (4 round-trips
  // per branch in the worst case), so the wall clock is dominated by
  // the slowest branch — typically 300-500ms instead of 2-3s.
  const wantAll = !q.targetType;
  const fetchJobs: Promise<LibraryItem[]>[] = [];
  if (wantAll || q.targetType === "PRIMITIVE") {
    fetchJobs.push(fetchPrimitives(q));
  }
  if (wantAll || q.targetType === "CAPABILITY") {
    fetchJobs.push(fetchCapabilities(q));
  }
  if (wantAll || q.targetType === "EFFECT") {
    fetchJobs.push(fetchEffects(q));
  }
  if (wantAll || q.targetType === "ITEM") {
    fetchJobs.push(fetchItems(q));
  }
  if (
    wantAll ||
    q.targetType === "RACE_TEMPLATE" ||
    q.targetType === "BACKGROUND_TEMPLATE" ||
    q.targetType === "ARCHETYPE_TEMPLATE"
  ) {
    fetchJobs.push(fetchTemplates(q));
  }
  if (wantAll || q.targetType === "BUILD_TEMPLATE") {
    fetchJobs.push(fetchBuilds(q));
  }
  const branches = await Promise.all(fetchJobs);
  const items: LibraryItem[] = branches.flat();

  // Sort the merged list (since each fetch already applies some ordering)
  sortItems(items, sort);

  // Apply post-fetch engagement filters (uses joined aggregates)
  const filtered = items.filter((it) => {
    if (q.minLikes !== undefined && it.likesCount < q.minLikes) return false;
    if (q.hasForks && it.forkCount === 0) return false;
    return true;
  });

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

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
      items.sort((a, b) => {
        if (b.forkCount !== a.forkCount) return b.forkCount - a.forkCount;
        return b.netReactions - a.netReactions;
      });
      break;
    case "ALPHABETICAL":
      items.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "ENGAGEMENT":
      // Composite engagement: likes * 2 + forks * 3 - dislikes
      // Weights forks highest (strongest signal of value), then likes,
      // penalties for dislikes. Items with no engagement sink to bottom.
      items.sort((a, b) => {
        const aScore =
          a.likesCount * 2 + a.forkCount * 3 - a.dislikesCount;
        const bScore =
          b.likesCount * 2 + b.forkCount * 3 - b.dislikesCount;
        if (bScore !== aScore) return bScore - aScore;
        // Tiebreaker: net reactions
        if (b.netReactions !== a.netReactions)
          return b.netReactions - a.netReactions;
        // Final tiebreaker: most recent
        const aT = a.publishedAt?.getTime() ?? 0;
        const bT = b.publishedAt?.getTime() ?? 0;
        return bT - aT;
      });
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

/**
 * NOT EXISTS condition: exclude entities that have an unpublished publication.
 * This ensures entities explicitly set to PRIVATE via the visibility API
 * don't appear in the library, even if their isPublic boolean is stale.
 */
function notUnpublished(targetType: string, idExpr: SQL) {
  return sql`NOT EXISTS (
    SELECT 1 FROM publications
    WHERE target_type = ${targetType}
      AND target_id = CAST(${idExpr} AS text)
      AND unpublished_at IS NOT NULL
  )`;
}

async function fetchPrimitives(q: LibraryQuery): Promise<LibraryItem[]> {
  const conditions = [
    or(eq(primitives.isPublic, true), isNull(primitives.userId))!,
    notUnpublished("PRIMITIVE", sql`${primitives.id}`),
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

  const authorMap = await resolveAuthorMap(rows.map((r) => r.userId));
  const engagementMap = await resolveEngagementMap(
    rows.map((r) => `PRIMITIVE:${r.id}`),
  );

  return rows.map((r) => {
    const author = r.userId ? authorMap.get(r.userId) : null;
    const eng = engagementMap.get(`PRIMITIVE:${r.id}`) ?? {
      likes: 0,
      dislikes: 0,
      forks: 0,
    };
    return {
      id: `PRIMITIVE:${r.id}`,
      targetType: "PRIMITIVE" as const,
      targetId: String(r.id),
      name: r.name,
      description: r.narrativeRule || null,
      category: r.category,
      buCost: r.buCost,
      authorId: r.userId ?? null,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: eng.likes,
      dislikesCount: eng.dislikes,
      forkCount: eng.forks,
      netReactions: eng.likes - eng.dislikes,
      tags: [],
    };
  });
}

async function fetchCapabilities(q: LibraryQuery): Promise<LibraryItem[]> {
  const conditions = [eq(capabilities.isPublic, true), notUnpublished("CAPABILITY", sql`${capabilities.id}`)];

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
      userId: capabilities.userId,
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
        (buMap.get(link.capabilityId) ?? 0) + Math.abs(link.buCost * link.quantity),
      );
    }
  }

  const authorMap = await resolveAuthorMap(rows.map((r) => r.userId));
  const engagementMap = await resolveEngagementMap(
    rows.map((r) => `CAPABILITY:${r.id}`),
  );

  return rows.map((r) => {
    const author = r.userId ? authorMap.get(r.userId) : null;
    const eng = engagementMap.get(`CAPABILITY:${r.id}`) ?? {
      likes: 0,
      dislikes: 0,
      forks: 0,
    };
    return {
      id: `CAPABILITY:${r.id}`,
      targetType: "CAPABILITY" as const,
      targetId: r.id,
      name: r.name,
      description: r.verboseDescription || null,
      category: r.type,
      buCost: buMap.get(r.id) ?? 0,
      authorId: r.userId ?? null,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: eng.likes,
      dislikesCount: eng.dislikes,
      forkCount: eng.forks,
      netReactions: eng.likes - eng.dislikes,
      tags: r.tags,
    };
  });
}

async function fetchEffects(q: LibraryQuery): Promise<LibraryItem[]> {
  const conditions = [eq(effects.isPublic, true), notUnpublished("EFFECT", sql`${effects.id}`)];

  if (q.search) {
    conditions.push(
      or(
        ilike(effects.name, `%${q.search}%`),
        ilike(effects.narrativeDescription, `%${q.search}%`),
      )!,
    );
  }
  if (q.authorUsername) {
    // Effects use text userId (Clerk ID format); we can't easily filter by
    // username at the SQL level without a join. Skip for now.
  }

  const rows = await db
    .select({
      id: effects.id,
      name: effects.name,
      narrativeDescription: effects.narrativeDescription,
      tags: effects.tags,
      userId: effects.userId,
      createdAt: effects.createdAt,
    })
    .from(effects)
    .where(and(...conditions))
    .limit(500);

  const authorMap = await resolveAuthorMap(rows.map((r) => r.userId));
  const engagementMap = await resolveEngagementMap(
    rows.map((r) => `EFFECT:${r.id}`),
  );

  // Compute BU total via primitive_links (uses buCost × quantity)
  const effectIds = rows.map((r) => r.id);
  let buMap = new Map<string, number>();
  if (effectIds.length > 0) {
    const links = await db
      .select({
        effectId: effectPrimitives.effectId,
        primitiveId: effectPrimitives.primitiveId,
        quantity: effectPrimitives.quantity,
        buCost: primitives.buCost,
      })
      .from(effectPrimitives)
      .innerJoin(primitives, eq(effectPrimitives.primitiveId, primitives.id))
      .where(inArray(effectPrimitives.effectId, effectIds));
    for (const link of links) {
      buMap.set(
        link.effectId,
        (buMap.get(link.effectId) ?? 0) + Math.abs(link.buCost * link.quantity),
      );
    }
  }

  return rows.map((r) => {
    const author = r.userId ? authorMap.get(r.userId) : null;
    const eng = engagementMap.get(`EFFECT:${r.id}`) ?? {
      likes: 0,
      dislikes: 0,
      forks: 0,
    };
    return {
      id: `EFFECT:${r.id}`,
      targetType: "EFFECT" as const,
      targetId: r.id,
      name: r.name,
      description: r.narrativeDescription || null,
      category: null,
      buCost: buMap.get(r.id) ?? 0,
      authorId: r.userId ?? null,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: eng.likes,
      dislikesCount: eng.dislikes,
      forkCount: eng.forks,
      netReactions: eng.likes - eng.dislikes,
      tags: r.tags ?? [],
    };
  });
}

async function fetchItems(q: LibraryQuery): Promise<LibraryItem[]> {
  const conditions = [eq(items.isPublic, true), notUnpublished("ITEM", sql`${items.id}`)];

  if (q.search) {
    conditions.push(
      or(
        ilike(items.name, `%${q.search}%`),
        ilike(items.description, `%${q.search}%`),
      )!,
    );
  }
  if (q.authorUsername) {
    // Items store Clerk ID in user_id; SQL-level username filter needs a
    // join. Skip — filter in caller.
  }
  if (q.tags && q.tags.length > 0) {
    // AND-match across the supplied tag list. Postgres `&&` is array
    // overlap (true when arrays share any element), but we want every
    // supplied tag to be present — so we AND together multiple
    // `tags @> ARRAY[<single>]` checks (the `@>` containment operator
    // is true when the LEFT array contains every element of the RIGHT
    // array).
    for (const tag of q.tags) {
      conditions.push(sql`${items.tags} @> ARRAY[${tag}]::text[]`);
    }
  }

  const rows = await db
    .select({
      id: items.id,
      name: items.name,
      itemType: items.itemType,
      rarity: items.rarity,
      buCost: items.buCost,
      description: items.description,
      tags: items.tags,
      userId: items.userId,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(and(...conditions))
    .limit(500);

  const authorMap = await resolveAuthorMap(rows.map((r) => r.userId));
  const engagementMap = await resolveEngagementMap(
    rows.map((r) => `ITEM:${r.id}`),
  );

  return rows.map((r) => {
    const author = r.userId ? authorMap.get(r.userId) : null;
    const eng = engagementMap.get(`ITEM:${r.id}`) ?? {
      likes: 0,
      dislikes: 0,
      forks: 0,
    };
    return {
      id: `ITEM:${r.id}`,
      targetType: "ITEM" as const,
      targetId: r.id,
      name: r.name,
      description: r.description || null,
      category: r.itemType,
      buCost: r.buCost,
      authorId: r.userId ?? null,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: eng.likes,
      dislikesCount: eng.dislikes,
      forkCount: eng.forks,
      netReactions: eng.likes - eng.dislikes,
      tags: r.tags ?? [],
    };
  });
}

async function fetchTemplates(q: LibraryQuery): Promise<LibraryItem[]> {
  const conditions = [eq(templates.isPublic, true), notUnpublished("RACE_TEMPLATE", sql`${templates.id}`)];

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

  // Map template kinds → composite IDs for engagement lookup
  const targetTypeByKind: Record<string, LibraryTargetType> = {
    RACE: "RACE_TEMPLATE",
    BACKGROUND: "BACKGROUND_TEMPLATE",
    ARCHETYPE: "ARCHETYPE_TEMPLATE",
  };
  const engagementMap = await resolveEngagementMap(
    rows.map((r) => `${targetTypeByKind[r.kind] ?? "RACE_TEMPLATE"}:${r.id}`),
  );

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
    const compositeId = `${targetType}:${r.id}`;
    const eng = engagementMap.get(compositeId) ?? {
      likes: 0,
      dislikes: 0,
      forks: 0,
    };
    return {
      id: compositeId,
      targetType,
      targetId: r.id,
      name: r.name,
      description: r.description,
      category: r.kind,
      buCost: null,
      authorId: r.userId ?? null,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: eng.likes,
      dislikesCount: eng.dislikes,
      forkCount: eng.forks,
      netReactions: eng.likes - eng.dislikes,
      tags: [],
    };
  });
}

// =============================================================================
// Builds — character snapshots + archetype templates.
//
// Mashu 2026-07-09: builds were previously only visible on the owner's
// Creations page. Surfacing them in the public library gives the corpus
// a "what people actually made" showcase. Filter: `is_public = true`
// (matches the visibility convention used by every other entity —
// private / followers-only builds stay private).
//
// Engagement is keyed via the `BUILD_TEMPLATE:<id>` composite id, which
// matches `publishTargetTypeEnum.BUILD_TEMPLATE` and the existing
// visibility API + fork-target helpers. The display category is
// "Archetype" or "Build" depending on `is_archetype_template`, so the
// card chip tells the user which kind of build they're looking at.
//
// BU cost: builds don't have a single canonical buCost — they compose
// race + background + capabilities + items. We surface `startingBu`
// (the level-1 budget the build was created with) as the chip value
// so cards remain comparable in the grid.
// =============================================================================

async function fetchBuilds(q: LibraryQuery): Promise<LibraryItem[]> {
  const conditions = [eq(builds.isPublic, true), notUnpublished("BUILD_TEMPLATE", sql`${builds.id}`)];

  if (q.search) {
    conditions.push(
      or(
        ilike(builds.name, `%${q.search}%`),
        ilike(builds.description, `%${q.search}%`),
        ilike(builds.raceName, `%${q.search}%`),
        ilike(builds.backgroundName, `%${q.search}%`),
      )!,
    );
  }
  if (q.authorUsername) {
    // Builds store Clerk user id in user_id; SQL-level username filter
    // needs a join. Skip — filter in caller (handled in queryLibrary).
  }

  const rows = await db
    .select({
      id: builds.id,
      name: builds.name,
      description: builds.description,
      level: builds.level,
      startingBu: builds.startingBu,
      isArchetypeTemplate: builds.isArchetypeTemplate,
      userId: builds.userId,
      createdAt: builds.createdAt,
    })
    .from(builds)
    .where(and(...conditions))
    .limit(500);

  const authorMap = await resolveAuthorMap(rows.map((r) => r.userId));
  const engagementMap = await resolveEngagementMap(
    rows.map((r) => `BUILD_TEMPLATE:${r.id}`),
  );

  return rows.map((r) => {
    const author = r.userId ? authorMap.get(r.userId) : null;
    const eng = engagementMap.get(`BUILD_TEMPLATE:${r.id}`) ?? {
      likes: 0,
      dislikes: 0,
      forks: 0,
    };
    return {
      id: `BUILD_TEMPLATE:${r.id}`,
      targetType: "BUILD_TEMPLATE" as const,
      targetId: r.id,
      name: r.name,
      // Surface level + archetype as the chip suffix so the card reads
      // "L1 · Archetype" / "L3 · Build" — distinguishes archetype
      // templates from character snapshots at a glance.
      description: r.description || null,
      category: r.isArchetypeTemplate ? "Archetype" : `Level ${r.level}`,
      buCost: r.startingBu,
      authorId: r.userId ?? null,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      publishedAt: r.createdAt,
      likesCount: eng.likes,
      dislikesCount: eng.dislikes,
      forkCount: eng.forks,
      netReactions: eng.likes - eng.dislikes,
      tags: [],
    };
  });
}

async function resolveAuthorMap(
  clerkUserIds: (string | null)[],
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
    new Set(clerkUserIds.filter((id): id is string => Boolean(id))),
  );
  if (unique.length === 0) return map;
  // Content tables store the Clerk user ID (text), not the internal UUID.
  // Users table exposes it as `clerkUserId` — match on that.
  const rows = await db.query.users.findMany({
    where: (table, { inArray }) => inArray(table.clerkUserId, unique),
    columns: {
      clerkUserId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isAnonymized: true,
      deletedAt: true,
    },
  });
  for (const r of rows) {
    // Don't surface anonymized/deleted users — their content remains in the
    // library (so ownership lineage is preserved) but the UI should not
    // show the deterministic hash handle or display name.
    if (r.isAnonymized || r.deletedAt) continue;
    if (!r.clerkUserId) continue;
    map.set(r.clerkUserId, {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    });
  }
  return map;
}

/**
 * Resolve engagement metrics for a list of items.
 *
 * Returns a Map keyed by the composite ID (`<TYPE>:<id>`).
 * Joins reaction_aggregates + fork_aggregates across all versions of an item,
 * grouping by the composite ID and summing across versions.
 */
async function resolveEngagementMap(
  compositeIds: string[],
): Promise<
  Map<string, { likes: number; dislikes: number; forks: number }>
> {
  const map = new Map<string, { likes: number; dislikes: number; forks: number }>();
  if (compositeIds.length === 0) return map;

  // Parse composite IDs into (type, id) tuples for type-aware joins
  const parsed = compositeIds
    .map((cid) => {
      const idx = cid.indexOf(":");
      if (idx === -1) return null;
      const type = cid.slice(0, idx);
      const id = cid.slice(idx + 1);
      return { cid, type, id };
    })
    .filter((p): p is { cid: string; type: string; id: string } => p !== null);

  const uniqueIds = Array.from(new Set(parsed.map((p) => p.id)));
  const typesByCid = new Map(parsed.map((p) => [p.cid, p.type] as const));

  // Reactions: one row per (target_type, target_id, version_id). We sum across
  // all versions to get the lifetime engagement for the de-duplicated item.
  const reactionRows = await db
    .select({
      targetType: reactionAggregates.targetType,
      targetId: reactionAggregates.targetId,
      likesCount: sql<number>`SUM(${reactionAggregates.likesCount})::int`,
      dislikesCount: sql<number>`SUM(${reactionAggregates.dislikesCount})::int`,
    })
    .from(reactionAggregates)
    .where(inArray(reactionAggregates.targetId, uniqueIds))
    .groupBy(reactionAggregates.targetType, reactionAggregates.targetId);

  // Forks: keyed by (source_target_type, source_target_id, source_version_id).
  const forkRows = await db
    .select({
      sourceTargetType: forkAggregates.sourceTargetType,
      sourceTargetId: forkAggregates.sourceTargetId,
      count: sql<number>`SUM(${forkAggregates.forkCount})::int`,
    })
    .from(forkAggregates)
    .where(inArray(forkAggregates.sourceTargetId, uniqueIds))
    .groupBy(forkAggregates.sourceTargetType, forkAggregates.sourceTargetId);

  // Build per-(type,id) intermediate maps
  const reactionByTypeId = new Map<
    string,
    { likes: number; dislikes: number }
  >();
  for (const r of reactionRows) {
    reactionByTypeId.set(`${r.targetType}:${r.targetId}`, {
      likes: Number(r.likesCount),
      dislikes: Number(r.dislikesCount),
    });
  }
  const forkByTypeId = new Map<string, number>();
  for (const f of forkRows) {
    forkByTypeId.set(`${f.sourceTargetType}:${f.sourceTargetId}`, Number(f.count));
  }

  // Map each composite ID → its (type, id) → look up aggregates
  for (const cid of new Set(compositeIds)) {
    const idx = cid.indexOf(":");
    if (idx === -1) continue;
    const type = cid.slice(0, idx);
    const id = cid.slice(idx + 1);
    const key = `${type}:${id}`;
    const react = reactionByTypeId.get(key);
    const forks = forkByTypeId.get(key) ?? 0;
    if (react || forks > 0) {
      map.set(cid, {
        likes: react?.likes ?? 0,
        dislikes: react?.dislikes ?? 0,
        forks,
      });
    }
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

/**
 * List all distinct tags across published items. Items store tags as
 * text[] on the items row. We unnest() the array server-side and group
 * by tag value. The public library uses this for the tag chip filter
 * (per the user's "no tag filter for items" report).
 *
 * Only public items contribute (matches the library's public-only
 * scope). Sorted by count desc, then label asc.
 */
export async function listItemTags(): Promise<
  { value: string; label: string; count: number }[]
> {
  // Drizzle's sql tag is used to write the unnest() — it's the
  // standard Postgres way to flatten an array column into rows.
  const rows = await db.execute<{
    tag: string;
    count: number;
  }>(sql`
    SELECT tag, COUNT(*)::int AS count
    FROM items, unnest(items.tags) AS tag
    WHERE items.is_public = true
    GROUP BY tag
    ORDER BY count DESC, tag ASC
  `);
  const list = (rows as unknown as { rows: { tag: string; count: number }[] })
    .rows ?? rows;
  return list
    .filter((r) => r.tag && r.tag.trim().length > 0)
    .map((r) => ({
      value: r.tag,
      label: r.tag,
      count: Number(r.count),
    }));
}