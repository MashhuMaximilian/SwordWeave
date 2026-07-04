import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { capabilities, capabilityPrimitives } from "@/db/schema";

type CapabilityPrimitiveRole =
  | "VERB"
  | "DOMAIN"
  | "SIZING"
  | "RANGE"
  | "DURATION"
  | "OUTPUT"
  | "AUGMENT"
  | "OTHER";

function parseRole(value: unknown): CapabilityPrimitiveRole | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  const valid: CapabilityPrimitiveRole[] = [
    "VERB",
    "DOMAIN",
    "SIZING",
    "RANGE",
    "DURATION",
    "OUTPUT",
    "AUGMENT",
    "OTHER",
  ];
  if ((valid as string[]).includes(upper)) {
    return upper as CapabilityPrimitiveRole;
  }
  return null;
}

function parsePrimitiveSlots(value: unknown): Array<{
  primitiveId: number;
  role: CapabilityPrimitiveRole;
  quantity: number;
  sortOrder: number;
  slotLabel: string | null;
  notes: string | null;
}> {
  if (!Array.isArray(value)) {
    throw new Error("primitiveSlots must be an array.");
  }

  return value.map((slotValue, index) => {
    if (!slotValue || typeof slotValue !== "object") {
      throw new Error("Each primitive slot must be an object.");
    }
    const slot = slotValue as Record<string, unknown>;
    const primitiveId = Number(slot["primitiveId"]);
    const role = parseRole(slot["role"]);
    const quantity = Number(slot["quantity"] ?? 1);

    if (!Number.isInteger(primitiveId) || primitiveId <= 0) {
      throw new Error("primitiveId must be a positive integer.");
    }
    if (!role) {
      throw new Error(
        "role must be one of: VERB, DOMAIN, SIZING, RANGE, DURATION, OUTPUT, AUGMENT, OTHER.",
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("quantity must be a positive integer.");
    }

    return {
      primitiveId,
      role,
      quantity,
      sortOrder: Number(slot["sortOrder"] ?? index),
      slotLabel: slot["slotLabel"] ? String(slot["slotLabel"]) : null,
      notes: slot["notes"] ? String(slot["notes"]) : null,
    };
  });
}

/**
 * GET /api/capabilities/[id]
 * Get a single capability with all its primitive links.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.capabilities.findFirst({
    where: eq(capabilities.id, id),
    with: {
      primitiveLinks: {
        with: {
          primitive: true,
        },
      },
      effectLinks: {
        with: {
          effect: true,
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Capability not found." }, { status: 404 });
  }

  return NextResponse.json({ capability: row });
}

/**
 * PATCH /api/capabilities/[id]
 * Update capability metadata or primitive slots.
 *
 * Body:
 *   - name, type, sourceType, verboseDescription, isPublic, tags, metadata: any field to update
 *   - primitiveSlots: full replacement of all primitive links (clean slate)
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

    // Build update payload
    const updatePayload: Record<string, unknown> = {};

    if ("name" in values) updatePayload["name"] = String(values["name"]).trim();
    if ("type" in values) {
      const type = String(values["type"]).toUpperCase();
      if (!["ACTIVE", "PASSIVE", "AUGMENT"].includes(type)) {
        return NextResponse.json(
          { error: "type must be ACTIVE, PASSIVE, or AUGMENT." },
          { status: 400 },
        );
      }
      updatePayload["type"] = type;
    }
    if ("sourceType" in values) {
      const sourceType = String(values["sourceType"]).toUpperCase();
      if (!["PHYSICAL", "MAGICAL", "PSYCHIC"].includes(sourceType)) {
        return NextResponse.json(
          { error: "sourceType must be PHYSICAL, MAGICAL, or PSYCHIC." },
          { status: 400 },
        );
      }
      updatePayload["sourceType"] = sourceType;
    }
    if ("verboseDescription" in values)
      updatePayload["verboseDescription"] = String(values["verboseDescription"]);
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

    if ("metadata" in values) {
      const metadata =
        values["metadata"] && typeof values["metadata"] === "object"
          ? values["metadata"]
          : {};
      updatePayload["metadata"] = metadata;
    }

    updatePayload["updatedAt"] = new Date();

    const [updated] = await db
      .update(capabilities)
      .set(updatePayload)
      .where(eq(capabilities.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Capability not found." }, { status: 404 });
    }

    // If primitiveSlots provided, replace all existing links
    if ("primitiveSlots" in values) {
      await db.delete(capabilityPrimitives).where(eq(capabilityPrimitives.capabilityId, id));

      const slots = parsePrimitiveSlots(values["primitiveSlots"]);
      if (slots.length > 0) {
        await db.insert(capabilityPrimitives).values(
          slots.map((slot) => ({
            capabilityId: id,
            primitiveId: slot.primitiveId,
            role: slot.role,
            quantity: slot.quantity,
            sortOrder: slot.sortOrder,
            slotLabel: slot.slotLabel,
            notes: slot.notes,
          })),
        );
      }
    }

    // Fetch the full updated capability
    const result = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, id),
      with: {
        primitiveLinks: {
          with: {
            primitive: true,
          },
        },
      },
    });

    return NextResponse.json({ capability: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/capabilities/[id]
 * Delete a capability and all its primitive links (cascade).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(capabilities)
      .where(eq(capabilities.id, id))
      .returning({ id: capabilities.id });

    if (!deleted) {
      return NextResponse.json({ error: "Capability not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}