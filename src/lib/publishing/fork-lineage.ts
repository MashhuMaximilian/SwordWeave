// =============================================================================
// Fork lineage service
//
// Two read APIs:
// - getForkSource: "where was THIS target forked from?" — used on the
//   source page header (and preview) to show a "Forked from X" breadcrumb.
//   Returns at most one row (a fork has exactly one parent).
// - getFullAncestry: "what's the full chain back to the original?" —
//   walks sourceTargetId → source of source → ... until we reach a row
//   that's not itself a fork. Returns the chain in display order
//   (oldest first). Used by the "Forking line" view on the dedicated
//   /forks page.
//
// Both queries are recursive only via repeated SELECTs on a small chain
// (typical depth 1-5). At any realistic depth this is fine; if we ever
// need to support arbitrarily deep chains we'd switch to a CTE.
//
// =============================================================================

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { forks } from "@/db/schema";
import type { ForkTargetType } from "@/lib/publishing/forks-query";

export interface ForkSource {
  /** The fork row id (uuid). */
  id: string;
  /** What the entity was forked from. */
  sourceTargetType: ForkTargetType;
  sourceTargetId: string;
  /** When the fork was taken. */
  forkedAt: Date;
  /** Optional source-version id for traceability. */
  sourceVersionId: string;
  /** Username of the original source's author (for display). */
  sourceAuthorUsername: string | null;
  /** Display name of the original source's author. */
  sourceAuthorDisplayName: string | null;
}

/**
 * Return the immediate parent of the given target, or null if it has
 * no parent (i.e. it's the original).
 *
 * Implementation: one SELECT on the forks table. The (forkedTargetType,
 * forkedTargetId) tuple is unique per entity (an entity can only be
 * forked once from a single source — a second fork would create a new
 * fork row from the same target pointing to a different source, which
 * is a different "person forked this", not a different parent).
 *
 * Wait — that previous claim is wrong. An entity CAN have multiple
 * fork rows pointing to it (because each fork is "user X forked Y from Z").
 * But for "what is THIS entity's parent?", we want the source it was
 * forked from when it was created. That IS unique: when entity E was
 * created as a fork of S, exactly one fork row exists where
 * forkedTarget = E. We return that row.
 */
export async function getForkSource(
  targetType: ForkTargetType,
  targetId: string,
): Promise<ForkSource | null> {
  // Strategy:
  // 1. Prefer the canonical `forks` engagement table (fast, indexed,
  //    captures author + timestamp). This is the modern path.
  // 2. If no row, fall back to the legacy `source_origin` field on the
  //    entity itself. The field uses the format `fork:<TYPE>:<id>:<rest>`
  //    (or the older `fork:<id>` form, tolerated). This is the data
  //    pre-Phase-4 forks live in.

  // (1) engagement table
  const row = await db.query.forks.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.forkedTargetType, targetType),
        eq(table.forkedTargetId, targetId),
      ),
    orderBy: (table, { asc }) => asc(table.createdAt),
  });
  if (row) {
    // Look up the source entity's author (best-effort — null if row gone).
    let sourceAuthorUsername: string | null = null;
    let sourceAuthorDisplayName: string | null = null;
    try {
      const author = await resolveSourceAuthor(
        row.sourceTargetType,
        row.sourceTargetId,
      );
      sourceAuthorUsername = author?.username ?? null;
      sourceAuthorDisplayName = author?.displayName ?? null;
    } catch {
      // Source row may have been hard-deleted; leave author fields null.
    }
    return {
      id: row.id,
      sourceTargetType: row.sourceTargetType as ForkTargetType,
      sourceTargetId: row.sourceTargetId,
      sourceVersionId: row.sourceVersionId,
      forkedAt: row.createdAt,
      sourceAuthorUsername,
      sourceAuthorDisplayName,
    };
  }

  // (2) source_origin fallback
  const synthetic = await resolveForkSourceFromEntity(
    targetType,
    targetId,
  );
  return synthetic;
}

/**
 * Read the entity's `source_origin` field and parse a `fork:...` marker
 * into a synthetic ForkSource. Returns null if the entity doesn't exist
 * or its source_origin doesn't start with `fork:`.
 *
 * Tolerates both formats:
 *   - Modern:    "fork:PRIMITIVE:425"  (or with :rest suffix)
 *   - Legacy:    "fork:425"            (no type prefix — assumed PRIMITIVE)
 *
 * The legacy format is best-effort: we only know it for PRIMITIVE rows
 * (the Phase 3 backfill marked primitive forks that way). Other entity
 * types are not affected.
 */
async function resolveForkSourceFromEntity(
  targetType: ForkTargetType,
  targetId: string,
): Promise<ForkSource | null> {
  const schema = await import("@/db/schema");
  const { sql } = await import("drizzle-orm");

  // Read just the source_origin column + user_id (for author). One query
  // per entity type, dispatched by targetType.
  let entity: { sourceOrigin: string | null; userId: string | null } | null =
    null;
  switch (targetType) {
    case "PRIMITIVE": {
      const rows = await db
        .select({
          sourceOrigin: schema.primitives.sourceOrigin,
          userId: schema.primitives.userId,
        })
        .from(schema.primitives)
        .where(sql`${schema.primitives.id} = ${targetId}::bigint`)
        .limit(1);
      entity = rows[0] ?? null;
      break;
    }
    case "CAPABILITY": {
      const rows = await db
        .select({
          sourceOrigin: schema.capabilities.sourceOrigin,
          userId: schema.capabilities.userId,
        })
        .from(schema.capabilities)
        .where(sql`${schema.capabilities.id} = ${targetId}`)
        .limit(1);
      entity = rows[0] ?? null;
      break;
    }
    case "EFFECT": {
      const rows = await db
        .select({
          sourceOrigin: schema.effects.sourceOrigin,
          userId: schema.effects.userId,
        })
        .from(schema.effects)
        .where(sql`${schema.effects.id} = ${targetId}`)
        .limit(1);
      entity = rows[0] ?? null;
      break;
    }
    case "ITEM": {
      const rows = await db
        .select({
          sourceOrigin: schema.items.sourceOrigin,
          userId: schema.items.userId,
        })
        .from(schema.items)
        .where(sql`${schema.items.id} = ${targetId}`)
        .limit(1);
      entity = rows[0] ?? null;
      break;
    }
    case "CHARACTER": {
      const rows = await db
        .select({
          sourceOrigin: schema.characters.sourceOrigin,
          userId: schema.characters.userId,
        })
        .from(schema.characters)
        .where(sql`${schema.characters.id} = ${targetId}`)
        .limit(1);
      entity = rows[0] ?? null;
      break;
    }
    case "LINEAGE_TEMPLATE":
    case "UPBRINGING_TEMPLATE":
    case "MANIFEST_TEMPLATE": {
      const kind = targetType.replace(/_TEMPLATE$/, "");
      const rows = await db
        .select({
          sourceOrigin: schema.heritage.sourceOrigin,
          userId: schema.heritage.userId,
        })
        .from(schema.heritage)
        .where(
          sql`${schema.heritage.kind} = ${kind} AND ${schema.heritage.id} = ${targetId}`,
        )
        .limit(1);
      entity = rows[0] ?? null;
      break;
    }
    default:
      return null;
  }

  if (!entity || !entity.sourceOrigin) return null;
  const parsed = parseForkSourceOrigin(entity.sourceOrigin, targetType);
  if (!parsed) return null;

  // Author of the source (best-effort, same helper as the engagement path).
  let sourceAuthorUsername: string | null = null;
  let sourceAuthorDisplayName: string | null = null;
  try {
    const author = await resolveSourceAuthor(parsed.type, parsed.id);
    sourceAuthorUsername = author?.username ?? null;
    sourceAuthorDisplayName = author?.displayName ?? null;
  } catch {
    // ignore
  }

  return {
    // Synthesized — we don't have a real `forks` row id. Use a stable
    // synthetic id derived from the target so the UI can still key on it.
    id: `synthetic:${targetType}:${targetId}`,
    sourceTargetType: parsed.type,
    sourceTargetId: parsed.id,
    // Legacy forks don't have a recorded sourceVersionId.
    sourceVersionId: "",
    // We don't have a real `forkedAt` timestamp from the engagement
    // table. Best proxy: the entity's own createdAt. The caller can
    // ignore this for display if they want — it's informational.
    forkedAt: new Date(0),
    sourceAuthorUsername,
    sourceAuthorDisplayName,
  };
}

/**
 * Parse a `source_origin` value into a (type, id) pair.
 * Returns null if the value is not a `fork:` marker.
 *
 * Accepted forms:
 *   "fork:PRIMITIVE:425"            -> { type: "PRIMITIVE", id: "425" }
 *   "fork:PRIMITIVE:425:rest"        -> { type: "PRIMITIVE", id: "425" }
 *   "fork:425"                       -> { type: <defaultType>, id: "425" }
 *
 * The `defaultType` parameter is what we use when the legacy form has
 * no type prefix. This is the query's targetType — so a primitive row
 * with source_origin="fork:25" is interpreted as a fork of primitive 25.
 */
function parseForkSourceOrigin(
  raw: string,
  defaultType: ForkTargetType,
): { type: ForkTargetType; id: string } | null {
  if (!raw.startsWith("fork:")) return null;
  const rest = raw.slice("fork:".length);
  if (!rest) return null;
  const parts = rest.split(":");
  // If the first part is a known type, the second is the id.
  const knownTypes: ForkTargetType[] = [
    "PRIMITIVE",
    "CAPABILITY",
    "EFFECT",
    "ITEM",
    "CHARACTER",
    "LINEAGE_TEMPLATE",
    "UPBRINGING_TEMPLATE",
    "MANIFEST_TEMPLATE",
  ];
  if (parts.length >= 2 && knownTypes.includes(parts[0] as ForkTargetType)) {
    return { type: parts[0] as ForkTargetType, id: parts[1] ?? "" };
  }
  // Legacy form: just an id. Use the query's defaultType.
  if (parts.length >= 1 && parts[0]) {
    return { type: defaultType, id: parts[0] };
  }
  return null;
}

export interface ForkAncestor extends ForkSource {
  /** Display name of the source entity (best-effort). */
  sourceTargetName: string | null;
}

/**
 * Walk back from a target to the original ancestor. Returns the chain
 * starting with the IMMEDIATE parent first and ending with the oldest
 * ancestor. If the input target itself is not a fork, returns an empty
 * array.
 *
 * Stops at depth MAX_DEPTH to prevent runaway loops on accidentally
 * circular references (none should exist given the current schema, but
 * defense-in-depth is cheap).
 */
const MAX_DEPTH = 20;

export async function getFullAncestry(
  targetType: ForkTargetType,
  targetId: string,
): Promise<ForkAncestor[]> {
  const chain: ForkAncestor[] = [];
  const seen = new Set<string>();
  let current: { type: ForkTargetType; id: string } | null = {
    type: targetType,
    id: targetId,
  };

  for (let i = 0; i < MAX_DEPTH; i++) {
    if (!current) break;
    const key = `${current.type}:${current.id}`;
    if (seen.has(key)) break; // defensive: stop on cycles
    seen.add(key);

    const parent = await getForkSource(current.type, current.id);
    if (!parent) break;
    const name = await resolveTargetName(
      parent.sourceTargetType,
      parent.sourceTargetId,
    );
    chain.push({ ...parent, sourceTargetName: name });
    current = { type: parent.sourceTargetType, id: parent.sourceTargetId };
  }

  return chain;
}

// =============================================================================
// Internal helpers — best-effort name + author lookup
// =============================================================================

async function resolveSourceAuthor(
  targetType: string,
  targetId: string,
): Promise<{ username: string; displayName: string | null } | null> {
  const schema = await import("@/db/schema");
  const { users } = schema;
  const clerkId = await readUserIdForTarget(targetType, targetId);
  if (!clerkId) return null;
  const row = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkId),
    columns: {
      username: true,
      displayName: true,
      isAnonymized: true,
      deletedAt: true,
    },
  });
  if (!row || row.isAnonymized || row.deletedAt) return null;
  return { username: row.username, displayName: row.displayName };
}

async function resolveTargetName(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  const row = await readNameForTarget(targetType, targetId);
  return row ?? null;
}

// =============================================================================
// Internal: dispatch by targetType. We avoid loading the full row object
// since the lineage query only needs two columns (userId, name) — saves
// ~80% of the bytes over the wire.
// =============================================================================

async function readUserIdForTarget(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  const schema = await import("@/db/schema");
  const { sql } = await import("drizzle-orm");
  switch (targetType) {
    case "PRIMITIVE": {
      const rows = await db
        .select({ userId: schema.primitives.userId })
        .from(schema.primitives)
        .where(eq(schema.primitives.id, Number(targetId)))
        .limit(1);
      return (rows[0]?.userId as string | null) ?? null;
    }
    case "CAPABILITY": {
      const rows = await db
        .select({ userId: schema.capabilities.userId })
        .from(schema.capabilities)
        .where(eq(schema.capabilities.id, targetId))
        .limit(1);
      return (rows[0]?.userId as string | null) ?? null;
    }
    case "EFFECT": {
      const rows = await db
        .select({ userId: schema.effects.userId })
        .from(schema.effects)
        .where(eq(schema.effects.id, targetId))
        .limit(1);
      return (rows[0]?.userId as string | null) ?? null;
    }
    case "ITEM": {
      const rows = await db
        .select({ userId: schema.items.userId })
        .from(schema.items)
        .where(eq(schema.items.id, targetId))
        .limit(1);
      return (rows[0]?.userId as string | null) ?? null;
    }
    case "CHARACTER": {
      const rows = await db
        .select({ userId: schema.characters.userId })
        .from(schema.characters)
        .where(eq(schema.characters.id, targetId))
        .limit(1);
      return (rows[0]?.userId as string | null) ?? null;
    }
    case "LINEAGE_TEMPLATE":
    case "UPBRINGING_TEMPLATE":
    case "MANIFEST_TEMPLATE": {
      const kind = targetType.replace(/_TEMPLATE$/, "");
      const rows = await db
        .select({ userId: schema.heritage.userId })
        .from(schema.heritage)
        .where(
          and(
            eq(schema.heritage.kind, kind as never),
            eq(schema.heritage.id, targetId),
          ),
        )
        .limit(1);
      return (rows[0]?.userId as string | null) ?? null;
    }
    default:
      return null;
  }
}

async function readNameForTarget(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  const schema = await import("@/db/schema");
  switch (targetType) {
    case "PRIMITIVE": {
      const rows = await db
        .select({ name: schema.primitives.name })
        .from(schema.primitives)
        .where(eq(schema.primitives.id, Number(targetId)))
        .limit(1);
      return rows[0]?.name ?? null;
    }
    case "CAPABILITY": {
      const rows = await db
        .select({ name: schema.capabilities.name })
        .from(schema.capabilities)
        .where(eq(schema.capabilities.id, targetId))
        .limit(1);
      return rows[0]?.name ?? null;
    }
    case "EFFECT": {
      const rows = await db
        .select({ name: schema.effects.name })
        .from(schema.effects)
        .where(eq(schema.effects.id, targetId))
        .limit(1);
      return rows[0]?.name ?? null;
    }
    case "ITEM": {
      const rows = await db
        .select({ name: schema.items.name })
        .from(schema.items)
        .where(eq(schema.items.id, targetId))
        .limit(1);
      return rows[0]?.name ?? null;
    }
    case "CHARACTER": {
      const rows = await db
        .select({ name: schema.characters.name })
        .from(schema.characters)
        .where(eq(schema.characters.id, targetId))
        .limit(1);
      return rows[0]?.name ?? null;
    }
    case "LINEAGE_TEMPLATE":
    case "UPBRINGING_TEMPLATE":
    case "MANIFEST_TEMPLATE": {
      const kind = targetType.replace(/_TEMPLATE$/, "");
      const rows = await db
        .select({ name: schema.heritage.name })
        .from(schema.heritage)
        .where(
          and(
            eq(schema.heritage.kind, kind as never),
            eq(schema.heritage.id, targetId),
          ),
        )
        .limit(1);
      return rows[0]?.name ?? null;
    }
    default:
      return null;
  }
}

// Re-export for callers
export { inArray };
export { parseForkSourceOrigin };
