import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterCapabilities,
  characterItems,
  characterPrimitives,
  characters,
} from "@/db/schema";

/**
 * POST /api/characters/[id]/clone
 *
 * Deep-copies a character. Caller becomes owner. Original character left untouched.
 * Note: linked primitives/capabilities/items are NOT re-cloned — they remain shared refs.
 * The character level snapshot is preserved.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    const source = await db.query.characters.findFirst({
      where: eq(characters.id, id),
      with: {
        primitiveLinks: true,
        capabilityLinks: true,
        itemLinks: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const newName = uniqueCloneName(source.name);

      const [created] = await tx
        .insert(characters)
        .values({
          userId,
          name: newName,
          size: source.size,
          lineageName: source.lineageName,
          lineageImageUrl: source.lineageImageUrl,
          lineageDescription: source.lineageDescription,
          upbringingName: source.upbringingName,
          upbringingImageUrl: source.upbringingImageUrl,
          upbringingDescription: source.upbringingDescription,
          manifestName: source.manifestName,
          level: source.level,
          attrPhysical: source.attrPhysical,
          attrMental: source.attrMental,
          attrMagical: source.attrMagical,
          attrProficient: source.attrProficient,
          practiceSlices: source.practiceSlices as object,
          currentVitality: source.currentVitality,
          startingBu: source.startingBu,
          buSpent: source.buSpent,
          dmBonusBu: source.dmBonusBu,
          enforceTemplateCaps: source.enforceTemplateCaps,
          isMirrored: source.isMirrored,
          notes: source.notes,
          dmNotes: null, // DM notes never carry over
          portraitUrl: source.portraitUrl,
          isPublic: false,
          sourceOrigin: `clone:${source.id}`,
        })
        .returning();

      if (!created) throw new Error("Unable to clone character.");

      if (source.primitiveLinks.length > 0) {
        await tx.insert(characterPrimitives).values(
          source.primitiveLinks.map((p) => ({
            characterId: created.id,
            primitiveId: p.primitiveId,
            source: p.source,
            acquiredAtLevel: p.acquiredAtLevel,
            notes: p.notes,
            // Phase 5: copy the version pin + slot_source from the source
            // link so the clone tracks the same content the source did.
            versionId: p.versionId,
            slotSource: p.slotSource,
          })),
        );
      }
      if (source.capabilityLinks.length > 0) {
        await tx.insert(characterCapabilities).values(
          source.capabilityLinks.map((c) => ({
            characterId: created.id,
            capabilityId: c.capabilityId,
            acquiredAtLevel: c.acquiredAtLevel,
            notes: c.notes,
            // Phase 5: copy the version pin + slot_source.
            versionId: c.versionId,
            slotSource: c.slotSource,
          })),
        );
      }
      if (source.itemLinks.length > 0) {
        await tx.insert(characterItems).values(
          source.itemLinks.map((i) => ({
            characterId: created.id,
            itemId: i.itemId,
            quantity: i.quantity,
            equipped: i.equipped,
            // Phase 5: copy the version pin + slot_source.
            versionId: i.versionId,
            slotSource: i.slotSource,
          })),
        );
      }

      return tx.query.characters.findFirst({
        where: eq(characters.id, created.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          itemLinks: { with: { item: true } },
        },
      });
    });

    return NextResponse.json({ character: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function uniqueCloneName(original: string): string {
  if (original.match(/\(Copy(?:\s\d+)?\)$/)) {
    const base = original.replace(/\(Copy(?:\s\d+)?\)$/, "").trim();
    return `${base} (Copy 2)`;
  }
  return `${original} (Copy)`;
}