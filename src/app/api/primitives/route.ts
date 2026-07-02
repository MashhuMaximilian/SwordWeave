import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import type { HardModifier } from "@/types/swordweave";

const primitiveCategories = [
  "VERB_TIER",
  "DOMAIN",
  "SIZING",
  "TARGETING",
  "RANGE",
  "DURATION",
  "OUTPUT",
  "CONDITION",
  "DEFENSE",
  "STRUCTURAL",
  "SHEET_AUGMENT",
] as const;

function parseHardModifiers(value: unknown): readonly HardModifier[] {
  if (Array.isArray(value)) {
    return value as readonly HardModifier[];
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  const parsed: unknown = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error("Hard modifiers must be a JSON array.");
  }

  return parsed as readonly HardModifier[];
}

export async function GET() {
  const rows = await db.query.primitives.findMany({
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  return NextResponse.json({ primitives: rows });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const name = String(values["name"] ?? "").trim();
    const category = String(values["category"] ?? "");
    const costTier = String(values["costTier"] ?? "").trim();
    const buCost = Number(values["buCost"]);
    const mechanicalOutputText = String(
      values["mechanicalOutputText"] ?? "",
    ).trim();
    const narrativeRule = String(values["narrativeRule"] ?? "").trim();
    const hardModifiers = parseHardModifiers(values["hardModifiers"]);

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!primitiveCategories.includes(category as (typeof primitiveCategories)[number])) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }

    if (!Number.isInteger(buCost) || buCost < 0) {
      return NextResponse.json(
        { error: "BU cost must be a non-negative integer." },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(primitives)
      .values({
        name,
        category: category as (typeof primitiveCategories)[number],
        costTier: costTier || "Tier 1: Minor (1-2 BU)",
        buCost,
        mechanicalOutputText,
        narrativeRule,
        hardModifiers,
      })
      .onConflictDoUpdate({
        target: [primitives.name, primitives.category],
        set: {
          costTier: costTier || "Tier 1: Minor (1-2 BU)",
          buCost,
          mechanicalOutputText,
          narrativeRule,
          hardModifiers,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ primitive: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
