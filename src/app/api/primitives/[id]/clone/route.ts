import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";

/**
 * POST /api/primitives/[id]/clone
 *
 * Creates a user-owned editable copy of a primitive.
 * Per UX-WORKFLOW-SPEC: "Clone = frozen copy + check-for-updates button".
 * For now: a deep copy with provenance metadata.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    const sourceId = Number(id);
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      return NextResponse.json({ error: "Invalid primitive id." }, { status: 400 });
    }

    const source = await db.query.primitives.findFirst({
      where: eq(primitives.id, sourceId),
    });

    if (!source) {
      return NextResponse.json({ error: "Primitive not found." }, { status: 404 });
    }

    // Generate unique name
    let newName = `${source.name} (Copy)`;
    let copyNumber = 2;
    while (true) {
      const existing = await db.query.primitives.findFirst({
        where: eq(primitives.name, newName),
      });
      if (!existing) break;
      newName = `${source.name} (Copy ${copyNumber})`;
      copyNumber++;
      if (copyNumber > 99) {
        return NextResponse.json(
          { error: "Too many copies of this primitive. Rename some first." },
          { status: 400 },
        );
      }
    }

    const [cloned] = await db
      .insert(primitives)
      .values({
        name: newName,
        userId,
        isPublic: false,
        category: source.category,
        costTier: source.costTier,
        buCost: source.buCost,
        mechanicalOutputText: source.mechanicalOutputText,
        narrativeRule: source.narrativeRule,
        isMirrorable: source.isMirrorable,
        mirrorVector: source.mirrorVector,
        mirrorBuCredit: source.mirrorBuCredit,
        mirrorEligibilityNotes: source.mirrorEligibilityNotes,
        hardModifiers: source.hardModifiers,
      })
      .returning();

    if (!cloned) {
      throw new Error("Failed to create cloned primitive.");
    }

    return NextResponse.json({ primitive: cloned }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}