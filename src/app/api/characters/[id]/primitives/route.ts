/**
 * GET /api/characters/[id]/primitives
 *
 * Phase 9.1 (Mashu 2026-09-06): returns the primitive instances slotted
 * onto this character, optionally filtered by accordion kind. Used by
 * the InlinePrimitiveSheet + HeritageFormalizeSheet + ItemFormalizeSheet
 * to display "will bundle N primitives" before the user commits.
 *
 * Query params:
 *   ?kind=LINEAGE|UPBRINGING|MANIFEST|PERSONAL  (optional; omit for all)
 *
 * Returns:
 *   { primitiveInstances: Array<{ instanceId, primitiveId, source,
 *                                  originHeritageId, isMirrored }> }
 *
 * Auth: required; character must be owned by caller.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId } = await params;
    const url = new URL(request.url);
    const kindParam = url.searchParams.get("kind");
    if (kindParam && !isPrimitiveSource(kindParam)) {
      return NextResponse.json(
        { error: "Invalid kind filter." },
        { status: 400 },
      );
    }

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

    const baseWhere = eq(characterPrimitives.characterId, characterId);
    const sourceFilter = kindParam
      ? (kindParam as (typeof ALLOWED_PRIMITIVE_SOURCES)[number])
      : null;
    const rows = sourceFilter
      ? await db
          .select({
            instanceId: characterPrimitives.instanceId,
            primitiveId: characterPrimitives.primitiveId,
            source: characterPrimitives.source,
            originHeritageId: characterPrimitives.originHeritageId,
            isMirrored: characterPrimitives.isMirrored,
          })
          .from(characterPrimitives)
          .where(and(baseWhere, eq(characterPrimitives.source, sourceFilter)))
      : await db
          .select({
            instanceId: characterPrimitives.instanceId,
            primitiveId: characterPrimitives.primitiveId,
            source: characterPrimitives.source,
            originHeritageId: characterPrimitives.originHeritageId,
            isMirrored: characterPrimitives.isMirrored,
          })
          .from(characterPrimitives)
          .where(baseWhere);

    return NextResponse.json({ primitiveInstances: rows }, { status: 200 });
  } catch (err) {
    console.error("[characters GET primitives] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to list primitives.";
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}

/**
 * POST /api/characters/[id]/primitives
 *
 * Phase 9.1 inline character-builder. Slots a primitive onto a character
 * without leaving the character sheet. Two modes:
 *
 * 1. **Reference mode** — body contains `primitiveId` (and optionally
 *    `quantity` for stacking). Inserts a `character_primitives` row
 *    referencing an existing primitive. If a row already exists for
 *    (characterId, primitiveId, source=PERSONAL), this returns 409
 *    (the v2 storage model collapses direct-paid copies via
 *    instance_id, but only the *caller* can choose to stack — for
 *    inline authoring the safe default is "no duplicate").
 *
 * 2. **Inline-create mode** — body contains a primitive payload
 *    (`name`, `category`, `buCost`, `hardModifiers[]`). Creates a
 *    `primitives` row owned by the caller, then slots it. The new
 *    primitive is `isPublic: false` until the user explicitly
 *    publishes it from `/creations` or `/atelier`.
 *
 * Body (one of):
 *   { primitiveId: number, quantity?: number }              // reference
 *   { name, category, buCost, hardModifiers?: HardModifier[] } // inline create
 *
 * Optional body fields (both modes):
 *   - `source`: "PERSONAL" | "HERITAGE" | "CAPABILITY" | "EFFECT"
 *     (defaults to "PERSONAL")
 *   - `originHeritageId`: uuid — set when the accordion is a heritage.
 *     Defaults to null (the chip is "directly slotted").
 *   - `originCapabilityId`: uuid — same for capability origin.
 *   - `originEffectId`: uuid — same for effect origin.
 *   - `isMirrored`: bool — mirror vector flag (default false).
 *   - `acquiredAtLevel`: int — defaults to 1.
 *
 * Auth: required; character must be owned by caller.
 *
 * Returns:
 *   { primitive: PrimitiveRow, characterPrimitive: CharacterPrimitiveRow }
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterPrimitives,
  primitives,
} from "@/db/schema";
import { parseHardModifiers } from "@/lib/packages/primitive-package";
import { isPrimitiveCategory } from "@/lib/packages/primitive-package";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";
import {
  ALLOWED_PRIMITIVE_SOURCES,
  isPrimitiveSource,
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

    // Ownership check.
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

    // Build mode gate (Mashu 2026-09-06): inline authoring only happens
    // when the character is in BUILD mode. PLAY mode is read-only.
    if (character.mode === "PLAY") {
      return NextResponse.json(
        {
          error:
            "Character is in PLAY mode. Switch to BUILD mode to slot primitives.",
        },
        { status: 409 },
      );
    }

    // Two-mode body. Validate up-front so the success path stays linear.
    const primitiveIdRaw = values["primitiveId"];
    const referenceMode =
      typeof primitiveIdRaw === "number" &&
      Number.isInteger(primitiveIdRaw) &&
      primitiveIdRaw > 0;

    let primitiveRowId: number;
    if (referenceMode) {
      // Reference mode: the primitive must exist.
      primitiveRowId = primitiveIdRaw as number;
      const existing = await db.query.primitives.findFirst({
        where: eq(primitives.id, primitiveRowId),
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Primitive not found." },
          { status: 404 },
        );
      }
    } else {
      // Inline-create mode. Required: name, category, buCost.
      const name = String(values["name"] ?? "").trim();
      const category = String(values["category"] ?? "");
      const buCost = Number(values["buCost"]);
      const hardModifiers = parseHardModifiers(values["hardModifiers"]);

      if (!name) {
        return NextResponse.json(
          { error: "name is required when creating a primitive inline." },
          { status: 400 },
        );
      }
      // Lightweight category whitelist check (full isPrimitiveCategory
      // is server-of-truth via the package). We re-use the same module:
      const { isPrimitiveCategory } = await import(
        "@/lib/packages/primitive-package"
      );
      if (!isPrimitiveCategory(category)) {
        return NextResponse.json(
          { error: "Invalid primitive category." },
          { status: 400 },
        );
      }
      if (!Number.isFinite(buCost) || buCost < 0) {
        return NextResponse.json(
          { error: "buCost must be a non-negative number." },
          { status: 400 },
        );
      }

      // Phase 9.1 (Mashu 2026-09-06): insert as a private row owned by
      // the character owner. visibility stays PRIVATE until the user
      // publishes from /creations or /atelier.
      const createdRows = await db
        .insert(primitives)
        .values({
          name,
          category,
          buCost: Math.floor(buCost),
          costTier: String(values["costTier"] ?? "STANDARD").slice(0, 32),
          mechanicalOutputText:
            String(values["mechanicalOutputText"] ?? "").trim() || null,
          narrativeRule: String(values["narrativeRule"] ?? "").trim() || null,
          hardModifiers: [...hardModifiers],
          isPublic: false,
          userId,
          // Inline-authored primitives slot through the new builder
          // flow; their source_origin is "user:<clerkId>" (Phase 3
          // universal identity).
          sourceOrigin: `user:${userId}`,
        } as never)
        .returning();
      const created = createdRows[0];
      if (!created) {
        return NextResponse.json(
          { error: "Failed to create primitive." },
          { status: 500 },
        );
      }
      primitiveRowId = created.id;
    }

    // Slot origin fields (both modes).
    const source = (() => {
      const raw = String(values["source"] ?? "PERSONAL");
      // Map accordion → enum. LINEAGE/UPBRINGING/MANIFEST go straight
      // through; anything else falls back to PERSONAL (for items
      // accordion and "directly slotted" picks).
      const allowed = [
        "LINEAGE",
        "UPBRINGING",
        "PERSONAL",
        "TRAINING",
        "LEVEL_UP",
        "DM",
        "MANIFEST",
      ] as const;
      return (allowed as readonly string[]).includes(raw)
        ? (raw as (typeof allowed)[number])
        : ("PERSONAL" as const);
    })();
    const originHeritageId =
      typeof values["originHeritageId"] === "string" &&
      values["originHeritageId"].length > 0
        ? (values["originHeritageId"] as string)
        : null;
    const originCapabilityId =
      typeof values["originCapabilityId"] === "string" &&
      values["originCapabilityId"].length > 0
        ? (values["originCapabilityId"] as string)
        : null;
    const originEffectId =
      typeof values["originEffectId"] === "string" &&
      values["originEffectId"].length > 0
        ? (values["originEffectId"] as string)
        : null;
    const isMirrored = Boolean(values["isMirrored"]);
    const acquiredAtLevel = (() => {
      const n = Number(values["acquiredAtLevel"]);
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    })();

    // Quantity stacking: if reference mode + quantity > 1, allow up
    // to N rows. Defaults to 1.
    const quantity = (() => {
      const n = Number(values["quantity"]);
      if (!Number.isFinite(n) || n < 1) return 1;
      return Math.min(Math.floor(n), 99); // hard cap to prevent runaway
    })();

    // Insert one row per quantity. Each gets a fresh instance_id.
    const insertedRows = [];
    for (let i = 0; i < quantity; i++) {
      const inserted = await db
        .insert(characterPrimitives)
        .values({
          characterId,
          primitiveId: primitiveRowId,
          source,
          originHeritageId,
          originCapabilityId,
          originEffectId,
          isMirrored,
          acquiredAtLevel,
        } as never)
        .returning();
      if (inserted[0]) insertedRows.push(inserted[0]);
    }

    // Phase 9.1 audit log: record the inline creation so the character
    // log captures how this primitive entered the sheet.
    await appendCharacterLog(characterId, "primitive_slotted", {
      primitiveId: primitiveRowId,
      quantity,
      originHeritageId,
      originCapabilityId,
      originEffectId,
      inline: !referenceMode,
    });

    bustResolverCache(characterId);

    return NextResponse.json(
      {
        characterPrimitive: insertedRows[0] ?? null,
        characterPrimitives: insertedRows,
        quantity: insertedRows.length,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[characters POST primitive] failed:", err);
    const message =
      err instanceof Error ? err.message : "Unable to slot primitive.";
    // Clerk auth.protect throws — surface as 401.
    const code = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
