/**
 * POST /api/characters/[id]/capabilities/[capabilityId]/trigger
 *
 * Phase 8.2 batch 4 — fire a one-shot capability.
 *
 * Per Mashu 2026-07-22: "trigger = instant fire + revert to
 * inactive; logged". This route writes a capability_trigger log
 * entry and that's it — no state change anywhere (the client's
 * localStorage is unchanged). The visual "flash" on the client
 * is purely a UX affordance.
 *
 * Body: none required.
 *
 * Returns:
 *   { capability: { id, name } }
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, characterCapabilities } from "@/db/schema";
import { appendCharacterLog } from "@/lib/character/character-log";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; capabilityId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id, capabilityId } = await params;

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, id),
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

    const link = await db.query.characterCapabilities.findFirst({
      where: and(
        eq(characterCapabilities.characterId, id),
        eq(characterCapabilities.capabilityId, capabilityId),
      ),
      with: { capability: true },
    });
    if (!link) {
      return NextResponse.json(
        { error: "This capability is not slotted on the character." },
        { status: 404 },
      );
    }

    const capabilityName = link.capability?.name ?? "(unknown)";

    await appendCharacterLog(id, "capability_trigger", {
      capabilityId,
      capabilityName,
    });

    return NextResponse.json({
      capability: { id: capabilityId, name: capabilityName },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
