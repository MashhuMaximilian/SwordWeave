/**
 * POST /api/characters/[id]/dm-bonus
 *
 * Phase 8.2 batch 5 — set the DM-issued bonus BU on a character.
 *
 * This is the editor for `characters.dmBonusBu`. The column already
 * exists and is used by the engine (the cumulative BU formula
 * includes dmBonusBu in the progression pool). What's missing was
 * a server route to update it after the sheet is created, and a UI
 * editor in the sheet's Overview tab.
 *
 * Body:
 *   dmBonusBu: number — non-negative integer. New DM bonus BU to grant.
 *
 * Semantics:
 *   - Idempotent: setting the same value twice is a no-op (but still
 *     writes a log entry so the audit trail is complete).
 *   - Always writes a dm_bonus_change log entry (new event kind).
 *   - Does NOT touch the level-up logic (level-up zeroes dmBonusBu
 *     because the bonus rolls into the next-level progression pool;
 *     see /api/characters/[id]/level-up).
 *   - Reject negative values, NaN, Infinity.
 *
 * Returns:
 *   { character: { id, dmBonusBu }, prev, next, applied }
 *
 * Auth: required (character owner). Same model as dmNotes — the
 * player owns the sheet, including the DM notes / bonus fields.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { appendCharacterLog } from "@/lib/character/character-log";

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

    const rawValue = (body as Record<string, unknown>)["dmBonusBu"];
    const next = Number(rawValue);
    if (!Number.isFinite(next) || !Number.isInteger(next) || next < 0) {
      return NextResponse.json(
        { error: "dmBonusBu must be a non-negative integer." },
        { status: 400 },
      );
    }

    // Ownership check.
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

    const prev = current.dmBonusBu ?? 0;
    if (prev === next) {
      await appendCharacterLog(id, "dm_bonus_change", {
        prev,
        next,
        applied: 0,
        note: "no-op (already at target value)",
      });
      return NextResponse.json({
        character: { id, dmBonusBu: prev },
        prev,
        next,
        applied: 0,
        note: "No change (already at target value).",
      });
    }

    const [updated] = await db
      .update(characters)
      .set({ dmBonusBu: next, updatedAt: new Date() })
      .where(eq(characters.id, id))
      .returning({
        id: characters.id,
        dmBonusBu: characters.dmBonusBu,
      });

    await appendCharacterLog(id, "dm_bonus_change", {
      prev,
      next,
      applied: next - prev,
    });

    return NextResponse.json({
      character: updated,
      prev,
      next,
      applied: next - prev,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
