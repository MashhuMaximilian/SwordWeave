import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterCapabilities,
  characterHeritages,
  characterItems,
  characterPrimitives,
  characters,
} from "@/db/schema";

/** Copy the character's build while keeping shared library entities as references. */
export async function cloneCharacter(sourceId: string, userId: string) {
  const source = await db.query.characters.findFirst({
    where: eq(characters.id, sourceId),
    with: {
      primitiveLinks: true,
      capabilityLinks: true,
      heritageLinks: true,
      itemLinks: true,
    },
  });
  if (!source) return null;

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(characters).values({
      userId,
      name: uniqueCloneName(source.name),
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
      dmNotes: null,
      portraitUrl: source.portraitUrl,
      portraitFrame: source.portraitFrame,
      isPublic: false,
      sourceOrigin: `clone:${source.id}`,
      backstory: source.backstory as object,
      mode: source.mode,
    }).returning();
    if (!created) throw new Error("Unable to clone character.");

    if (source.primitiveLinks.length > 0) {
      await tx.insert(characterPrimitives).values(source.primitiveLinks.map((p) => ({
        characterId: created.id,
        primitiveId: p.primitiveId,
        source: p.source,
        directSource: p.directSource,
        acquiredAtLevel: p.acquiredAtLevel,
        isMirrored: p.isMirrored,
        versionId: p.versionId,
        slotSource: p.slotSource,
        originHeritageId: p.originHeritageId,
        originCapabilityId: p.originCapabilityId,
        originEffectId: p.originEffectId,
        originItemId: p.originItemId,
        notes: p.notes,
      })));
    }
    if (source.capabilityLinks.length > 0) {
      await tx.insert(characterCapabilities).values(source.capabilityLinks.map((c) => ({
        characterId: created.id,
        capabilityId: c.capabilityId,
        acquiredAtLevel: c.acquiredAtLevel,
        versionId: c.versionId,
        slotSource: c.slotSource,
        originHeritageId: c.originHeritageId,
        slotTab: c.slotTab,
        notes: c.notes,
      })));
    }
    if (source.heritageLinks.length > 0) {
      await tx.insert(characterHeritages).values(source.heritageLinks.map((h) => ({
        characterId: created.id,
        heritageId: h.heritageId,
        acquiredAtLevel: h.acquiredAtLevel,
        isMirrored: h.isMirrored,
        versionId: h.versionId,
        slotSource: h.slotSource,
        notes: h.notes,
      })));
    }
    if (source.itemLinks.length > 0) {
      await tx.insert(characterItems).values(source.itemLinks.map((i) => ({
        characterId: created.id,
        itemId: i.itemId,
        quantity: i.quantity,
        equipped: i.equipped,
        versionId: i.versionId,
        slotSource: i.slotSource,
      })));
    }

    return tx.query.characters.findFirst({
      where: eq(characters.id, created.id),
      with: {
        primitiveLinks: { with: { primitive: true } },
        capabilityLinks: { with: { capability: true } },
        heritageLinks: { with: { heritage: true } },
        itemLinks: { with: { item: true } },
      },
    });
  });
}

function uniqueCloneName(original: string): string {
  if (original.match(/\(Copy(?:\s\d+)?\)$/)) {
    const base = original.replace(/\(Copy(?:\s\d+)?\)$/, "").trim();
    return `${base} (Copy 2)`;
  }
  return `${original} (Copy)`;
}
