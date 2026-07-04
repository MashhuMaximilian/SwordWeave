import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";

/**
 * POST /api/characters/[id]/level-up
 *
 * Level up the character by 1 (max 20).
 *
 * Effects:
 *   - level += 1
 *   - dm_bonus_bu resets to 0 (per Mashu: DM bonus rolls into next-level progression)
 *   - The progression pool expands by 5 BU automatically (per BU_PER_LEVEL)
 *
 * Body (optional):
 *   - newVitality: number — update currentVitality (e.g. on long rest)
 *
 * Note: BU spent does NOT reset. DM bonus grants that haven't been spent carry forward
 * into the new level's progression pool, so we zero it out so it's not double-counted.
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

    if (current.level >= 20) {
      return NextResponse.json(
        { error: "Character is already at maximum level (20)." },
        { status: 400 },
      );
    }

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

    return NextResponse.json({
      character: updated,
      message: `Leveled up to ${updated?.level}. DM bonus BU consumed into progression pool.`,
      progressionGained: 5,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}