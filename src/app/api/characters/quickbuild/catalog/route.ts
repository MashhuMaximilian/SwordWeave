import { NextResponse } from "next/server";
import { eq, asc, inArray } from "drizzle-orm";
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
import {
  quickbuildCost,
  EMPTY_QUICKBUILD,
  type QuickbuildCatalog,
} from "@/lib/character/quickbuild";

/** Flat, bounded queries avoid PostgreSQL alias truncation on deep Drizzle joins. */
export async function GET() {
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
    .where(eq(heritage.isPublic, true))
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
          buCost: primitives.buCost,
          mirrorBuCredit: primitives.mirrorBuCredit,
        })
        .from(primitives)
        .where(inArray(primitives.id, primitiveIds))
    : [];
  const catalog: QuickbuildCatalog = {
    primitives: costs,
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
  for (const h of catalog.heritages)
    h.cost = quickbuildCost(catalog, {
      ...EMPTY_QUICKBUILD,
      [h.kind]: h.id,
    }).netCost;
  return NextResponse.json(catalog, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
