import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
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
const VALID_ATTRS: readonly Attribute[] = ["PHYSICAL", "MENTAL", "MAGICAL"];

function parseSize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_SIZES as readonly string[]).includes(upper)) return upper;
  return null;
}

function parseAttribute(value: unknown): Attribute | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_ATTRS as readonly string[]).includes(upper)) return upper as Attribute;
  return null;
}

function parseIntInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
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

function emptyToNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

/**
 * GET /api/characters/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }

  return NextResponse.json({ character: row });
}

/**
 * PATCH /api/characters/[id]
 *
 * Updates mutable character fields. Re-validates BU cap if buSpent/level/dmBonusBu/startingBu changed.
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

    // Get current state for validation
    const current = await db.query.characters.findFirst({
      where: eq(characters.id, id),
    });
    if (!current) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {};

    if ("name" in values) updatePayload["name"] = String(values["name"]).trim();
    if ("size" in values) {
      const s = parseSize(values["size"]);
      if (!s) {
        return NextResponse.json(
          { error: `size must be one of: ${VALID_SIZES.join(", ")}.` },
          { status: 400 },
        );
      }
      updatePayload["size"] = s;
    }
    if ("level" in values) {
      const lv = parseIntInRange(values["level"], 1, 20);
      if (lv === null) {
        return NextResponse.json({ error: "Level must be an integer 1-20." }, { status: 400 });
      }
      updatePayload["level"] = lv;
    }

    // Attributes (validate sum + range)
    const attrKeys: ("attrPhysical" | "attrMental" | "attrMagical")[] = [
      "attrPhysical",
      "attrMental",
      "attrMagical",
    ];
    let attrs: { physical: number; mental: number; magical: number } = {
      physical: current.attrPhysical,
      mental: current.attrMental,
      magical: current.attrMagical,
    };
    for (const k of attrKeys) {
      if (k in values) {
        const v = parseIntInRange(values[k], -1, 5);
        if (v === null) {
          return NextResponse.json(
            { error: `${k} must be an integer in [-1, 5].` },
            { status: 400 },
          );
        }
        attrs[k.replace("attr", "").toLowerCase() as "physical" | "mental" | "magical"] = v;
        updatePayload[k] = v;
      }
    }
    const attrCheck = validateAttributes(attrs);
    if (!attrCheck.valid) {
      return NextResponse.json(
        { error: "Invalid attributes.", details: attrCheck.errors },
        { status: 400 },
      );
    }
    if (attrs.physical + attrs.mental + attrs.magical !== 10) {
      return NextResponse.json(
        { error: "Attributes must sum to exactly 10." },
        { status: 400 },
      );
    }

    if ("attrProficient" in values) {
      updatePayload["attrProficient"] = parseAttribute(values["attrProficient"]);
    }
    if ("practiceSlices" in values) {
      updatePayload["practiceSlices"] =
        values["practiceSlices"] && typeof values["practiceSlices"] === "object"
          ? values["practiceSlices"]
          : {};
    }

    if ("startingBu" in values) {
      const v = parseIntInRange(values["startingBu"], 0, 1000);
      if (v === null) return NextResponse.json({ error: "startingBu must be 0-1000." }, { status: 400 });
      updatePayload["startingBu"] = v;
    }
    if ("buSpent" in values) {
      const v = parseIntInRange(values["buSpent"], 0, 10000);
      if (v === null) return NextResponse.json({ error: "buSpent must be 0-10000." }, { status: 400 });
      updatePayload["buSpent"] = v;
    }
    if ("dmBonusBu" in values) {
      const v = parseIntInRange(values["dmBonusBu"], 0, 1000);
      if (v === null) return NextResponse.json({ error: "dmBonusBu must be 0-1000." }, { status: 400 });
      updatePayload["dmBonusBu"] = v;
    }

    // Validate progression cap with merged values
    const mergedLevel = (updatePayload["level"] as number | undefined) ?? current.level;
    const mergedStarting = (updatePayload["startingBu"] as number | undefined) ?? current.startingBu;
    const mergedBonus = (updatePayload["dmBonusBu"] as number | undefined) ?? current.dmBonusBu;
    const mergedSpent = (updatePayload["buSpent"] as number | undefined) ?? current.buSpent;
    const pool = mergedStarting + (mergedLevel - 1) * 5 + mergedBonus;
    if (mergedSpent > pool) {
      return NextResponse.json(
        {
          error: `BU spent (${mergedSpent}) exceeds progression cap (${pool})`,
        },
        { status: 400 },
      );
    }

    if ("enforceTemplateCaps" in values) {
      updatePayload["enforceTemplateCaps"] = Boolean(values["enforceTemplateCaps"]);
    }
    if ("isPublic" in values) updatePayload["isPublic"] = Boolean(values["isPublic"]);
    if ("raceName" in values) updatePayload["raceName"] = emptyToNull(values["raceName"]);
    if ("raceImageUrl" in values) updatePayload["raceImageUrl"] = emptyToNull(values["raceImageUrl"]);
    if ("raceDescription" in values) updatePayload["raceDescription"] = emptyToNull(values["raceDescription"]);
    if ("backgroundName" in values) updatePayload["backgroundName"] = emptyToNull(values["backgroundName"]);
    if ("backgroundImageUrl" in values) updatePayload["backgroundImageUrl"] = emptyToNull(values["backgroundImageUrl"]);
    if ("backgroundDescription" in values) updatePayload["backgroundDescription"] = emptyToNull(values["backgroundDescription"]);
    if ("archetypeName" in values) updatePayload["archetypeName"] = emptyToNull(values["archetypeName"]);
    if ("notes" in values) updatePayload["notes"] = emptyToNull(values["notes"]);
    if ("dmNotes" in values) updatePayload["dmNotes"] = emptyToNull(values["dmNotes"]);
    if ("portraitUrl" in values) updatePayload["portraitUrl"] = emptyToNull(values["portraitUrl"]);
    if ("currentVitality" in values) {
      const v = parseIntInRange(values["currentVitality"], 0, 9999);
      if (v === null) return NextResponse.json({ error: "currentVitality must be a non-negative integer." }, { status: 400 });
      updatePayload["currentVitality"] = v;
    }

    updatePayload["updatedAt"] = new Date();

    const result = await db.transaction(async (tx) => {
      if (Object.keys(updatePayload).length > 0) {
        await tx.update(characters).set(updatePayload).where(eq(characters.id, id));
      }

      if ("primitiveIds" in values) {
        const primitiveIds = parseStringArray(values["primitiveIds"]);
        await tx.delete(characterPrimitives).where(eq(characterPrimitives.characterId, id));
        if (primitiveIds.length > 0) {
          await tx.insert(characterPrimitives).values(
            primitiveIds.map((pid) => ({
              characterId: id,
              primitiveId: pid,
              source: "PERSONAL" as const,
              acquiredAtLevel: mergedLevel,
            })),
          );
        }
      }

      if ("capabilityIds" in values) {
        const capabilityIds = parseUuidArray(values["capabilityIds"]);
        await tx.delete(characterCapabilities).where(eq(characterCapabilities.characterId, id));
        if (capabilityIds.length > 0) {
          await tx.insert(characterCapabilities).values(
            capabilityIds.map((cid) => ({
              characterId: id,
              capabilityId: cid,
              acquiredAtLevel: mergedLevel,
            })),
          );
        }
      }

      if ("itemIds" in values) {
        const itemIds = parseUuidArray(values["itemIds"]);
        await tx.delete(characterItems).where(eq(characterItems.characterId, id));
        if (itemIds.length > 0) {
          await tx.insert(characterItems).values(
            itemIds.map((iid) => ({
              characterId: id,
              itemId: iid,
            })),
          );
        }
      }

      return tx.query.characters.findFirst({
        where: eq(characters.id, id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          itemLinks: { with: { item: true } },
        },
      });
    });

    return NextResponse.json({ character: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/characters/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(characters)
      .where(eq(characters.id, id))
      .returning({ id: characters.id });

    if (!deleted) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}