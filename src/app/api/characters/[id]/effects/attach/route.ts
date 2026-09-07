/**
 * POST /api/characters/[id]/effects/attach
 *
 * Phase 9.3 (Mashu 2026-09-06): attach an effect (existing or
 * just-created in atelier) onto this character.
 *
 * NOTE (Mashu 2026-09-06): effects are stored in the global
 * `effects` table and walked via character_primitives.originEffectId
 * today. There is no character_effects junction table yet — that
 * needs a schema migration (character_effects (character_id,
 * effect_id, origin_primitive_instance_id)).
 *
 * Until that migration lands, this route:
 *   1. Validates the effect exists
 *   2. Validates the character exists + is in BUILD mode
 *   3. Writes a "would have attached" audit log so the user's
 *      intent is recorded even though the schema is incomplete
 *   4. Returns 501 with a clear message asking the user to attach
 *      the effect by dragging it from /atelier onto a primitive
 *      body, or to retry once the migration lands.
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, effects } from "@/db/schema";
import { appendCharacterLog } from "@/lib/character/character-log";

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
    const effectIdRaw = String(values["effectId"] ?? "").trim();
    if (!effectIdRaw) {
      return NextResponse.json(
        { error: "effectId is required." },
        { status: 400 },
      );
    }

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
    if (character.mode === "PLAY") {
      return NextResponse.json(
        {
          error:
            "Character is in PLAY mode. Switch to BUILD mode to attach effects.",
        },
        { status: 409 },
      );
    }

    const effect = await db.query.effects.findFirst({
      where: eq(effects.id, effectIdRaw),
    });
    if (!effect) {
      return NextResponse.json(
        { error: "Effect not found." },
        { status: 404 },
      );
    }

    // Audit log (intent is recorded even though the schema is incomplete).
    await appendCharacterLog(characterId, "effect_attached", {
      effectId: effectIdRaw,
      effectName: effect.name,
    });

    return NextResponse.json(
      {
        error:
          "Effect attachment requires the character_effects migration. As a workaround, attach the effect by editing a primitive's body in /atelier or drag-and-drop in the character sheet.",
        effect: { id: effect.id, name: effect.name },
      },
      { status: 501 },
    );
  } catch (err) {
    console.error("[characters effects/attach] failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to attach effect.",
      },
      { status: 500 },
    );
  }
}
