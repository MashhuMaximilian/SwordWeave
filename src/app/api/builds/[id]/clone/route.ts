import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { buildCapabilities, builds } from "@/db/schema";

/**
 * POST /api/builds/[id]/clone
 *
 * Deep-copies a build. Caller becomes owner. Original build left untouched.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    const source = await db.query.builds.findFirst({
      where: eq(builds.id, id),
      with: { capabilityLinks: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Build not found." }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const newName = uniqueCloneName(source.name);

      const [created] = await tx
        .insert(builds)
        .values({
          userId,
          name: newName,
          description: source.description,
          level: source.level,
          startingBu: source.startingBu,
          isManifestTemplate: source.isManifestTemplate,
          lineageName: source.lineageName,
          lineageDescription: source.lineageDescription,
          lineageId: source.lineageId,
          upbringingName: source.upbringingName,
          upbringingDescription: source.upbringingDescription,
          upbringingId: source.upbringingId,
          manifestName: source.manifestName,
          attrPhysical: source.attrPhysical,
          attrMental: source.attrMental,
          attrMagical: source.attrMagical,
          attrProficient: source.attrProficient,
          practiceSlices: source.practiceSlices as object | null,
          portraitUrl: source.portraitUrl,
          isPublic: false,
          sourceOrigin: `clone:${source.id}`,
        })
        .returning();

      if (!created) throw new Error("Unable to clone build.");

      if (source.capabilityLinks.length > 0) {
        await tx.insert(buildCapabilities).values(
          source.capabilityLinks.map((c) => ({
            buildId: created.id,
            capabilityId: c.capabilityId,
            acquiredAtLevel: c.acquiredAtLevel,
          })),
        );
      }

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

function uniqueCloneName(original: string): string {
  if (original.match(/\(Copy(?:\s\d+)?\)$/)) {
    const base = original.replace(/\(Copy(?:\s\d+)?\)$/, "").trim();
    return `${base} (Copy 2)`;
  }
  return `${original} (Copy)`;
}