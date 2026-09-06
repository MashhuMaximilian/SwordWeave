/**
 * POST /api/characters/[id]/heritages/formalize
 *
 * Phase 9.1 inline character-builder. Takes the accordion's currently
 * slotted primitives and bakes them into a real heritage row.
 *
 * Flow:
 *   1. Read character + the accordion's primitives (filtered by
 *      `source` = LINEAGE/UPBRINGING/MANIFEST).
 *   2. Create a `heritage` row owned by the character.
 *   3. Insert `heritage_primitives` rows for each unique primitive
 *      in the accordion. Bundled primitive IDs become the heritage's
 *      bundle. (Quantities collapse via the heritage's primary key
 *      (templateId, primitiveId) — the heritage is the bundle; we
 *      don't track per-character quantities at this level.)
 *   4. Update character.lineage_id / upbringing_id / manifest_id to
 *      point at the new heritage row.
 *   5. Set the character's lineageName / upbringingName / manifestName
 *      snapshot fields for legacy read paths that still read them.
 *
 * Body:
 *   {
 *     kind: "LINEAGE" | "UPBRINGING" | "MANIFEST",
 *     name: string,
 *     description?: string,
 *     isPublic?: boolean,
 *   }
 *
 * Auth: required; character must be owned by caller; character must be
 * in BUILD mode.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterPrimitives,
  heritage,
  heritagePrimitives,
  primitives,
} from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  isAccordionKind,
  KIND_TO_COLUMN,
  KIND_TO_SNAPSHOT,
  KIND_TO_SOURCE,
  type AccordionKind,
} from "@/lib/character/inline-builder-types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
    const values = body as Record<string, unknown>;

    if (!isAccordionKind(values["kind"])) {
      return NextResponse.json(
        { error: "kind must be LINEAGE, UPBRINGING, or MANIFEST." },
        { status: 400 },
      );
    }
    const kind = values["kind"] as AccordionKind;
    const name = String(values["name"] ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "name is required." },
        { status: 400 },
      );
    }
    const description =
      typeof values["description"] === "string"
        ? (values["description"] as string)
        : null;
    const isPublic = Boolean(values["isPublic"]);

    // Ownership + mode gate.
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });
    if (!character) {
      return NextResponse.json(
        { error: "Character not found." },
        { status: 404 },
      );
    }
    if (character.userId !== userId) {
      return NextResponse.json(
        { error: "You do not own this character." },
        { status: 403 },
      );
    }
    if (character.mode === "PLAY") {
      return NextResponse.json(
        {
          error:
            "Character is in PLAY mode. Switch to BUILD mode to formalize heritages.",
        },
        { status: 409 },
      );
    }

    // Phase 9.1: pull every primitive instance currently slotted to
    // this accordion. We dedupe by primitiveId for the heritage's
    // bundle (the heritage can't represent multiple copies of the
    // same primitive — that's a character-level concern).
    const slottedRows = await db
      .select({ primitiveId: characterPrimitives.primitiveId })
      .from(characterPrimitives)
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.source, KIND_TO_SOURCE[kind]),
        ),
      );
    const uniquePrimitiveIds = Array.from(
      new Set(slottedRows.map((r) => r.primitiveId)),
    );
    if (uniquePrimitiveIds.length === 0) {
      return NextResponse.json(
        {
          error: `No primitives slotted to the ${kind} accordion. Add at least one primitive before formalizing.`,
        },
        { status: 400 },
      );
    }

    // Verify every primitive still exists (cascade race protection).
    const existingPrimitives = await db
      .select({ id: primitives.id })
      .from(primitives)
      .where(inArray(primitives.id, uniquePrimitiveIds));
    const foundIds = new Set(existingPrimitives.map((p) => p.id));
    const missing = uniquePrimitiveIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Some primitives no longer exist: ${missing.join(", ")}. Refresh the page.`,
        },
        { status: 409 },
      );
    }

    // Compute a unique fork-name (e.g. "Mystic (copy)" / "Mystic (copy) 2").
    // The heritage's (name, kind, source_origin) unique constraint
    // will collide if another heritage with the same name + kind
    // exists; the walker handles this.
    const sourceOrigin = `user:${userId}`;
    // Build a nameExists predicate scoped to this kind + source_origin.
    const nameExistsRows = await db
      .select({ name: heritage.name })
      .from(heritage)
      .where(
        and(
          eq(heritage.kind, kind),
          eq(heritage.sourceOrigin, sourceOrigin),
        ),
      );
    const takenNames = new Set(nameExistsRows.map((r) => r.name));
    const finalName = await computeUniqueForkName(
      name,
      (candidate) => Promise.resolve(takenNames.has(candidate)),
    );

    // 1. Create the heritage row.
    const [createdHeritage] = await db
      .insert(heritage)
      .values({
        userId,
        kind,
        name: finalName,
        description,
        isPublic,
        sourceOrigin,
      })
      .returning();
    if (!createdHeritage) {
      return NextResponse.json(
        { error: "Failed to create heritage." },
        { status: 500 },
      );
    }

    // 2. Insert heritage_primitives for each unique primitive.
    const heritagePrimitiveRows = uniquePrimitiveIds.map(
      (primitiveId, index) => ({
        templateId: createdHeritage.id,
        primitiveId,
        sortOrder: index,
        isMirrored: false,
      }),
    );
    await db.insert(heritagePrimitives).values(
      heritagePrimitiveRows as never,
    );

    // 3. Update character lineage_id / upbringing_id / manifest_id.
    const snapshotField = KIND_TO_SNAPSHOT[kind];
    const snapshotValue = createdHeritage.name;
    const updateSet: Record<string, unknown> = {
      [KIND_TO_COLUMN[kind]]: createdHeritage.id,
      [snapshotField]: snapshotValue,
      // Phase 9.1: also refresh the description snapshot if the user
      // supplied one.
      ...(description
        ? { [`${kind.toLowerCase()}Description` as string]: description }
        : {}),
    };
    await db
      .update(characters)
      .set(updateSet)
      .where(eq(characters.id, characterId));

    // 4. Audit log.
    await appendCharacterLog(characterId, "heritage_formalized", {
      heritageId: createdHeritage.id,
      kind,
      accordionKind: kind,
      primitiveCount: uniquePrimitiveIds.length,
    });

    bustResolverCache(characterId);

    return NextResponse.json(
      {
        heritage: createdHeritage,
        primitiveCount: uniquePrimitiveIds.length,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[characters POST heritage formalize] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to formalize heritage.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
