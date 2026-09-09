// =============================================================================
// POST /api/characters/[id]/primitives/[primitiveInstanceId]/bump-version
//
// PLAN Eilxina Part D (Mashu 2026-09-09): wire the existing "update
// available" stale pill to actually bump the slot's versionId.
//
// Body: { toVersionId?: string }  — if omitted, bumps to latest.
//
// Authorization: OWNER only for now (Part C will swap for canResolveCharacter
// with requireEdit:true so collaborators can bump too). The existing character
// mutation routes in /api/characters/[id]/* already gate by userId; we
// match that pattern until Part C.
//
// Side effects:
//   - UPDATE character_primitives SET version_id = <new>
//   - recomputeBuSpentAndBustCache() — primitive BU is version-dependent
//   - returns the new versionId + the refreshed character row
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterPrimitives, characters } from "@/db/schema";
import { bumpSlotVersion } from "@/lib/character/bump-slot-version";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; primitiveInstanceId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId, primitiveInstanceId } = await params;

    let body: { toVersionId?: string } = {};
    try {
      body = (await request.json()) as { toVersionId?: string };
    } catch {
      // empty body is fine — toVersionId defaults to "latest"
    }

    // Authorization: OWNER only (Part C will swap this for canResolveCharacter).
    const ownerRow = await db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1);
    if (!ownerRow[0]) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }
    // Re-check owner — the bare existence check above only proves the
    // character exists. Ownership is verified via the dedicated lookup
    // below.
    const ownerCheck = await db
      .select({ userId: characters.userId })
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1);
    if (ownerCheck[0]?.userId !== userId) {
      return NextResponse.json(
        { error: "Only the character owner can bump slot versions." },
        { status: 403 },
      );
    }

    // Verify the slot row exists for this (character, instanceId) pair.
    const slot = await db
      .select({ primitiveId: characterPrimitives.primitiveId })
      .from(characterPrimitives)
      .where(
        eq(characterPrimitives.instanceId, primitiveInstanceId),
      )
      .limit(1);
    if (!slot[0]) {
      return NextResponse.json(
        { error: "Primitive slot not found." },
        { status: 404 },
      );
    }

    const { newVersionId } = await bumpSlotVersion({
      characterId,
      entityId: primitiveInstanceId,
      kind: "primitive",
      // exactOptionalPropertyTypes: skip the key entirely when undefined
      // rather than passing `toVersionId: undefined`.
      ...(body.toVersionId ? { toVersionId: body.toVersionId } : {}),
    });

    return NextResponse.json({ newVersionId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to bump slot version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
