import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterCapabilities,
  characterItems,
  characterPrimitives,
  characters,
  primitives,
  capabilities,
  items,
} from "@/db/schema";
import { validateAttributes, type Attribute } from "@/lib/engine/practices";
import { validateMirrorSet } from "@/lib/api/volatility";
import {
  resolveLatestVersionId,
  resolveSlotSource,
} from "@/lib/versions/slot-source";

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

    // Mirrored primitive IDs (subset of primitiveIds) — acquires each as a
    // mirror vector (negative BU). Subject to level-based volatility ceiling
    // enforced by validateMirrorSet() below. See BU Market canon, Section
    // "Tier-Matched Volatility Ceiling".
    const mirroredPrimitiveIds = parseStringArray(
      values["mirroredPrimitiveIds"],
    ).filter((id) => primitiveIds.includes(id)); // sanity: mirrors must be in the primitive set

    // Validate volatility ceiling BEFORE writing (fail fast).
    const volCheck = await validateMirrorSet(
      level,
      mirroredPrimitiveIds,
      primitiveIds,
    );
    if (!volCheck.ok) {
      return NextResponse.json(
        {
          error: volCheck.error,
          ceiling: volCheck.ceiling,
          rating: volCheck.rating,
          bracket: volCheck.bracket,
          offendingPrimitiveId: volCheck.offendingPrimitiveId,
        },
        { status: volCheck.status },
      );
    }

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
        const mirrorSet = new Set(mirroredPrimitiveIds);
        // Phase 5: load entity rows to compute version_id + slot_source.
        // Both are derived from the entity at slot-add time, then frozen
        // on the junction row. The slot then points to a specific
        // content-addressed version, not the entity by id.
        const primRows = primitiveIds.length > 0
          ? await db
              .select({
                id: primitives.id,
                userId: primitives.userId,
                sourceOrigin: primitives.sourceOrigin,
              })
              .from(primitives)
              .where(inArray(primitives.id, primitiveIds))
          : [];
        const primMap = new Map(primRows.map((r) => [r.id, r]));
        const slotsWithVersion = await Promise.all(
          primitiveIds.map(async (pid) => {
            const prim = primMap.get(pid);
            const versionId = await resolveLatestVersionId("primitive", pid);
            const slotSource = prim
              ? resolveSlotSource({
                  entity: prim,
                  callerUserId: userId,
                })
              : "PINNED";
            return {
              characterId: created.id,
              primitiveId: pid,
              source: "PERSONAL" as const,
              acquiredAtLevel: level,
              isMirrored: mirrorSet.has(pid),
              versionId,
              slotSource,
            };
          }),
        );
        await tx.insert(characterPrimitives).values(slotsWithVersion);
      }
      if (capabilityIds.length > 0) {
        // Phase 5: same wire-up for capabilities.
        const capRows = await db
          .select({
            id: capabilities.id,
            userId: capabilities.userId,
            sourceOrigin: capabilities.sourceOrigin,
          })
          .from(capabilities)
          .where(inArray(capabilities.id, capabilityIds));
        const capMap = new Map(capRows.map((r) => [r.id, r]));
        const slotsWithVersion = await Promise.all(
          capabilityIds.map(async (cid) => {
            const cap = capMap.get(cid);
            const versionId = await resolveLatestVersionId("capability", cid);
            const slotSource = cap
              ? resolveSlotSource({
                  entity: cap,
                  callerUserId: userId,
                })
              : "PINNED";
            return {
              characterId: created.id,
              capabilityId: cid,
              acquiredAtLevel: level,
              versionId,
              slotSource,
            };
          }),
        );
        await tx.insert(characterCapabilities).values(slotsWithVersion);
      }
      if (itemIds.length > 0) {
        // Phase 5: same wire-up for items.
        const itemRows = await db
          .select({
            id: items.id,
            userId: items.userId,
            sourceOrigin: items.sourceOrigin,
          })
          .from(items)
          .where(inArray(items.id, itemIds));
        const itemMap = new Map(itemRows.map((r) => [r.id, r]));
        const slotsWithVersion = await Promise.all(
          itemIds.map(async (iid) => {
            const item = itemMap.get(iid);
            const versionId = await resolveLatestVersionId("item", iid);
            const slotSource = item
              ? resolveSlotSource({
                  entity: item,
                  callerUserId: userId,
                })
              : "PINNED";
            return {
              characterId: created.id,
              itemId: iid,
              versionId,
              slotSource,
            };
          }),
        );
        await tx.insert(characterItems).values(slotsWithVersion);
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