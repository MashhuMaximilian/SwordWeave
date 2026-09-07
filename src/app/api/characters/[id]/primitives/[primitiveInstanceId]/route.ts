/**
 * PATCH /api/characters/[id]/primitives/[instanceId]
 *
 * Phase 9.1 inline character-builder. Moves an existing primitive
 * instance between accordions (Lineage / Upbringing / Manifest / Items /
 * detach). Updates origin_heritage_id, origin_capability_id,
 * origin_effect_id, AND source on `character_primitives` to match the
 * new accordion.
 *
 * Why both: the engine reads `source` to bucket contributions for
 * provenance (the Accordion tab). origin_heritage_id is the UI breadcrumb
 * "from Lineage 'Elf'" — useful when the accordion's primitive was
 * inherited from a heritage later formalized.
 *
 * Body:
 *   {
 *     to: "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL",
 *     toHeritageId?: string  // set when to === "LINEAGE" | "UPBRINGING" | "MANIFEST"
 *   }
 *
 * Returns:
 *   { characterPrimitive: CharacterPrimitiveRow }
 *
 * Auth: required; character must be owned by caller; character must
 * be in BUILD mode.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterCapabilities,
  characterPrimitives,
  heritage,
} from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";
import { isPrimitiveSource } from "@/lib/character/inline-builder-types";

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
    const toRaw = String(values["to"] ?? "");
    if (!isPrimitiveSource(toRaw)) {
      return NextResponse.json(
        { error: `to must be one of LINEAGE, UPBRINGING, MANIFEST, PERSONAL.` },
        { status: 400 },
      );
    }
    const to = toRaw;
    const toHeritageId =
      typeof values["toHeritageId"] === "string" &&
      values["toHeritageId"].length > 0
        ? (values["toHeritageId"] as string)
        : null;
    // Phase 9.2 (Mashu 2026-09-06): allow moving a primitive instance
    // into a specific capability. The capability lives ON the character
    // (character_capabilities row). We record this via
    // originCapabilityId — the resolver walks this column to know
    // which primitives belong to which capability body for this
    // character. Source stays at the same accordion; we just stamp
    // the capability origin.
    const toCapabilityId =
      typeof values["toCapabilityId"] === "string" &&
      values["toCapabilityId"].length > 0
        ? (values["toCapabilityId"] as string)
        : null;

    // Ownership check.
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
            "Character is in PLAY mode. Switch to BUILD mode to move primitives.",
        },
        { status: 409 },
      );
    }

    // Find the instance row.
    const existing = await db.query.characterPrimitives.findFirst({
      where: and(
        eq(characterPrimitives.characterId, characterId),
        eq(characterPrimitives.instanceId, instanceId),
      ),
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Primitive instance not found." },
        { status: 404 },
      );
    }

    // Validate toHeritageId if provided: must exist + match kind.
    let resolvedHeritageId: string | null = toHeritageId;
    if (toHeritageId) {
      const h = await db.query.heritage.findFirst({
        where: eq(heritage.id, toHeritageId),
      });
      if (!h) {
        return NextResponse.json(
          { error: "Target heritage not found." },
          { status: 404 },
        );
      }
      const kindToHeritage: Record<string, string> = {
        LINEAGE: "LINEAGE",
        UPBRINGING: "UPBRINGING",
        MANIFEST: "MANIFEST",
      };
      if (kindToHeritage[to] && h.kind !== kindToHeritage[to]) {
        return NextResponse.json(
          {
            error: `Heritage kind ${h.kind} does not match accordion ${to}.`,
          },
          { status: 400 },
        );
      }
    } else if (to === "LINEAGE" || to === "UPBRINGING" || to === "MANIFEST") {
      // Accordion-level move without specifying a heritage row: clear
      // origin_heritage_id and origin_capability_id. The accordion is
      // empty (no heritage yet), and the chip is "directly slotted"
      // into the accordion kind.
      resolvedHeritageId = null;
    }

    // Phase 9.2: validate the target capability belongs to this
    // character (and isn't soft-deleted, but we don't track soft
    // deletes on character_capabilities — the cascade-on-character-delete
    // takes care of it). If specified, the source accordion becomes
    // PERSONAL (the capability carries its own accordion position),
    // and originCapabilityId is stamped.
    let resolvedCapabilityId: string | null = null;
    if (toCapabilityId) {
      const cap = await db.query.characterCapabilities.findFirst({
        where: and(
          eq(characterCapabilities.characterId, characterId),
          eq(characterCapabilities.capabilityId, toCapabilityId),
        ),
      });
      if (!cap) {
        return NextResponse.json(
          {
            error: "Target capability not found on this character.",
          },
          { status: 404 },
        );
      }
      resolvedCapabilityId = toCapabilityId;
    }

    // Update the row.
    //
    // Phase 9.2 (Mashu 2026-09-06): when moving INTO a capability,
    // we set originCapabilityId and keep originHeritageId cleared
    // (the capability carries its own accordion placement; the user
    // can still see the chip's heritage provenance via the chip's
    // breadcrumb UI).
    const updated = await db
      .update(characterPrimitives)
      .set({
        source: to,
        originHeritageId:
          resolvedCapabilityId != null
            ? null
            : to === "PERSONAL"
              ? null
              : resolvedHeritageId,
        originCapabilityId: resolvedCapabilityId,
        originEffectId: null,
      })
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.instanceId, instanceId),
        ),
      )
      .returning();

    // Audit log.
    await appendCharacterLog(characterId, "primitive_moved", {
      primitiveId: existing.primitiveId,
      instanceId,
      fromHeritageId: existing.originHeritageId ?? null,
      toHeritageId: resolvedHeritageId ?? null,
      fromCapabilityId: existing.originCapabilityId ?? null,
      toCapabilityId: resolvedCapabilityId,
      fromSource: existing.source,
      toSource: to,
    });

    bustResolverCache(characterId);

    return NextResponse.json(
      { characterPrimitive: updated[0] ?? null },
      { status: 200 },
    );
  } catch (err) {
    console.error("[characters PATCH primitive] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to move primitive.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}

/**
 * DELETE /api/characters/[id]/primitives/[instanceId]
 *
 * Phase 9.1 inline character-builder. Removes a primitive instance
 * from the character. Useful for "detach" — moving a chip out of all
 * accordions (the user decides later whether to delete the underlying
 * primitive row, or keep it in the library).
 *
 * Auth: required; character must be owned by caller; character must be
 * in BUILD mode.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; primitiveInstanceId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId, primitiveInstanceId: instanceId } = await params;

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
            "Character is in PLAY mode. Switch to BUILD mode to remove primitives.",
        },
        { status: 409 },
      );
    }

    const existing = await db.query.characterPrimitives.findFirst({
      where: and(
        eq(characterPrimitives.characterId, characterId),
        eq(characterPrimitives.instanceId, instanceId),
      ),
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Primitive instance not found." },
        { status: 404 },
      );
    }

    await db
      .delete(characterPrimitives)
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.instanceId, instanceId),
        ),
      );

    await appendCharacterLog(characterId, "primitive_removed", {
      primitiveId: existing.primitiveId,
      instanceId,
    });

    bustResolverCache(characterId);

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    console.error("[characters DELETE primitive] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to remove primitive.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
