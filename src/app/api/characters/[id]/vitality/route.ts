/**
 * POST /api/characters/[id]/vitality
 *
 * Phase 8.2 batch 2 — apply damage or healing to a character's
 * vitality. Always writes a vitality_change log entry (whether the
 * delta was a real change or got clamped to a boundary).
 *
 * Body:
 *   delta: number — positive = heal, negative = damage
 *   source: "manual" | "long_rest" | "short_rest" — who initiated
 *           the change. Defaults to "manual". Used for log audit.
 *
 * Semantics (Mashu 2026-07-22):
 *   - Heal past max → clamps to max. No rejection.
 *   - Damage below 0 → clamps to 0. No rejection.
 *   - A log entry is always written so the player can see
 *     "tried to heal 20 from full" if they ever mis-key.
 *
 * Returns:
 *   { character: { id, currentVitality, level }, max, delta: { prev, next, applied } }
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

    const rawDelta = (body as Record<string, unknown>)["delta"];
    const rawSource = (body as Record<string, unknown>)["source"];

    const delta = Number(rawDelta);
    if (!Number.isFinite(delta)) {
      return NextResponse.json(
        { error: "delta must be a finite number (positive = heal, negative = damage)." },
        { status: 400 },
      );
    }

    // Source validation: only allow the three known sources.
    const source: "manual" | "long_rest" | "short_rest" =
      rawSource === "long_rest" || rawSource === "short_rest"
        ? rawSource
        : "manual";

    // Ownership check + load current state.
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

    // Compute max vitality the same way the sheet does.
    const { max } = await loadCharacterMaxVitality(id);
    const prev = current.currentVitality ?? 0;
    const candidate = prev + delta;
    const next = clampVitality(candidate, max);

    if (next === prev) {
      // No-op (delta was 0 or clamped to the same value).
      // Still log it so the audit trail is complete.
      await appendCharacterLog(id, "vitality_change", {
        delta,
        prev,
        next,
        source,
      });
      return NextResponse.json({
        character: {
          id,
          currentVitality: next,
          level: current.level,
        },
        max,
        delta: { prev, next, applied: 0 },
        note: "No change (already at boundary).",
      });
    }

    const [updated] = await db
      .update(characters)
      .set({ currentVitality: next, updatedAt: new Date() })
      .where(eq(characters.id, id))
      .returning({
        id: characters.id,
        currentVitality: characters.currentVitality,
        level: characters.level,
      });

    await appendCharacterLog(id, "vitality_change", {
      delta,
      prev,
      next,
      source,
    });

    return NextResponse.json({
      character: updated,
      max,
      delta: { prev, next, applied: next - prev },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}