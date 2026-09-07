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
 *   - PATCH  /api/characters/[id]/primitives/[id]/mirror
 *   - DELETE /api/characters/[id]/primitives/[id]    (remove)
 *
 * Implementation: pulls the character_primitives row + joined
 * primitive definition (buCost, isMirrorable, isMirrored),
 * then sums via the same `calculatePrimitiveBu` formula the
 * modal uses. The result is the `buSpent` column for the
 * character.
 *
 * Library note: the library primitive table lives in the index
 * `@/db/schema` (NOT `@/db/schema/characters`). The `primitives`
 * symbol re-exported by the index is the canonical library
 * table; the per-character rows live in `characterPrimitives`
 * inside the characters schema module.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterPrimitives, characters } from "@/db/schema/characters";
import { primitives } from "@/db/schema";
import { calculatePrimitiveBu } from "@/lib/engine/bu";

export type RecomputeBuResult = {
  buSpent: number;
  instanceCount: number;
};

/**
 * Recomputes the character's `buSpent` and writes the result to
 * the `characters` row. Returns the new value.
 *
 * Phase 9.5 algorithm (Mashu 2026-09-07):
 *   1. Pull every character_primitives row for the character.
 *   2. Join to the latest library `primitives` row by id.
 *   3. For each row, call `calculatePrimitiveBu` with the
 *      current `is_mirrored` flag. Mirrored chips contribute
 *      ZERO to the spent total — they're saved count for
 *      display purposes only.
 *   4. Sum the positive contributions (mirror credits are
 *      tracked separately so we don't go negative here).
 *   5. UPDATE characters SET bu_spent = $sum WHERE id = $id.
 *
 * The function is idempotent: rerunning it gives the same answer.
 *
 * Locking: callers should wrap their mutation + this recompute in
 * a single transaction so two concurrent slots can't interleave a
 * stale recompute.
 */
export async function recomputeBuSpent(
  characterId: string,
): Promise<number> {
  const rows = await db
    .select({
      instanceId: characterPrimitives.instanceId,
      primitiveId: characterPrimitives.primitiveId,
      buCost: primitives.buCost,
      isMirrorable: primitives.isMirrorable,
      mirrorBuCredit: primitives.mirrorBuCredit,
      isMirrored: characterPrimitives.isMirrored,
    })
    .from(characterPrimitives)
    .innerJoin(
      primitives,
      eq(primitives.id, characterPrimitives.primitiveId),
    )
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

/**
 * Same as recomputeBuSpent but also clears the resolver cache so
 * the next page render re-resolves the modifier aggregation.
 *
 * Use this from API routes that don't already invalidate the
 * cache themselves.
 */
export async function recomputeBuSpentAndBustCache(
  characterId: string,
): Promise<number> {
  const next = await recomputeBuSpent(characterId);
  // Dynamic import to avoid cross-package cycles when the
  // character schema is consumed by migration scripts.
  const { bustResolverCache } = await import(
    "@/lib/cache/character-resolver-cache"
  );
  bustResolverCache(characterId);
  return next;
}

/**
 * Test hook: returns the recompute result without writing.
 */
export async function _dryRunRecomputeBuSpent(
  characterId: string,
): Promise<RecomputeBuResult> {
  const rows = await db
    .select({
      instanceId: characterPrimitives.instanceId,
      primitiveId: characterPrimitives.primitiveId,
      buCost: primitives.buCost,
      isMirrorable: primitives.isMirrorable,
      mirrorBuCredit: primitives.mirrorBuCredit,
      isMirrored: characterPrimitives.isMirrored,
    })
    .from(characterPrimitives)
    .innerJoin(
      primitives,
      eq(primitives.id, characterPrimitives.primitiveId),
    )
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
  return { buSpent: positiveSpent, instanceCount: rows.length };
}
