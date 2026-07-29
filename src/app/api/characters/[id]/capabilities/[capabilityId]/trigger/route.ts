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
 * Body:
 *   itemId?: string — Phase 8.4 v24.5 (Mashu 2026-07-29):
 *     when present, the cap is an item-scoped capability.
 *     The item must be slotted on this character.
 *
 * Returns:
 *   { capability: { id, name, itemId?: string } }
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterCapabilities,
  characterItems,
} from "@/db/schema";
import { itemCapabilities } from "@/db/schema/items";
import { appendCharacterLog } from "@/lib/character/character-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; capabilityId: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id, capabilityId } = await params;
    const body: unknown = await request.json().catch(() => ({}));

    let itemId: string | null = null;
    if (body && typeof body === "object") {
      const rawItemId = (body as Record<string, unknown>)["itemId"];
      if (typeof rawItemId === "string" && rawItemId.length > 0) {
        itemId = rawItemId;
      }
    }

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

    let capabilityName = "(unknown)";
    let itemSlug: string | null = null;

    if (itemId) {
      // Item-scoped path (Phase 8.4 v24.5).
      const charItem = await db.query.characterItems.findFirst({
        where: and(
          eq(characterItems.characterId, id),
          eq(characterItems.itemId, itemId),
        ),
      });
      if (!charItem) {
        return NextResponse.json(
          { error: "This item is not slotted on the character." },
          { status: 404 },
        );
      }
      const itemLink = await db.query.itemCapabilities.findFirst({
        where: and(
          eq(itemCapabilities.itemId, itemId),
          eq(itemCapabilities.capabilityId, capabilityId),
        ),
        with: { capability: true },
      });
      if (!itemLink) {
        return NextResponse.json(
          { error: "This capability is not on the item." },
          { status: 404 },
        );
      }
      capabilityName = itemLink.capability?.name ?? "(unknown)";
      itemSlug = itemId;
    } else {
      // Character-scoped path (original).
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
      capabilityName = link.capability?.name ?? "(unknown)";
    }

    await appendCharacterLog(id, "capability_trigger", {
      capabilityId,
      capabilityName,
      ...(itemSlug
        ? { itemId: itemSlug, scope: "item" as const }
        : { scope: "character" as const }),
    });

    return NextResponse.json({
      capability: {
        id: capabilityId,
        name: capabilityName,
        ...(itemSlug ? { itemId: itemSlug } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}