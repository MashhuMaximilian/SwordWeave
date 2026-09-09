/**
 * PATCH /api/characters/[id]/primitives/[instanceId]/mirror
 *
 * Phase 9.5 (Mashu 2026-09-07): toggles the is_mirrored column on
 * a character_primitives row. Mirrored primitives don't count
 * against the character's BU budget — they get the
 * mirror_bu_credit instead (typically 0). Non-mirrored primitives
 * count their full bu_cost.
 *
 * Body: { isMirrored: boolean }
 *
 * Auth: required; character must be owned by caller; character
 * must be in BUILD mode.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterPrimitives } from "@/db/schema/characters";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; primitiveInstanceId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId, primitiveInstanceId: instanceId } = await params;

    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
    const values = body as Record<string, unknown>;
    const isMirrored = Boolean(values["isMirrored"]);

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    const { character: current } = await resolveCharacterAccess(
      userId,
      characterId,
      { require: "OWNER" },
    );
    if (current.mode === "PLAY") {
      return NextResponse.json(
        {
          error:
            "Character is in PLAY mode. Switch to BUILD mode to mirror primitives.",
        },
        { status: 409 },
      );
    }

    const updated = await db
      .update(characterPrimitives)
      .set({ isMirrored })
      .where(
        and(
          eq(characterPrimitives.instanceId, instanceId),
          eq(characterPrimitives.characterId, characterId),
        ),
      )
      .returning();
    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Primitive instance not found on this character." },
        { status: 404 },
      );
    }

    await appendCharacterLog(characterId, "primitive_mirrored", {
      primitiveInstanceId: instanceId,
      isMirrored,
    });

    // Phase 9.5 (Mashu 2026-09-07): mirroring toggles the BU
    // contribution of this slot (full cost vs. mirror credit).
    // Recompute so the budget readout updates immediately.
    const { recomputeBuSpent } = await import(
      "@/lib/engine/recompute-bu-spent"
    );
    await recomputeBuSpent(characterId);

    bustResolverCache(characterId);

    return NextResponse.json(
      { characterPrimitive: updated[0] },
      { status: 200 },
    );
  } catch (err) {
    console.error("[characters PATCH primitive mirror] failed:", err);
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied → 403.
    if (err instanceof Error && err.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Unable to toggle mirror.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
