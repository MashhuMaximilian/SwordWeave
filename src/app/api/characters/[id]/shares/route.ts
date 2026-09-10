// =============================================================================
// POST /api/characters/[id]/shares — PLAN Eilxina Part C (Mashu 2026-09-09).
//
// Owner invites a user to share this character.
//
// Body: { username: string, canEdit?: boolean }
// Response: 201 { share: { id, characterId, sharedWithUserId, canEdit, ... } }
//
// Auth: OWNER only. EDITOR/VIEWER can't extend shares.
//
// Idempotency: if an active share already exists for
// (character_id, shared_with_user_id), the existing share's canEdit
// is UPDATED to the new value (not 409). This matches the "re-share
// updates permission" semantic — the owner can flip a viewer to an
// editor in one click without first revoking.
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { characterShares, users } from "@/db/schema";
import {
  canResolveCharacter,
  CharacterAccessDenied,
} from "@/lib/character/can-resolve-character";

/** Body validator. Kept inline since the codebase doesn't use zod
 *  in the character API surface — this is a 4-line manual check. */
function parsePostBody(
  body: unknown,
):
  | { ok: true; value: { username: string; canEdit: boolean } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const username = b["username"];
  const canEditRaw = b["canEdit"];
  if (typeof username !== "string" || username.length === 0) {
    return { ok: false, error: "username is required." };
  }
  if (username.length > 64) {
    return { ok: false, error: "username must be at most 64 chars." };
  }
  const canEdit = typeof canEditRaw === "boolean" ? canEditRaw : false;
  return { ok: true, value: { username, canEdit } };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth.protect();
    const { id: characterId } = await params;
    const { character, permission } = await canResolveCharacter(
      clerkUserId,
      characterId,
    );

    if (permission !== "OWNER") {
      return NextResponse.json(
        {
          error:
            "Only the character owner can invite collaborators.",
        },
        { status: 403 },
      );
    }

    const body: unknown = await request.json().catch(() => ({}));
    const parsed = parsePostBody(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }
    const { username, canEdit } = parsed.value;

    // Resolve username → internal user.id.
    // Usernames are lowercase by convention (see users.username column).
    const target = await db
      .select({ id: users.id, clerkUserId: users.clerkUserId })
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);
    if (target.length === 0) {
      return NextResponse.json(
        { error: `No user with username "${username}".` },
        { status: 404 },
      );
    }
    const targetInternalId = target[0]!.id;

    // Owner can't share with themselves.
    if (target[0]!.clerkUserId === character.userId) {
      return NextResponse.json(
        { error: "You can't share a character with yourself." },
        { status: 400 },
      );
    }

    // Check if an active share already exists → update instead of insert.
    const existing = await db
      .select({ id: characterShares.id, canEdit: characterShares.canEdit })
      .from(characterShares)
      .where(
        and(
          eq(characterShares.characterId, characterId),
          eq(characterShares.sharedWithUserId, targetInternalId),
          isNull(characterShares.revokedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Idempotent update — keep the same row, flip canEdit.
      await db
        .update(characterShares)
        .set({ canEdit, updatedAt: new Date() })
        .where(eq(characterShares.id, existing[0]!.id));
      return NextResponse.json(
        {
          share: {
            id: existing[0]!.id,
            characterId,
            sharedWithUserId: targetInternalId,
            canEdit,
            updated: true,
          },
        },
        { status: 200 },
      );
    }

    // Fresh share.
    const inserted = await db
      .insert(characterShares)
      .values({
        characterId,
        sharedWithUserId: targetInternalId,
        sharedByUserId: clerkUserId,
        canEdit,
      })
      .returning({
        id: characterShares.id,
        characterId: characterShares.characterId,
        sharedWithUserId: characterShares.sharedWithUserId,
        canEdit: characterShares.canEdit,
        createdAt: characterShares.createdAt,
      });

    return NextResponse.json({ share: inserted[0] }, { status: 201 });
  } catch (e) {
    if (e instanceof CharacterAccessDenied) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[POST /api/characters/[id]/shares] unexpected:", e);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
