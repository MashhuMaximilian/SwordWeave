import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { asc, or, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import {
  isPrimitiveCategory,
  parseHardModifiers,
  type PrimitiveCategoryValue,
} from "@/lib/packages/primitive-package";

export async function GET() {
  const user = await currentUser();
  const rows = await db.query.primitives.findMany({
    where: user
      ? or(
          eq(primitives.isPublic, true),
          isNull(primitives.userId),
          eq(primitives.userId, user.id),
        )
      : or(eq(primitives.isPublic, true), isNull(primitives.userId)),
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  return NextResponse.json({ primitives: rows });
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const name = String(values["name"] ?? "").trim();
    const isPublic = Boolean(values["isPublic"]);
    const category = String(values["category"] ?? "");
    const costTier = String(values["costTier"] ?? "").trim();
    const buCost = Number(values["buCost"]);
    const mechanicalOutputText = String(
      values["mechanicalOutputText"] ?? "",
    ).trim();
    const narrativeRule = String(values["narrativeRule"] ?? "").trim();
    const isMirrorable = Boolean(values["isMirrorable"]);
    const mirrorVector = String(values["mirrorVector"] ?? "STANDARD_ONLY").trim();
    const mirrorBuCredit = Number(values["mirrorBuCredit"] ?? 0);
    const mirrorEligibilityNotes = String(
      values["mirrorEligibilityNotes"] ?? "",
    ).trim();
    const hardModifiers = parseHardModifiers(values["hardModifiers"]);

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!isPrimitiveCategory(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }

    if (!Number.isInteger(buCost) || buCost < 0) {
      return NextResponse.json(
        { error: "BU cost must be a non-negative integer." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(mirrorBuCredit) || mirrorBuCredit < 0) {
      return NextResponse.json(
        { error: "Mirror BU credit must be a non-negative integer." },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(primitives)
      .values({
        name,
        userId,
        isPublic,
        category: category as PrimitiveCategoryValue,
        costTier: costTier || "Tier 1: Minor (1-2 BU)",
        buCost,
        mechanicalOutputText,
        narrativeRule,
        isMirrorable,
        mirrorVector: isMirrorable ? mirrorVector || "VARIABLE_VECTOR" : "STANDARD_ONLY",
        mirrorBuCredit: isMirrorable ? mirrorBuCredit : 0,
        mirrorEligibilityNotes,
        hardModifiers,
      })
      .onConflictDoUpdate({
        target: [primitives.name, primitives.category, primitives.userId],
        set: {
          costTier: costTier || "Tier 1: Minor (1-2 BU)",
          userId,
          isPublic,
          buCost,
          mechanicalOutputText,
          narrativeRule,
          isMirrorable,
          mirrorVector: isMirrorable
            ? mirrorVector || "VARIABLE_VECTOR"
            : "STANDARD_ONLY",
          mirrorBuCredit: isMirrorable ? mirrorBuCredit : 0,
          mirrorEligibilityNotes,
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
