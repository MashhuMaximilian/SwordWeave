import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  heritageCapabilities,
  heritagePrimitives,
  heritage,
} from "@/db/schema";

/**
 * POST /api/heritage/[id]/clone
 *
 * Deep copies a template. Caller becomes the new owner.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    const source = await db.query.heritage.findFirst({
      where: eq(heritage.id, id),
      with: {
        primitiveLinks: true,
        capabilityLinks: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const newName = uniqueCloneName(source.name);

      const [created] = await tx
        .insert(heritage)
        .values({
          userId,
          kind: source.kind,
          name: newName,
          imageUrl: source.imageUrl,
          description: source.description,
          suggestedTraits: source.suggestedTraits,
          isPublic: false,
          sourceOrigin: `clone:${source.id}`,
        })
        .returning();

      if (!created) throw new Error("Unable to clone template.");

      if (source.primitiveLinks.length > 0) {
        await tx.insert(heritagePrimitives).values(
          source.primitiveLinks.map((p) => ({
            templateId: created.id,
            primitiveId: p.primitiveId,
            sortOrder: p.sortOrder,
            notes: p.notes,
          })),
        );
      }

      if (source.capabilityLinks.length > 0) {
        await tx.insert(heritageCapabilities).values(
          source.capabilityLinks.map((c) => ({
            templateId: created.id,
            capabilityId: c.capabilityId,
          })),
        );
      }

      return tx.query.heritage.findFirst({
        where: eq(heritage.id, created.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
        },
      });
    });

    return NextResponse.json({ template: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function uniqueCloneName(original: string): string {
  if (original.match(/\(Copy(?:\s\d+)?\)$/)) {
    const base = original.replace(/\(Copy(?:\s\d+)?\)$/, "").trim();
    return `${base} (Copy 2)`;
  }
  return `${original} (Copy)`;
}