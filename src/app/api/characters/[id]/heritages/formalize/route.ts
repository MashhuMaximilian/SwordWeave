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
  characterHeritages,
  characterPrimitives,
  heritage,
  heritagePrimitives,
  primitives,
} from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";
import { withCharacterSnapshot } from "@/lib/character/with-character-snapshot";
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

    // Phase 9.5 follow-up (Mashu 2026-09-07): the form
    // body uses `accordion` not `kind`. The old read
    // (`values["kind"]`) silently produced the "kind must
    // be LINEAGE..." 400 and broke "Create Upbringing".
    // Accept both for forward compat.
    const rawKind = values["accordion"] ?? values["kind"];
    if (!isAccordionKind(rawKind)) {
      return NextResponse.json(
        { error: "kind must be LINEAGE, UPBRINGING, or MANIFEST." },
        { status: 400 },
      );
    }
    const kind = rawKind;
    const name = String(values["name"] ?? "").trim();
    const explicitHeritageId =
      typeof values["heritageId"] === "string" && (values["heritageId"] as string).length > 0
        ? (values["heritageId"] as string)
        : null;
    // Phase 9.5 round 4 (Mashu 2026-09-07): accept either
    // `name` (legacy "create from scratch using accordion
    // primitives") OR `heritageId` (new "attach the template
    // the atelier just saved"). The character-sheet flow
    // uses heritageId so the user gets the exact template
    // they composed in EmbeddedHeritageForm — not a
    // parallel-bundled version made by re-scanning the
    // accordion.
    if (!explicitHeritageId && !name) {
      return NextResponse.json(
        { error: "Either name or heritageId is required." },
        { status: 400 },
      );
    }
    const description =
      typeof values["description"] === "string"
        ? (values["description"] as string)
        : null;
    const isPublic = Boolean(values["isPublic"]);

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    const { character } = await resolveCharacterAccess(userId, characterId, {
      require: "OWNER",
    });
    if (character.mode === "PLAY") {
      return NextResponse.json(
        {
          error:
            "Character is in PLAY mode. Switch to BUILD mode to formalize heritages.",
        },
        { status: 409 },
      );
    }

    let resolvedHeritageId: string;
    let resolvedHeritageName: string;
    let resolvedDescription: string | null;
    let resolvedIsPublic: boolean;
    // Phase 9.5 round 4 (Mashu 2026-09-07): declared at
    // outer scope so the audit log can read it even when
    // we took the heritageId branch (where it's unused).
    let uniquePrimitiveIds: number[] = [];

    if (explicitHeritageId) {
      // Phase 9.5 round 4 (Mashu 2026-09-07): attach the
      // template the user just saved in EmbeddedHeritageForm.
      // We deliberately do NOT re-bundle the accordion — the
      // template already has its own heritage_primitives
      // from the atelier save.
      const templateRow = await db.query.heritage.findFirst({
        where: eq(heritage.id, explicitHeritageId),
      });
      if (!templateRow) {
        return NextResponse.json(
          { error: `Heritage ${explicitHeritageId} not found.` },
          { status: 404 },
        );
      }
      if (templateRow.userId !== userId) {
        return NextResponse.json(
          { error: "You do not own this heritage template." },
          { status: 403 },
        );
      }
      // De-dupe: if this template is already slotted, return
      // early with 200 (not 201) so the UI treats it as a
      // no-op refresh instead of duplicating work.
      const existing = await db.query.characterHeritages.findFirst({
        where: and(
          eq(characterHeritages.characterId, characterId),
          eq(characterHeritages.heritageId, explicitHeritageId),
        ),
      });
      if (existing) {
        bustResolverCache(characterId);
        return NextResponse.json(
          {
            heritage: templateRow,
            alreadyAttached: true,
          },
          { status: 200 },
        );
      }
      resolvedHeritageId = explicitHeritageId;
      resolvedHeritageName = templateRow.name;
      resolvedDescription = templateRow.description ?? null;
      resolvedIsPublic = templateRow.isPublic;
    } else {
      // Legacy create-from-scratch flow: bundle every
      // primitive currently slotted to this accordion into
      // a brand-new heritage row.
      const slottedRows = await db
        .select({ primitiveId: characterPrimitives.primitiveId })
        .from(characterPrimitives)
        .where(
          and(
            eq(characterPrimitives.characterId, characterId),
            eq(characterPrimitives.source, KIND_TO_SOURCE[kind]),
          ),
        );
      uniquePrimitiveIds = Array.from(
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
      const sourceOrigin = `user:${userId}`;
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
      const [createdHeritage] = await db
        .insert(heritage)
        .values({
          userId,
          kind,
          name: finalName,
          description: description ?? null,
          isPublic: isPublic,
          sourceOrigin,
        })
        .returning();
      if (!createdHeritage) {
        return NextResponse.json(
          { error: "Failed to create heritage." },
          { status: 500 },
        );
      }
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
      resolvedHeritageId = createdHeritage.id;
      resolvedHeritageName = createdHeritage.name;
      resolvedDescription = createdHeritage.description ?? null;
      resolvedIsPublic = createdHeritage.isPublic;
    }

    // 3. Update character lineage_id / upbringing_id / manifest_id
    // (the "primary" heritage pointer used by the sheet's
    // accordion header) AND insert into character_heritages
    // (the N:M table the resolver reads to enumerate attached
    // heritages — without this, the bundle doesn't show up
    // in the lineage accordion).
    //
    // Phase 9.5 round 4 (Mashu 2026-09-07): legacy flow
    // only updated the FK columns, leaving
    // character_heritages empty. The resolver then saw
    // "Lineage (0)" even though lineageId was set. Both
    // writes now happen.
    const snapshotField = KIND_TO_SNAPSHOT[kind];
    const snapshotValue = resolvedHeritageName;
    const updateSet: Record<string, unknown> = {
      [KIND_TO_COLUMN[kind]]: resolvedHeritageId,
      [snapshotField]: snapshotValue,
      ...(resolvedDescription
        ? {
            [`${kind.toLowerCase()}Description` as string]:
              resolvedDescription,
          }
        : {}),
    };
    await db
      .update(characters)
      .set(updateSet)
      .where(eq(characters.id, characterId));
    await db.insert(characterHeritages).values({
      characterId,
      heritageId: resolvedHeritageId,
      acquiredAtLevel: character.level,
      isMirrored: false,
      createdAt: new Date(),
    });

    // 4. Audit log.
    await appendCharacterLog(characterId, "heritage_formalized", {
      heritageId: resolvedHeritageId,
      kind,
      accordionKind: kind,
      // Phase 9.5 round 4: primitiveCount is now
      // reflective of what we actually bundled. When
      // heritageId is supplied we report 0 primitives
      // here because we don't re-count the template's
      // heritage_primitives (that's the atelier's job).
      // The UI still knows the bundle size from the
      // template row's heritage_primitives array.
      primitiveCount: explicitHeritageId
        ? 0
        : uniquePrimitiveIds.length,
    });

    await withCharacterSnapshot(characterId, async () => {
      // Snapshot captures fresh state after the heritage formalization
    }, { publishedByUserId: userId });

    bustResolverCache(characterId);

    return NextResponse.json(
      {
        heritage: {
          id: resolvedHeritageId,
          name: resolvedHeritageName,
        },
        primitiveCount: explicitHeritageId
          ? 0
          : uniquePrimitiveIds.length,
      },
      { status: 201 },
    );
  } catch (err) {
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied
    // → 403. Template authorship check at line 160 still uses
    // its own inline pattern (different gate).
    if (err instanceof Error && err.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[characters POST heritage formalize] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to formalize heritage.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
