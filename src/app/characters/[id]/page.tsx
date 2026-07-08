import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { CharacterSheetView } from "@/components/characters/character-sheet-view";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { aggregateCharacterSheet } from "@/lib/engine";
import {
  bulkResolveLatestVersions,
  makeKey,
  type VersionKey,
} from "@/lib/versions/bulk-resolve-latest-versions";

export const dynamic = "force-dynamic";

export default async function CharacterSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { userId } = await auth();

  const row = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
    },
  });

  if (!row) notFound();

  // Ownership: redirect to list if not owner
  if (userId && row.userId !== userId) {
    redirect("/characters");
  }

  // Phase 5 (T5.C.2): compute the latest version id for every linked
  // entity so the sheet can render "stale" badges. One bulk query per
  // entity kind, returns a Map keyed by `${kind}:${id}`.
  const entityPairs = [
    ...row.primitiveLinks.map((l) => ({ kind: "primitive" as const, id: l.primitiveId })),
    ...row.capabilityLinks.map((l) => ({ kind: "capability" as const, id: l.capabilityId })),
    ...row.itemLinks.map((l) => ({ kind: "item" as const, id: l.itemId })),
  ];
  const latestVersions = await bulkResolveLatestVersions(entityPairs);

  const sheet = aggregateCharacterSheet({
    level: row.level,
    attrPhysical: row.attrPhysical,
    attrMental: row.attrMental,
    attrMagical: row.attrMagical,
    attrProficient: row.attrProficient,
    practiceSlices:
      (row.practiceSlices as Record<string, number> | null) ?? null,
    startingBu: row.startingBu,
    buSpent: row.buSpent,
    dmBonusBu: row.dmBonusBu,
    currentVitality: row.currentVitality,
    size: row.size,
    primitiveLinks: row.primitiveLinks.map((l) => ({
      primitiveId: l.primitive.id,
      source: l.source,
      acquiredAtLevel: l.acquiredAtLevel,
      isMirrored: l.isMirrored ?? false,
      // Phase 5: surface slot metadata to the view.
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: latestVersions.get(makeKey("primitive", l.primitiveId)) ?? null,
      primitive: {
        id: l.primitive.id,
        name: l.primitive.name,
        category: l.primitive.category,
        buCost: l.primitive.buCost,
        isMirrorable: l.primitive.isMirrorable,
        mirrorBuCredit: l.primitive.mirrorBuCredit,
        narrativeRule: l.primitive.narrativeRule ?? "",
      },
    })),
    capabilityLinks: row.capabilityLinks.map((l) => ({
      capabilityId: l.capabilityId,
      acquiredAtLevel: l.acquiredAtLevel,
      // Phase 5: surface slot metadata to the view.
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: latestVersions.get(makeKey("capability", l.capabilityId)) ?? null,
      capability: {
        id: l.capability.id,
        name: l.capability.name,
        type: l.capability.type,
        sourceType: l.capability.sourceType,
        verboseDescription: l.capability.verboseDescription,
      },
    })),
    itemLinks: row.itemLinks.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      equipped: l.equipped,
      // Phase 5: surface slot metadata to the view.
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: latestVersions.get(makeKey("item", l.itemId)) ?? null,
      item: {
        id: l.item.id,
        name: l.item.name,
        itemType: l.item.itemType,
        rarity: l.item.rarity,
        description: l.item.description,
        buCost: l.item.buCost,
        slotCost: l.item.slotCost,
        isTwoHanded: l.item.isTwoHanded,
        isConsumable: l.item.isConsumable,
      },
    })),
  });

  return (
    <CharacterSheetView
      id={row.id}
      name={row.name}
      level={row.level}
      size={row.size}
      portraitUrl={row.portraitUrl}
      notes={row.notes}
      dmNotes={row.dmNotes}
      raceName={row.raceName}
      raceDescription={row.raceDescription}
      backgroundName={row.backgroundName}
      backgroundDescription={row.backgroundDescription}
      archetypeName={row.archetypeName}
      attrPhysical={row.attrPhysical}
      attrMental={row.attrMental}
      attrMagical={row.attrMagical}
      attrProficient={row.attrProficient}
      startingBu={row.startingBu}
      buSpent={row.buSpent}
      dmBonusBu={row.dmBonusBu}
      currentVitality={row.currentVitality}
      enforceTemplateCaps={row.enforceTemplateCaps}
      volatility={sheet.volatility}
      practices={sheet.practices.map((p) => {
        const attr = sheet.practiceAttributeMap.PHYSICAL.includes(p.practice as never)
          ? "PHYSICAL"
          : sheet.practiceAttributeMap.MENTAL.includes(p.practice as never)
            ? "MENTAL"
            : "MAGICAL";
        return {
          practice: p.practice,
          attribute: attr,
          total: p.total,
          slice: p.slice,
          pbContribution: p.pbContribution,
          primitiveContributions: p.primitiveContributions.map((pc) => ({
            primitiveId: pc.primitiveId,
            primitiveName: pc.primitiveName,
            bonus: pc.bonus,
          })),
        };
      })}
      defensiveDCs={sheet.defensiveDCs.map((d) => ({
        attribute: d.attribute,
        dc: d.dc,
      }))}
      vitality={sheet.vitality}
      encumbrance={sheet.encumbrance}
      buBalance={sheet.buBalance}
      primitiveLinks={row.primitiveLinks.map((l) => ({
        primitiveId: l.primitiveId,
        source: l.source,
        acquiredAtLevel: l.acquiredAtLevel,
        isMirrored: l.isMirrored ?? false,
        // Phase 5: surface slot metadata to the view.
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: latestVersions.get(makeKey("primitive", l.primitiveId)) ?? null,
        primitive: {
          id: l.primitive.id,
          name: l.primitive.name,
          category: l.primitive.category,
          buCost: l.primitive.buCost,
          isMirrorable: l.primitive.isMirrorable,
          mirrorBuCredit: l.primitive.mirrorBuCredit,
          narrativeRule: l.primitive.narrativeRule ?? "",
        },
      }))}
      capabilityLinks={row.capabilityLinks.map((l) => ({
        capabilityId: l.capabilityId,
        acquiredAtLevel: l.acquiredAtLevel,
        // Phase 5: surface slot metadata to the view.
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: latestVersions.get(makeKey("capability", l.capabilityId)) ?? null,
        capability: {
          id: l.capability.id,
          name: l.capability.name,
          type: l.capability.type,
          sourceType: l.capability.sourceType,
          verboseDescription: l.capability.verboseDescription,
        },
      }))}
      itemLinks={row.itemLinks.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        equipped: l.equipped,
        // Phase 5: surface slot metadata to the view.
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: latestVersions.get(makeKey("item", l.itemId)) ?? null,
        item: {
          id: l.item.id,
          name: l.item.name,
          itemType: l.item.itemType,
          rarity: l.item.rarity,
          description: l.item.description,
          buCost: l.item.buCost,
          slotCost: l.item.slotCost,
          isTwoHanded: l.item.isTwoHanded,
          isConsumable: l.item.isConsumable,
        },
      }))}
      initialEditMode={sp.edit === "1"}
    />
  );
}