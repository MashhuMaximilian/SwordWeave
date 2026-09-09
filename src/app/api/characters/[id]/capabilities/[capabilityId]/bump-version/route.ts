// =============================================================================
// POST /api/characters/[id]/capabilities/[capabilityId]/bump-version
//
// PLAN Eilxina Part D (Mashu 2026-09-09): bump capability slot version.
// Mirrors the primitive endpoint; capability slots are identified by
// (character_id, capability_id) — the PK on character_capabilities.
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterCapabilities, characters } from "@/db/schema";
import { bumpSlotVersion } from "@/lib/character/bump-slot-version";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; capabilityId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId, capabilityId } = await params;

    let body: { toVersionId?: string } = {};
    try {
      body = (await request.json()) as { toVersionId?: string };
    } catch {
      // empty body OK — defaults to "latest"
    }

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    await resolveCharacterAccess(userId, characterId, {
      require: "OWNER",
    });

    // Verify the capability slot row exists.
    const slot = await db
      .select({ capabilityId: characterCapabilities.capabilityId })
      .from(characterCapabilities)
      .where(
        and(
          eq(characterCapabilities.characterId, characterId),
          eq(characterCapabilities.capabilityId, capabilityId),
        ),
      )
      .limit(1);
    if (!slot[0]) {
      return NextResponse.json(
        { error: "Capability slot not found." },
        { status: 404 },
      );
    }

    const { newVersionId } = await bumpSlotVersion({
      characterId,
      entityId: capabilityId,
      kind: "capability",
      ...(body.toVersionId ? { toVersionId: body.toVersionId } : {}),
    });

    return NextResponse.json({ newVersionId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to bump slot version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
