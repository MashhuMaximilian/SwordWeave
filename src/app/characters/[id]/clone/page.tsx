import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterCapabilities,
  characterItems,
  characterPrimitives,
  characters,
} from "@/db/schema";

/**
 * /characters/[id]/clone — server-side deep clone of the character,
 * then redirects to the new character's sheet.
 */
export default async function CloneCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const source = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    with: {
      primitiveLinks: true,
      capabilityLinks: true,
      itemLinks: true,
    },
  });

  if (!source) redirect("/characters");

  const newId = await db
    .transaction(async (tx) => {
      const newName = source.name.match(/\(Copy(?:\s\d+)?\)$/)
        ? `${source.name.replace(/\(Copy(?:\s\d+)?\)$/, "").trim()} (Copy 2)`
        : `${source.name} (Copy)`;

      const [created] = await tx
        .insert(characters)
        .values({
          userId: source.userId,
          name: newName,
          size: source.size,
          raceName: source.raceName,
          raceImageUrl: source.raceImageUrl,
          raceDescription: source.raceDescription,
          backgroundName: source.backgroundName,
          backgroundImageUrl: source.backgroundImageUrl,
          backgroundDescription: source.backgroundDescription,
          archetypeName: source.archetypeName,
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
          dmNotes: null,
          portraitUrl: source.portraitUrl,
          isPublic: false,
          sourceOrigin: `clone:${source.id}`,
        })
        .returning();
      if (!created) throw new Error("Clone failed");

      if (source.primitiveLinks.length > 0) {
        await tx.insert(characterPrimitives).values(
          source.primitiveLinks.map((p) => ({
            characterId: created.id,
            primitiveId: p.primitiveId,
            source: p.source,
            acquiredAtLevel: p.acquiredAtLevel,
            notes: p.notes,
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
          })),
        );
      }
      return created.id;
    })
    .catch((err) => {
      console.error("Clone error:", err);
      return null;
    });

  redirect(newId ? `/characters/${newId}` : "/characters");
}