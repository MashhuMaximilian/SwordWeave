// =============================================================================
// POST /api/characters/[id]/items/[itemId]/bump-version
//
// PLAN Eilxina Part D (Mashu 2026-09-09): bump item slot version.
// Mirrors the primitive + capability endpoints.
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterItems } from "@/db/schema";
import { bumpSlotVersion } from "@/lib/character/bump-slot-version";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId, itemId } = await params;

    let body: { toVersionId?: string } = {};
    try {
      body = (await request.json()) as { toVersionId?: string };
    } catch {
      // empty body OK
    }

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    await resolveCharacterAccess(userId, characterId, { require: "OWNER" });

    const slot = await db
      .select({ itemId: characterItems.itemId })
      .from(characterItems)
      .where(
        and(
          eq(characterItems.characterId, characterId),
          eq(characterItems.itemId, itemId),
        ),
      )
      .limit(1);
    if (!slot[0]) {
      return NextResponse.json({ error: "Item slot not found." }, { status: 404 });
    }

    const { newVersionId } = await bumpSlotVersion({
      characterId,
      entityId: itemId,
      kind: "item",
      ...(body.toVersionId ? { toVersionId: body.toVersionId } : {}),
    });

    return NextResponse.json({ newVersionId });
  } catch (error) {
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied → 403.
    if (error instanceof Error && error.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to bump slot version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
