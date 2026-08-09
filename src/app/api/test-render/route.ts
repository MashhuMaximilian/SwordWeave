import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { aggregateCharacterSheet } from "@/lib/engine";
import { proficiencyBonus } from "@/lib/engine/practices";
import { bulkResolveLatestVersions, makeKey } from "@/lib/versions/bulk-resolve-latest-versions";
import { parseBackstory } from "@/lib/character/character-backstory";
import { enrichItemLinksWithNestedBundle } from "@/lib/api/enrich-item-links";
import type { ConditionContext } from "@/lib/engine/condition-evaluator";
import type { SlotSource } from "@/db/schema/characters";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const charId = searchParams.get("id") || "462f9048-b0da-4185-98db-d18027132c82";
    
    const row = await db.query.characters.findFirst({
      where: eq(characters.id, charId),
      with: {
        primitiveLinks: { with: { primitive: true } },
        capabilityLinks: { with: { capability: true } },
        itemLinks: { with: { item: true } },
        heritageLinks: { with: { heritage: true } },
        logEntries: { orderBy: (l, { desc }) => [desc(l.createdAt)], limit: 500 },
      },
    });
    
    if (!row) return NextResponse.json({ error: "Character not found" });
    
    // Build sheetInput exactly like page.tsx does
    const practices: any[] = [];
    for (const attr of ["PHYSICAL", "MENTAL", "MAGICAL"] as const) {
      const mods = (row.primitiveLinks ?? []).flatMap((l: any) =>
        (l.primitive?.hardModifiers ?? []).filter((m: any) => {
          if (m.target !== "skill_practice_check") return false;
          const scope = m.metadata?.targetScope;
          if (!scope) return false;
          if (scope.layer === "PRACTICE" && scope.values?.includes(attr)) return true;
          if (scope.layer === "ALL") return true;
          return false;
        })
      );
      let total = 0;
      // ... simplified
      practices.push({ practice: attr.toLowerCase(), attribute: attr, total: 0 });
    }
    
    const pb = proficiencyBonus(row.level ?? 1);
    const sheetInput: any = {
      attrPhysical: row.attrPhysical ?? 0,
      attrMental: row.attrMental ?? 0,
      attrMagical: row.attrMagical ?? 0,
      level: row.level ?? 1,
      proficiencyBonus: pb,
      attrProficient: row.attrProficient ?? "PHYSICAL",
      primitiveLinks: row.primitiveLinks.map((l: any) => ({
        primitive: { hardModifiers: l.primitive.hardModifiers ?? [] },
        isMirrored: l.isMirrored ?? false,
        source: l.originCapabilityId ? "capability" : "direct",
        originHeritageId: l.originHeritageId ?? null,
        originCapabilityId: l.originCapabilityId ?? null,
        originEffectId: l.originEffectId ?? null,
        isToggledOff: false,
        primitiveId: l.primitiveId,
        acquiredAtLevel: l.acquiredAtLevel,
      })),
      primitiveIds: row.primitiveLinks.map((l: any) => l.primitiveId),
    };
    
    let sheet;
    try {
      sheet = aggregateCharacterSheet(sheetInput);
    } catch (e: any) {
      return NextResponse.json({ error: "aggregateCharacterSheet failed", message: e.message, stack: e.stack });
    }
    
    const conditionContext: ConditionContext = {
      character: {
        vitality: row.currentVitality ?? sheet.vitality.max,
        vitalityMax: sheet.vitality.max,
        saveDc: sheet.saveDCs?.find((s: any) => s.attribute === (row.attrProficient ?? "PHYSICAL"))?.dc ?? 5,
        blockValue: sheet.behaviorVariables.find((b: any) => b.key === "blockvalue")?.value ?? 0,
        attributes: {
          physical: sheet.attributes.physical,
          mental: sheet.attributes.mental,
          magical: sheet.attributes.magical,
        },
        practices: Object.fromEntries(sheet.practices.map((p: any) => [p.practice, p.total])) as never,
        proficiencies: new Set(sheet.practices
          .filter((p: any) => p.attribute === (row.attrProficient ?? "PHYSICAL"))
          .map((p: any) => p.practice)),
        flags: new Set(),
        custom: {},
      },
    };
    
    sheet = aggregateCharacterSheet({ ...sheetInput, conditionContext });
    
    // Try building the CharacterSheetView props
    const props: any = {
      id: row.id,
      name: row.name,
      level: row.level,
      size: row.size,
      portraitUrl: row.portraitUrl,
      notes: row.notes,
      dmNotes: row.dmNotes,
      lineageName: row.lineageName,
      lineageDescription: row.lineageDescription,
      upbringingName: row.upbringingName,
      upbringingDescription: row.upbringingDescription,
      manifestName: row.manifestName,
      attrPhysical: row.attrPhysical,
      attrMental: row.attrMental,
      attrMagical: row.attrMagical,
      attrProficient: row.attrProficient,
      startingBu: row.startingBu,
      buSpent: row.buSpent,
      dmBonusBu: row.dmBonusBu ?? 0,
      currentVitality: row.currentVitality,
      enforceTemplateCaps: row.enforceTemplateCaps ?? false,
      practices: sheet.practices,
      defensiveDCs: sheet.defensiveDCs.map((d: any) => ({ attribute: d.attribute, dc: d.dc })),
      vitality: sheet.vitality,
      encumbrance: sheet.encumbrance,
      speedByType: sheet.speedByType,
      carryCapacity: sheet.carryCapacity,
      damageModifiers: extractDamageMods(row.primitiveLinks),
      behaviorVariables: sheet.behaviorVariables,
      buBalance: sheet.buBalance,
      primitiveLinks: row.primitiveLinks.map((l: any) => ({
        primitiveId: l.primitiveId,
        source: l.source,
        acquiredAtLevel: l.acquiredAtLevel,
        isMirrored: l.isMirrored ?? false,
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: null,
        originHeritageId: l.originHeritageId ?? null,
        originCapabilityId: l.originCapabilityId ?? null,
        originEffectId: l.originEffectId ?? null,
        isToggledOff: (l as any).isToggledOff ?? false,
        primitive: {
          id: l.primitive.id,
          name: l.primitive.name,
          category: l.primitive.category,
          buCost: l.primitive.buCost,
          isMirrorable: l.primitive.isMirrorable,
          mirrorVector: l.primitive.mirrorVector,
          hardModifiers: l.primitive.hardModifiers,
        },
      })),
      conditionContext,
      capabilityLinks: row.capabilityLinks.map((l: any) => ({
        capabilityId: l.capabilityId,
        acquiredAtLevel: l.acquiredAtLevel,
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: null,
        originHeritageId: l.originHeritageId ?? null,
        slotTab: l.slotTab ?? "MANIFEST",
        effectLinks: [],
        capability: {
          id: l.capability.id,
          name: l.capability.name,
          type: l.capability.type,
          sourceType: l.capability.sourceType,
          verboseDescription: l.capability.verboseDescription,
        },
      })),
      itemLinks: [],
      latestVersions: new Map(),
      heritageLinks: row.heritageLinks.map((l: any) => ({
        heritageId: l.heritageId,
        acquiredAtLevel: l.acquiredAtLevel,
        isMirrored: l.isMirrored ?? false,
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: null,
        originHeritageId: l.originHeritageId ?? null,
        heritage: { id: l.heritage.id, name: l.heritage.name, kind: l.heritage.kind, description: l.heritage.description ?? "" },
      })),
      logEntries: row.logEntries,
      backstory: parseBackstory((row as any).backstory),
      volatility: sheet.volatility,
      attributeModifiers: { physical: sheet.attributes.physical, mental: sheet.attributes.mental, magical: sheet.attributes.magical },
      baseAttributes: { physical: row.attrPhysical, mental: row.attrMental, magical: row.attrMagical },
      resolver: sheet,
      pb: pb,
      currentVitality: row.currentVitality ?? sheet.vitality.max,
      maxVitality: sheet.vitality.max,
      physMod: sheet.attributes.physical,
      mentMod: sheet.attributes.mental,
      magiMod: sheet.attributes.magical,
      proficientAttribute: row.attrProficient,
      primaryAttackBonus: pb + sheet.attributes.physical + (sheet.totals["attack_bonus.physical"] ?? 0),
      primaryDc: 5 + pb + sheet.attributes.physical,
      primarySave: sheet.attributes.physical + pb,
      dcTarget: "save_dc.physical",
      practices: sheet.practices,
      comboPractice: null,
      combo: null,
      lineageName: row.lineageName,
      lineageDescription: row.lineageDescription,
      upbringingName: row.upbringingName,
      upbringingDescription: row.upbringingDescription,
      manifestName: row.manifestName,
      attrSum: (row.attrPhysical ?? 0) + (row.attrMental ?? 0) + (row.attrMagical ?? 0),
      attrSumValid: (row.attrPhysical + row.attrMental + row.attrMagical) === 10,
      encumbrance: sheet.encumbrance,
      characterSize: row.size,
      speedByType: sheet.speedByType,
      carryCapacity: sheet.carryCapacity,
      damageModifiers: { resistance: [], vulnerability: [], immunity: [] },
      behaviorVariables: sheet.behaviorVariables,
    };
    
    return NextResponse.json({ ok: true, propsKeys: Object.keys(props), totals: Object.fromEntries(Object.entries(props.resolver.totals).map(([k,v]) => [k, typeof v === 'number' ? v : null])) });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed", message: e.message, stack: e.stack });
  }
}

function extractDamageMods(links: any[]) {
  const r = { resistance: [] as string[], vulnerability: [] as string[], immunity: [] as string[] };
  for (const link of links) {
    for (const mod of link.primitive.hardModifiers ?? []) {
      if (String(mod.operation) !== "multiply") continue;
      const target = String(mod.target ?? "");
      const value = Number(mod.value);
      if (!Number.isFinite(value)) continue;
      const dotIdx = target.indexOf(".");
      if (dotIdx <= 0) continue;
      const axis = target.slice(0, dotIdx);
      const sub = target.slice(dotIdx + 1);
      if (axis !== "damage_modifier") continue;
      if (value === 0) r.immunity.push(sub);
      else if (value >= 2) r.vulnerability.push(sub);
      else r.resistance.push(sub);
    }
  }
  return r;
}
