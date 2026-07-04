import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterCapabilities,
  characterItems,
  characterPrimitives,
  characters,
} from "@/db/schema";
import { validateAttributes, type Attribute } from "@/lib/engine/practices";

const VALID_SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;
type CharacterSize = (typeof VALID_SIZES)[number];

const VALID_ATTRS: readonly Attribute[] = ["PHYSICAL", "MENTAL", "MAGICAL"];

function parseSize(value: unknown): CharacterSize {
  if (typeof value !== "string") return "MEDIUM";
  const upper = value.toUpperCase();
  if ((VALID_SIZES as readonly string[]).includes(upper)) {
    return upper as CharacterSize;
  }
  return "MEDIUM";
}

function parseAttribute(value: unknown): Attribute | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_ATTRS as readonly string[]).includes(upper)) {
    return upper as Attribute;
  }
  return null;
}

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
 * GET /api/characters
 *
 * Lists characters. If authenticated, returns user's characters + public ones.
 * Optional filter: ?user=me
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userFilter = searchParams.get("user");

  let whereClause: ReturnType<typeof eq> | undefined;
  if (userFilter === "me") {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    whereClause = eq(characters.userId, userId);
  }

  const rows = await db.query.characters.findMany({
    where: whereClause,
    orderBy: [asc(characters.level), asc(characters.name)],
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
    },
  });

  return NextResponse.json({ characters: rows });
}

/**
 * POST /api/characters
 *
 * Create a new character. Requires authentication.
 *
 * Body:
 *   - name (required)
 *   - size (default MEDIUM)
 *   - level (1-20, default 1)
 *   - attrPhysical, attrMental, attrMagical (must sum to 10, each in [-1, 5])
 *   - attrProficient (PHYSICAL | MENTAL | MAGICAL, optional)
 *   - practiceSlices (object, optional)
 *   - raceName, raceImageUrl, raceDescription (optional — direct fields)
 *   - backgroundName, backgroundImageUrl, backgroundDescription (optional)
 *   - archetypeName (optional)
 *   - startingBu (default 25)
 *   - buSpent (default 0) — must be ≤ starting_bu + (level-1)*5 + dm_bonus_bu
 *   - dmBonusBu (default 0)
 *   - enforceTemplateCaps (default false)
 *   - isPublic (default false)
 *   - primitiveIds (with source/acquiredAtLevel/notes per primitive, optional)
 *   - capabilityIds (optional)
 *   - itemIds (optional)
 *   - notes, dmNotes, portraitUrl (optional)
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

    const size = parseSize(values["size"]);
    const level = parseIntInRange(values["level"], 1, 20, 1);
    const attrPhysical = parseIntInRange(values["attrPhysical"], -1, 5, 0);
    const attrMental = parseIntInRange(values["attrMental"], -1, 5, 0);
    const attrMagical = parseIntInRange(values["attrMagical"], -1, 5, 0);
    const attrProficient = parseAttribute(values["attrProficient"]);

    // Validate attributes sum to 10 and within range
    const attrCheck = validateAttributes({
      physical: attrPhysical,
      mental: attrMental,
      magical: attrMagical,
    });
    if (!attrCheck.valid) {
      return NextResponse.json(
        { error: "Invalid attributes.", details: attrCheck.errors },
        { status: 400 },
      );
    }
    if (attrPhysical + attrMental + attrMagical !== 10) {
      return NextResponse.json(
        { error: "Attributes must sum to exactly 10." },
        { status: 400 },
      );
    }

    const startingBu = parseIntInRange(values["startingBu"], 0, 1000, 25);
    const buSpent = parseIntInRange(values["buSpent"], 0, 10000, 0);
    const dmBonusBu = parseIntInRange(values["dmBonusBu"], 0, 1000, 0);

    // Validate BU hard cap (server-side enforcement)
    const progressionPool = startingBu + (level - 1) * 5 + dmBonusBu;
    if (buSpent > progressionPool) {
      return NextResponse.json(
        {
          error: `BU spent (${buSpent}) exceeds progression cap (${progressionPool})`,
        },
        { status: 400 },
      );
    }

    const enforceTemplateCaps = Boolean(values["enforceTemplateCaps"]);
    const isPublic = Boolean(values["isPublic"]);
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || "manual";

    const practiceSlices =
      values["practiceSlices"] && typeof values["practiceSlices"] === "object"
        ? (values["practiceSlices"] as Record<string, unknown>)
        : {};

    const raceName = String(values["raceName"] ?? "").trim() || null;
    const raceImageUrl = String(values["raceImageUrl"] ?? "").trim() || null;
    const raceDescription = String(values["raceDescription"] ?? "").trim() || null;
    const backgroundName = String(values["backgroundName"] ?? "").trim() || null;
    const backgroundImageUrl = String(values["backgroundImageUrl"] ?? "").trim() || null;
    const backgroundDescription = String(values["backgroundDescription"] ?? "").trim() || null;
    const archetypeName = String(values["archetypeName"] ?? "").trim() || null;
    const notes = String(values["notes"] ?? "").trim() || null;
    const dmNotes = String(values["dmNotes"] ?? "").trim() || null;
    const portraitUrl = String(values["portraitUrl"] ?? "").trim() || null;

    const primitiveIds = parseStringArray(values["primitiveIds"]);
    const capabilityIds = parseUuidArray(values["capabilityIds"]);
    const itemIds = parseUuidArray(values["itemIds"]);

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(characters)
        .values({
          userId,
          name,
          size,
          level,
          attrPhysical,
          attrMental,
          attrMagical,
          attrProficient,
          practiceSlices,
          raceName,
          raceImageUrl,
          raceDescription,
          backgroundName,
          backgroundImageUrl,
          backgroundDescription,
          archetypeName,
          startingBu,
          buSpent,
          dmBonusBu,
          enforceTemplateCaps,
          isPublic,
          sourceOrigin,
          notes,
          dmNotes,
          portraitUrl,
        })
        .returning();

      if (!created) throw new Error("Unable to create character.");

      if (primitiveIds.length > 0) {
        await tx.insert(characterPrimitives).values(
          primitiveIds.map((pid) => ({
            characterId: created.id,
            primitiveId: pid,
            source: "PERSONAL" as const,
            acquiredAtLevel: level,
          })),
        );
      }
      if (capabilityIds.length > 0) {
        await tx.insert(characterCapabilities).values(
          capabilityIds.map((cid) => ({
            characterId: created.id,
            capabilityId: cid,
            acquiredAtLevel: level,
          })),
        );
      }
      if (itemIds.length > 0) {
        await tx.insert(characterItems).values(
          itemIds.map((iid) => ({
            characterId: created.id,
            itemId: iid,
          })),
        );
      }

      return tx.query.characters.findFirst({
        where: eq(characters.id, created.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          itemLinks: { with: { item: true } },
        },
      });
    });

    return NextResponse.json({ character: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}