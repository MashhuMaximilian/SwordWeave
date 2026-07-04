import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { effectPrimitives, effects } from "@/db/schema";

/**
 * POST /api/effects/[id]/clone
 * Creates a user-owned editable copy of an effect.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    const source = await db.query.effects.findFirst({
      where: eq(effects.id, id),
      with: {
        primitiveLinks: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Effect not found." }, { status: 404 });
    }

    // Generate unique name
    let newName = `${source.name} (Copy)`;
    let copyNumber = 2;
    while (true) {
      const existing = await db.query.effects.findFirst({
        where: eq(effects.name, newName),
      });
      if (!existing) break;
      newName = `${source.name} (Copy ${copyNumber})`;
      copyNumber++;
      if (copyNumber > 99) {
        return NextResponse.json(
          { error: "Too many copies of this effect. Rename some first." },
          { status: 400 },
        );
      }
    }

    const [cloned] = await db
      .insert(effects)
      .values({
        name: newName,
        userId,
        narrativeDescription: source.narrativeDescription,
        isPublic: false,
        sourceOrigin: `Cloned from ${source.name}`,
        tags: source.tags,
      })
      .returning();

    if (!cloned) {
      throw new Error("Failed to create cloned effect.");
    }

    // Copy primitive links
    if (source.primitiveLinks.length > 0) {
      await db.insert(effectPrimitives).values(
        source.primitiveLinks.map((link) => ({
          effectId: cloned.id,
          primitiveId: link.primitiveId,
          quantity: link.quantity,
          sortOrder: link.sortOrder,
          notes: link.notes,
        })),
      );
    }

    const result = await db.query.effects.findFirst({
      where: eq(effects.id, cloned.id),
      with: {
        primitiveLinks: {
          with: {
            primitive: true,
          },
        },
      },
    });

    return NextResponse.json({ effect: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}