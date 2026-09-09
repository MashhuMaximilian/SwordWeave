// =============================================================================
// POST /api/characters/[id]/versions/[versionNumber]/restore
//
// PLAN Eilxina Part E (Mashu 2026-09-09).
//
// Restore a character to a previous version. The character is the
// widest entity in the system — its snapshot captures the row +
// every junction slot + their version pins. So unlike the generic
// /api/versions/restore (which only updates entity scalars and
// returns a "slot links not restored" warning), THIS route
// atomically reconstructs the entire character from the snapshot.
//
// Atomicity:
//   - Single Drizzle transaction wraps all writes.
//   - Either every junction table updates or none do.
//   - If a referenced version pin no longer exists (entity version
//     was deleted), we null-out the pin — the slot stays on the
//     entity, just loses the version reference. This matches the
//     restore recipe in swordweave-versioning §"characterVersions
//     writer gap".
//
// Pending proposals: per the open-question in PLAN Eilxina §6
// (Mashu 2026-09-09 lock), restore marks any PENDING proposal as
// SUPERSEDED (not auto-rejected) so the audit trail is preserved.
//
// Body: none (version is in URL).
// Response: 200 { restoredFromVersion, currentVersionNumber, warnings: string[] }
//
// Auth: OWNER only (per canResolveCharacter).
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  characters,
  characterPrimitives,
  characterCapabilities,
  characterItems,
  characterHeritages,
  characterProposals,
  characterVersions,
  primitiveVersions,
  capabilityVersions,
  itemVersions,
} from "@/db/schema";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import { computeCharacterContentHash } from "@/lib/publishing/hash-content";
import type {
  CanonicalCharacterPayload,
  CanonicalPrimitiveSlotPayload,
  CanonicalCapabilitySlotPayload,
  CanonicalItemSlotPayload,
  CanonicalHeritageSlotPayload,
} from "@/lib/publishing/hash-content";

const ParamsSchema = z.object({
  versionNumber: z.coerce.number().int().positive(),
});

interface RestoreResult {
  restoredFromVersion: number;
  currentVersionNumber: number;
  warnings: string[];
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionNumber: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth.protect();
    const { id: characterId, versionNumber: versionNumberRaw } = await params;
    const parsedParams = ParamsSchema.safeParse({
      versionNumber: versionNumberRaw,
    });
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid versionNumber." },
        { status: 400 },
      );
    }
    const targetVersionNumber = parsedParams.data.versionNumber;
    await resolveCharacterAccess(clerkUserId, characterId, {
      require: "OWNER",
    });

    // 1. Load the target version row.
    const versionRows = await db
      .select({
        id: characterVersions.id,
        snapshot: characterVersions.snapshot,
      })
      .from(characterVersions)
      .where(
        and(
          eq(characterVersions.characterId, characterId),
          eq(characterVersions.versionNumber, targetVersionNumber),
        ),
      )
      .limit(1);
    if (versionRows.length === 0) {
      return NextResponse.json(
        { error: `Version ${targetVersionNumber} not found.` },
        { status: 404 },
      );
    }
    const snapshot = versionRows[0]!.snapshot as unknown as CanonicalCharacterPayload;

    const warnings: string[] = [];

    // 2. Validate version pins in parallel — one query per kind,
    //    then null-out pins whose target row doesn't exist anymore.
    const validatedPrims = await validatePrimitives(
      snapshot.primitiveSlots,
      warnings,
    );
    const validatedCaps = await validateCapabilities(
      snapshot.capabilitySlots,
      warnings,
    );
    const validatedItems = await validateItems(snapshot.itemSlots, warnings);
    // Heritage doesn't have a version table we can validate against
    // (heritage is slotted by ID, not by version), so we keep pins as-is.
    const validatedHeritages = snapshot.heritageSlots;

    // 3. Atomic restore — single transaction.
    const newVersion = await db.transaction(async (tx) => {
      // 3a. Character row scalars.
      await tx
        .update(characters)
        .set({
          level: snapshot.level,
          attrPhysical: snapshot.attrPhysical,
          attrMental: snapshot.attrMental,
          attrMagical: snapshot.attrMagical,
          attrProficient: snapshot.attrProficient as never,
          currentVitality: snapshot.currentVitality,
          backstory: snapshot.backstory,
          dmBonusBu: snapshot.dmBonusBu,
          mode: snapshot.mode,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId));

      // 3b. Junction tables — DELETE + INSERT (derived state, no
      //     audit trail lost; simpler than diff-and-patch).
      await tx
        .delete(characterPrimitives)
        .where(eq(characterPrimitives.characterId, characterId));
      if (validatedPrims.length > 0) {
        await tx.insert(characterPrimitives).values(
          validatedPrims.map((s) => ({
            instanceId: s.instanceId,
            characterId,
            primitiveId: s.primitiveId,
            source: s.source as never, // enum cast at insert boundary
            acquiredAtLevel: s.acquiredAtLevel,
            isMirrored: s.isMirrored,
            versionId: s.versionId,
            slotSource: s.slotSource as never,
          })),
        );
      }

      await tx
        .delete(characterCapabilities)
        .where(eq(characterCapabilities.characterId, characterId));
      if (validatedCaps.length > 0) {
        await tx.insert(characterCapabilities).values(
          validatedCaps.map((s) => ({
            characterId,
            capabilityId: s.capabilityId,
            versionId: s.versionId,
            slotSource: s.slotSource as never,
          })),
        );
      }

      await tx
        .delete(characterItems)
        .where(eq(characterItems.characterId, characterId));
      if (validatedItems.length > 0) {
        await tx.insert(characterItems).values(
          validatedItems.map((s) => ({
            characterId,
            itemId: s.itemId,
            quantity: s.quantity,
            equipped: s.equipped,
            versionId: s.versionId,
            slotSource: s.slotSource as never,
          })),
        );
      }

      await tx
        .delete(characterHeritages)
        .where(eq(characterHeritages.characterId, characterId));
      if (validatedHeritages.length > 0) {
        await tx.insert(characterHeritages).values(
          validatedHeritages.map((s) => ({
            characterId,
            heritageId: s.heritageId,
            versionId: s.versionId,
            slotSource: s.slotSource as never,
          })),
        );
      }

      // 3c. Mark pending proposals SUPERSEDED (preserve audit, no
      //     auto-reject — per the Mashu 2026-09-09 lock).
      await tx
        .update(characterProposals)
        .set({
          status: "SUPERSEDED",
          reviewerUserId: clerkUserId,
          reviewerNote: `Superseded by restore to version ${targetVersionNumber}.`,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(characterProposals.characterId, characterId),
            eq(characterProposals.status, "PENDING"),
          ),
        );

      // 3d. Compute hash of restored state and persist a new
      //     version row representing the restore event.
      const newHash = await computeCharacterContentHash({
        level: snapshot.level,
        attrPhysical: snapshot.attrPhysical,
        attrMental: snapshot.attrMental,
        attrMagical: snapshot.attrMagical,
        attrProficient: snapshot.attrProficient,
        currentVitality: snapshot.currentVitality,
        backstory: snapshot.backstory,
        dmBonusBu: snapshot.dmBonusBu,
        mode: snapshot.mode,
        primitiveSlots: validatedPrims,
        capabilitySlots: validatedCaps,
        itemSlots: validatedItems,
        heritageSlots: validatedHeritages,
      });
      return recordVersion({
        entityKind: "character",
        entityId: characterId,
        contentHash: newHash,
        snapshot: snapshot as unknown as Record<string, unknown>,
        publishedByUserId: clerkUserId,
      });
    });

    const out: RestoreResult = {
      restoredFromVersion: targetVersionNumber,
      currentVersionNumber: newVersion.versionNumber,
      warnings,
    };
    return NextResponse.json(out, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error(
      "[POST /api/characters/[id]/versions/[versionNumber]/restore] unexpected:",
      e,
    );
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

// =============================================================================
// Validate that every version pin still points at a real version row.
// If any are stale, null them out and add a warning. Pure (modulo DB
// reads) — no DB writes here.
// =============================================================================

async function collectValidVersionIds(
  table: typeof primitiveVersions | typeof capabilityVersions | typeof itemVersions,
  pinnedIds: readonly string[],
): Promise<Set<string>> {
  if (pinnedIds.length === 0) return new Set();
  // Different version tables have different id columns (uuid in all
  // three for our case, but TS can't prove that generically). Cast
  // for the where-clause.
  const idCol = (table as unknown as { id: { name: string } }).id;
  const rows = await db
    .select({ id: idCol as never })
    .from(table)
    .where(inArray(idCol as never, [...pinnedIds]));
  return new Set(rows.map((r) => String((r as unknown as { id: unknown }).id)));
}

function nullStalePins<T extends { versionId: string | null }>(
  slots: readonly T[],
  validIds: Set<string>,
): T[] {
  let nulledCount = 0;
  const out = slots.map((s) => {
    if (s.versionId && !validIds.has(s.versionId)) {
      nulledCount++;
      return { ...s, versionId: null };
    }
    return s;
  });
  return nulledCount > 0 ? out : [...slots];
}

async function validatePrimitives(
  slots: readonly CanonicalPrimitiveSlotPayload[],
  warnings: string[],
): Promise<CanonicalPrimitiveSlotPayload[]> {
  const pinnedIds = slots
    .map((s) => s.versionId)
    .filter((v): v is string => v !== null);
  const validIds = await collectValidVersionIds(primitiveVersions, pinnedIds);
  if (validIds.size === pinnedIds.length) return [...slots];
  warnings.push(
    `${pinnedIds.length - validIds.size} primitive version pin(s) no longer exist; nulled.`,
  );
  return nullStalePins(slots, validIds);
}

async function validateCapabilities(
  slots: readonly CanonicalCapabilitySlotPayload[],
  warnings: string[],
): Promise<CanonicalCapabilitySlotPayload[]> {
  const pinnedIds = slots
    .map((s) => s.versionId)
    .filter((v): v is string => v !== null);
  const validIds = await collectValidVersionIds(
    capabilityVersions,
    pinnedIds,
  );
  if (validIds.size === pinnedIds.length) return [...slots];
  warnings.push(
    `${pinnedIds.length - validIds.size} capability version pin(s) no longer exist; nulled.`,
  );
  return nullStalePins(slots, validIds);
}

async function validateItems(
  slots: readonly CanonicalItemSlotPayload[],
  warnings: string[],
): Promise<CanonicalItemSlotPayload[]> {
  const pinnedIds = slots
    .map((s) => s.versionId)
    .filter((v): v is string => v !== null);
  const validIds = await collectValidVersionIds(itemVersions, pinnedIds);
  if (validIds.size === pinnedIds.length) return [...slots];
  warnings.push(
    `${pinnedIds.length - validIds.size} item version pin(s) no longer exist; nulled.`,
  );
  return nullStalePins(slots, validIds);
}

// Suppress unused-export warning by referencing the heritage type.
type _UnusedHeritageTypeRef = CanonicalHeritageSlotPayload;
