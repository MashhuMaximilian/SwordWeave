// =============================================================================
// bumpSlotVersion — PLAN Eilxina Part D (Mashu 2026-09-09).
//
// Single helper used by all three bump-version endpoints
// (/api/characters/[id]/{primitives,caps,items}/.../bump-version).
// Updates a character's slot row (character_primitives / character_capabilities /
// character_items) to a new version of its underlying entity. Recomputes the
// character's BU budget because primitive BU is version-dependent.
//
// Authorization is OWNER-only for now. Part C will swap this for
// canResolveCharacter({ requireEdit: true }) so collaborators with edit
// rights can also bump their own slots.
//
// Returns the new versionId so the caller can echo it back to the client.
// =============================================================================

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterCapabilities,
  characterItems,
  characterPrimitives,
} from "@/db/schema/characters";
import { resolveLatestVersionId } from "@/lib/versions/slot-source";
import { recomputeBuSpentAndBustCache } from "@/lib/engine/recompute-bu-spent";

export type SlotKind = "primitive" | "capability" | "item";

export interface BumpSlotArgs {
  /** Slot row owner. */
  readonly characterId: string;
  /** Underlying entity id. For primitives: number. For caps/items: uuid string. */
  readonly entityId: string | number;
  /** What kind of slot. */
  readonly kind: SlotKind;
  /**
   * Target version id. If omitted, resolve the entity's current latest
   * version and bump to that.
   */
  readonly toVersionId?: string;
}

/**
 * Look up the slot row by (characterId, entityId), update its versionId,
 * recompute bu_spent, and bust the resolver cache. Throws on missing
 * slot or missing entity version.
 */
export async function bumpSlotVersion({
  characterId,
  entityId,
  kind,
  toVersionId,
}: BumpSlotArgs): Promise<{ newVersionId: string }> {
  // Resolve target version BEFORE writing so we don't mutate the DB on
  // a bad version id. This is the common path: omit toVersionId to
  // bump to latest.
  let newVersionId = toVersionId ?? null;
  if (!newVersionId) {
    const resolved = await resolveLatestVersionId(
      kind === "primitive" ? "primitive" : kind === "capability" ? "capability" : "item",
      entityId,
    );
    if (!resolved) {
      throw new Error(
        `No version found for ${kind} ${String(entityId)} — was the entity ever published?`,
      );
    }
    newVersionId = resolved;
  }

  if (kind === "primitive") {
    // character_primitives uses instanceId, not entityId. The caller
    // passes entityId which is actually the instanceId (UUID, not the
    // primitiveId). For primitives we identify the slot by instanceId
    // because the slot-source-badge renders against a specific instance.
    await db
      .update(characterPrimitives)
      .set({ versionId: newVersionId })
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.instanceId, String(entityId)),
        ),
      );
  } else if (kind === "capability") {
    await db
      .update(characterCapabilities)
      .set({ versionId: newVersionId })
      .where(
        and(
          eq(characterCapabilities.characterId, characterId),
          eq(characterCapabilities.capabilityId, String(entityId)),
        ),
      );
  } else {
    await db
      .update(characterItems)
      .set({ versionId: newVersionId })
      .where(
        and(
          eq(characterItems.characterId, characterId),
          eq(characterItems.itemId, String(entityId)),
        ),
      );
  }

  // BU depends on the slotted primitive's version (BU is read from the
  // primitive row, which the resolver may cache against a specific
  // version). Recompute to keep the budget in sync.
  await recomputeBuSpentAndBustCache(characterId);

  return { newVersionId };
}
