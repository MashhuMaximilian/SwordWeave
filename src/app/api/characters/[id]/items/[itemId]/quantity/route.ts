/**
 * POST /api/characters/[id]/items/[itemId]/quantity
 *
 * Phase 8.5 / Session H6 (Mashu 2026-08-03): update the
 * quantity of a slotted item from the public character sheet's
 * ItemCard. The modal save path already handles qty at
 * character creation / edit time; this route covers the case
 * where the user wants to bump an item's stack count
 * (e.g. "I looted 4 more healing potions") without opening
 * the full modal.
 *
 * Body:
 *   quantity: number — the new stack count. Clamped to >= 1.
 *
 * Semantics:
 *   - Idempotent: writing the same quantity is a no-op
 *     (still logs a single event so the audit trail is
 *     complete).
 *   - Writes an `item_quantity` log entry.
 *   - Updates `character_items.quantity` directly.
 *   - Returns 404 if the link row doesn't exist.
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
import { withCharacterSnapshot } from "@/lib/character/with-character-snapshot";

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

    const rawQty = (body as Record<string, unknown>)["quantity"];
    const qty = typeof rawQty === "number" ? rawQty : Number(rawQty);
    if (!Number.isInteger(qty) || qty < 1) {
      return NextResponse.json(
        { error: "Quantity must be a positive integer." },
        { status: 400 },
      );
    }

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    const { character: current } = await resolveCharacterAccess(
      userId,
      id,
      { require: "OWNER" },
    );

    // Confirm the link row exists (and join to item for the
    // log payload — even though we don't need it for the
    // update, the log entry records what the item was).
    const [link] = await db
      .select({
        itemId: characterItems.itemId,
        quantity: characterItems.quantity,
        name: items.name,
      })
      .from(characterItems)
      .innerJoin(items, eq(items.id, characterItems.itemId))
      .where(
        and(
          eq(characterItems.characterId, id),
          eq(characterItems.itemId, itemId),
        ),
      )
      .limit(1);
    if (!link) {
      return NextResponse.json(
        { error: "Item is not slotted on this character." },
        { status: 404 },
      );
    }

    if (link.quantity === qty) {
      return NextResponse.json(
        { quantity: qty, unchanged: true },
        { status: 200 },
      );
    }

    await db
      .update(characterItems)
      .set({
        quantity: qty,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(characterItems.characterId, id),
          eq(characterItems.itemId, itemId),
        ),
      );

    // Audit log — distinct event type from equip so the
    // timeline can show "looted 3 more healing potions" vs
    // "equipped the longsword".
    await appendCharacterLog(
      id,
      "item_quantity",
      {
        itemId,
        itemName: link.name,
        previousQuantity: link.quantity,
        newQuantity: qty,
      },
    );

    await withCharacterSnapshot(id, async () => {
      // Snapshot captures fresh state after the quantity update
    }, { publishedByUserId: userId });

    return NextResponse.json({
      quantity: qty,
      previousQuantity: link.quantity,
    });
  } catch (error) {
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied → 403.
    if (error instanceof Error && error.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[character items quantity] error", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
