/**
 * bulkComputeEffectBuCost / bulkComputeCapabilityBuCost — Phase 6 batched
 * BU-cost fetches.
 *
 * Given a list of effect / capability IDs, return a Map keyed by id → total
 * BU cost (sum of composed primitiveLinks.primitive.buCost *
 * primitiveLinks.quantity). One round-trip via JOIN. Same pattern as
 * the library-query helper, scoped for ad-hoc use on source pages.
 *
 * Used by /library/item/[id] capability and template detail bodies to
 * render per-effect / per-capability cost in their "Composed effects" /
 * "Bundled capabilities" lists, so users can see what each nested item
 * contributes to the parent's total.
 *
 * Effects / capabilities that have zero composed primitives return 0
 * (and may still appear in the map at 0; callers can use `?? 0` to be
 * safe).
 *
 * ## Phase 8.1 batch 13.5 follow-up: transitive BU for capabilities
 *
 * The capability version previously counted DIRECT primitive cost only.
 * Mashu 2026-07-22: "I have a lineage with capability X. Capability X
 * has cost 13 BU for example, but it still shows 3 BU in lineage
 * preview where capability X is shown bc it either doesn't take the
 * cost from the mother component or doesn't calculate it properly."
 *
 * Capabilities compose primitives + effects. The effect sub-costs
 * require walking through `capability_effects` → `effect_primitives`.
 * We do that with a second JOIN against the same primitive table and
 * dedupe by primitive_id so a primitive that is both direct AND
 * via-effect counts once.
 *
 * Same approach as the `computeTransitiveBu` helper in
 * @/lib/engine/transitive-bu, but kept here as a batch query so the
 * source pages don't pay a per-capability round-trip.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilityEffects,
  capabilityPrimitives,
  effectPrimitives,
  primitives,
} from "@/db/schema/engine";

export async function bulkComputeEffectBuCost(
  effectIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (effectIds.length === 0) return out;

  const rows = await db
    .select({
      effectId: effectPrimitives.effectId,
      primitiveId: effectPrimitives.primitiveId,
      quantity: effectPrimitives.quantity,
      buCost: primitives.buCost,
    })
    .from(effectPrimitives)
    .innerJoin(primitives, eq(effectPrimitives.primitiveId, primitives.id))
    .where(inArray(effectPrimitives.effectId, effectIds as string[]));

  for (const r of rows) {
    out.set(r.effectId, (out.get(r.effectId) ?? 0) + Math.abs(r.buCost * r.quantity));
  }
  return out;
}

export async function bulkComputeCapabilityBuCost(
  capabilityIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (capabilityIds.length === 0) return out;

  // Map<capabilityId, Map<primitiveId, buCost-sum>>
  // We track primitives per-capability and dedupe by primitive_id so a
  // primitive that is both direct AND via-effect counts once. (Per
  // Mashu: "only primitives cost BU." Same dedup semantics as
  // computeTransitiveBu.)
  const perCap = new Map<
    string,
    Map<number, { unitCost: number; quantity: number }>
  >();
  for (const id of capabilityIds) {
    perCap.set(id, new Map());
  }
  const addRow = (
    capId: string,
    primId: number,
    unitCost: number | null,
    quantity: number,
  ): void => {
    if (unitCost == null) return;
    const m = perCap.get(capId);
    if (!m) return;
    // First occurrence wins for the unit cost (consistent with
    // computeTransitiveBu); quantities add up. In practice all rows
    // for the same primitive share the same unit cost.
    const existing = m.get(primId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      m.set(primId, { unitCost: unitCost ?? 0, quantity });
    }
  };

  // (1) Direct primitive links.
  const directRows = await db
    .select({
      capabilityId: capabilityPrimitives.capabilityId,
      primitiveId: capabilityPrimitives.primitiveId,
      quantity: capabilityPrimitives.quantity,
      buCost: primitives.buCost,
    })
    .from(capabilityPrimitives)
    .innerJoin(primitives, eq(capabilityPrimitives.primitiveId, primitives.id))
    .where(inArray(capabilityPrimitives.capabilityId, capabilityIds as string[]));
  for (const r of directRows) {
    addRow(r.capabilityId, r.primitiveId, r.buCost, r.quantity);
  }

  // (2) Primitive links through effects of these capabilities. Walk
  // capability_effects → effect_primitives → primitives.buCost in one
  // JOIN so we don't pay a round-trip per capability.
  const effectRows = await db
    .select({
      capabilityId: capabilityEffects.capabilityId,
      primitiveId: effectPrimitives.primitiveId,
      quantity: effectPrimitives.quantity,
      buCost: primitives.buCost,
    })
    .from(capabilityEffects)
    .innerJoin(
      effectPrimitives,
      eq(effectPrimitives.effectId, capabilityEffects.effectId),
    )
    .innerJoin(primitives, eq(effectPrimitives.primitiveId, primitives.id))
    .where(
      inArray(capabilityEffects.capabilityId, capabilityIds as string[]),
    );
  for (const r of effectRows) {
    addRow(r.capabilityId, r.primitiveId, r.buCost, r.quantity);
  }

  // Sum the deduped primitives per capability.
  for (const [capId, primMap] of perCap.entries()) {
    let total = 0;
    for (const { unitCost, quantity } of primMap.values()) {
      total += Math.abs(unitCost * quantity);
    }
    out.set(capId, total);
  }
  return out;
}