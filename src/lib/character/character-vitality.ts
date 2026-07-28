/**
 * character-vitality.ts — Phase 8.2 batch 2
 *
 * Server-side helpers for the vitality API. Computes the canonical
 * max vitality for a character by reading the character's level +
 * slotted primitives + items + heritages (anything that contributes
 * a vitality modifier). Used by:
 *
 *   - POST /api/characters/[id]/vitality (apply damage / heal)
 *   - POST /api/characters/[id]/rest (long / short)
 *
 * Important: this MUST agree with src/lib/engine/sheet.ts
 * (aggregateCharacterSheet) — if these two diverge, the sheet will
 * display "X / Y max" where X comes from one source and Y from
 * another. We re-use the same engine functions to keep parity.
 */

import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  characterItems,
  characterPrimitives,
  characters,
  items,
  primitives,
} from "@/db/schema";
import {
  computeMaxVitality,
  computeVitalityModifiersFromPrimitives,
  type VitalityModifier,
} from "@/lib/engine/vitality";

/**
 * Load every primitive + item that could carry a vitality modifier
 * for the given character, then compute max vitality the same way
 * `aggregateCharacterSheet` does.
 */
export async function loadCharacterMaxVitality(
  characterId: string,
): Promise<{ max: number; current: number }> {
  const row = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
    with: {
      primitiveLinks: { with: { primitive: true } },
      itemLinks: { with: { item: true } },
    },
  });

  if (!row) {
    throw new Error(`Character ${characterId} not found.`);
  }

  // Phase 8.3g v5 (Mashu 2026-07-28): use the SAME
  // engine function as the sheet aggregator. The previous
  // inline filter+map was independently reimplementing
  // the heuristic and DROPPING the `isMirrored` flag,
  // so the rest/damage routes computed max vitality
  // WITHOUT the mirror sign-flip. Result: a character
  // with mirrored Vitality Core Augment primitives
  // would sheet-display max = 268 (with mirrors) but
  // the rest route would set current to 308 (without).
  // `computeVitalityModifiersFromPrimitives` is the
  // canonical engine entry point and respects mirrors.
  const primMods: VitalityModifier[] = computeVitalityModifiersFromPrimitives(
    row.primitiveLinks.map((l) => ({
      buCost: l.primitive.buCost,
      category: l.primitive.category,
      name: l.primitive.name,
      // The critical field — was being dropped before.
      isMirrored: l.isMirrored ?? false,
    })),
  ) as VitalityModifier[];

  // Items don't currently contribute vitality modifiers in the
  // engine, but be defensive: if any item has "vitality"/"hp"/
  // "health"/"tough" in its name, treat its buCost as a flat
  // additive modifier. We're conservative here — items
  // don't have an isMirrored flag in the schema as of
  // Phase 8.3g, so they go through as positive.
  const itemMods: VitalityModifier[] = row.itemLinks
    .map((l) => ({
      name: l.item.name,
      buCost: l.item.buCost ?? 0,
    }))
    .filter((i) => {
      const n = i.name.toLowerCase();
      return (
        n.includes("vitality") ||
        n.includes("hp") ||
        n.includes("health") ||
        n.includes("tough")
      );
    })
    .map((i) => ({ source: i.name, amount: i.buCost }));

  const allMods = [...primMods, ...itemMods];
  const max = computeMaxVitality(row.level, allMods);
  return { max, current: row.currentVitality ?? 0 };
}

/**
 * Clamp a candidate vitality value to [0, max]. Mashu's policy
 * (2026-07-22): "I should not be able to heal past max vitality
 * nor take damage below 0 ... clamping or whatever". We clamp
 * silently rather than 400 — see comment in route handler.
 */
export function clampVitality(next: number, max: number): number {
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(max, Math.floor(next)));
}