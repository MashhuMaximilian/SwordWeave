import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { getVolatilityCeiling } from "@/lib/engine/bu";

/**
 * POST /api/characters/[id]/level-up
 *
 * Level up the character by 1. Phase 8.1 batch 10g: no upper cap
 * (was 20).
 *
 * Effects:
 *   - level += 1
 *   - dm_bonus_bu resets to 0 (per Mashu: DM bonus rolls into next-level progression)
 *   - Volatility ceiling expands (level-up only ever grows or holds
 *     ceiling, so existing mirrors can never become invalid — see
 *     getVolatilityCeiling)
 *
 * Body (optional):
 *   - newVitality: number — update currentVitality (e.g. on long rest)
 *
 * Note: BU spent does NOT reset. DM bonus grants that haven't been
 * spent carry forward into the new level's progression pool, so we
 * zero it out so it's not double-counted. The DB-level
 * bu_progression_check uses the cumulative formula
 * (25 + 10*(L-1) + 4*k*(k+1)/2 where k = floor(L/4)), so the pool
 * grows correctly at every spike level.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));

    const current = await db.query.characters.findFirst({
      where: eq(characters.id, id),
    });
    if (!current) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    // Phase 8.1 batch 10g: no upper level cap — the cumulative BU
    // formula extrapolates indefinitely. The only constraint is that
    // level is >= 1 (which is enforced by the DB-level check).
    const updatePayload: Record<string, unknown> = {
      level: current.level + 1,
      // DM bonus rolls into next-level progression, reset so it's not double-counted
      dmBonusBu: 0,
      updatedAt: new Date(),
    };

    if (body && typeof body === "object") {
      const newVitality = (body as Record<string, unknown>)["newVitality"];
      if (newVitality !== undefined && newVitality !== null) {
        const v = Number(newVitality);
        if (!Number.isInteger(v) || v < 0) {
          return NextResponse.json(
            { error: "newVitality must be a non-negative integer." },
            { status: 400 },
          );
        }
        updatePayload["currentVitality"] = v;
      }
    }

    const [updated] = await db
      .update(characters)
      .set(updatePayload)
      .where(eq(characters.id, id))
      .returning();

    const newCeiling = getVolatilityCeiling(updated?.level ?? 1);

    return NextResponse.json({
      character: updated,
      message: `Leveled up to ${updated?.level}. DM bonus BU consumed into progression pool.`,
      progressionGained: 5,
      volatilityCeiling: newCeiling.maxNegativeBu,
      volatilityBracket: newCeiling.levelBracket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}