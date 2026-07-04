/**
 * Volatility validator for character primitive writes.
 *
 * Per the BU Market canon (Notion), a character's level bounds the total
 * negative BU they can take from mirrored primitives:
 *
 *   Levels 1-4  → max -8 BU
 *   Levels 5-10 → max -12 BU
 *   Levels 11-15 → max -16 BU
 *   Levels 16+  → max -24 BU
 *
 * This module fetches the relevant primitive metadata from the DB and runs
 * the engine's `canAcceptMirror` per proposed mirror, accumulating the rating
 * until the ceiling is reached. Returns 422 with a structured error if the
 * proposed set would exceed the ceiling.
 */
import {
  and,
  eq,
  inArray,
} from "drizzle-orm";
import { db } from "@/db/client";
import { primitives, characterPrimitives } from "@/db/schema";
import {
  canAcceptMirror,
  getVolatilityCeiling,
  type PrimitiveInput,
} from "@/lib/engine/bu";

export interface MirrorValidationError {
  ok: false;
  status: 422;
  error: string;
  ceiling: number;
  rating: number;
  bracket: string;
  offendingPrimitiveId: number;
  offendingPrimitiveName: string;
}

export interface MirrorValidationOk {
  ok: true;
  rating: number;
  ceiling: number;
  bracket: string;
}

export type MirrorValidationResult =
  | MirrorValidationOk
  | MirrorValidationError;

/**
 * Load primitive rows from DB by id.
 * Returns a Map keyed by id for O(1) lookup during validation.
 */
async function loadPrimitivesByIds(
  ids: readonly number[],
): Promise<Map<number, PrimitiveInput>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: primitives.id,
      name: primitives.name,
      category: primitives.category,
      buCost: primitives.buCost,
      isMirrorable: primitives.isMirrorable,
      mirrorBuCredit: primitives.mirrorBuCredit,
    })
    .from(primitives)
    .where(inArray(primitives.id, ids as number[]));
  const map = new Map<number, PrimitiveInput>();
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      name: r.name,
      category: r.category,
      buCost: r.buCost,
      isMirrorable: r.isMirrorable,
      mirrorBuCredit: r.mirrorBuCredit,
      hardModifiers: [],
    });
  }
  return map;
}

/**
 * Validate a proposed set of mirrored primitives against the character's level.
 *
 * @param level            - Character level (1+)
 * @param mirroredIds      - Primitive IDs the client is trying to acquire as mirrors
 * @param allPrimitiveIds  - ALL primitive IDs being attached to the character
 *                          (positive + mirrored). Needed because some positive
 *                          primitives may also be flagged mirrorable, but the
 *                          mirror set is what we're enforcing here.
 * @returns { ok, rating, ceiling, bracket } | { ok: false, error, offending... }
 */
export async function validateMirrorSet(
  level: number,
  mirroredIds: readonly number[],
  allPrimitiveIds: readonly number[],
): Promise<MirrorValidationResult> {
  const ceiling = getVolatilityCeiling(level);
  const allNeeded = Array.from(new Set([...mirroredIds, ...allPrimitiveIds]));
  const primMap = await loadPrimitivesByIds(allNeeded);

  // Build the "current mirrored" list as the union of:
  //   (a) existing mirrored primitives on the character (from DB), and
  //   (b) the proposed mirrored primitives in this request.
  // We only check (b) against the ceiling — (a) was already vetted when written.
  // The caller should pass `allPrimitiveIds` such that mirrored primitives
  // already on the character are NOT included unless they're also in
  // mirroredIds (i.e. a re-write). For new characters (a) is empty.
  const proposedMirrors: PrimitiveInput[] = [];
  for (const id of mirroredIds) {
    const p = primMap.get(id);
    if (!p) {
      return {
        ok: false,
        status: 422,
        error: `Primitive id ${id} not found in catalog.`,
        ceiling: ceiling.maxNegativeBu,
        rating: 0,
        bracket: ceiling.levelBracket,
        offendingPrimitiveId: id,
        offendingPrimitiveName: "(missing)",
      };
    }
    proposedMirrors.push(p);
  }

  let running = 0;
  for (const p of proposedMirrors) {
    const check = canAcceptMirror(level, [], p);
    if (!check.allowed) {
      return {
        ok: false,
        status: 422,
        error: check.reason ?? "Mirror rejected.",
        ceiling: ceiling.maxNegativeBu,
        rating: running,
        bracket: ceiling.levelBracket,
        offendingPrimitiveId: p.id as number,
        offendingPrimitiveName: p.name,
      };
    }
    running += Math.abs(p.mirrorBuCredit);
    if (running > ceiling.maxNegativeBu) {
      return {
        ok: false,
        status: 422,
        error: `Accepting "${p.name}" would push volatility to ${running} BU, exceeding level ${level} ceiling of ${ceiling.maxNegativeBu} BU.`,
        ceiling: ceiling.maxNegativeBu,
        rating: running,
        bracket: ceiling.levelBracket,
        offendingPrimitiveId: p.id as number,
        offendingPrimitiveName: p.name,
      };
    }
  }

  return {
    ok: true,
    rating: running,
    ceiling: ceiling.maxNegativeBu,
    bracket: ceiling.levelBracket,
  };
}

/**
 * For character PATCH: validate that the *resulting* mirror set (existing + new)
 * does not exceed the ceiling. The caller supplies the existing character's
 * current mirrored primitive IDs.
 */
export async function validateMirrorAddition(
  level: number,
  existingMirroredIds: readonly number[],
  proposedNewMirroredIds: readonly number[],
): Promise<MirrorValidationResult> {
  const ceiling = getVolatilityCeiling(level);
  const allIds = Array.from(
    new Set([...existingMirroredIds, ...proposedNewMirroredIds]),
  );
  const primMap = await loadPrimitivesByIds(allIds);

  // Compute current rating from existing mirrors.
  let running = 0;
  for (const id of existingMirroredIds) {
    const p = primMap.get(id);
    if (p) running += Math.abs(p.mirrorBuCredit);
  }

  // Now add proposed new mirrors one at a time.
  for (const id of proposedNewMirroredIds) {
    const p = primMap.get(id);
    if (!p) {
      return {
        ok: false,
        status: 422,
        error: `Primitive id ${id} not found in catalog.`,
        ceiling: ceiling.maxNegativeBu,
        rating: running,
        bracket: ceiling.levelBracket,
        offendingPrimitiveId: id,
        offendingPrimitiveName: "(missing)",
      };
    }
    const prospective = running + Math.abs(p.mirrorBuCredit);
    if (prospective > ceiling.maxNegativeBu) {
      return {
        ok: false,
        status: 422,
        error: `Accepting "${p.name}" would push volatility to ${prospective} BU, exceeding level ${level} ceiling of ${ceiling.maxNegativeBu} BU.`,
        ceiling: ceiling.maxNegativeBu,
        rating: prospective,
        bracket: ceiling.levelBracket,
        offendingPrimitiveId: p.id as number,
        offendingPrimitiveName: p.name,
      };
    }
    running = prospective;
  }

  return {
    ok: true,
    rating: running,
    ceiling: ceiling.maxNegativeBu,
    bracket: ceiling.levelBracket,
  };
}

/**
 * Load the set of currently-mirrored primitive IDs for a character.
 * Used by PATCH to compute the resulting volatility when primitives change.
 */
export async function loadMirroredPrimitiveIds(
  characterId: string,
): Promise<number[]> {
  const rows = await db
    .select({ primitiveId: characterPrimitives.primitiveId })
    .from(characterPrimitives)
    .where(
      and(
        eq(characterPrimitives.characterId, characterId),
        eq(characterPrimitives.isMirrored, true),
      ),
    );
  return rows.map((r) => r.primitiveId);
}