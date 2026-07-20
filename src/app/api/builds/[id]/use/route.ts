import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  builds,
  characterCapabilities,
  characters,
} from "@/db/schema";

/**
 * POST /api/builds/[id]/use
 *
 * Instantly create a playable character from this build. Caller becomes owner.
 * The character inherits the build's snapshot fields and capability list.
 *
 * Body (optional):
 *   - characterName: string — override the resulting character's name
 *     (defaults to build name)
 *
 * Returns: { character } — the new character.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));

    const build = await db.query.builds.findFirst({
      where: eq(builds.id, id),
      with: { capabilityLinks: true },
    });

    if (!build) {
      return NextResponse.json({ error: "Build not found." }, { status: 404 });
    }

    // Determine character name
    let characterName = build.name;
    if (body && typeof body === "object") {
      const override = (body as Record<string, unknown>)["characterName"];
      if (typeof override === "string" && override.trim()) {
        characterName = override.trim();
      }
    }

    // Attribute validation: if build has attributes, ensure they sum to 10
    if (
      build.attrPhysical !== null &&
      build.attrMental !== null &&
      build.attrMagical !== null
    ) {
      const sum =
        build.attrPhysical + build.attrMental + build.attrMagical;
      if (sum !== 10) {
        return NextResponse.json(
          {
            error: `Build has invalid attributes (sum=${sum}, expected 10). Fix the build before using.`,
          },
          { status: 400 },
        );
      }
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(characters)
        .values({
          userId,
          name: characterName,
          lineageName: build.lineageName,
          lineageImageUrl: null,
          lineageDescription: build.lineageDescription,
          upbringingName: build.upbringingName,
          upbringingImageUrl: null,
          upbringingDescription: build.upbringingDescription,
          manifestName: build.manifestName,
          level: build.level,
          attrPhysical: build.attrPhysical ?? 0,
          attrMental: build.attrMental ?? 0,
          attrMagical: build.attrMagical ?? 0,
          attrProficient: build.attrProficient,
          practiceSlices:
            (build.practiceSlices as object | null) ?? {},
          portraitUrl: build.portraitUrl,
          startingBu: build.startingBu,
          buSpent: 0,
          dmBonusBu: 0,
          enforceTemplateCaps: false,
          isPublic: false,
          sourceOrigin: `build:${build.id}`,
        })
        .returning();

      if (!created) throw new Error("Unable to create character from build.");

      // Carry over capabilities from build
      if (build.capabilityLinks.length > 0) {
        await tx.insert(characterCapabilities).values(
          build.capabilityLinks.map((c) => ({
            characterId: created.id,
            capabilityId: c.capabilityId,
            acquiredAtLevel: c.acquiredAtLevel,
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

    return NextResponse.json(
      {
        character: result,
        message: `Created character "${result?.name}" from build "${build.name}".`,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}