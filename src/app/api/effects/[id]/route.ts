import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { effectPrimitives, effects } from "@/db/schema";

/**
 * GET /api/effects/[id]
 * Get a single effect with all primitive links.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.effects.findFirst({
    where: eq(effects.id, id),
    with: {
      primitiveLinks: {
        with: {
          primitive: true,
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Effect not found." }, { status: 404 });
  }

  return NextResponse.json({ effect: row });
}

/**
 * PATCH /api/effects/[id]
 * Update effect metadata or primitive slots.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};

    if ("name" in values) updatePayload["name"] = String(values["name"]).trim();
    if ("narrativeDescription" in values)
      updatePayload["narrativeDescription"] = String(values["narrativeDescription"]);
    if ("isPublic" in values) updatePayload["isPublic"] = Boolean(values["isPublic"]);
    if ("sourceOrigin" in values)
      updatePayload["sourceOrigin"] = String(values["sourceOrigin"]).trim() || null;

    if ("tags" in values) {
      const tags = Array.isArray(values["tags"])
        ? (values["tags"] as unknown[]).map(String)
        : String(values["tags"])
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      updatePayload["tags"] = tags;
    }

    updatePayload["updatedAt"] = new Date();

    const [updated] = await db
      .update(effects)
      .set(updatePayload)
      .where(eq(effects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Effect not found." }, { status: 404 });
    }

    // Replace primitive slots if provided
    if ("primitiveSlots" in values && Array.isArray(values["primitiveSlots"])) {
      await db.delete(effectPrimitives).where(eq(effectPrimitives.effectId, id));

      const slots = (values["primitiveSlots"] as unknown[]).map(
        (slotValue, index) => {
          const slot = slotValue as Record<string, unknown>;
          return {
            effectId: id,
            primitiveId: Number(slot["primitiveId"]),
            quantity: Number(slot["quantity"] ?? 1),
            sortOrder: Number(slot["sortOrder"] ?? index),
            notes: slot["notes"] ? String(slot["notes"]) : null,
          };
        },
      );

      if (slots.length > 0) {
        await db.insert(effectPrimitives).values(slots);
      }
    }

    const result = await db.query.effects.findFirst({
      where: eq(effects.id, id),
      with: {
        primitiveLinks: {
          with: {
            primitive: true,
          },
        },
      },
    });

    return NextResponse.json({ effect: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/effects/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(effects)
      .where(eq(effects.id, id))
      .returning({ id: effects.id });

    if (!deleted) {
      return NextResponse.json({ error: "Effect not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}