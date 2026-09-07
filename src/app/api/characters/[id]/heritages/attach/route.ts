/**
 * POST /api/characters/[id]/heritages/attach
 *
 * Phase 9.5 follow-up (Mashu 2026-09-07): attach an existing
 * published heritage template (LINEAGE / UPBRINGING /
 * MANIFEST) to the character. Used by the character sheet's
 * right-column "Library" button so the user can browse
 * heritage templates and slot them onto their character
 * without going through the full formalize flow.
 *
 * Differs from /heritages/formalize which CREATES a new
 * heritage from bundled primitives. This route attaches
 * an existing one — the heritage's bundled primitives
 * and capabilities cascade into the character as inherited
 * rows so the resolver picks them up.
 *
 * Body: { heritageId: string }
 * Returns: { heritageId, heritageName }
 *
 * Auth: required; character must be owned by caller and
 * in BUILD mode.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
  characterHeritages,
  characters,
  heritage,
  heritageCapabilities,
  heritagePrimitives,
} from "@/db/schema";

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
    const heritageId = String(values["heritageId"] ?? "").trim();
    if (!heritageId) {
      return NextResponse.json(
        { error: "heritageId is required." },
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
            "Character is in PLAY mode. Switch to BUILD mode to attach heritages.",
        },
        { status: 409 },
      );
    }

    const templateRow = await db.query.heritage.findFirst({
      where: eq(heritage.id, heritageId),
    });
    if (!templateRow) {
      return NextResponse.json(
        { error: "Heritage not found." },
        { status: 404 },
      );
    }

    // De-dupe: if this heritage is already attached, return early.
    const existing = await db.query.characterHeritages.findFirst({
      where: and(
        eq(characterHeritages.characterId, characterId),
        eq(characterHeritages.heritageId, heritageId),
      ),
    });
    if (existing) {
      return NextResponse.json(
        {
          heritageId,
          heritageName: templateRow.name,
          alreadyAttached: true,
        },
        { status: 200 },
      );
    }

    // Insert the character_heritages row. The DB has a unique
    // (characterId, heritageId) constraint so the dedupe above
    // is just a nicer error than a 500 from the constraint.
    const now = new Date();
    await db.insert(characterHeritages).values({
      characterId,
      heritageId,
      acquiredAtLevel: character.level,
      isMirrored: false,
      createdAt: now,
    });

    // Phase 9.5 follow-up (Mashu 2026-09-07): nothing else to
    // do here. The character sheet reads heritage_links from
    // character_heritages joined with heritage, and the
    // bundled primitives / capabilities flow through the
    // resolver's bundle expansion via the heritage's
    // heritagePrimitives / heritageCapabilities rows. The
    // resolver already treats heritage-bundled content as
    // inherited — no separate character_primitives row
    // needed.
    // (Compare with the formalize flow which DELETES
    // character_primitives rows for primitives that are now
    // bundled — that mutation only applies when the heritage
    // is being CREATED from already-slotted primitives.)

    // Quietly touch heritagePrimitives / heritageCapabilities
    // imports so unused-import lints don't trip if someone
    // refactors the imports later. The cascade expansion
    // happens in the resolver, not here.
    void heritagePrimitives;
    void heritageCapabilities;

    return NextResponse.json(
      {
        heritageId,
        heritageName: templateRow.name,
        alreadyAttached: false,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[characters POST heritages/attach] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to attach heritage.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
