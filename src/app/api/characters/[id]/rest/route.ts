/**
 * POST /api/characters/[id]/rest
 *
 * Phase 8.2 batch 2 — long or short rest.
 *
 * Long rest (Mashu 2026-07-22):
 *   - currentVitality = maxVitality (full restore)
 *
 * Short rest:
 *   - currentVitality += ceil((max - current) / 2), i.e. restore
 *     50% of missing vitality (round up). Capped at max.
 *
 * Both:
 *   - Logged as a 'rest' event
 *   - vitality_change also logged so the audit trail is consistent
 *
 * Body:
 *   restType: "long" | "short"
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import {
  clampVitality,
  loadCharacterMaxVitality,
} from "@/lib/character/character-vitality";
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

    const restType = (body as Record<string, unknown>)["restType"];
    if (restType !== "long" && restType !== "short") {
      return NextResponse.json(
        { error: "restType must be 'long' or 'short'." },
        { status: 400 },
      );
    }

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

    const { max } = await loadCharacterMaxVitality(id);
    const prev = current.currentVitality ?? 0;
    let next: number;
    let delta: number;

    if (restType === "long") {
      next = max;
      delta = max - prev;
    } else {
      // Short: restore 50% of missing vitality, rounded UP. e.g.
      // missing 7 → restore 4; missing 1 → restore 1; missing 0 → 0.
      const missing = max - prev;
      const restore = Math.ceil(missing / 2);
      delta = restore;
      next = clampVitality(prev + restore, max);
    }

    if (next !== prev) {
      await db
        .update(characters)
        .set({ currentVitality: next, updatedAt: new Date() })
        .where(eq(characters.id, id));
    }

    // Two log entries: one for the rest itself, one for the
    // underlying vitality change so the history panel can show
    // them on the same timeline.
    await appendCharacterLog(id, "rest", {
      restType,
      vitalityRestored: next - prev,
    });
    await appendCharacterLog(id, "vitality_change", {
      delta,
      prev,
      next,
      source: restType === "long" ? "long_rest" : "short_rest",
    });

    return NextResponse.json({
      character: {
        id,
        currentVitality: next,
        level: current.level,
      },
      max,
      restType,
      vitalityRestored: next - prev,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}