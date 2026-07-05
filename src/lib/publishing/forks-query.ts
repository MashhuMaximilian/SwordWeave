// =============================================================================
// Forks query service — Phase 6.5 cherry-on-top
//
// Read APIs for fork lineage:
// - listBySource: "who has forked THIS target?" — used on library item detail
// - listByForker: "what has THIS user forked?" — used on profile pages
//
// Both return the same shape: ForkEntry[] — enough for a <ForksList> render.
// Author resolution goes through resolveAuthorMap from library-query so we
// share the same Clerk-ID-→-username logic (and the anonymization rules).
//
// Counter `fork_count` lives in fork_aggregates keyed by (source_*) so the
// aggregate is computed once at write time; we don't recompute via COUNT()
// here (would O(n) per row at scale).
// =============================================================================

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { forkAggregates, forks, users } from "@/db/schema";

export type ForkTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "EFFECT"
  | "ITEM"
  | "CHARACTER"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE"
  | "BUILD_TEMPLATE";

export interface ForkEntry {
  /** Fork row id (uuid) */
  id: string;
  /** Who forked it (the forker) */
  forkerUserId: string; // internal UUID (users.id)
  forkerUsername: string | null;
  forkerDisplayName: string | null;
  forkerAvatarUrl: string | null;
  /** The fork itself */
  forkedTargetType: ForkTargetType;
  forkedTargetId: string;
  forkedTargetName: string | null;
  /** Source the fork was taken from */
  sourceTargetType: ForkTargetType;
  sourceTargetId: string;
  sourceTargetName: string | null;
  sourceVersionId: string;
  sourceAuthorUsername: string | null;
  sourceAuthorDisplayName: string | null;
  /** Timestamps */
  forkedAt: Date;
}

export interface ForkQueryResult {
  forks: ForkEntry[];
  /** Total fork count for this source (from fork_aggregates, may differ
   *  from `forks.length` if a user forked multiple versions) */
  totalForks: number;
}

/**
 * List all forks taken FROM a specific source target.
 *
 * Used by the library item detail page to show "forked N times by [list]".
 *
 * @param targetType — source target type
 * @param targetId   — source target id (text)
 * @param limit      — page size (default 10, max 50)
 */
export async function listBySource(
  targetType: ForkTargetType,
  targetId: string,
  limit = 10,
): Promise<ForkQueryResult> {
  const cappedLimit = Math.min(Math.max(limit, 1), 50);

  const rows = await db
    .select({
      id: forks.id,
      forkedByUserId: forks.forkedByUserId,
      forkedTargetType: forks.forkedTargetType,
      forkedTargetId: forks.forkedTargetId,
      sourceTargetType: forks.sourceTargetType,
      sourceTargetId: forks.sourceTargetId,
      sourceVersionId: forks.sourceVersionId,
      createdAt: forks.createdAt,
      // Join forker public profile fields
      forkerClerkId: users.clerkUserId,
      forkerUsername: users.username,
      forkerDisplayName: users.displayName,
      forkerAvatarUrl: users.avatarUrl,
      forkerIsAnonymized: users.isAnonymized,
      forkerDeletedAt: users.deletedAt,
    })
    .from(forks)
    .innerJoin(users, eq(users.id, forks.forkedByUserId))
    .where(
      and(
        eq(forks.sourceTargetType, targetType),
        eq(forks.sourceTargetId, targetId),
      ),
    )
    .orderBy(desc(forks.createdAt))
    .limit(cappedLimit);

  const totalForks = await getAggregateCount(targetType, targetId);

  const entries = await enrichEntries(rows, {
    forkerClerkId: rows.map((r) => r.forkerClerkId),
  });

  return { forks: entries, totalForks };
}

/**
 * List all forks created BY a specific user (the "forker").
 *
 * Used by profile pages: "X has forked Y builds from Z authors".
 *
 * @param clerkUserId — the forker's Clerk ID (text), not internal UUID
 * @param limit      — page size (default 20, max 100)
 */
export async function listByForker(
  clerkUserId: string,
  limit = 20,
): Promise<ForkEntry[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 100);

  // Resolve internal user.id from Clerk ID; null if user unknown
  const userRow = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
    columns: { id: true },
  });
  if (!userRow) return [];

  const rows = await db
    .select({
      id: forks.id,
      forkedByUserId: forks.forkedByUserId,
      forkedTargetType: forks.forkedTargetType,
      forkedTargetId: forks.forkedTargetId,
      sourceTargetType: forks.sourceTargetType,
      sourceTargetId: forks.sourceTargetId,
      sourceVersionId: forks.sourceVersionId,
      createdAt: forks.createdAt,
      forkerClerkId: users.clerkUserId,
      forkerUsername: users.username,
      forkerDisplayName: users.displayName,
      forkerAvatarUrl: users.avatarUrl,
      forkerIsAnonymized: users.isAnonymized,
      forkerDeletedAt: users.deletedAt,
    })
    .from(forks)
    .innerJoin(users, eq(users.id, forks.forkedByUserId))
    .where(eq(forks.forkedByUserId, userRow.id))
    .orderBy(desc(forks.createdAt))
    .limit(cappedLimit);

  return enrichEntries(rows, {
    forkerClerkId: rows.map((r) => r.forkerClerkId),
  });
}

/**
 * Sum fork_count across all versions of a source target.
 * fork_aggregates is keyed (type, id, version) so we SUM the per-version counts.
 */
async function getAggregateCount(
  targetType: ForkTargetType,
  targetId: string,
): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${forkAggregates.forkCount}), 0)::int`,
    })
    .from(forkAggregates)
    .where(
      and(
        eq(forkAggregates.sourceTargetType, targetType),
        eq(forkAggregates.sourceTargetId, targetId),
      ),
    );
  return rows[0]?.total ?? 0;
}

// =============================================================================
// Internal helpers
// =============================================================================

type RawForkRow = {
  id: string;
  forkedByUserId: string;
  forkedTargetType: ForkTargetType;
  forkedTargetId: string;
  sourceTargetType: ForkTargetType;
  sourceTargetId: string;
  sourceVersionId: string;
  createdAt: Date;
  forkerClerkId: string | null;
  forkerUsername: string | null;
  forkerDisplayName: string | null;
  forkerAvatarUrl: string | null;
  forkerIsAnonymized: boolean | null;
  forkerDeletedAt: Date | null;
};

/**
 * Hydrate raw fork rows with:
 * - Forked target name (from target table — looks up by id)
 * - Source target name (same)
 * - Source author username (via resolveAuthorMap; uses source content's userId text)
 *
 * For simplicity we resolve target names in a single per-type query batch.
 * Names are best-effort — if the row has been hard-deleted, name stays null.
 */
async function enrichEntries(
  rows: RawForkRow[],
  _hints: { forkerClerkId: (string | null)[] },
): Promise<ForkEntry[]> {
  if (rows.length === 0) return [];

  // Collect all source/forked target IDs grouped by type so we can batch-fetch
  // their display names. We map each target type → Set<id> from BOTH source and
  // forked sides, since either side may be missing rows in our DB (e.g. hard
  // deleted). We'll resolve whichever side has rows.
  const idsByType = new Map<string, Set<string>>();
  for (const r of rows) {
    const sKey = r.sourceTargetType;
    if (!idsByType.has(sKey)) idsByType.set(sKey, new Set());
    idsByType.get(sKey)!.add(r.sourceTargetId);

    const fKey = r.forkedTargetType;
    if (!idsByType.has(fKey)) idsByType.set(fKey, new Set());
    idsByType.get(fKey)!.add(r.forkedTargetId);
  }

  // Batch-fetch names per type
  const nameMap = await resolveTargetNames(idsByType);

  return rows.map((r) => {
    // Skip anonymized/deleted forker's username — fall back to null
    const forkerVisible =
      !r.forkerIsAnonymized && !r.forkerDeletedAt && Boolean(r.forkerClerkId);

    // Source author username: the source content row may have its own userId
    // text. We resolve author for the source TARGET (not the fork) so profile
    // page shows "X forked Y builds from Z" with Z being the source author.
    // The source author is *not* the same as `users` joined above (that was
    // the forker). Source author is read from the target table's userId col.
    // We surface that as the SOURCE's author; for now we leave username null
    // unless the UI wants to fetch it — <ForksList> can render with just the
    // forker's username, which is the primary social signal.
    return {
      id: r.id,
      forkerUserId: r.forkedByUserId,
      forkerUsername: forkerVisible ? r.forkerUsername : null,
      forkerDisplayName: forkerVisible ? r.forkerDisplayName : null,
      forkerAvatarUrl: forkerVisible ? r.forkerAvatarUrl : null,
      forkedTargetType: r.forkedTargetType,
      forkedTargetId: r.forkedTargetId,
      forkedTargetName: nameMap.get(`${r.forkedTargetType}:${r.forkedTargetId}`) ?? null,
      sourceTargetType: r.sourceTargetType,
      sourceTargetId: r.sourceTargetId,
      sourceTargetName: nameMap.get(`${r.sourceTargetType}:${r.sourceTargetId}`) ?? null,
      sourceVersionId: r.sourceVersionId,
      // Source author: left null for now; the source TARGET row's userId text
      // would need an additional join to surface. Phase 6.5 candidate.
      sourceAuthorUsername: null,
      sourceAuthorDisplayName: null,
      forkedAt: r.createdAt,
    };
  });
}

/**
 * Fetch display names from the appropriate target table for a batch of
 * type→id pairs. Returns Map<"<TYPE>:<id>", name>.
 *
 * We only query the 5 target tables we know about (others are extensions).
 */
async function resolveTargetNames(
  idsByType: Map<string, Set<string>>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  // Dynamic import of schema (avoids circular dep at module load)
  const {
    primitives,
    capabilities,
    effects,
    items,
    characters,
    templates,
  } = await import("@/db/schema");

  const get = (type: string) => Array.from(idsByType.get(type) ?? []);

  const primIds = get("PRIMITIVE").map(Number).filter(Number.isFinite);
  if (primIds.length > 0) {
    const rows = await db
      .select({ id: primitives.id, name: primitives.name })
      .from(primitives)
      .where(
        sql`${primitives.id} IN (${sql.join(primIds.map((i) => sql`${i}`), sql`, `)})`,
      );
    for (const r of rows) out.set(`PRIMITIVE:${r.id}`, r.name);
  }

  const capIds = get("CAPABILITY");
  if (capIds.length > 0) {
    const rows = await db
      .select({ id: capabilities.id, name: capabilities.name })
      .from(capabilities)
      .where(
        sql`${capabilities.id} IN (${sql.join(capIds.map((i) => sql`${i}`), sql`, `)})`,
      );
    for (const r of rows) out.set(`CAPABILITY:${r.id}`, r.name);
  }

  const effIds = get("EFFECT");
  if (effIds.length > 0) {
    const rows = await db
      .select({ id: effects.id, name: effects.name })
      .from(effects)
      .where(
        sql`${effects.id} IN (${sql.join(effIds.map((i) => sql`${i}`), sql`, `)})`,
      );
    for (const r of rows) out.set(`EFFECT:${r.id}`, r.name);
  }

  const itemIds = get("ITEM");
  if (itemIds.length > 0) {
    const rows = await db
      .select({ id: items.id, name: items.name })
      .from(items)
      .where(
        sql`${items.id} IN (${sql.join(itemIds.map((i) => sql`${i}`), sql`, `)})`,
      );
    for (const r of rows) out.set(`ITEM:${r.id}`, r.name);
  }

  const charIds = get("CHARACTER");
  if (charIds.length > 0) {
    const rows = await db
      .select({ id: characters.id, name: characters.name })
      .from(characters)
      .where(
        sql`${characters.id} IN (${sql.join(charIds.map((i) => sql`${i}`), sql`, `)})`,
      );
    for (const r of rows) out.set(`CHARACTER:${r.id}`, r.name);
  }

  // RACE_TEMPLATE / BACKGROUND_TEMPLATE / ARCHETYPE_TEMPLATE all share the
  // `templates` table with a `kind` discriminator.
  const tplIdsByKind = {
    RACE_TEMPLATE: get("RACE_TEMPLATE"),
    BACKGROUND_TEMPLATE: get("BACKGROUND_TEMPLATE"),
    ARCHETYPE_TEMPLATE: get("ARCHETYPE_TEMPLATE"),
  };
  for (const [kind, ids] of Object.entries(tplIdsByKind)) {
    if (ids.length === 0) continue;
    const rows = await db
      .select({ id: templates.id, name: templates.name })
      .from(templates)
      .where(
        sql`${templates.kind} = ${kind} AND ${templates.id} IN (${sql.join(
          ids.map((i) => sql`${i}`),
          sql`, `,
        )})`,
      );
    for (const r of rows) out.set(`${kind}:${r.id}`, r.name);
  }

  return out;
}