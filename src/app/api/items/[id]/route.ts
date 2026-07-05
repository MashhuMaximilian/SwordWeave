import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  items,
  primitives,
} from "@/db/schema";
import { ITEM_PRIMITIVE_CATEGORY } from "../route";

const VALID_TYPES = [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
] as const;
const VALID_RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

function parseType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_TYPES as readonly string[]).includes(upper)) return upper;
  return null;
}

function parseRarity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_RARITIES as readonly string[]).includes(upper)) return upper;
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
 * GET /api/items/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.items.findFirst({
    where: eq(items.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      effectLinks: { with: { effect: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ item: row });
}

/**
 * PATCH /api/items/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};

    // Ownership gate: load current row to verify caller is the owner.
    // System content (user_id IS NULL) is immutable via this endpoint.
    const existing = await db.query.items.findFirst({
      where: eq(items.id, id),
      columns: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "You can only edit items you own." },
        { status: 403 },
      );
    }

    if ("name" in values) updatePayload["name"] = String(values["name"]).trim();
    if ("itemType" in values) {
      const t = parseType(values["itemType"]);
      if (!t) {
        return NextResponse.json(
          { error: `itemType must be one of: ${VALID_TYPES.join(", ")}.` },
          { status: 400 },
        );
      }
      updatePayload["itemType"] = t;
    }
    if ("rarity" in values) {
      const r = parseRarity(values["rarity"]);
      if (!r) {
        return NextResponse.json(
          { error: `rarity must be one of: ${VALID_RARITIES.join(", ")}.` },
          { status: 400 },
        );
      }
      updatePayload["rarity"] = r;
    }
    if ("buCost" in values)
      updatePayload["buCost"] = parseIntInRange(values["buCost"], 0, 1000);
    if ("description" in values)
      updatePayload["description"] = String(values["description"]).trim();
    if ("slotCost" in values)
      updatePayload["slotCost"] = parseIntInRange(values["slotCost"], 1, 100);
    if ("isTwoHanded" in values)
      updatePayload["isTwoHanded"] = Boolean(values["isTwoHanded"]);
    if ("isConsumable" in values)
      updatePayload["isConsumable"] = Boolean(values["isConsumable"]);
    if ("actsAsFocus" in values)
      updatePayload["actsAsFocus"] = Boolean(values["actsAsFocus"]);
    if ("isPublic" in values)
      updatePayload["isPublic"] = Boolean(values["isPublic"]);
    if ("tags" in values) updatePayload["tags"] = parseTags(values["tags"]);

    updatePayload["updatedAt"] = new Date();

    const result = await db.transaction(async (tx) => {
      if (Object.keys(updatePayload).length > 0) {
        await tx.update(items).set(updatePayload).where(eq(items.id, id));
      }

      if ("primitiveIds" in values) {
        const primitiveIds = Array.isArray(values["primitiveIds"])
          ? (values["primitiveIds"] as unknown[])
              .map(Number)
              .filter((n) => Number.isInteger(n) && n > 0)
          : [];

        if (primitiveIds.length > 0) {
          const prims = await tx
            .select()
            .from(primitives)
            .where(inArray(primitives.id, primitiveIds));
          const wrong = prims.filter(
            (p) => p.category !== ITEM_PRIMITIVE_CATEGORY,
          );
          if (wrong.length > 0) {
            throw new Error(
              `Items can only use ${ITEM_PRIMITIVE_CATEGORY} primitives. Invalid: ${wrong.map((p) => p.name).join(", ")}`,
            );
          }
          await tx.delete(itemPrimitives).where(eq(itemPrimitives.itemId, id));
          await tx.insert(itemPrimitives).values(
            prims.map((p, idx) => ({
              itemId: id,
              primitiveId: p.id,
              sortOrder: idx,
            })),
          );
        } else {
          await tx.delete(itemPrimitives).where(eq(itemPrimitives.itemId, id));
        }
      }

      if ("capabilityIds" in values) {
        const capabilityIds = Array.isArray(values["capabilityIds"])
          ? (values["capabilityIds"] as unknown[]).filter(
              (c) => typeof c === "string",
            )
          : [];
        await tx
          .delete(itemCapabilities)
          .where(eq(itemCapabilities.itemId, id));
        if (capabilityIds.length > 0) {
          await tx.insert(itemCapabilities).values(
            capabilityIds.map((cid) => ({
              itemId: id,
              capabilityId: cid as string,
            })),
          );
        }
      }

      if ("effectIds" in values) {
        const effectIds = Array.isArray(values["effectIds"])
          ? (values["effectIds"] as unknown[]).filter(
              (e) => typeof e === "string",
            )
          : [];
        await tx.delete(itemEffects).where(eq(itemEffects.itemId, id));
        if (effectIds.length > 0) {
          await tx.insert(itemEffects).values(
            effectIds.map((eid) => ({
              itemId: id,
              effectId: eid as string,
            })),
          );
        }
      }

      return tx.query.items.findFirst({
        where: eq(items.id, id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          effectLinks: { with: { effect: true } },
        },
      });
    });

    return NextResponse.json({ item: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/items/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    // Ownership gate: system content (user_id IS NULL) cannot be deleted via API.
    const existing = await db.query.items.findFirst({
      where: eq(items.id, id),
      columns: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "You can only delete items you own." },
        { status: 403 },
      );
    }

    const [deleted] = await db
      .delete(items)
      .where(eq(items.id, id))
      .returning({ id: items.id });

    if (!deleted) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}