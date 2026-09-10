/**
 * GET /api/characters/[id]/logs
 *
 * Phase 8.4 v11 (Mashu 2026-07-28): returns the
 * character_log rows for the character, newest first.
 * Used by the History tab in the character sheet to
 * pick up new entries (e.g. capability_toggle,
 * capability_trigger) without a full page reload.
 *
 * The page-level server component fetches log entries
 * as a join; this endpoint gives the History tab an
 * independent fetch path that the client can call
 * after a toggle / trigger action.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, characterLog } from "@/db/schema/characters";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    const { character } = await resolveCharacterAccess(userId, id, { require: "OWNER" });

    const rows = await db
      .select({
        id: characterLog.id,
        characterId: characterLog.characterId,
        kind: characterLog.kind,
        payload: characterLog.payload,
        createdAt: characterLog.createdAt,
      })
      .from(characterLog)
      .where(eq(characterLog.characterId, id))
      .orderBy(desc(characterLog.createdAt))
      .limit(200);

    return NextResponse.json({
      entries: rows.map((r) => ({
        id: r.id,
        characterId: r.characterId,
        kind: r.kind,
        payload: (r.payload ?? {}) as Record<string, unknown>,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : new Date(r.createdAt as unknown as string).toISOString(),
      })),
    });
  } catch (error) {
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied → 403.
    if (error instanceof Error && error.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}