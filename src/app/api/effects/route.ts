import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { effectPrimitives, effects } from "@/db/schema";

type PrimitiveSlotInput = {
  primitiveId: number;
  quantity: number;
  notes?: string | undefined;
};

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function parsePrimitiveSlots(value: unknown): PrimitiveSlotInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Effect primitives must be an array.");
  }

  const slots = value.map((slotValue) => {
    if (!slotValue || typeof slotValue !== "object") {
      throw new Error("Effect primitive slot must be an object.");
    }

    const slot = slotValue as Record<string, unknown>;
    const primitiveId = Number(slot["primitiveId"]);
    const quantity = Number(slot["quantity"] ?? 1);

    if (!Number.isInteger(primitiveId) || primitiveId <= 0) {
      throw new Error("Primitive slot id must be a positive integer.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Primitive slot quantity must be a positive integer.");
    }

    return {
      primitiveId,
      quantity,
      notes: String(slot["notes"] ?? "").trim() || undefined,
    };
  });

  const mergedSlots = new Map<number, PrimitiveSlotInput>();

  for (const slot of slots) {
    const existing = mergedSlots.get(slot.primitiveId);

    if (existing) {
      mergedSlots.set(slot.primitiveId, {
        ...existing,
        quantity: existing.quantity + slot.quantity,
      });
    } else {
      mergedSlots.set(slot.primitiveId, slot);
    }
  }

  return [...mergedSlots.values()];
}

export async function GET() {
  const rows = await db.query.effects.findMany({
    orderBy: [desc(effects.createdAt), asc(effects.name)],
    with: {
      primitiveLinks: {
        orderBy: [asc(effectPrimitives.sortOrder)],
        with: {
          primitive: true,
        },
      },
    },
  });

  return NextResponse.json({ effects: rows });
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const name = String(values["name"] ?? "").trim();
    const narrativeDescription = String(
      values["narrativeDescription"] ?? "",
    ).trim();
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || null;
    const tags = parseTags(values["tags"]);
    const isPublic = Boolean(values["isPublic"]);
    const primitiveSlots = parsePrimitiveSlots(values["primitiveSlots"]);

    if (!name) {
      return NextResponse.json({ error: "Effect name is required." }, { status: 400 });
    }

    if (primitiveSlots.length === 0) {
      return NextResponse.json(
        { error: "Slot at least one primitive into the effect." },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(effects)
      .values({
        name,
        userId,
        narrativeDescription,
        sourceOrigin,
        tags,
        isPublic,
      })
      .returning();

    if (!created) {
      throw new Error("Unable to create effect.");
    }

    await db.insert(effectPrimitives).values(
      primitiveSlots.map((slot, index) => ({
        effectId: created.id,
        primitiveId: slot.primitiveId,
        quantity: slot.quantity,
        sortOrder: index,
        notes: slot.notes,
      })),
    );

    const effect = await db.query.effects.findFirst({
      where: (table, { eq }) => eq(table.id, created.id),
      with: {
        primitiveLinks: {
          orderBy: [asc(effectPrimitives.sortOrder)],
          with: {
            primitive: true,
          },
        },
      },
    });

    return NextResponse.json({ effect }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
