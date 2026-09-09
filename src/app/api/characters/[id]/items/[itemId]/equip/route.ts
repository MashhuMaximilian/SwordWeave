/**
 * POST /api/characters/[id]/items/[itemId]/equip
 *
 * Phase 8.2 batch 4 — toggle an item's equipped state for a character.
 *
 * The character_items table already has an `equipped: boolean` column
 * (was added back in Phase 1 alongside quantity/slotSource). It just
 * had no UI to flip it. This route is the server-side half of that.
 *
 * Body:
 *   equipped: boolean — true to equip, false to unequip
 *
 * Semantics (Mashu 2026-07-23):
 *   - Idempotent: calling equip on an already-equipped item is a no-op
 *     (still logs a single event so the audit trail is complete).
 *   - Always writes an `item_equip` or `item_unequip` log entry.
 *   - Does NOT enforce slot capacity (encumbrance warning is shown
 *     on the sheet, but we don't reject — same approach as the
 *     rest of the engine).
 *   - Returns 404 if the link row doesn't exist; the item must
 *     actually be on the character.
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterItems, items } from "@/db/schema";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";
import { appendCharacterLog } from "@/lib/character/character-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id, itemId } = await params;
    const body: unknown = await request.json().catch(() => ({}));

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const rawEquipped = (body as Record<string, unknown>)["equipped"];
    if (typeof rawEquipped !== "boolean") {
      return NextResponse.json(
        { error: "equipped must be a boolean." },
        { status: 400 },
      );
    }

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    const { character: current } = await resolveCharacterAccess(
      userId,
      id,
      { require: "OWNER" },
    );

    // Load the link row. Must exist for the character to equip/unequip.
    const link = await db.query.characterItems.findFirst({
      where: and(
        eq(characterItems.characterId, id),
        eq(characterItems.itemId, itemId),
      ),
      with: { item: true },
    });
    if (!link) {
      return NextResponse.json(
        { error: "This item is not on the character." },
        { status: 404 },
      );
    }

    // Idempotency: if the state already matches, skip the update but
    // still log so the audit trail captures the attempt.
    if (link.equipped === rawEquipped) {
      await appendCharacterLog(
        id,
        rawEquipped ? "item_equip" : "item_unequip",
        {
          itemId,
          itemName: link.item?.name ?? "(unknown)",
          note: "no-op (already in target state)",
        },
      );
      return NextResponse.json({
        character: { id, itemId },
        equipped: link.equipped,
        note: "No change (already in target state).",
      });
    }

    await db
      .update(characterItems)
      .set({ equipped: rawEquipped, updatedAt: new Date() })
      .where(
        and(
          eq(characterItems.characterId, id),
          eq(characterItems.itemId, itemId),
        ),
      );

    await appendCharacterLog(
      id,
      rawEquipped ? "item_equip" : "item_unequip",
      {
        itemId,
        itemName: link.item?.name ?? "(unknown)",
      },
    );

    return NextResponse.json({
      character: { id, itemId },
      equipped: rawEquipped,
    });
  } catch (error) {
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied → 403.
    if (error instanceof Error && error.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
