import { visibleEntries } from "@/lib/collections/service";
import { auth } from "@clerk/nextjs/server";
import { visibilityCondition } from "@/lib/publishing/library-query";
import { NextResponse } from "next/server";
import { eq, asc, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  heritage,
  heritagePrimitives,
  heritageCapabilities,
  capabilityPrimitives,
  capabilityEffects,
  effectPrimitives,
  primitives,
} from "@/db/schema";
import { lineageArtUrl } from "@/lib/heritage/lineage-art";
import { parseLineageSize } from "@/lib/heritage/lineage-size";
import { mirrorConsequence } from "@/lib/character/mirror-suggestions";
import {
  quickbuildCost,
  EMPTY_QUICKBUILD,
  type QuickbuildCatalog,
} from "@/lib/character/quickbuild";

/** Flat, bounded queries avoid PostgreSQL alias truncation on deep Drizzle joins. */
export async function GET() {
  const { userId } = await auth();
  const rows = await db
    .select({
      id: heritage.id,
      kind: heritage.kind,
      name: heritage.name,
      description: heritage.description,
      imageUrl: heritage.imageUrl,
      defaultSize: heritage.defaultSize,
      sourceOrigin: heritage.sourceOrigin,
      userId: heritage.userId,
    })
    .from(heritage)
    .where(
      visibilityCondition(
        sql`CASE ${heritage.kind} WHEN 'LINEAGE' THEN 'LINEAGE_TEMPLATE' WHEN 'UPBRINGING' THEN 'UPBRINGING_TEMPLATE' ELSE 'MANIFEST_TEMPLATE' END::publish_target_type`,
        sql`${heritage.id}`,
        sql`${heritage.userId}`,
        userId ?? undefined,
        sql`${heritage.isPublic}`,
      ),
    )
    .orderBy(asc(heritage.name));
  const ids = rows.map((h) => h.id);
  if (!ids.length) return NextResponse.json({ heritages: [], primitives: [] });
  const [hp, hc] = await Promise.all([
    db
      .select({
        templateId: heritagePrimitives.templateId,
        primitiveId: heritagePrimitives.primitiveId,
        isMirrored: heritagePrimitives.isMirrored,
      })
      .from(heritagePrimitives)
      .where(inArray(heritagePrimitives.templateId, ids)),
    db
      .select({
        templateId: heritageCapabilities.templateId,
        capabilityId: heritageCapabilities.capabilityId,
      })
      .from(heritageCapabilities)
      .where(inArray(heritageCapabilities.templateId, ids)),
  ]);
  const capIds = [...new Set(hc.map((c) => c.capabilityId))];
  const [cp, ce] = capIds.length
    ? await Promise.all([
        db
          .select({
            capabilityId: capabilityPrimitives.capabilityId,
            primitiveId: capabilityPrimitives.primitiveId,
            isMirrored: capabilityPrimitives.isMirrored,
          })
          .from(capabilityPrimitives)
          .where(inArray(capabilityPrimitives.capabilityId, capIds)),
        db
          .select({
            capabilityId: capabilityEffects.capabilityId,
            effectId: capabilityEffects.effectId,
          })
          .from(capabilityEffects)
          .where(inArray(capabilityEffects.capabilityId, capIds)),
      ])
    : [[], []];
  const effectIds = [...new Set(ce.map((e) => e.effectId))];
  const ep = effectIds.length
    ? await db
        .select({
          effectId: effectPrimitives.effectId,
          primitiveId: effectPrimitives.primitiveId,
          isMirrored: effectPrimitives.isMirrored,
        })
        .from(effectPrimitives)
        .where(inArray(effectPrimitives.effectId, effectIds))
    : [];
  const primitiveIds = [
    ...new Set([...hp, ...cp, ...ep].map((p) => p.primitiveId)),
  ];
  const costs = primitiveIds.length
    ? await db
        .select({
          id: primitives.id,
          category: primitives.category,
          mechanicalRule: primitives.mechanicalRule,
          buCost: primitives.buCost,
          mirrorBuCredit: primitives.mirrorBuCredit,
          name: primitives.name,
          mechanicalOutputText: primitives.mechanicalOutputText,
          narrativeRule: primitives.narrativeRule,
          hardModifiers: primitives.hardModifiers,
          mirrorVector: primitives.mirrorVector,
        })
        .from(primitives)
        .where(inArray(primitives.id, primitiveIds))
    : [];
  const catalog: QuickbuildCatalog = {
    primitives: costs.map(({ id, category, buCost, mirrorBuCredit }) => ({
      id,
      category,
      buCost,
      mirrorBuCredit,
    })),
    heritages: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      description: row.description,
      imageUrl: lineageArtUrl(row),
      defaultSize:
        row.kind === "LINEAGE" ? parseLineageSize(row.defaultSize) : null,
      cost: 0,
      primitiveLinks: hp
        .filter((p) => p.templateId === row.id)
        .map((p) => ({ primitiveId: p.primitiveId, isMirrored: p.isMirrored })),
      capabilityLinks: hc
        .filter((c) => c.templateId === row.id)
        .map((c) => ({
          capabilityId: c.capabilityId,
          primitiveLinks: cp
            .filter((p) => p.capabilityId === c.capabilityId)
            .map((p) => ({
              primitiveId: p.primitiveId,
              isMirrored: p.isMirrored,
            })),
          effectLinks: ce
            .filter((e) => e.capabilityId === c.capabilityId)
            .map((e) => ({
              effectId: e.effectId,
              primitiveLinks: ep
                .filter((p) => p.effectId === e.effectId)
                .map((p) => ({
                  primitiveId: p.primitiveId,
                  isMirrored: p.isMirrored,
                })),
            })),
        })),
    })),
  };
  const readablePrimitives = new Set(
    (
      await visibleEntries(
        costs.map((p) => ({ targetType: "PRIMITIVE", targetId: String(p.id) })),
        userId ?? null,
      )
    ).map((p) => p.targetId),
  );
  const rulesById = new Map(costs.map((p) => [p.id, p]));
  for (const h of catalog.heritages) {
    const resolved = quickbuildCost(catalog, {
      ...EMPTY_QUICKBUILD,
      [h.kind]: h.id,
    });
    h.cost = resolved.netCost;
    h.rules = resolved.expansion.primitives.flatMap((slot) => {
      const p = rulesById.get(slot.primitiveId);
      if (!p || !readablePrimitives.has(String(p.id))) return [];
      const descriptive =
        (p.mechanicalRule as { family?: string } | null)?.family ===
        "DESCRIPTIVE";
      const mechanicalText = descriptive ? "" : p.mechanicalOutputText.trim();
      return [
        {
          primitiveId: p.id,
          name: p.name,
          mechanical:
            !descriptive && Boolean(mechanicalText || p.hardModifiers.length),
          text: slot.isMirrored
            ? mirrorConsequence(p)
            : mechanicalText ||
              p.narrativeRule.trim() ||
              p.mechanicalOutputText.trim() ||
              p.name,
          source: slot.originEffectId
            ? ("effect" as const)
            : slot.originCapabilityId
              ? ("capability" as const)
              : ("primitive" as const),
          isMirrored: slot.isMirrored,
        },
      ];
    });
  }
  return NextResponse.json(catalog, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
