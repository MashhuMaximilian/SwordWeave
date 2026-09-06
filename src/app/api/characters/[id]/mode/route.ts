/**
 * POST /api/characters/[id]/mode
 *
 * Phase 9.1 inline character-builder. Toggles a character between
 * BUILD and PLAY mode. The page (BUILD) reads this column to decide
 * whether to render the inline authoring affordances.
 *
 * Body:
 *   { mode: "BUILD" | "PLAY" }
 *
 * Returns:
 *   { character: { id, mode } }
 *
 * Auth: required; character must be owned by caller.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";

const ALLOWED_MODES = ["BUILD", "PLAY"] as const;
type Mode = (typeof ALLOWED_MODES)[number];

function isMode(v: unknown): v is Mode {
  return typeof v === "string" && (ALLOWED_MODES as readonly string[]).includes(v);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
    const values = body as Record<string, unknown>;
    const rawMode = values["mode"];
    if (!isMode(rawMode)) {
      return NextResponse.json(
        { error: `mode must be one of ${ALLOWED_MODES.join(", ")}` },
        { status: 400 },
      );
    }
    const newMode: Mode = rawMode;

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });
    if (!character) {
      return NextResponse.json(
        { error: "Character not found." },
        { status: 404 },
      );
    }
    if (character.userId !== userId) {
      return NextResponse.json(
        { error: "You do not own this character." },
        { status: 403 },
      );
    }

    if (character.mode === newMode) {
      // No-op; respond idempotently.
      return NextResponse.json(
        {
          character: { id: character.id, mode: character.mode },
          changed: false,
        },
        { status: 200 },
      );
    }

    const updated = await db
      .update(characters)
      .set({ mode: newMode })
      .where(eq(characters.id, characterId))
      .returning();

    await appendCharacterLog(characterId, "mode_changed", {
      fromMode: character.mode,
      toMode: newMode,
    });

    bustResolverCache(characterId);

    return NextResponse.json(
      {
        character: { id: characterId, mode: newMode },
        changed: true,
        row: updated[0] ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[characters POST mode] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to update mode.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
