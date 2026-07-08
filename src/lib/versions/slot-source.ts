/**
 * Slot-source helpers — Phase 5.
 *
 * When a slot (character_primitives, character_capabilities, character_items) is
 * added, two facts need to be recorded:
 *
 *   - `version_id` — the content-addressed UUID of the entity's latest
 *     version row. This is what makes "edit doesn't break others" work:
 *     later, when the entity's latest version differs from the slot's
 *     pinned version_id, we know the slot is stale.
 *
 *   - `slot_source` — a 3-valued enum:
 *     - 'OWNED'  — caller created this entity AND it's not a fork. The
 *                  slot tracks the same identity as the entity row.
 *     - 'FORKED' — the entity is a fork (caller created it as a fork of
 *                  someone else's entity). The slot tracks the fork.
 *     - 'PINNED' — the entity belongs to someone else (system or another
 *                  user). The slot is a snapshot of a specific version
 *                  and won't auto-update on save.
 *
 * Why this lives here: the character create / patch / clone routes all
 * need these two values. Centralising them keeps the slot-source rules
 * consistent across the 3 endpoints.
 *
 * Fallback behavior:
 *   - If the entity has no version row yet (e.g. just-created system
 *     content that hasn't been touched by a save), resolveLatestVersionId
 *     returns null. The route should still insert the slot; version_id
 *     will be NULL, isStale is `false` (no version to compare against).
 *   - If entity.userId is null (system content), slot_source is 'PINNED'.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilityVersions,
  effectVersions,
  itemVersions,
  primitiveVersions,
  templateVersions,
} from "@/db/schema";
import type { SlotSource } from "@/db/schema/characters";

export type { SlotSource };

export type VersionedEntityKind =
  | "primitive"
  | "effect"
  | "capability"
  | "item"
  | "template";

/**
 * Resolve the latest version id of an entity. Returns null if the entity
 * has no version row yet (e.g. just-seeded system content).
 *
 * For primitives, entityId is a number. For all other kinds, it's a uuid
 * string. The version-table foreign-key column types are matched to that.
 */
export async function resolveLatestVersionId(
  kind: VersionedEntityKind,
  entityId: string | number,
): Promise<string | null> {
  // Dispatch on the version table directly. Each one is simple enough that
  // a per-kind branch is clearer than a generic table-ref.
  if (kind === "primitive") {
    const rows = await db
      .select({ id: primitiveVersions.id })
      .from(primitiveVersions)
      .where(
        and(
          eq(primitiveVersions.primitiveId, Number(entityId)),
          eq(primitiveVersions.isLatest, true),
        ),
      )
      .orderBy(desc(primitiveVersions.versionNumber))
      .limit(1);
    return rows[0]?.id ?? null;
  }
  if (kind === "effect") {
    const rows = (await db
      .select({ id: effectVersions.id })
      .from(effectVersions)
      .where(
        and(
          eq(effectVersions.effectId, String(entityId)),
          eq(effectVersions.isLatest, true),
        ),
      )
      .orderBy(desc(effectVersions.versionNumber))
      .limit(1)) as unknown as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }
  if (kind === "capability") {
    const rows = (await db
      .select({ id: capabilityVersions.id })
      .from(capabilityVersions)
      .where(
        and(
          eq(capabilityVersions.capabilityId, String(entityId)),
          eq(capabilityVersions.isLatest, true),
        ),
      )
      .orderBy(desc(capabilityVersions.versionNumber))
      .limit(1)) as unknown as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }
  if (kind === "item") {
    const rows = (await db
      .select({ id: itemVersions.id })
      .from(itemVersions)
      .where(
        and(
          eq(itemVersions.itemId, String(entityId)),
          eq(itemVersions.isLatest, true),
        ),
      )
      .orderBy(desc(itemVersions.versionNumber))
      .limit(1)) as unknown as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }
  if (kind === "template") {
    const rows = (await db
      .select({ id: templateVersions.id })
      .from(templateVersions)
      .where(
        and(
          eq(templateVersions.templateId, String(entityId)),
          eq(templateVersions.isLatest, true),
        ),
      )
      .orderBy(desc(templateVersions.versionNumber))
      .limit(1)) as unknown as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }
  return null;
}

/**
 * Decide the slot_source for a given entity when added to a character.
 *
 * Rules:
 *   - If the entity has no userId (system content) → 'PINNED' (the
 *     slot is a snapshot; no shared identity with any user).
 *   - If the entity's userId matches callerUserId AND its sourceOrigin
 *     is not a fork marker → 'OWNED'.
 *   - If the entity's userId matches callerUserId AND its sourceOrigin
 *     IS a fork marker (starts with "fork:") → 'FORKED'.
 *   - Otherwise (caller is using someone else's entity) → 'PINNED'.
 *
 * Note: "fork marker" means the sourceOrigin starts with "fork:". This
 * matches the convention from src/lib/publishing/dispatch-save.ts where
 * forked rows get `sourceOrigin = "fork:<sourceId>"`.
 */
export function resolveSlotSource(args: {
  /** The entity row being slotted. */
  entity: {
    userId: string | null;
    sourceOrigin: string | null;
  };
  /** Clerk userId of the character owner (the one adding the slot). */
  callerUserId: string;
}): SlotSource {
  const { entity, callerUserId } = args;
  if (entity.userId === null) return "PINNED";
  if (entity.userId !== callerUserId) return "PINNED";
  // Caller owns this entity.
  if (entity.sourceOrigin?.startsWith("fork:")) return "FORKED";
  return "OWNED";
}
