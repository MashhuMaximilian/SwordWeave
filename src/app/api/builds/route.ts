import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  buildCapabilities,
  builds,
} from "@/db/schema";

function parseIntInRange(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseStringArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function parseUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

/**
 * GET /api/builds
 *
 * Lists builds. By default: public + user-owned (if authenticated).
 * Optional filter: ?user=me
 * Optional filter: ?archetype=true (only archetype templates)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userFilter = searchParams.get("user");
  const archetypeFilter = searchParams.get("archetype");

  let whereClause: ReturnType<typeof eq>[] = [];
  if (userFilter === "me") {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    whereClause.push(eq(builds.userId, userId));
  }
  if (archetypeFilter === "true") {
    whereClause.push(eq(builds.isArchetypeTemplate, true));
  }

  const rows = await db.query.builds.findMany({
    where: whereClause.length > 0 ? whereClause[0] : undefined,
    orderBy: [asc(builds.level), asc(builds.name)],
    with: {
      capabilityLinks: { with: { capability: true } },
      race: true,
      background: true,
    },
  });

  return NextResponse.json({ builds: rows });
}

/**
 * POST /api/builds
 *
 * Create a new build (snapshot). Requires authentication.
 *
 * Body:
 *   - name (required)
 *   - description (optional)
 *   - level (1-20, default 1)
 *   - startingBu (default 25)
 *   - isArchetypeTemplate (default false) — archetype builds are pre-built character templates
 *   - raceName, raceDescription, backgroundName, backgroundDescription (snapshot fields)
 *   - raceId, backgroundId (optional refs to templates library)
 *   - attrPhysical, attrMental, attrMagical, attrProficient (optional snapshot)
 *   - practiceSlices (optional)
 *   - portraitUrl (optional)
 *   - isPublic (default false)
 *   - capabilityIds (optional — frozen list of capabilities this build grants)
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
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const description = String(values["description"] ?? "").trim() || null;
    const level = parseIntInRange(values["level"], 1, 20, 1);
    const startingBu = parseIntInRange(values["startingBu"], 0, 1000, 25);
    const isArchetypeTemplate = Boolean(values["isArchetypeTemplate"]);
    const isPublic = Boolean(values["isPublic"]);

    const raceName = String(values["raceName"] ?? "").trim() || null;
    const raceDescription = String(values["raceDescription"] ?? "").trim() || null;
    const raceId = String(values["raceId"] ?? "").trim() || null;
    const backgroundName = String(values["backgroundName"] ?? "").trim() || null;
    const backgroundDescription = String(values["backgroundDescription"] ?? "").trim() || null;
    const backgroundId = String(values["backgroundId"] ?? "").trim() || null;
    const archetypeName = String(values["archetypeName"] ?? "").trim() || null;
    const portraitUrl = String(values["portraitUrl"] ?? "").trim() || null;
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || "manual:build";

    // Phase 8: per-entity iconography. Same shape as the other entity
    // tables. Empty string is coerced to null; invalid colors fall
    // through to the DB default (#ffffff) which is set on the column.
    const iconSourceRaw = values["iconSource"];
    const iconSource: "GAME_ICONS" | "UPLOAD" | null =
      iconSourceRaw === "GAME_ICONS" || iconSourceRaw === "UPLOAD"
        ? iconSourceRaw
        : null;
    const iconKey = String(values["iconKey"] ?? "").trim() || null;
    const iconUrl = String(values["iconUrl"] ?? "").trim() || null;
    const iconColor =
      String(values["iconColor"] ?? "").trim() || "#ffffff";

    // Optional attributes
    const attrPhysical = "attrPhysical" in values ? parseIntInRange(values["attrPhysical"], -1, 5, 0) : null;
    const attrMental = "attrMental" in values ? parseIntInRange(values["attrMental"], -1, 5, 0) : null;
    const attrMagical = "attrMagical" in values ? parseIntInRange(values["attrMagical"], -1, 5, 0) : null;

    const capabilityIds = parseUuidArray(values["capabilityIds"]);
    const primitiveIds = parseStringArray(values["primitiveIds"]);

    const practiceSlices =
      values["practiceSlices"] && typeof values["practiceSlices"] === "object"
        ? (values["practiceSlices"] as Record<string, unknown>)
        : null;

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(builds)
        .values({
          userId,
          name,
          description,
          level,
          startingBu,
          isArchetypeTemplate,
          raceName,
          raceDescription,
          raceId,
          backgroundName,
          backgroundDescription,
          backgroundId,
          archetypeName,
          attrPhysical,
          attrMental,
          attrMagical,
          attrProficient: null,
          practiceSlices: practiceSlices ?? null,
          portraitUrl,
          iconSource,
          iconKey,
          iconUrl,
          iconColor,
          isPublic,
          sourceOrigin,
        })
        .returning();

      if (!created) throw new Error("Unable to create build.");

      if (capabilityIds.length > 0) {
        await tx.insert(buildCapabilities).values(
          capabilityIds.map((cid) => ({
            buildId: created.id,
            capabilityId: cid,
            acquiredAtLevel: level,
          })),
        );
      }

      // primitives are stored only if explicitly provided (rare for builds)
      // — most builds express power via capabilities, not raw primitives
      void primitiveIds;

      return tx.query.builds.findFirst({
        where: eq(builds.id, created.id),
        with: {
          capabilityLinks: { with: { capability: true } },
          race: true,
          background: true,
        },
      });
    });

    return NextResponse.json({ build: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}