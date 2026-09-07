// @ts-nocheck
/**
 * Phase 9.5 (Mashu 2026-09-07): helper to recompute a character's
 * `buSpent` from its character_primitives rows and write the
 * result back to the `characters` table.
 *
 * Why this exists: the engine derives `buSpent` from the sum of
 * all primitive costs. Until now the column was only updated
 * through the modal character-creation form. After we added
 * the BUILD-mode DnD UI (slot / move / mirror / remove via the
 * sheet), the column drifted — adding a primitive via the
 * right-column Add Panel + library modal didn't update the
 * column, so the BU budget readout was stuck at the pre-DnD
 * value. This helper closes that gap.
 *
 * Called from:
 *   - POST   /api/characters/[id]/primitives         (slot)
 *   - PATCH  /api/characters/[id]/primitives/[id]    (move)
 *   - PATCH  /api/characters/[id]/primitives/[id]/mirror
 *   - DELETE /api/characters/[id]/primitives/[id]    (remove)
 *
 * Implementation: pulls the character_primitives row + joined
 * primitive definition (buCost, isMirrorable, mirrorBuCredit,
 * isMirrored), then sums via the same `calculatePrimitiveBu`
 * formula the modal uses. The result is the `buSpent` column
 * for the character.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterPrimitives, primitives, characters } from "@/db/schema/characters";
import { calculatePrimitiveBu } from "./bu";

export async function recomputeBuSpent(characterId: string): Promise<number> {
  const rows = await db
    .select({
      buCost: primitives.buCost,
      isMirrorable: primitives.isMirrorable,
      mirrorBuCredit: primitives.mirrorBuCredit,
      isMirrored: characterPrimitives.isMirrored,
    })
    .from(characterPrimitives)
    .innerJoin(primitives, eq(primitives.id, characterPrimitives.primitiveId))
    .where(eq(characterPrimitives.characterId, characterId));

  let positiveSpent = 0;
  for (const r of rows) {
    const bu = calculatePrimitiveBu(
      {
        id: 0,
        name: "",
        category: "",
        buCost: r.buCost,
        isMirrorable: r.isMirrorable,
        mirrorBuCredit: r.mirrorBuCredit,
        hardModifiers: [],
      },
      r.isMirrored,
    );
    if (bu > 0) positiveSpent += bu;
  }
  // Net spent only counts positive BU; mirror credits are tracked
  // separately in the engine (itemBuSpent) so the column reflects
  // what the user actually owes the budget.
  await db
    .update(characters)
    .set({ buSpent: positiveSpent })
    .where(eq(characters.id, characterId));
  return positiveSpent;
}
