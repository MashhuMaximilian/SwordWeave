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
 * NOTE: the capability version counts DIRECT primitive cost only, not
 * nested effects. Capabilities compose primitives + effects; the effect
 * sub-costs would require a recursive walk which is out of scope here.
 * The page that uses this can decide whether to include effect BU
 * separately.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
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
    out.set(r.effectId, (out.get(r.effectId) ?? 0) + r.buCost * r.quantity);
  }
  return out;
}

export async function bulkComputeCapabilityBuCost(
  capabilityIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (capabilityIds.length === 0) return out;

  const rows = await db
    .select({
      capabilityId: capabilityPrimitives.capabilityId,
      primitiveId: capabilityPrimitives.primitiveId,
      quantity: capabilityPrimitives.quantity,
      buCost: primitives.buCost,
    })
    .from(capabilityPrimitives)
    .innerJoin(primitives, eq(capabilityPrimitives.primitiveId, primitives.id))
    .where(inArray(capabilityPrimitives.capabilityId, capabilityIds as string[]));

  for (const r of rows) {
    out.set(
      r.capabilityId,
      (out.get(r.capabilityId) ?? 0) + r.buCost * r.quantity,
    );
  }
  return out;
}