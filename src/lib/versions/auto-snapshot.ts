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
 * (the content-addressed id matches an existing row, which is updated in
 * place with is_latest=true and a fresh publishedAt timestamp).
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
 * Migration 0024 (2026-07-08) added the missing unique index on
 * (entity_id, version_number) for primitive_versions, capability_versions,
 * and template_versions. Without it, the ON CONFLICT clause in the upsert
 * below fails with SQLSTATE 42P10. If you see that error in prod logs,
 * re-run `pnpm exec tsx scripts/sync-pending-migrations.mts`.
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
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

/** The 5 entity kinds that have a _versions table. */
export type VersionedEntityKind =
  | "primitive"
  | "effect"
  | "capability"
  | "item"
  | "template";

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
  const { entityKind, entityId, contentHash, snapshot } = args;
  const ref = versionTableFor(entityKind);
  if (!ref) {
    throw new Error(`recordVersion: unknown entityKind ${entityKind}`);
  }

  const versionId = resolveContentVersionId(entityKind, entityId, contentHash);

  // Compute the foreign key value (primitive = int, others = uuid string).
  const fkValue = entityKind === "primitive" ? Number(entityId) : String(entityId);

  // Direct query via the db client. Imported lazily to avoid a circular
  // dependency with the schema re-exports.
  const { db } = await import("@/db/client");

  // Find the max versionNumber for this entity. If the caller didn't
  // provide one, this becomes max(existing) + 1, or 1 for first version.
  let versionNumber = args.versionNumber;
  if (versionNumber === undefined) {
    const maxResult = await db
      .select({ m: max(ref.versionNumber) })
      .from(ref.table)
      .where(eq(ref.foreignKey, fkValue as never));
    versionNumber = (maxResult[0]?.m ?? 0) + 1;
  }

  // Set the previous latest to is_latest=false (only if it isn't the
  // version row we're about to upsert).
  await db
    .update(ref.table)
    .set({ isLatest: false })
    .where(
      and(
        eq(ref.foreignKey, fkValue as never),
        eq(ref.isLatest, true),
        ne(ref.id, versionId),
      ),
    );

  // Upsert the new version row. The unique key is (entity_id, versionNumber)
  // for the standard publish flow, but for auto-snapshots we also dedupe
  // by id: if a row with the same content-addressed id already exists,
  // refresh its is_latest + published_at.
  const deltaKind: DeltaKind = "FULL";
  const now = new Date();

  // published_by_user_id is `uuid` (internal users.id), not the Clerk text
  // ID the route has in hand. Resolve the mapping here so the routes can
  // keep passing the Clerk ID. If the user is not in the users table yet
  // (e.g. first-ever save before the profile sync has run), this returns
  // null and we omit the publisher rather than blocking the save.
  const publishedByUserId =
    args.publishedByUserId === undefined
      ? null
      : args.publishedByUserId === null
        ? null
        : (await resolveUserIdByClerkId(args.publishedByUserId)) ?? null;

  await db
    .insert(ref.table)
    .values({
      id: versionId,
      [entityKind === "primitive" ? "primitiveId" : `${entityKind}Id`]:
        fkValue,
      versionNumber,
      isLatest: true,
      deltaKind,
      snapshot,
      publishedByUserId,
      publishedAt: now,
    } as never)
    .onConflictDoUpdate({
      target: [ref.foreignKey, ref.versionNumber],
      set: {
        isLatest: true,
        publishedAt: now,
        snapshot,
        publishedByUserId,
      },
    });

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
