/**
 * POST /api/characters/[id]/capabilities/[capabilityId]/toggle
 *
 * Phase 8.2 batch 4 — flip a capability's active state.
 *
 * IMPORTANT: this route does NOT persist the `active` flag to the
 * DB. Per Mashu 2026-07-23 the active state lives in localStorage
 * (the client is the source of truth for transient runtime state).
 * This route's only job is to write the audit log so the player
 * can reconstruct what happened even if localStorage is cleared.
 *
 * Body:
 *   active: boolean — the desired active state (post-toggle)
 *
 * Returns:
 *   { capability: { id, name, active } }
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, characterCapabilities, capabilities } from "@/db/schema";
import { appendCharacterLog } from "@/lib/character/character-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; capabilityId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id, capabilityId } = await params;
    const body: unknown = await request.json().catch(() => ({}));

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const rawActive = (body as Record<string, unknown>)["active"];
    if (typeof rawActive !== "boolean") {
      return NextResponse.json(
        { error: "active must be a boolean." },
        { status: 400 },
      );
    }

    // Ownership check.
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

    // Confirm the capability is actually slotted on this character.
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

    // Always log; this is the audit trail. localStorage on the
    // client has the source-of-truth active state.
    await appendCharacterLog(id, "capability_toggle", {
      capabilityId,
      capabilityName,
      active: rawActive,
    });

    return NextResponse.json({
      capability: {
        id: capabilityId,
        name: capabilityName,
        active: rawActive,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
