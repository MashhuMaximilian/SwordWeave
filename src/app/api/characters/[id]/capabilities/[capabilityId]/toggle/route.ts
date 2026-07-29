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
 *   itemId?: string — when present, the cap is an item-scoped
 *     capability (lives on item_capabilities, not
 *     character_capabilities). The item must be slotted on this
 *     character (character_items) for the toggle to be allowed.
 *     Phase 8.4 v24.5 (Mashu 2026-07-29).
 *
 * Returns:
 *   { capability: { id, name, active, itemId?: string } }
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

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const bodyObj = body as Record<string, unknown>;
    const rawActive = bodyObj["active"];
    if (typeof rawActive !== "boolean") {
      return NextResponse.json(
        { error: "active must be a boolean." },
        { status: 400 },
      );
    }
    const itemId =
      typeof bodyObj["itemId"] === "string" && bodyObj["itemId"].length > 0
        ? bodyObj["itemId"]
        : null;

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

    let capabilityName = "(unknown)";
    let itemSlug: string | null = null;

    if (itemId) {
      // Item-scoped path (Phase 8.4 v24.5).
      // Confirm the item is slotted on this character.
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
      // Confirm the cap is on the item.
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

    // Always log; this is the audit trail. localStorage on the
    // client has the source-of-truth active state.
    await appendCharacterLog(id, "capability_toggle", {
      capabilityId,
      capabilityName,
      active: rawActive,
      // Phase 8.4 v24.5: tag item-scoped toggles so the
      // History tab can distinguish them from character-scoped.
      ...(itemSlug
        ? { itemId: itemSlug, scope: "item" as const }
        : { scope: "character" as const }),
    });

    return NextResponse.json({
      capability: {
        id: capabilityId,
        name: capabilityName,
        active: rawActive,
        ...(itemSlug ? { itemId: itemSlug } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}