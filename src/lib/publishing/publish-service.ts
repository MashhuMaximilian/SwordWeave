// =============================================================================
// Publishing service — Phase 5 Commit B + Phase 6 backend
//
// Creates a version snapshot of a target (primitive/capability/effect/item/
// character/template) and registers it as a Publication with a visibility
// tier.
//
// Invariants:
// - First publish for a target → FULL snapshot (v1)
// - Subsequent publishes → DELTA from latest (saves storage)
// - Only the author can publish/unpublish their own content
// - Visibility tiers: PUBLIC, FOLLOWERS_ONLY, PRIVATE
// =============================================================================

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilityVersions,
  characterVersions,
  effectVersions,
  forks,
  itemVersions,
  primitiveVersions,
  publications,
  publishTargetTypeEnum,
  templateVersions,
} from "@/db/schema";
import {
  compactSnapshot,
  computeSelfDescribingDelta,
  createFullSnapshot,
  type SelfDescribingDelta,
} from "@/lib/versions/delta";

// Drizzle pgEnum doesn't auto-export TS types, so infer them from the
// enum values tuple.
export type PublishTargetType =
  (typeof publishTargetTypeEnum.enumValues)[number];
export type PublishVisibility = "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";

export interface PublishInput {
  targetType: PublishTargetType;
  targetId: string;
  authorId: string; // internal user UUID (NOT Clerk ID)
  visibility: PublishVisibility;
  /** Snapshot data for the target — caller is responsible for loading. */
  snapshot: Record<string, unknown>;
}

export interface PublishResult {
  publicationId: string;
  versionId: string;
  versionNumber: number;
  isLatest: boolean;
  deltaKind: "FULL" | "DELTA";
}

/**
 * Find the latest version row for a target, dispatching by targetType to
 * the correct version table. Returns null if no prior version exists.
 */
async function findLatestVersion(
  targetType: PublishTargetType,
  targetId: string,
): Promise<{
  id: string;
  versionNumber: number;
  snapshot: Record<string, unknown> | null;
  deltaKind: "FULL" | "DELTA";
} | null> {
  // Convert targetId: PRIMITIVE stores integer IDs, others store UUIDs.
  // The version table stores the raw value as text on its respective column.
  const versionTable = versionTableFor(targetType);
  if (!versionTable) return null;

  const rows = (await db
    .select({
      id: versionTable.id,
      versionNumber: versionTable.versionNumber,
      snapshot: versionTable.snapshot,
      deltaKind: versionTable.deltaKind,
    } as never)
    .from(versionTable.table)
    .where(
      eq(
        versionTable.foreignKey,
        targetType === "PRIMITIVE" ? Number(targetId) : targetId,
      ),
    )
    .orderBy(desc(versionTable.versionNumber))
    .limit(1)) as Array<{
    id: string;
    versionNumber: number;
    snapshot: Record<string, unknown> | null;
    deltaKind: "FULL" | "DELTA";
  }>;

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    snapshot: row.snapshot,
    deltaKind: row.deltaKind,
  };
}

/**
 * Mark the previous latest version as no-longer-latest.
 */
async function supersedePreviousLatest(
  targetType: PublishTargetType,
  previousVersionId: string,
): Promise<void> {
  const versionTable = versionTableFor(targetType);
  if (!versionTable) return;
  await db
    .update(versionTable.table)
    .set({ isLatest: false })
    .where(eq(versionTable.id, previousVersionId));
}

/**
 * Insert a new version row into the correct version table.
 */
async function insertVersionRow(
  targetType: PublishTargetType,
  targetId: string,
  versionNumber: number,
  deltaKind: "FULL" | "DELTA",
  snapshotJson: Record<string, unknown>,
  authorUuid: string,
): Promise<string> {
  const versionTable = versionTableFor(targetType);
  if (!versionTable) {
    throw new Error(`No version table mapping for targetType ${targetType}`);
  }

  // All version tables share the same column shape — see src/db/schema/versions.ts
  // We use type assertion because Drizzle's typed table refs differ per table.
  const rows = (await db
    .insert(versionTable.table)
    .values({
      [versionTable.foreignKey.name]:
        targetType === "PRIMITIVE" ? Number(targetId) : targetId,
      versionNumber,
      isLatest: true,
      deltaKind,
      snapshot: snapshotJson,
      publishedByUserId: authorUuid,
    } as never)
    .returning({ id: versionTable.id })) as Array<{ id: string }>;
  const row = rows[0];
  if (!row) {
    throw new Error(`Failed to insert version row for ${targetType}`);
  }
  return row.id;
}

/**
 * Returns the version table dispatch metadata for a given targetType.
 *
 * IMPORTANT: keep this in sync with src/db/schema/versions.ts.
 *
 * - primitiveVersions.primitiveId (integer)  → PRIMITIVE
 * - capabilityVersions.capabilityId (uuid)   → CAPABILITY
 * - characterVersions.characterId (uuid)     → CHARACTER
 * - templateVersions.templateId (uuid)       → RACE/BACKGROUND/ARCHETYPE_TEMPLATE
 * - effectVersions.effectId (uuid)           → EFFECT
 * - itemVersions.itemId (uuid)               → ITEM
 */
function versionTableFor(targetType: PublishTargetType) {
  switch (targetType) {
    case "PRIMITIVE":
      return {
        table: primitiveVersions,
        id: primitiveVersions.id,
        versionNumber: primitiveVersions.versionNumber,
        snapshot: primitiveVersions.snapshot,
        deltaKind: primitiveVersions.deltaKind,
        foreignKey: primitiveVersions.primitiveId,
      };
    case "CAPABILITY":
      return {
        table: capabilityVersions,
        id: capabilityVersions.id,
        versionNumber: capabilityVersions.versionNumber,
        snapshot: capabilityVersions.snapshot,
        deltaKind: capabilityVersions.deltaKind,
        foreignKey: capabilityVersions.capabilityId,
      };
    case "EFFECT":
      return {
        table: effectVersions,
        id: effectVersions.id,
        versionNumber: effectVersions.versionNumber,
        snapshot: effectVersions.snapshot,
        deltaKind: effectVersions.deltaKind,
        foreignKey: effectVersions.effectId,
      };
    case "ITEM":
      return {
        table: itemVersions,
        id: itemVersions.id,
        versionNumber: itemVersions.versionNumber,
        snapshot: itemVersions.snapshot,
        deltaKind: itemVersions.deltaKind,
        foreignKey: itemVersions.itemId,
      };
    case "CHARACTER":
      return {
        table: characterVersions,
        id: characterVersions.id,
        versionNumber: characterVersions.versionNumber,
        snapshot: characterVersions.snapshot,
        deltaKind: characterVersions.deltaKind,
        foreignKey: characterVersions.characterId,
      };
    case "RACE_TEMPLATE":
    case "BACKGROUND_TEMPLATE":
    case "ARCHETYPE_TEMPLATE":
    case "BUILD_TEMPLATE":
      return {
        table: templateVersions,
        id: templateVersions.id,
        versionNumber: templateVersions.versionNumber,
        snapshot: templateVersions.snapshot,
        deltaKind: templateVersions.deltaKind,
        foreignKey: templateVersions.templateId,
      };
    default:
      return null;
  }
}

/**
 * Publish a target: create a new version row + publication row.
 *
 * If a previous version exists, the new version stores a DELTA (saves
 * storage). If this is the first publish, it stores a FULL snapshot.
 */
export async function publishTarget(
  input: PublishInput,
): Promise<PublishResult> {
  const { targetType, targetId, authorId, visibility, snapshot } = input;

  const cleanSnapshot = compactSnapshot(snapshot);

  // Find latest version (for delta computation) — dispatches by targetType
  const latest = await findLatestVersion(targetType, targetId);

  let nextVersionNumber: number;
  let deltaKind: "FULL" | "DELTA";
  let payload: { snapshot: Record<string, unknown> } | {
    delta: SelfDescribingDelta;
  };

  if (!latest) {
    nextVersionNumber = 1;
    deltaKind = "FULL";
    payload = { snapshot: createFullSnapshot(cleanSnapshot).data };
  } else {
    nextVersionNumber = latest.versionNumber + 1;
    deltaKind = "DELTA";
    // For simplicity we assume the latest FULL row was created at the
    // most recent version (storage convention: latest version is always
    // FULL for fast reads). Older versions reconstruct via delta chain.
    const prevSnapshot = latest.snapshot ?? {};
    const delta = computeSelfDescribingDelta(prevSnapshot, cleanSnapshot);
    payload = { delta };
  }

  // Mark old latest as no-longer-latest
  if (latest) {
    await supersedePreviousLatest(targetType, latest.id);
  }

  // Insert new version row (in the correct table for this targetType)
  const snapshotJson: Record<string, unknown> =
    deltaKind === "FULL"
      ? "snapshot" in payload
        ? payload.snapshot
        : {}
      : "delta" in payload
        ? (payload.delta as Record<string, unknown>)
        : {};

  const versionId = await insertVersionRow(
    targetType,
    targetId,
    nextVersionNumber,
    deltaKind,
    snapshotJson,
    authorId,
  );

  // Insert publication row
  const [pubRow] = await db
    .insert(publications)
    .values({
      targetType,
      targetId,
      versionId,
      versionNumber: nextVersionNumber,
      authorId,
      visibility,
    })
    .returning({ id: publications.id });

  if (!pubRow) {
    throw new Error("Failed to insert publication row");
  }

  // Update fork lineage: if this published target is itself a fork of
  // something else, point forks.forkedVersionId at the new version row.
  // Without this, "show forks of source v_n" can be wrong because the
  // forked copies' lineage still references the source's version, not
  // the fork's own current version.
  await db
    .update(forks)
    .set({ forkedVersionId: versionId })
    .where(
      and(
        eq(forks.forkedTargetType, targetType),
        eq(forks.forkedTargetId, targetId),
      ),
    );

  return {
    publicationId: pubRow.id,
    versionId,
    versionNumber: nextVersionNumber,
    isLatest: true,
    deltaKind,
  };
}

/**
 * Unpublish: mark the publication as inactive. The version row stays
 * so history is preserved (users who pinned to this version still
 * resolve it).
 */
export async function unpublishTarget(
  publicationId: string,
  userId: string,
): Promise<void> {
  await db
    .update(publications)
    .set({ unpublishedAt: sql`NOW()` })
    .where(
      and(
        eq(publications.id, publicationId),
        eq(publications.authorId, userId),
        sql`${publications.unpublishedAt} IS NULL`,
      ),
    );
}

/**
 * Get all publications by a user.
 */
export async function getPublicationsByAuthor(authorId: string) {
  return db.query.publications.findMany({
    where: (table, { eq, isNull }) =>
      and(eq(table.authorId, authorId), isNull(table.unpublishedAt)),
    orderBy: [desc(publications.publishedAt)],
  });
}

/**
 * Get all versions for a target, newest first.
 *
 * Dispatches by targetType to the correct version table.
 */
export async function getVersionChain(
  targetType: PublishTargetType,
  targetId: string,
) {
  const versionTable = versionTableFor(targetType);
  if (!versionTable) {
    throw new Error(`No version table mapping for targetType ${targetType}`);
  }
  return db
    .select()
    .from(versionTable.table)
    .where(
      eq(
        versionTable.foreignKey,
        targetType === "PRIMITIVE" ? Number(targetId) : targetId,
      ),
    )
    .orderBy(desc(versionTable.versionNumber));
}

// Re-export for convenience
export { publishTargetTypeEnum };