/**
 * recordVersion — auto-snapshot a content entity into its _versions table.
 *
 * Called by dispatchEntitySave on every save. Replaces the Phase 2-era
 * "onSaveVersion" shim that was never actually wired up.
 *
 * The version row's `id` is the content-addressed UUID computed by
 * resolveContentVersionId(entityKind, entityId, contentHash). This means:
 *   - Same content re-saved yields the same id (no duplicate rows).
 *   - The id uniquely identifies "this version of this entity" - a slot
 *     can pin to it directly via version_id.
 *   - The transitive walk in T5.5 uses these ids to find stale slots.
 *
 * Idempotency: re-calling recordVersion with the same args is a no-op
 * (the content-addressed id matches an existing immutable row; only its
 * latest flag changes when explicitly returning to earlier content).
 *
 * If the caller provides a versionNumber, it's used as-is (caller is
 * responsible for monotonic ordering). Otherwise versionNumber is computed
 * as max(existing) + 1.
 *
 * If the caller provides publishedByUserId, it's set; otherwise null
 * (system snapshots). Note: publishedByUserId accepts a Clerk user ID
 * (text, e.g. "user_2abc...") and resolves it to the internal users.id
 * uuid before insert. Pass null explicitly to skip the resolution.
 *
 * Unique entity/version-number indexes protect historical payloads.
 * A collision fails the transaction instead of rewriting an existing version.
 */

import { and, desc, eq, max, ne } from "drizzle-orm";
import {
  capabilityVersions,
  characterVersions,
  effectVersions,
  itemVersions,
  primitiveVersions,
  heritageVersions,
  type versionDeltaKindEnum,
} from "@/db/schema";
import { resolveContentVersionId } from "./content-hash";
import { withDatabaseTransaction } from "@/db/client";
import { sql } from "drizzle-orm";
import { withDependencyPins } from "./capture-dependency-pins";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

/** The 5 entity kinds that have a _versions table. */
export type VersionedEntityKind =
  | "primitive"
  | "effect"
  | "capability"
  | "item"
  | "template"
  // PLAN Eilxina Part E (Mashu 2026-09-09): character versions are
  // distinct from slot version pins — see swordweave-versioning §
  // "Slot pinning vs character versioning". Character snapshots
  // capture the WHOLE character (row + junction links + their
  // version pins) so a restore can reconstruct the previous state.
  | "character";

export interface RecordVersionArgs {
  entityKind: VersionedEntityKind;
  /** primitive = integer, all others = uuid string. */
  entityId: string | number;
  contentHash: string;
  /**
   * The canonical payload at the time of save. Stored verbatim in the
   * `snapshot` jsonb column. The dispatcher is responsible for building
   * this from the entity row + the version-payload helper for the kind.
   */
  snapshot: Record<string, unknown>;
  /**
   * Optional. If provided, used as the new version's versionNumber.
   * If omitted, computed as max(existing for this entity) + 1.
   */
  versionNumber?: number;
  /**
   * Optional. If provided, the version row records this user as the
   * publisher. If omitted, null (system snapshot, e.g. seeded content).
   */
  publishedByUserId?: string | null;
}

export interface RecordVersionResult {
  /** Content-addressed UUID matching a *_versions.id row. */
  versionId: string;
  versionNumber: number;
  isLatest: boolean;
}

/**
 * Dispatch helper: given an entity kind, return the matching _versions
 * table reference + its foreign-key column. Kept in sync with
 * src/db/schema/versions.ts.
 */
function versionTableFor(kind: VersionedEntityKind) {
  switch (kind) {
    case "primitive":
      return {
        table: primitiveVersions,
        id: primitiveVersions.id,
        versionNumber: primitiveVersions.versionNumber,
        foreignKey: primitiveVersions.primitiveId,
        isLatest: primitiveVersions.isLatest,
        contentHash: primitiveVersions.snapshot,
      };
    case "effect":
      return {
        table: effectVersions,
        id: effectVersions.id,
        versionNumber: effectVersions.versionNumber,
        foreignKey: effectVersions.effectId,
        isLatest: effectVersions.isLatest,
        contentHash: effectVersions.snapshot,
      };
    case "capability":
      return {
        table: capabilityVersions,
        id: capabilityVersions.id,
        versionNumber: capabilityVersions.versionNumber,
        foreignKey: capabilityVersions.capabilityId,
        isLatest: capabilityVersions.isLatest,
        contentHash: capabilityVersions.snapshot,
      };
    case "item":
      return {
        table: itemVersions,
        id: itemVersions.id,
        versionNumber: itemVersions.versionNumber,
        foreignKey: itemVersions.itemId,
        isLatest: itemVersions.isLatest,
        contentHash: itemVersions.snapshot,
      };
    case "template":
      return {
        table: heritageVersions,
        id: heritageVersions.id,
        versionNumber: heritageVersions.versionNumber,
        foreignKey: heritageVersions.templateId,
        isLatest: heritageVersions.isLatest,
        contentHash: heritageVersions.snapshot,
      };
    case "character":
      return {
        table: characterVersions,
        id: characterVersions.id,
        versionNumber: characterVersions.versionNumber,
        foreignKey: characterVersions.characterId,
        isLatest: characterVersions.isLatest,
        contentHash: characterVersions.snapshot,
      };
  }
}

type DeltaKind = (typeof versionDeltaKindEnum.enumValues)[number];

/**
 * Record a new version for the given entity. Idempotent on re-call with
 * the same contentHash.
 *
 * @returns the content-addressed versionId, the versionNumber, and
 *   isLatest=true (always - the just-inserted row is the latest).
 */
export async function recordVersion(
  args: RecordVersionArgs,
): Promise<RecordVersionResult> {
  return withDatabaseTransaction(async (tx) => {
    // Serialize both save and publish writers without changing existing IDs.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${args.entityKind + ":" + args.entityId}))`);
    return recordVersionLocked(args);
  });
}

async function recordVersionLocked(args: RecordVersionArgs): Promise<RecordVersionResult> {
  const { entityKind, entityId, contentHash, snapshot } = args;
  const ref = versionTableFor(entityKind);
  if (!ref) {
    throw new Error(`recordVersion: unknown entityKind ${entityKind}`);
  }

  const versionId = resolveContentVersionId(entityKind, entityId, contentHash);

  // Compute the foreign key value (primitive = int, others = uuid string).
  // PLAN Eilxina Part E (Mashu 2026-09-09): "character" was added to
  // the union; its fk is uuid so the same string-id path as
  // effect/capability/item/template applies.
  const fkValue =
    entityKind === "primitive" ? Number(entityId) : String(entityId);

  // Direct query via the db client. Imported lazily to avoid a circular
  // dependency with the schema re-exports.
  const { db } = await import("@/db/client");

  // Existing immutable content is never rewritten on an identical save.
  const [existing] = await db.select({ id: ref.id, versionNumber: ref.versionNumber,
    isLatest: ref.isLatest }).from(ref.table).where(eq(ref.id, versionId)).limit(1);
  if (existing) {
    if (!existing.isLatest) {
      await db.update(ref.table).set({ isLatest: false }).where(and(
        eq(ref.foreignKey, fkValue as never), eq(ref.isLatest, true), ne(ref.id, versionId)));
      await db.update(ref.table).set({ isLatest: true }).where(eq(ref.id, versionId));
    }
    return { versionId, versionNumber: existing.versionNumber, isLatest: true };
  }
  const maxResult = await db.select({ m: max(ref.versionNumber) }).from(ref.table)
    .where(eq(ref.foreignKey, fkValue as never));
  const versionNumber = args.versionNumber ?? (maxResult[0]?.m ?? 0) + 1;
  await db.update(ref.table).set({ isLatest: false }).where(and(
    eq(ref.foreignKey, fkValue as never), eq(ref.isLatest, true)));
  const deltaKind: DeltaKind = "FULL";
  const now = new Date();
  const publishedByUserId = args.publishedByUserId == null ? null
    : (await resolveUserIdByClerkId(args.publishedByUserId)) ?? null;

  const pinnedSnapshot = await withDependencyPins(snapshot);

  // Different content (new versionId). Insert a fresh immutable snapshot. A conflicting version number
  // is an error, never permission to replace historical content.
  // PLAN Eilxina Part E (Mashu 2026-09-09): "character" maps to
  // characterVersions.characterId.
  const fkColumnName =
    entityKind === "primitive"
      ? "primitiveId"
      : entityKind === "character"
        ? "characterId"
        : `${entityKind}Id`;
  await db
    .insert(ref.table)
    .values({
      id: versionId,
      [fkColumnName]: fkValue,
      versionNumber,
      isLatest: true,
      deltaKind,
      snapshot: pinnedSnapshot,
      publishedByUserId,
      publishedAt: now,
    } as never)
;

  return {
    versionId,
    versionNumber,
    isLatest: true,
  };
}

/**
 * Find the latest version row for an entity, or null if no version
 * exists yet.
 */
export async function findLatestVersion(
  entityKind: VersionedEntityKind,
  entityId: string | number,
): Promise<{ versionId: string; versionNumber: number; snapshot: unknown } | null> {
  const ref = versionTableFor(entityKind);
  if (!ref) return null;
  const fkValue = entityKind === "primitive" ? Number(entityId) : String(entityId);
  const { db } = await import("@/db/client");
  const rows = await db
    .select({
      id: ref.id,
      versionNumber: ref.versionNumber,
      snapshot: ref.table.snapshot,
    })
    .from(ref.table)
    .where(
      and(
        eq(ref.foreignKey, fkValue as never),
        eq(ref.isLatest, true),
      ),
    )
    .orderBy(desc(ref.versionNumber))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { versionId: row.id, versionNumber: row.versionNumber, snapshot: row.snapshot };
}
