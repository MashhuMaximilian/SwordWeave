import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  items,
  primitives,
} from "@/db/schema";
import {
  buildCanonicalItemPayload,
  computeItemContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";

export const ITEM_PRIMITIVE_CATEGORY = "ITEM_AUGMENT";

const VALID_TYPES = [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
] as const;
type ItemType = (typeof VALID_TYPES)[number];

const VALID_RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;
type ItemRarity = (typeof VALID_RARITIES)[number];

function parseType(value: unknown): ItemType | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_TYPES as readonly string[]).includes(upper)) {
    return upper as ItemType;
  }
  return null;
}

function parseRarity(value: unknown): ItemRarity | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_RARITIES as readonly string[]).includes(upper)) {
    return upper as ItemRarity;
  }
  return null;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((t) => t.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

function parseIntInRange(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * GET /api/items
 *
 * Lists public items.
 * Optional filters: ?type=WEAPON|ARMOR|TRINKET|ARTIFACT|CONSUMABLE
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const rarityFilter = searchParams.get("rarity");

  const whereClauses = [eq(items.isPublic, true)];
  const type = typeFilter ? parseType(typeFilter) : null;
  if (type) whereClauses.push(eq(items.itemType, type));
  const rarity = rarityFilter ? parseRarity(rarityFilter) : null;
  if (rarity) whereClauses.push(eq(items.rarity, rarity));

  const rows = await db.query.items.findMany({
    where: whereClauses.length === 1 ? whereClauses[0] : undefined,
    orderBy: [asc(items.name)],
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      effectLinks: { with: { effect: true } },
    },
  });

  return NextResponse.json({ items: rows });
}

/**
 * POST /api/items
 *
 * Create a new item. Requires authentication.
 *
 * Body:
 *   - name (required)
 *   - itemType: WEAPON|ARMOR|TRINKET|ARTIFACT|CONSUMABLE (required)
 *   - rarity (default COMMON)
 *   - buCost (integer, default 0)
 *   - description (optional)
 *   - slotCost (integer, default 1)
 *   - isTwoHanded, isConsumable, actsAsFocus (booleans)
 *   - isPublic (default false)
 *   - tags (string[] or comma-separated)
 *   - primitiveIds (array — must all be item-augment category)
 *   - capabilityIds (array — capabilities granted when equipped)
 *   - effectIds (array — effects granted when equipped)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const name = String(values["name"] ?? "").trim();
    const itemType = parseType(values["itemType"]);
    const rarity = parseRarity(values["rarity"]) ?? "COMMON";
    const buCost = parseIntInRange(values["buCost"], 0, 1000);
    const description = String(values["description"] ?? "").trim();
    const slotCost = parseIntInRange(values["slotCost"], 1, 100);
    // Quantity: any positive integer, no upper cap (per the user's spec —
    // consumables and other types can stack freely).
    const quantity = Math.max(1, Number(values["quantity"]) || 1);
    const isTwoHanded = Boolean(values["isTwoHanded"]);
    const isConsumable = Boolean(values["isConsumable"]);
    const actsAsFocus = Boolean(values["actsAsFocus"]);
    const isPublic = Boolean(values["isPublic"]);
    const tags = parseTags(values["tags"]);
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || null;

    // Phase 7 Q-M-UX: accept primitiveSlots ({primitiveId, isMirrored}[]).
    // Fall back to primitiveIds (number[]) for legacy payloads.
    const primitiveSlotsInput = Array.isArray(values["primitiveSlots"])
      ? (values["primitiveSlots"] as unknown[]).map((slotValue) => {
          const slot = slotValue as Record<string, unknown>;
          return {
            primitiveId: Number(slot["primitiveId"] ?? slot["id"]),
            isMirrored: Boolean(
              slot["is_mirrored"] ?? slot["isMirrored"] ?? false,
            ),
          };
        })
      : [];
    const legacyPrimitiveIds = Array.isArray(values["primitiveIds"])
      ? (values["primitiveIds"] as unknown[])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
          .map((id) => ({ primitiveId: id, isMirrored: false }))
      : [];
    const primitiveSlots =
      primitiveSlotsInput.length > 0 ? primitiveSlotsInput : legacyPrimitiveIds;
    const capabilityIds = Array.isArray(values["capabilityIds"])
      ? (values["capabilityIds"] as unknown[]).filter((c) => typeof c === "string")
      : [];
    const effectIds = Array.isArray(values["effectIds"])
      ? (values["effectIds"] as unknown[]).filter((e) => typeof e === "string")
      : [];

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!itemType) {
      return NextResponse.json(
        {
          error: `itemType must be one of: ${VALID_TYPES.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    // Validate primitives are item-augment
    let validSlots: { primitiveId: number; isMirrored: boolean }[] = [];
    if (primitiveSlots.length > 0) {
      const ids = primitiveSlots.map((s) => s.primitiveId);
      const prims = await db
        .select({ id: primitives.id, category: primitives.category, name: primitives.name })
        .from(primitives)
        .where(inArray(primitives.id, ids));
      const wrong = prims.filter((p) => p.category !== ITEM_PRIMITIVE_CATEGORY);
      if (wrong.length > 0) {
        return NextResponse.json(
          {
            error: `Items can only use ${ITEM_PRIMITIVE_CATEGORY} primitives. Invalid: ${wrong.map((p) => p.name).join(", ")}`,
          },
          { status: 400 },
        );
      }
      // Filter input slots against valid primitive IDs (preserving
      // the per-slot isMirrored flag for downstream persistence).
      const validIdSet = new Set(prims.map((p) => p.id));
      validSlots = primitiveSlots.filter((s) => validIdSet.has(s.primitiveId));
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(items)
        .values({
          name,
          itemType,
          rarity,
          buCost,
          description,
          slotCost,
          quantity,
          isTwoHanded,
          isConsumable,
          actsAsFocus,
          isPublic,
          userId,
          sourceOrigin: sourceOrigin ?? `manual:item`,
          tags,
          // Phase 8: per-entity iconography
          iconSource: pickIconSource(values["iconSource"]),
          iconKey: pickStringOrNull(values["iconKey"]),
          iconUrl: pickStringOrNull(values["iconUrl"]),
          iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
        })
        .returning();

      if (!created) throw new Error("Unable to create item.");

      if (validSlots.length > 0) {
        await tx.insert(itemPrimitives).values(
          validSlots.map((slot, idx) => ({
            itemId: created.id,
            primitiveId: slot.primitiveId,
            sortOrder: idx,
            // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
            isMirrored: slot.isMirrored,
          })),
        );
      }
      if (capabilityIds.length > 0) {
        await tx.insert(itemCapabilities).values(
          capabilityIds.map((cid) => ({
            itemId: created.id,
            capabilityId: cid as string,
          })),
        );
      }
      if (effectIds.length > 0) {
        await tx.insert(itemEffects).values(
          effectIds.map((eid) => ({
            itemId: created.id,
            effectId: eid as string,
          })),
        );
      }

      return tx.query.items.findFirst({
        where: eq(items.id, created.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          effectLinks: { with: { effect: true } },
        },
      });
    });

    if (!result) {
      throw new Error("Unable to create item.");
    }

    // Phase 4: compute content hash + auto-snapshot.
    const canonicalPayload = buildCanonicalItemPayload({
      name: result.name,
      itemType: result.itemType,
      rarity: result.rarity,
      buCost: result.buCost,
      description: result.description,
      slotCost: result.slotCost,
      quantity: result.quantity,
      isTwoHanded: result.isTwoHanded,
      isConsumable: result.isConsumable,
      actsAsFocus: result.actsAsFocus,
      isPublic: result.isPublic,
      tags: result.tags,
      primitiveIds: validSlots.map((s) => s.primitiveId),
      primitiveSlots: validSlots,
      capabilityIds,
      effectIds,
    });
    const contentHash = await computeItemContentHash({
      name: result.name,
      itemType: result.itemType,
      rarity: result.rarity,
      buCost: result.buCost,
      description: result.description,
      slotCost: result.slotCost,
      quantity: result.quantity,
      isTwoHanded: result.isTwoHanded,
      isConsumable: result.isConsumable,
      actsAsFocus: result.actsAsFocus,
      isPublic: result.isPublic,
      tags: result.tags,
      primitiveIds: validSlots.map((s) => s.primitiveId),
      primitiveSlots: validSlots,
      capabilityIds,
      effectIds,
    });
    await db.update(items).set({ contentHash }).where(eq(items.id, result.id));
    await recordVersion({
      entityKind: "item",
      entityId: result.id,
      contentHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    return NextResponse.json({ item: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * Phase 8: per-entity iconography helpers. See the matching block in
 * src/app/api/primitives/route.ts for the rationale.
 */
function pickIconSource(value: unknown): "GAME_ICONS" | "UPLOAD" | null {
  if (value === "GAME_ICONS" || value === "UPLOAD") return value;
  return null;
}
function pickStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function pickStringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}