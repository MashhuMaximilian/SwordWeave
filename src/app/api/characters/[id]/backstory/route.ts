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

    const current = await db.query.characters.findFirst({
      where: eq(characters.id, id),
    });
    if (!current) {
      return NextResponse.json(
        { error: "Character not found." },
        { status: 404 },
      );
    }
    if (current.userId !== userId) {
      return NextResponse.json(
        { error: "You do not own this character." },
        { status: 403 },
      );
    }

    await db
      .update(characters)
      .set({ backstory: cleaned, updatedAt: new Date() })
      .where(eq(characters.id, id));

    return NextResponse.json({ backstory: cleaned });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}