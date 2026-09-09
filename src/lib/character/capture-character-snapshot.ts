// =============================================================================
// capture-character-snapshot — PLAN Eilxina Part E (Mashu 2026-09-09).
//
// Reads the current character row + every junction slot row, builds
// the canonical payload, computes the content hash, and calls
// recordVersion to persist a characterVersions row.
//
// Trigger policy (from swordweave-versioning §"characterVersions writer
// gap"): call on SIGNIFICANT edits only:
//
//   - Level change
//   - Attribute change (PHYSICAL/MENTAL/MAGICAL or attr_proficient)
//   - Primitive slot add/remove/mirror
//   - Capability attach/detach
//   - Item equip/unequip/quantity change
//   - Heritage attach/detach
//   - Mode change (BUILD↔PLAY) — debatable; included because it
//     marks an editorial boundary the user might want to roll back
//
// DO NOT call on:
//   - Vitality tick (current_vitality) — would drown the table
//   - Notes / DM notes edits — not mechanically meaningful
//   - bu_spent recompute — derived, not an edit
//
// Why a separate module: the snapshot logic touches 5 tables (characters
// + 4 junction tables). Inlining this into every save route would
// duplicate the work and drift over time. Centralizing here keeps the
// trigger policy in one place too — see `SIGNIFICANT_EDIT_ROUTES` in
// the wiring file (src/lib/character/with-character-snapshot.ts).
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterPrimitives,
  characterCapabilities,
  characterItems,
  characterHeritages,
} from "@/db/schema";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import {
  buildCanonicalCharacterPayload,
  computeCharacterContentHash,
  type CanonicalCharacterPayload,
  type CanonicalPrimitiveSlotPayload,
  type CanonicalCapabilitySlotPayload,
  type CanonicalItemSlotPayload,
  type CanonicalHeritageSlotPayload,
} from "@/lib/publishing/hash-content";

export interface CaptureSnapshotArgs {
  characterId: string;
  /** Clerk user id of who triggered the edit. null = system. */
  publishedByUserId?: string | null;
}

export interface CaptureSnapshotResult {
  versionId: string;
  versionNumber: number;
  /** Hash of the snapshot we just persisted. Used by callers that
   *  want to deduplicate (e.g. "don't snapshot twice for the same
   *  edit"). */
  contentHash: string;
}

/**
 * Read the character's full current state from the DB, hash it,
 * and persist a characterVersions row. Returns the new versionId
 * + the hash.
 *
 * Idempotent: re-calling with the same content yields the same
 * versionId (the recordVersion path handles the PK-collision
 * trap from auto-snapshot.ts Phase 8.I i2.5e).
 */
export async function captureCharacterSnapshot(
  args: CaptureSnapshotArgs,
): Promise<CaptureSnapshotResult> {
  const characterId = args.characterId;

  // 1. Load the character row.
  const charRows = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  const char = charRows[0];
  if (!char) {
    throw new Error(
      `captureCharacterSnapshot: character ${characterId} not found`,
    );
  }

  // 2. Load all four junction tables in parallel.
  const [primRows, capRows, itemRows, heritageRows] = await Promise.all([
    db
      .select({
        instanceId: characterPrimitives.instanceId,
        primitiveId: characterPrimitives.primitiveId,
        source: characterPrimitives.source,
        acquiredAtLevel: characterPrimitives.acquiredAtLevel,
        isMirrored: characterPrimitives.isMirrored,
        versionId: characterPrimitives.versionId,
        slotSource: characterPrimitives.slotSource,
      })
      .from(characterPrimitives)
      .where(eq(characterPrimitives.characterId, characterId)),
    db
      .select({
        capabilityId: characterCapabilities.capabilityId,
        versionId: characterCapabilities.versionId,
        slotSource: characterCapabilities.slotSource,
      })
      .from(characterCapabilities)
      .where(eq(characterCapabilities.characterId, characterId)),
    db
      .select({
        itemId: characterItems.itemId,
        versionId: characterItems.versionId,
        slotSource: characterItems.slotSource,
        equipped: characterItems.equipped,
        quantity: characterItems.quantity,
      })
      .from(characterItems)
      .where(eq(characterItems.characterId, characterId)),
    db
      .select({
        heritageId: characterHeritages.heritageId,
        versionId: characterHeritages.versionId,
        slotSource: characterHeritages.slotSource,
      })
      .from(characterHeritages)
      .where(eq(characterHeritages.characterId, characterId)),
  ]);

  // 3. Build the canonical payload. The hash-builder sorts the
  // junction arrays internally for stability, but we cast here so
  // TypeScript knows the field names.
  const primitiveSlots: CanonicalPrimitiveSlotPayload[] = primRows.map((r) => ({
    instanceId: r.instanceId,
    primitiveId: r.primitiveId,
    source: r.source,
    acquiredAtLevel: r.acquiredAtLevel,
    isMirrored: r.isMirrored,
    versionId: r.versionId ?? null,
    slotSource: r.slotSource,
  }));
  const capabilitySlots: CanonicalCapabilitySlotPayload[] = capRows.map(
    (r) => ({
      capabilityId: r.capabilityId,
      versionId: r.versionId ?? null,
      slotSource: r.slotSource,
    }),
  );
  const itemSlots: CanonicalItemSlotPayload[] = itemRows.map((r) => ({
    itemId: r.itemId,
    versionId: r.versionId ?? null,
    slotSource: r.slotSource,
    equipped: r.equipped,
    quantity: r.quantity,
  }));
  const heritageSlots: CanonicalHeritageSlotPayload[] = heritageRows.map(
    (r) => ({
      heritageId: r.heritageId,
      versionId: r.versionId ?? null,
      slotSource: r.slotSource,
    }),
  );

  const payload: CanonicalCharacterPayload = buildCanonicalCharacterPayload({
    level: char.level,
    attrPhysical: char.attrPhysical,
    attrMental: char.attrMental,
    attrMagical: char.attrMagical,
    attrProficient: char.attrProficient,
    currentVitality: char.currentVitality ?? null,
    backstory:
      (char.backstory as Record<string, unknown> | null | undefined) ?? {},
    dmBonusBu: char.dmBonusBu,
    mode: char.mode,
    primitiveSlots,
    capabilitySlots,
    itemSlots,
    heritageSlots,
  });

  const contentHash = await computeCharacterContentHash({
    level: payload.level,
    attrPhysical: payload.attrPhysical,
    attrMental: payload.attrMental,
    attrMagical: payload.attrMagical,
    attrProficient: payload.attrProficient,
    currentVitality: payload.currentVitality,
    backstory: payload.backstory,
    dmBonusBu: payload.dmBonusBu,
    mode: payload.mode,
    primitiveSlots: payload.primitiveSlots,
    capabilitySlots: payload.capabilitySlots,
    itemSlots: payload.itemSlots,
    heritageSlots: payload.heritageSlots,
  });

  const result = await recordVersion({
    entityKind: "character",
    entityId: characterId,
    contentHash,
    snapshot: payload as unknown as Record<string, unknown>,
    publishedByUserId: args.publishedByUserId ?? null,
  });

  return {
    versionId: result.versionId,
    versionNumber: result.versionNumber,
    contentHash,
  };
}
