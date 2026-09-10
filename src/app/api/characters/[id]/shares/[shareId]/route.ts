// =============================================================================
// DELETE /api/characters/[id]/shares/[shareId] — PLAN Eilxina Part C
// (Mashu 2026-09-09).
//
// Owner revokes a share. Soft delete via revokedAt timestamp (not
// hard DELETE) so audit history survives.
//
// Auth: OWNER only.
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterShares } from "@/db/schema";
import {
  canResolveCharacter,
  CharacterAccessDenied,
} from "@/lib/character/can-resolve-character";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth.protect();
    const { id: characterId, shareId } = await params;
    const { permission } = await canResolveCharacter(
      clerkUserId,
      characterId,
    );

    if (permission !== "OWNER") {
      return NextResponse.json(
        {
          error: "Only the character owner can revoke collaborators.",
        },
        { status: 403 },
      );
    }

    // Soft delete: set revokedAt = now. Audit history preserved.
    const result = await db
      .update(characterShares)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(characterShares.id, shareId),
          eq(characterShares.characterId, characterId),
        ),
      )
      .returning({ id: characterShares.id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Share not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { revoked: true, shareId: result[0]!.id },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof CharacterAccessDenied) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error(
      "[DELETE /api/characters/[id]/shares/[shareId]] unexpected:",
      e,
    );
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
