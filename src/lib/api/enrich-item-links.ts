/**
 * Phase 8.4 v22 (Mashu 2026-07-29): T2 followup — flat
 * helpers that enrich item-link rows with their nested
 * bundle (capabilities + effects + primitives) without
 * using depth-3+ Drizzle `with:` joins, which mis-scope
 * Postgres's LEFT JOIN LATERAL and make the parent query
 * fail (see the explicit warnings in /api/characters/[id]
 * and /api/heritage/[id] about this).
 *
 * This helper is used by:
 *   - GET /api/characters/[id] (modal edit seed)
 *   - GET /app/characters/[id] (sheet server fetch)
 *
 * Per Mashu's spec, item's primitives/caps/effects do
 * NOT enter the character's general primitive pool —
 * they stay scoped to the item.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  capabilities as capabilitiesTable,
  effects as effectsTable,
  primitives as primitivesTable,
} from "@/db/schema";

/**
 * Shape of an item-link after enrichment. Each item
 * gets primitiveLinks, capabilityLinks, and effectLinks
 * arrays with the joined capability/effect/primitive
 * rows. Capability effect links (effects-under-cap) are
 * left empty for now — callers can lazy-fetch via
 * /api/capabilities/[id] when needed.
 */
export interface EnrichedItemLink {
  itemId: string;
  item: Record<string, unknown> & {
    primitiveLinks: Array<{
      primitiveId: number;
      primitive: {
        id: number;
        name: string;
        category: string;
        buCost: number;
        isMirrorable: boolean;
        mirrorBuCredit: number;
        narrativeRule: string | null;
      };
    }>;
    capabilityLinks: Array<{
      capabilityId: string;
      capability: {
        id: string;
        name: string;
        type: string;
        sourceType: string;
        verboseDescription: string;
        effectLinks: Array<{
          effectId: string;
          effect: { id: string; name: string; description: string };
        }>;
      };
    }>;
    effectLinks: Array<{
      effectId: string;
      effect: { id: string; name: string; description: string };
    }>;
  };
}

/**
 * Enrich each itemLink with its item's nested bundle via
 * FLAT queries (NOT depth-3+ Drizzle `with:` joins).
 *
 * Side-effect mutates each `link.item` to include
 * capabilityLinks / effectLinks / primitiveLinks.
 *
 * Empty arrays are no-ops (no DB roundtrip when no items).
 */
export async function enrichItemLinksWithNestedBundle(
  itemLinks: ReadonlyArray<{
    itemId: string;
    item: Record<string, unknown>;
  }>,
): Promise<void> {
  if (!itemLinks || itemLinks.length === 0) return;
  const itemIds = itemLinks.map((l) => l.itemId);

  // 1) Direct item primitives
  const itemPrimRows = await db
    .select({
      itemId: itemPrimitives.itemId,
      primitiveId: itemPrimitives.primitiveId,
      sortOrder: itemPrimitives.sortOrder,
      pId: primitivesTable.id,
      pName: primitivesTable.name,
      pCategory: primitivesTable.category,
      pBuCost: primitivesTable.buCost,
      pIsMirrorable: primitivesTable.isMirrorable,
      pMirrorBuCredit: primitivesTable.mirrorBuCredit,
      pNarrativeRule: primitivesTable.narrativeRule,
    })
    .from(itemPrimitives)
    .innerJoin(
      primitivesTable,
      eq(primitivesTable.id, itemPrimitives.primitiveId),
    )
    .where(inArray(itemPrimitives.itemId, itemIds));

  // 2) Item capabilities
  const itemCapRows = await db
    .select({
      itemId: itemCapabilities.itemId,
      capabilityId: itemCapabilities.capabilityId,
      cId: capabilitiesTable.id,
      cName: capabilitiesTable.name,
      cType: capabilitiesTable.type,
      cSourceType: capabilitiesTable.sourceType,
      cVerboseDescription: capabilitiesTable.verboseDescription,
    })
    .from(itemCapabilities)
    .innerJoin(
      capabilitiesTable,
      eq(capabilitiesTable.id, itemCapabilities.capabilityId),
    )
    .where(inArray(itemCapabilities.itemId, itemIds));

  // 3) Item direct effects
  const itemEffectRows = await db
    .select({
      itemId: itemEffects.itemId,
      effectId: itemEffects.effectId,
      eId: effectsTable.id,
      eName: effectsTable.name,
      eNarrativeDescription: effectsTable.narrativeDescription,
    })
    .from(itemEffects)
    .innerJoin(effectsTable, eq(effectsTable.id, itemEffects.effectId))
    .where(inArray(itemEffects.itemId, itemIds));

  // Group by itemId and attach.
  const primsByItemId = new Map<string, typeof itemPrimRows>();
  for (const r of itemPrimRows) {
    const arr = primsByItemId.get(r.itemId) ?? [];
    arr.push(r);
    primsByItemId.set(r.itemId, arr);
  }
  const capsByItemId = new Map<string, typeof itemCapRows>();
  for (const r of itemCapRows) {
    const arr = capsByItemId.get(r.itemId) ?? [];
    arr.push(r);
    capsByItemId.set(r.itemId, arr);
  }
  const effectsByItemId = new Map<string, typeof itemEffectRows>();
  for (const r of itemEffectRows) {
    const arr = effectsByItemId.get(r.itemId) ?? [];
    arr.push(r);
    effectsByItemId.set(r.itemId, arr);
  }

  for (const link of itemLinks) {
    const item = link.item;
    // Primitives
    item["primitiveLinks"] = (primsByItemId.get(link.itemId) ?? []).map(
      (r) => ({
        primitiveId: r.primitiveId,
        primitive: {
          id: r.pId,
          name: r.pName,
          category: r.pCategory,
          buCost: r.pBuCost,
          isMirrorable: r.pIsMirrorable,
          mirrorBuCredit: r.pMirrorBuCredit,
          narrativeRule: r.pNarrativeRule,
        },
      }),
    );
    // Capabilities (effectLinks under caps left empty —
    // callers lazy-fetch via /api/capabilities/[id])
    item["capabilityLinks"] = (capsByItemId.get(link.itemId) ?? []).map(
      (r) => ({
        capabilityId: r.capabilityId,
        capability: {
          id: r.cId,
          name: r.cName,
          type: r.cType,
          sourceType: r.cSourceType,
          verboseDescription: r.cVerboseDescription,
          effectLinks: [],
        },
      }),
    );
    // Direct effects
    item["effectLinks"] = (effectsByItemId.get(link.itemId) ?? []).map((r) => ({
      effectId: r.effectId,
      effect: {
        id: r.eId,
        name: r.eName,
        description: r.eNarrativeDescription,
      },
    }));
  }
}