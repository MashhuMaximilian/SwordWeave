import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { capabilities, capabilityPrimitives } from "@/db/schema";
import type { JsonValue } from "@/types/swordweave";

function parseTags(value: unknown): string[] {
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

function parseCapabilityType(
  value: unknown,
): "ACTIVE" | "PASSIVE" | "AUGMENT" | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if (upper === "ACTIVE" || upper === "PASSIVE" || upper === "AUGMENT") {
    return upper;
  }
  return null;
}

function parseSourceType(
  value: unknown,
): "PHYSICAL" | "MAGICAL" | "PSYCHIC" | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if (upper === "PHYSICAL" || upper === "MAGICAL" || upper === "PSYCHIC") {
    return upper;
  }
  return null;
}

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
 * Create a new capability. Requires authentication.
 *
 * Body:
 *   - name (required)
 *   - type: ACTIVE | PASSIVE | AUGMENT (required)
 *   - sourceType: PHYSICAL | MAGICAL | PSYCHIC (required)
 *   - verboseDescription (optional)
 *   - isPublic (default false)
 *   - sourceOrigin (optional, defaults to user identifier)
 *   - tags (string[] or comma-separated)
 *   - metadata (object, optional - typically {totalBu, tier})
 *   - primitiveSlots (array of {primitiveId, role, quantity?, sortOrder?, slotLabel?})
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
    const metadata: Record<string, JsonValue> =
      values["metadata"] && typeof values["metadata"] === "object"
        ? (values["metadata"] as Record<string, JsonValue>)
        : {};

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

    // Create the capability
    const [created] = await db
      .insert(capabilities)
      .values({
        name,
        type,
        sourceType,
        verboseDescription,
        isPublic,
        sourceOrigin,
        tags,
        metadata,
      })
      .returning();

    if (!created) {
      throw new Error("Unable to create capability.");
    }

    return NextResponse.json({ capability: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}