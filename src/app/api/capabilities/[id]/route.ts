import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { capabilities, capabilityPrimitives, primitives } from "@/db/schema";
import {
  buildAssemblyAndComputeBU,
  parsePrimitiveSlots,
  parseTags,
  safeMetadata,
  type PrimitiveLike,
} from "@/lib/api/capability-helpers";
import type { JsonValue } from "@/types/swordweave";

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
 * Update capability metadata and/or primitive slots atomically.
 *
 * Body:
 *   - name, type, sourceType, verboseDescription, isPublic, tags, metadata
 *   - primitiveSlots: full replacement of all primitive links
 *
 * Server-authoritative: totalBu is recomputed from primitives whenever
 * slots change; client `previewBu` is always ignored.
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
    const existing = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, id),
      columns: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Capability not found." }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "You can only edit capabilities you own." },
        { status: 403 },
      );
    }

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

    if ("tags" in values) updatePayload["tags"] = parseTags(values["tags"]);

    // Server-authoritative metadata: if slots change, totalBu is recomputed.
    // Otherwise just preserve client metadata (but strip previewBu).
    let needsMetadataRewrite = false;
    if ("metadata" in values) {
      const md = safeMetadata(values["metadata"]);
      if ("previewBu" in md) delete (md as Record<string, unknown>)["previewBu"];
      updatePayload["metadata"] = md;
      needsMetadataRewrite = true;
    }

    updatePayload["updatedAt"] = new Date();

    // If primitiveSlots provided, replace all existing links (atomic)
    let slotsChanged = false;
    let slots: ReturnType<typeof parsePrimitiveSlots> = [];
    if ("primitiveSlots" in values && values["primitiveSlots"] != null) {
      slots = parsePrimitiveSlots(values["primitiveSlots"]);
      slotsChanged = true;
    }

    const result = await db.transaction(async (tx) => {
      if (Object.keys(updatePayload).length > 0) {
        const [updated] = await tx
          .update(capabilities)
          .set(updatePayload)
          .where(eq(capabilities.id, id))
          .returning();

        if (!updated) {
          throw new Error("Capability not found.");
        }
      }

      if (slotsChanged) {
        // Server-compute BU
        let totalBu = 0;
        if (slots.length > 0) {
          const primitiveIds = slots.map((s) => s.primitiveId);
          const primitiveRows = await tx
            .select()
            .from(primitives)
            .where(inArray(primitives.id, primitiveIds));

          if (primitiveRows.length !== new Set(primitiveIds).size) {
            const foundIds = new Set(primitiveRows.map((p) => p.id));
            const missing = primitiveIds.filter((pid) => !foundIds.has(pid));
            throw new Error(`Unknown primitiveIds: ${missing.join(", ")}`);
          }

          const primitivesById: ReadonlyMap<string, PrimitiveLike> = new Map(
            primitiveRows.map((p) => [
              String(p.id),
              {
                id: String(p.id),
                name: p.name,
                category: p.category,
                buCost: p.buCost,
              },
            ]),
          );

          // Need name/type/sourceType for assembly — pull from current row
          const current = await tx.query.capabilities.findFirst({
            where: eq(capabilities.id, id),
          });
          if (!current) throw new Error("Capability not found.");

          const { totalBu: computed } = buildAssemblyAndComputeBU(
            slots,
            primitivesById,
            {
              id,
              name: current.name,
              type: current.type,
              sourceType: current.sourceType,
              description: current.verboseDescription || undefined,
            },
          );
          totalBu = computed;
        }

        // Wipe + rewrite primitive links
        await tx.delete(capabilityPrimitives).where(eq(capabilityPrimitives.capabilityId, id));
        if (slots.length > 0) {
          await tx.insert(capabilityPrimitives).values(
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

        // Update metadata.totalBu
        const current = await tx.query.capabilities.findFirst({
          where: eq(capabilities.id, id),
        });
        if (current) {
          const existingMd = safeMetadata(current.metadata);
          const newMd: Record<string, JsonValue> = {
            ...existingMd,
            totalBu,
            compiledAt: new Date().toISOString(),
          };
          if ("previewBu" in newMd) delete (newMd as Record<string, unknown>)["previewBu"];

          await tx
            .update(capabilities)
            .set({ metadata: newMd, updatedAt: new Date() })
            .where(eq(capabilities.id, id));
        }
      }

      // Return full capability with links
      return tx.query.capabilities.findFirst({
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
    const { userId } = await auth.protect();
    const { id } = await params;

    // Ownership gate: system content (user_id IS NULL) cannot be deleted via API.
    const existing = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, id),
      columns: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Capability not found." }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "You can only delete capabilities you own." },
        { status: 403 },
      );
    }

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