/**
 * POST /api/characters/[id]/backstory
 *
 * Phase 8.2 batch 3 — update the character's freeform backstory.
 * The DB column is `backstory jsonb` (migration 0039). The current
 * shape is { origin, motivation, ties, flaw }; this endpoint
 * accepts that shape and writes it as-is.
 *
 * Body:
 *   backstory: { origin?, motivation?, ties?, flaw? }
 *
 * Returns:
 *   { backstory: CharacterBackstory }
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import {
  parseBackstory,
  sanitizeBackstory,
  type CharacterBackstory,
} from "@/lib/character/character-backstory";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const rawBackstory = (body as Record<string, unknown>)["backstory"];
    if (rawBackstory === undefined) {
      return NextResponse.json(
        { error: "Missing 'backstory' field." },
        { status: 400 },
      );
    }

    const parsed: CharacterBackstory = parseBackstory(rawBackstory);
    const cleaned = sanitizeBackstory(parsed);

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    await resolveCharacterAccess(userId, id, { require: "OWNER" });

    await db
      .update(characters)
      .set({ backstory: cleaned, updatedAt: new Date() })
      .where(eq(characters.id, id));

    return NextResponse.json({ backstory: cleaned });
  } catch (error) {
    if (error instanceof Error && error.name === "CharacterAccessDenied") {
      return NextResponse.json(
        { error: error.message },
        { status: 403 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}