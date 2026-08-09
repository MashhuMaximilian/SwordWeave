import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { characters, characters as ch } from "@/db/schema";
import { eq } from "drizzle-orm";
import { aggregateCharacterSheet } from "@/lib/engine";
import { proficiencyBonus } from "@/lib/engine/practices";
import type { ConditionContext } from "@/lib/engine/condition-evaluator";
import { bulkResolveLatestVersions, makeKey } from "@/lib/versions/bulk-resolve-latest-versions";
import { parseBackstory } from "@/lib/character/character-backstory";
import { enrichItemLinksWithNestedBundle } from "@/lib/api/enrich-item-links";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "462f9048-b0da-4185-98db-d18027132c82";
  
  try {
    const row = await db.query.characters.findFirst({
      where: eq(ch.id, id),
      with: {
        primitiveLinks: { with: { primitive: true } },
        capabilityLinks: { with: { capability: true } },
        itemLinks: { with: { item: true } },
        heritageLinks: { with: { heritage: true } },
        logEntries: { orderBy: (l, { desc }) => [desc(l.createdAt)], limit: 500 },
      },
    });

    if (!row) return NextResponse.json({ error: "Not found" });
    
    // Build sheetInput exactly like page.tsx
    const primitiveLinks = row.primitiveLinks.map((l: any) => ({
      primitive: { 
        id: l.primitive.id,
        name: l.primitive.name,
        category: l.primitive.category,
        buCost: l.primitive.buCost,
        isMirrorable: l.primitive.isMirrorable,
        mirrorBuCredit: l.primitive.mirrorBuCredit,
        narrativeRule: l.primitive.narrativeRule ?? "",
        mirrorVector: l.primitive.mirrorVector,
        hardModifiers: l.primitive.hardModifiers ?? [],
      },
      isMirrored: l.isMirrored ?? false,
      source: l.source,
      isToggledOff: (l as any).isToggledOff ?? false,
      primitiveId: l.primitiveId,
      acquiredAtLevel: l.acquiredAtLevel,
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: l.latestVersionId,
      originHeritageId: l.originHeritageId ?? null,
      originCapabilityId: l.originCapabilityId ?? null,
      originEffectId: l.originEffectId ?? null,
    }));

    const sheetInput = {
      characterId: row.id,
      attrPhysical: row.attrPhysical ?? 0,
      attrMental: row.attrMental ?? 0,
      attrMagical: row.attrMagical ?? 0,
      level: row.level ?? 1,
      proficiencyBonus: proficiencyBonus(row.level ?? 1),
      attrProficient: row.attrProficient ?? "PHYSICAL",
      startingBu: row.startingBu,
      buSpent: row.buSpent,
      dmBonusBu: row.dmBonusBu ?? 0,
      primitiveLinks,
      primitiveIds: row.primitiveLinks.map((l: any) => l.primitiveId),
      practices: [],
      behaviors: [],
      actionSlots: [],
    };
    
    const sheet = aggregateCharacterSheet(sheetInput as any);
    return NextResponse.json({ ok: true, totals: Object.fromEntries(Object.entries(sheet.totals).map(([k,v]) => [k, v])) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
