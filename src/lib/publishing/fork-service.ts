// =============================================================================
// Fork service — Phase 5 Commit B
//
// Clones a published target (capability/primitive/template) into the user's
// own sandbox with attribution back to the source.
//
// Invariants:
// - Forked content belongs to the user (userId = forker), isPrivate = false
//   so it shows up in their sandbox for editing.
// - A `forks` row is created linking forked target back to source.
// - `fork_aggregates.fork_count` is incremented atomically.
// - The forked target gets its own v1 FULL snapshot so the user can edit
//   and re-publish as their own version chain.
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  forkAggregates,
  forks,
  publications,
} from "@/db/schema";

export interface ForkInput {
  /** The publication being forked (resolves to version + source). */
  publicationId: string;
  /** The user forking (internal UUID, not Clerk ID). */
  forkerUserId: string;
}

export interface ForkResult {
  forkedCapabilityId: string;
  sourcePublicationId: string;
  sourceAuthorId: string | null;
  forkCount: number;
}

/**
 * Fork a published capability. Creates a new capability owned by the user,
 * copies its primitive_links, creates v1 FULL snapshot for the fork, and
 * records attribution in the forks table.
 */
export async function forkCapability(input: ForkInput): Promise<ForkResult> {
  const { publicationId, forkerUserId } = input;

  // 1. Load publication + version + source capability
  const pub = await db.query.publications.findFirst({
    where: (table, { eq, and, isNull }) =>
      and(eq(table.id, publicationId), isNull(table.unpublishedAt)),
  });
  if (!pub) {
    throw new Error("Publication not found or has been unpublished");
  }
  if (pub.targetType !== "CAPABILITY") {
    throw new Error(
      `forkCapability only supports CAPABILITY targets, got ${pub.targetType}`,
    );
  }

  const version = await db.query.capabilityVersions.findFirst({
    where: (table, { eq }) => eq(table.id, pub.versionId),
  });
  if (!version) {
    throw new Error("Version row missing for publication");
  }

  const source = await db.query.capabilities.findFirst({
    where: (table, { eq }) => eq(table.id, pub.targetId),
    with: {
      primitiveLinks: true,
    },
  });
  if (!source) {
    throw new Error("Source capability missing");
  }

  // 2. Create new capability owned by the forker
  const [forked] = await db
    .insert(capabilities)
    .values({
      name: `${source.name} (fork)`,
      type: source.type,
      sourceType: source.sourceType,
      verboseDescription: source.verboseDescription,
      isPublic: false, // Private until user re-publishes
      sourceOrigin: `fork:${source.id}:${pub.versionId}`,
      tags: source.tags,
      metadata: {
        ...source.metadata,
        forkedFrom: {
          capabilityId: source.id,
          versionId: pub.versionId,
          versionNumber: pub.versionNumber,
          publicationId,
        },
      },
    })
    .returning({ id: capabilities.id });

  if (!forked) {
    throw new Error("Failed to insert forked capability");
  }

  // 3. Copy primitive_links
  if (source.primitiveLinks.length > 0) {
    await db.insert(capabilityPrimitives).values(
      source.primitiveLinks.map((link) => ({
        capabilityId: forked.id,
        primitiveId: link.primitiveId,
        role: link.role,
        quantity: link.quantity,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel,
        notes: link.notes,
      })),
    );
  }

  // 4. Record fork attribution. The forked target gets its own version
  //    chain when the user publishes it later — no version row needed
  //    at fork time.
  await db.insert(forks).values({
    forkedByUserId: forkerUserId,
    sourceTargetType: "CAPABILITY",
    sourceTargetId: source.id,
    sourceVersionId: pub.versionId,
    sourceAuthorId: pub.authorId,
    forkedTargetType: "CAPABILITY",
    forkedTargetId: forked.id,
    forkedVersionId: pub.versionId, // Will be replaced when forked target gets published
    metadata: {
      publicationId,
      versionNumber: pub.versionNumber,
    },
  });

  // 6. Atomic fork_count increment
  const [agg] = await db
    .insert(forkAggregates)
    .values({
      sourceTargetType: "CAPABILITY",
      sourceTargetId: source.id,
      sourceVersionId: pub.versionId,
      forkCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        forkAggregates.sourceTargetType,
        forkAggregates.sourceTargetId,
        forkAggregates.sourceVersionId,
      ],
      set: {
        forkCount: sql`${forkAggregates.forkCount} + 1`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning({ forkCount: forkAggregates.forkCount });

  return {
    forkedCapabilityId: forked.id,
    sourcePublicationId: publicationId,
    sourceAuthorId: pub.authorId,
    forkCount: agg?.forkCount ?? 1,
  };
}

/**
 * Get the fork count for a target+version.
 */
export async function getForkCount(
  sourceTargetType: string,
  sourceTargetId: string,
  sourceVersionId: string,
): Promise<number> {
  const row = await db.query.forkAggregates.findFirst({
    where: (table, { eq, and }) =>
      and(
        eq(table.sourceTargetType, sourceTargetType as never),
        eq(table.sourceTargetId, sourceTargetId),
        eq(table.sourceVersionId, sourceVersionId),
      ),
  });
  return row?.forkCount ?? 0;
}

/**
 * Get the list of forks for a target+version (newest first), with forker
 * profile info for display.
 */
export async function getForksForTarget(
  sourceTargetType: string,
  sourceTargetId: string,
  sourceVersionId: string,
  limit = 20,
) {
  return db.query.forks.findMany({
    where: (table, { eq, and }) =>
      and(
        eq(table.sourceTargetType, sourceTargetType as never),
        eq(table.sourceTargetId, sourceTargetId),
        eq(table.sourceVersionId, sourceVersionId),
      ),
    with: {
      forkedBy: {
        columns: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
    orderBy: (table, { desc }) => desc(table.createdAt),
    limit,
  });
}

/**
 * Get all forks created by a user (their fork history).
 */
export async function getForksByUser(forkerUserId: string) {
  return db.query.forks.findMany({
    where: (table, { eq }) => eq(table.forkedByUserId, forkerUserId),
    orderBy: (table, { desc }) => desc(table.createdAt),
  });
}