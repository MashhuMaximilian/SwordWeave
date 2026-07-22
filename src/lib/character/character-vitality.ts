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

  // Mirror src/lib/engine/sheet.ts's heuristic for which primitives
  // contribute. We re-read primitive.name/category/buCost because the
  // existing engine function uses those to filter.
  const primMods: VitalityModifier[] = row.primitiveLinks
    .map((l) => ({
      name: l.primitive.name,
      category: l.primitive.category,
      buCost: l.primitive.buCost,
    }))
    .filter((p) => {
      const n = p.name.toLowerCase();
      return (
        n.includes("vitality") ||
        n.includes("hp") ||
        n.includes("health") ||
        n.includes("tough")
      );
    })
    .map((p) => ({ source: p.name, amount: p.buCost }));

  // Items don't currently contribute vitality modifiers in the
  // engine, but the engine reserves the shape — leave the door
  // open by reading them.
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