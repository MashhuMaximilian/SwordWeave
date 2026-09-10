/**
 * POST /api/characters/[id]/items/formalize
 *
 * Phase 9.1 inline character-builder. The items accordion is
 * currently driven by *primitives* (not items) — but the user wants
 * to be able to formalize that accordion into a real item row.
 *
 * Why? A character carries a "Belt of the Giant" (a tag-bundled
 * collection of primitives: STR +1, +20 carry capacity, 1 slot
 * reduction). The user authors the primitives inline → realizes
 * they want to share this between characters → clicks "Wrap as item"
 * → an item row is created, the primitives are bundled into
 * item_primitives, and a character_items row pins it to this
 * character.
 *
 * Flow:
 *   1. Read the items accordion's currently slotted primitives
 *      (filtered by source = "PERSONAL").
 *   2. Create an `items` row owned by the character.
 *   3. Insert `item_primitives` rows for each unique primitive.
 *   4. Insert a `character_items` row that pins the new item to
 *      the character (so the character sheet's ItemsTab shows it
 *      immediately).
 *   5. Auto-publish: set the item's `isPublic` to true if the
 *      request asked for it.
 *
 * Body:
 *   {
 *     name: string,
 *     description?: string,
 *     itemType?: "WEAPON" | "ARMOR" | "ACCESSORY" | "CONSUMABLE" | "AMMO" | "TOOL" | "GENERIC" | "FOCUS",
 *     rarity?: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY",
 *     size?: "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE",
 *     slotCost?: number,
 *     buCost?: number,
 *     isPublic?: boolean,
 *     quantity?: number,  // initial quantity on character_items
 *   }
 *
 * Auth: required; character must be owned by caller; character must be
 * in BUILD mode.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterItems,
  characterPrimitives,
} from "@/db/schema/characters";
import {
  items,
  itemPrimitives,
} from "@/db/schema/items";
import { primitives } from "@/db/schema/engine";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";
import { withCharacterSnapshot } from "@/lib/character/with-character-snapshot";

const ITEM_TYPES = [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
] as const;

const RARITIES = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
] as const;

const SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;

function inAllowed<T extends string>(
  v: unknown,
  allowed: readonly T[],
): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
    const values = body as Record<string, unknown>;

    const name = String(values["name"] ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "name is required." },
        { status: 400 },
      );
    }
    const description =
      typeof values["description"] === "string"
        ? (values["description"] as string).slice(0, 4000)
        : "";
    const itemTypeRaw = values["itemType"] ?? "TRINKET";
    if (!inAllowed(itemTypeRaw, ITEM_TYPES)) {
      return NextResponse.json(
        {
          error: `itemType must be one of ${ITEM_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    const itemType = itemTypeRaw;
    const rarityRaw = values["rarity"] ?? "COMMON";
    if (!inAllowed(rarityRaw, RARITIES)) {
      return NextResponse.json(
        {
          error: `rarity must be one of ${RARITIES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    const rarity = rarityRaw;
    const sizeRaw = values["size"] ?? "SMALL";
    if (!inAllowed(sizeRaw, SIZES)) {
      return NextResponse.json(
        {
          error: `size must be one of ${SIZES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    const size = sizeRaw;
    const slotCost = Math.max(
      0,
      Math.min(20, Math.floor(Number(values["slotCost"] ?? 1))),
    );
    const buCost = Math.max(
      0,
      Math.min(50, Math.floor(Number(values["buCost"] ?? 0))),
    );
    const quantity = Math.max(
      1,
      Math.min(9999, Math.floor(Number(values["quantity"] ?? 1))),
    );
    const isPublic = Boolean(values["isPublic"]);

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
            "Character is in PLAY mode. Switch to BUILD mode to wrap items.",
        },
        { status: 409 },
      );
    }

    // Phase 9.1: pull every primitive instance currently slotted to
    // the items accordion (source = "PERSONAL").
    const slottedRows = await db
      .select({ primitiveId: characterPrimitives.primitiveId })
      .from(characterPrimitives)
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.source, "PERSONAL"),
        ),
      );
    const uniquePrimitiveIds = Array.from(
      new Set(slottedRows.map((r) => r.primitiveId)),
    );
    if (uniquePrimitiveIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "No primitives slotted to the items accordion. Add at least one primitive before wrapping as an item.",
        },
        { status: 400 },
      );
    }

    // Verify every primitive still exists.
    const existingPrimitives = await db
      .select({ id: primitives.id })
      .from(primitives)
      .where(inArray(primitives.id, uniquePrimitiveIds));
    const foundIds = new Set(existingPrimitives.map((p) => p.id));
    const missing = uniquePrimitiveIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Some primitives no longer exist: ${missing.join(", ")}. Refresh the page.`,
        },
        { status: 409 },
      );
    }

    // Compute unique fork-name scoped to (userId, sourceOrigin).
    const sourceOrigin = `user:${userId}`;
    const nameExistsRows = await db
      .select({ name: items.name })
      .from(items)
      .where(eq(items.sourceOrigin, sourceOrigin));
    const takenNames = new Set(nameExistsRows.map((r) => r.name));
    const finalName = await computeUniqueForkName(
      name,
      (candidate) => Promise.resolve(takenNames.has(candidate)),
    );

    // 1. Create the item row.
    const [createdItem] = await db
      .insert(items)
      .values({
        name: finalName,
        description,
        itemType,
        rarity,
        size,
        slotCost,
        buCost,
        quantity: 1,
        isPublic,
        userId,
        sourceOrigin,
      })
      .returning();
    if (!createdItem) {
      return NextResponse.json(
        { error: "Failed to create item." },
        { status: 500 },
      );
    }

    // 2. Insert item_primitives for each unique primitive.
    const itemPrimitiveRows = uniquePrimitiveIds.map(
      (primitiveId, index) => ({
        itemId: createdItem.id,
        primitiveId,
        sortOrder: index,
        isMirrored: false,
      }),
    );
    await db.insert(itemPrimitives).values(itemPrimitiveRows as never);

    // 3. Pin the new item to the character.
    await db.insert(characterItems).values({
      characterId,
      itemId: createdItem.id,
      quantity,
      equipped: false,
      slotSource: "PINNED",
    });

    // 4. Audit log.
    await appendCharacterLog(characterId, "item_formalized", {
      itemId: createdItem.id,
      itemName: createdItem.name,
      primitiveCount: uniquePrimitiveIds.length,
    });

    await withCharacterSnapshot(characterId, async () => {
      // Snapshot captures fresh state after the item formalization
    }, { publishedByUserId: userId });

    bustResolverCache(characterId);

    return NextResponse.json(
      {
        item: createdItem,
        primitiveCount: uniquePrimitiveIds.length,
        characterItem: { characterId, itemId: createdItem.id, quantity },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[characters POST item formalize] failed:", err);
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied → 403.
    if (err instanceof Error && err.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Unable to wrap item.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
