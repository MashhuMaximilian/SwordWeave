import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { buildCapabilities, builds } from "@/db/schema";

function parseIntInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function parseUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

function emptyToNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

/**
 * GET /api/builds/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.builds.findFirst({
    where: eq(builds.id, id),
    with: {
      capabilityLinks: { with: { capability: true } },
      race: true,
      background: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Build not found." }, { status: 404 });
  }

  return NextResponse.json({ build: row });
}

/**
 * PATCH /api/builds/[id]
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
    if ("description" in values) updatePayload["description"] = emptyToNull(values["description"]);
    if ("level" in values) {
      const lv = parseIntInRange(values["level"], 1, 20);
      if (lv === null) return NextResponse.json({ error: "level must be 1-20." }, { status: 400 });
      updatePayload["level"] = lv;
    }
    if ("startingBu" in values) {
      const v = parseIntInRange(values["startingBu"], 0, 1000);
      if (v === null) return NextResponse.json({ error: "startingBu must be 0-1000." }, { status: 400 });
      updatePayload["startingBu"] = v;
    }
    if ("isArchetypeTemplate" in values) updatePayload["isArchetypeTemplate"] = Boolean(values["isArchetypeTemplate"]);
    if ("isPublic" in values) updatePayload["isPublic"] = Boolean(values["isPublic"]);
    if ("raceName" in values) updatePayload["raceName"] = emptyToNull(values["raceName"]);
    if ("raceDescription" in values) updatePayload["raceDescription"] = emptyToNull(values["raceDescription"]);
    if ("raceId" in values) updatePayload["raceId"] = emptyToNull(values["raceId"]);
    if ("backgroundName" in values) updatePayload["backgroundName"] = emptyToNull(values["backgroundName"]);
    if ("backgroundDescription" in values) updatePayload["backgroundDescription"] = emptyToNull(values["backgroundDescription"]);
    if ("backgroundId" in values) updatePayload["backgroundId"] = emptyToNull(values["backgroundId"]);
    if ("archetypeName" in values) updatePayload["archetypeName"] = emptyToNull(values["archetypeName"]);
    if ("portraitUrl" in values) updatePayload["portraitUrl"] = emptyToNull(values["portraitUrl"]);

    // Phase 8: per-entity iconography — same shape as the POST route.
    if ("iconSource" in values) {
      const s = values["iconSource"];
      updatePayload["iconSource"] =
        s === "GAME_ICONS" || s === "UPLOAD" ? s : null;
    }
    if ("iconKey" in values) updatePayload["iconKey"] = emptyToNull(values["iconKey"]);
    if ("iconUrl" in values) updatePayload["iconUrl"] = emptyToNull(values["iconUrl"]);
    if ("iconColor" in values) {
      const c = String(values["iconColor"] ?? "").trim();
      // Always set — never accept the empty string. Falls back to the
      // DB default if the client sent nothing or whitespace.
      updatePayload["iconColor"] = c || "#ffffff";
    }

    if ("attrPhysical" in values) {
      const v = parseIntInRange(values["attrPhysical"], -1, 5);
      if (v === null) return NextResponse.json({ error: "attrPhysical must be -1 to 5." }, { status: 400 });
      updatePayload["attrPhysical"] = v;
    }
    if ("attrMental" in values) {
      const v = parseIntInRange(values["attrMental"], -1, 5);
      if (v === null) return NextResponse.json({ error: "attrMental must be -1 to 5." }, { status: 400 });
      updatePayload["attrMental"] = v;
    }
    if ("attrMagical" in values) {
      const v = parseIntInRange(values["attrMagical"], -1, 5);
      if (v === null) return NextResponse.json({ error: "attrMagical must be -1 to 5." }, { status: 400 });
      updatePayload["attrMagical"] = v;
    }

    if ("practiceSlices" in values) {
      updatePayload["practiceSlices"] =
        values["practiceSlices"] && typeof values["practiceSlices"] === "object"
          ? values["practiceSlices"]
          : null;
    }

    updatePayload["updatedAt"] = new Date();

    const result = await db.transaction(async (tx) => {
      if (Object.keys(updatePayload).length > 0) {
        await tx.update(builds).set(updatePayload).where(eq(builds.id, id));
      }

      if ("capabilityIds" in values) {
        const capabilityIds = parseUuidArray(values["capabilityIds"]);
        await tx.delete(buildCapabilities).where(eq(buildCapabilities.buildId, id));
        if (capabilityIds.length > 0) {
          await tx.insert(buildCapabilities).values(
            capabilityIds.map((cid) => ({
              buildId: id,
              capabilityId: cid,
              acquiredAtLevel: (updatePayload["level"] as number) ?? 1,
            })),
          );
        }
      }

      return tx.query.builds.findFirst({
        where: eq(builds.id, id),
        with: {
          capabilityLinks: { with: { capability: true } },
          race: true,
          background: true,
        },
      });
    });

    return NextResponse.json({ build: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/builds/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(builds)
      .where(eq(builds.id, id))
      .returning({ id: builds.id });

    if (!deleted) {
      return NextResponse.json({ error: "Build not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}