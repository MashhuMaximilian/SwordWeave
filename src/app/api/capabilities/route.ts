import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { capabilities, capabilityPrimitives, primitives } from "@/db/schema";
import {
  buildAssemblyAndComputeBU,
  parseCapabilityType,
  parsePrimitiveSlots,
  parseSourceType,
  parseTags,
  safeMetadata,
  type PrimitiveLike,
} from "@/lib/api/capability-helpers";

/**
 * GET /api/capabilities
 *
 * Lists capabilities. Public + user-owned (if authenticated).
 * Returns capabilities with their primitive links.
 */
export async function GET() {
  const rows = await db.query.capabilities.findMany({
    where: eq(capabilities.isPublic, true),
    orderBy: [asc(capabilities.name)],
    with: {
      primitiveLinks: {
        orderBy: [asc(capabilityPrimitives.sortOrder)],
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

  return NextResponse.json({ capabilities: rows });
}

/**
 * POST /api/capabilities
 *
 * Atomically create a capability with its primitive slots.
 * The server computes totalBu from the provided primitives — clients
 * cannot lie about cost.
 *
 * Body:
 *   - name (required)
 *   - type: ACTIVE | PASSIVE | AUGMENT (required)
 *   - sourceType: PHYSICAL | MAGICAL | PSYCHIC (required)
 *   - verboseDescription (optional)
 *   - isPublic (default false)
 *   - sourceOrigin (optional)
 *   - tags (string[] or comma-separated)
 *   - metadata (object, optional — `previewBu` from client is IGNORED)
 *   - primitiveSlots (array of {primitiveId, role, quantity?, sortOrder?, slotLabel?, notes?})
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
    const type = parseCapabilityType(values["type"]);
    const sourceType = parseSourceType(values["sourceType"]);
    const verboseDescription = String(values["verboseDescription"] ?? "").trim();
    const isPublic = Boolean(values["isPublic"]);
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || null;
    const tags = parseTags(values["tags"]);
    const clientMetadata = safeMetadata(values["metadata"]);

    if (!name) {
      return NextResponse.json({ error: "Capability name is required." }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json(
        { error: "Type must be ACTIVE, PASSIVE, or AUGMENT." },
        { status: 400 },
      );
    }
    if (!sourceType) {
      return NextResponse.json(
        { error: "Source type must be PHYSICAL, MAGICAL, or PSYCHIC." },
        { status: 400 },
      );
    }

    // Parse primitive slots first (may throw on bad input)
    let slots: ReturnType<typeof parsePrimitiveSlots> = [];
    if ("primitiveSlots" in values && values["primitiveSlots"] != null) {
      slots = parsePrimitiveSlots(values["primitiveSlots"]);
    }

    // Server-authoritative BU computation
    let totalBu = 0;
    let primitivesById: ReadonlyMap<string, PrimitiveLike> = new Map();
    if (slots.length > 0) {
      const primitiveIds = slots.map((s) => s.primitiveId);
      const primitiveRows = await db
        .select()
        .from(primitives)
        .where(inArray(primitives.id, primitiveIds));

      if (primitiveRows.length !== new Set(primitiveIds).size) {
        const foundIds = new Set(primitiveRows.map((p) => p.id));
        const missing = primitiveIds.filter((id) => !foundIds.has(id));
        return NextResponse.json(
          { error: `Unknown primitiveIds: ${missing.join(", ")}` },
          { status: 400 },
        );
      }

      primitivesById = new Map(
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

      const result = buildAssemblyAndComputeBU(
        slots,
        primitivesById,
        {
          id: "temp", // server overwrites after insert
          name,
          type,
          sourceType,
          description: verboseDescription || undefined,
        },
      );
      totalBu = result.totalBu;
    }

    // Authoritative metadata: drop client's previewBu, inject server BU
    const metadata = {
      ...clientMetadata,
      totalBu,
      compiledAt: new Date().toISOString(),
    };
    // Strip the client-lied previewBu (if any) from the metadata
    if ("previewBu" in metadata) {
      delete (metadata as Record<string, unknown>)["previewBu"];
    }

    // Atomic insert: capability + primitive links in a transaction
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(capabilities)
        .values({
          name,
          type,
          sourceType,
          verboseDescription,
          isPublic,
          userId,
          sourceOrigin,
          tags,
          metadata,
        })
        .returning();

      if (!created) {
        throw new Error("Unable to create capability.");
      }

      if (slots.length > 0) {
        await tx.insert(capabilityPrimitives).values(
          slots.map((slot) => ({
            capabilityId: created.id,
            primitiveId: slot.primitiveId,
            role: slot.role,
            quantity: slot.quantity,
            sortOrder: slot.sortOrder,
            slotLabel: slot.slotLabel,
            notes: slot.notes,
          })),
        );
      }

      // Return full capability with links
      return tx.query.capabilities.findFirst({
        where: eq(capabilities.id, created.id),
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

    return NextResponse.json({ capability: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}