// =============================================================================
// Flags service — Phase 5 Commit C
//
// Users can flag content with a reason (UNBALANCED / BROKEN / INAPPROPRIATE
// / DUPLICATE / OTHER) plus an optional note. Flag counts are cached in
// flag_aggregates per (target_type, target_id, version_id) tuple.
//
// Per project policy: NO auto-moderation. Flags are visible counters only —
// moderators (out of scope for Phase 5) review them manually.
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  flagAggregates,
  flagReasonEnum,
  flags,
  type publishTargetTypeEnum,
} from "@/db/schema";

export type FlagReason = (typeof flagReasonEnum.enumValues)[number];
export type FlagTargetType =
  (typeof publishTargetTypeEnum.enumValues)[number];

export interface FlagInput {
  userId: string;
  targetType: FlagTargetType;
  targetId: string;
  versionId: string;
  reason: FlagReason;
  note?: string;
}

export interface FlagResult {
  flagged: boolean;
  reason: FlagReason;
  flagCounts: Record<FlagReason, number>;
  totalFlags: number;
}

/**
 * Flag a target with a reason. Idempotent per (user, target, version, reason):
 * flagging again with the same reason is a no-op. Adding a different reason
 * creates a separate flag row (one user can flag the same content for multiple
 * reasons).
 */
export async function flagTarget(input: FlagInput): Promise<FlagResult> {
  const { userId, targetType, targetId, versionId, reason, note } = input;

  return db.transaction(async (tx) => {
    // Check if user already flagged this target+version+reason
    const existing = await tx.query.flags.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, userId),
          eq(table.targetType, targetType),
          eq(table.targetId, targetId),
          eq(table.versionId, versionId),
          eq(table.reason, reason),
        ),
    });

    let delta = 0;
    if (existing) {
      // Already flagged — no-op
      delta = 0;
    } else {
      await tx.insert(flags).values({
        userId,
        targetType,
        targetId,
        versionId,
        reason,
        note: note ?? null,
      });
      delta = 1;
    }

    // Update aggregate for this reason
    const columnForReason = {
      UNBALANCED: flagAggregates.unbalancedCount,
      BROKEN: flagAggregates.brokenCount,
      INAPPROPRIATE: flagAggregates.inappropriateCount,
      DUPLICATE: flagAggregates.duplicateCount,
      OTHER: flagAggregates.otherCount,
    } as const;
    const col = columnForReason[reason];

    const [agg] = await tx
      .insert(flagAggregates)
      .values({
        targetType,
        targetId,
        versionId,
        unbalancedCount: reason === "UNBALANCED" ? 1 : 0,
        brokenCount: reason === "BROKEN" ? 1 : 0,
        inappropriateCount: reason === "INAPPROPRIATE" ? 1 : 0,
        duplicateCount: reason === "DUPLICATE" ? 1 : 0,
        otherCount: reason === "OTHER" ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [
          flagAggregates.targetType,
          flagAggregates.targetId,
          flagAggregates.versionId,
        ],
        set: {
          [reason === "UNBALANCED"
            ? "unbalancedCount"
            : reason === "BROKEN"
              ? "brokenCount"
              : reason === "INAPPROPRIATE"
                ? "inappropriateCount"
                : reason === "DUPLICATE"
                  ? "duplicateCount"
                  : "otherCount"]: sql`${col} + ${delta}`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({
        unbalancedCount: flagAggregates.unbalancedCount,
        brokenCount: flagAggregates.brokenCount,
        inappropriateCount: flagAggregates.inappropriateCount,
        duplicateCount: flagAggregates.duplicateCount,
        otherCount: flagAggregates.otherCount,
      });

    const counts = {
      UNBALANCED: Number(agg?.unbalancedCount ?? 0),
      BROKEN: Number(agg?.brokenCount ?? 0),
      INAPPROPRIATE: Number(agg?.inappropriateCount ?? 0),
      DUPLICATE: Number(agg?.duplicateCount ?? 0),
      OTHER: Number(agg?.otherCount ?? 0),
    };

    return {
      flagged: !existing,
      reason,
      flagCounts: counts,
      totalFlags: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  });
}

/**
 * Remove a flag the user previously placed.
 */
export async function unflagTarget(input: {
  userId: string;
  targetType: FlagTargetType;
  targetId: string;
  versionId: string;
  reason: FlagReason;
}): Promise<FlagResult> {
  const { userId, targetType, targetId, versionId, reason } = input;

  return db.transaction(async (tx) => {
    const existing = await tx.query.flags.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, userId),
          eq(table.targetType, targetType),
          eq(table.targetId, targetId),
          eq(table.versionId, versionId),
          eq(table.reason, reason),
        ),
    });

    let delta = 0;
    if (existing) {
      await tx.delete(flags).where(eq(flags.id, existing.id));
      delta = -1;
    }

    const colName =
      reason === "UNBALANCED"
        ? "unbalancedCount"
        : reason === "BROKEN"
          ? "brokenCount"
          : reason === "INAPPROPRIATE"
            ? "inappropriateCount"
            : reason === "DUPLICATE"
              ? "duplicateCount"
              : "otherCount";

    const [agg] = await tx
      .insert(flagAggregates)
      .values({
        targetType,
        targetId,
        versionId,
        unbalancedCount: 0,
        brokenCount: 0,
        inappropriateCount: 0,
        duplicateCount: 0,
        otherCount: 0,
      })
      .onConflictDoUpdate({
        target: [
          flagAggregates.targetType,
          flagAggregates.targetId,
          flagAggregates.versionId,
        ],
        set: {
          [colName]: sql`GREATEST(0, ${sql.raw(`${colName}`)} + ${delta})`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({
        unbalancedCount: flagAggregates.unbalancedCount,
        brokenCount: flagAggregates.brokenCount,
        inappropriateCount: flagAggregates.inappropriateCount,
        duplicateCount: flagAggregates.duplicateCount,
        otherCount: flagAggregates.otherCount,
      });

    const counts = {
      UNBALANCED: Number(agg?.unbalancedCount ?? 0),
      BROKEN: Number(agg?.brokenCount ?? 0),
      INAPPROPRIATE: Number(agg?.inappropriateCount ?? 0),
      DUPLICATE: Number(agg?.duplicateCount ?? 0),
      OTHER: Number(agg?.otherCount ?? 0),
    };

    return {
      flagged: false,
      reason,
      flagCounts: counts,
      totalFlags: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  });
}

/**
 * Get flag aggregates for a target+version.
 */
export async function getFlagAggregate(
  targetType: FlagTargetType,
  targetId: string,
  versionId: string,
): Promise<Record<FlagReason, number>> {
  const row = await db.query.flagAggregates.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.targetType, targetType),
        eq(table.targetId, targetId),
        eq(table.versionId, versionId),
      ),
  });
  return {
    UNBALANCED: Number(row?.unbalancedCount ?? 0),
    BROKEN: Number(row?.brokenCount ?? 0),
    INAPPROPRIATE: Number(row?.inappropriateCount ?? 0),
    DUPLICATE: Number(row?.duplicateCount ?? 0),
    OTHER: Number(row?.otherCount ?? 0),
  };
}