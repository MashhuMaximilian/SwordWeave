import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  primitives,
  templateCapabilities,
  templatePrimitives,
  templates,
} from "@/db/schema";
import {
  buildCanonicalTemplatePayload,
  computeTemplateContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";

type TemplateKind = "RACE" | "BACKGROUND" | "ARCHETYPE";

const VALID_KINDS: TemplateKind[] = ["RACE", "BACKGROUND", "ARCHETYPE"];

function parseKind(value: unknown): TemplateKind | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_KINDS as string[]).includes(upper)) {
    return upper as TemplateKind;
  }
  return null;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((t) => t.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

/**
 * GET /api/templates
 *
 * Lists templates. Public + user-owned.
 * Optional filters: ?kind=RACE|BACKGROUND|ARCHETYPE
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kindFilter = searchParams.get("kind");

  const whereClause = kindFilter && parseKind(kindFilter)
    ? eq(templates.kind, kindFilter as TemplateKind)
    : undefined;

  const rows = await db.query.templates.findMany({
    where: whereClause,
    orderBy: [asc(templates.kind), asc(templates.name)],
    with: {
      primitiveLinks: {
        orderBy: [asc(templatePrimitives.sortOrder)],
        with: {
          primitive: true,
        },
      },
      capabilityLinks: {
        with: {
          capability: true,
        },
      },
    },
  });

  // Filter to public only
  const publicRows = rows.filter((r) => r.isPublic);

  // Compute BU per template
  const enriched = publicRows.map((t) => {
    const bu = t.primitiveLinks.reduce(
      (total, link) =>
        total + (link.primitive?.buCost ?? 0),
      0,
    );
    return { ...t, computedBu: bu };
  });

  return NextResponse.json({ templates: enriched });
}

/**
 * POST /api/templates
 *
 * Create a new template. Requires authentication.
 *
 * Body:
 *   - kind: RACE | BACKGROUND | ARCHETYPE (required)
 *   - name (required)
 *   - imageUrl, description, suggestedTraits (optional)
 *   - isPublic (default false)
 *   - primitiveIds (array of primitive IDs - only matching category allowed)
 *   - capabilityIds (array of capability IDs)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const kind = parseKind(values["kind"]);
    const name = String(values["name"] ?? "").trim();
    const imageUrl = String(values["imageUrl"] ?? "").trim() || null;
    const description = String(values["description"] ?? "").trim() || null;
    const suggestedTraits = String(values["suggestedTraits"] ?? "").trim() || null;
    const isPublic = Boolean(values["isPublic"]);
    const primitiveIds = Array.isArray(values["primitiveIds"])
      ? (values["primitiveIds"] as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    const capabilityIds = Array.isArray(values["capabilityIds"])
      ? (values["capabilityIds"] as unknown[]).filter((id) => typeof id === "string")
      : [];

    if (!kind) {
      return NextResponse.json(
        { error: "kind must be RACE, BACKGROUND, or ARCHETYPE." },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    // Mashu 2026-07-09: removed category restriction. Templates can
    // slot any primitive regardless of kind. The schema-level slot
    // rules (templates = primitives + capabilities only, no effects)
    // are the only safety constraints; designers decide what belongs
    // to a race/background/archetype based on intent. The previous
    // HERITAGE_AUGMENT / BACKGROUND_AUGMENT / CHARACTER_SHEET_AUGMENT
    // taxonomy is preserved in the primitive `category` column so
    // authors can still search/filter, but it's no longer enforced
    // server-side.
    let validPrimitiveIds: number[] = [];
    if (primitiveIds.length > 0) {
      const prims = await db
        .select()
        .from(primitives)
        .where(inArray(primitives.id, primitiveIds));

      validPrimitiveIds = prims.map((p) => p.id);
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(templates)
        .values({
          kind,
          name,
          imageUrl,
          description,
          suggestedTraits,
          isPublic,
          sourceOrigin: `manual:${kind.toLowerCase()}`,
        })
        .returning();

      if (!created) throw new Error("Unable to create template.");

      if (validPrimitiveIds.length > 0) {
        await tx.insert(templatePrimitives).values(
          validPrimitiveIds.map((pid, idx) => ({
            templateId: created.id,
            primitiveId: pid,
            sortOrder: idx,
          })),
        );
      }

      if (capabilityIds.length > 0) {
        await tx.insert(templateCapabilities).values(
          capabilityIds.map((cid) => ({
            templateId: created.id,
            capabilityId: cid,
          })),
        );
      }

      return tx.query.templates.findFirst({
        where: eq(templates.id, created.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
        },
      });
    });

    if (!result) {
      throw new Error("Unable to create template.");
    }

    // Phase 4: compute content hash + auto-snapshot.
    const canonicalPayload = buildCanonicalTemplatePayload({
      kind: result.kind,
      name: result.name,
      description: result.description ?? "",
      suggestedTraits: result.suggestedTraits ?? "",
      isPublic: result.isPublic,
      primitiveIds: validPrimitiveIds,
      capabilityIds,
    });
    const contentHash = await computeTemplateContentHash({
      kind: result.kind,
      name: result.name,
      description: result.description ?? "",
      suggestedTraits: result.suggestedTraits ?? "",
      isPublic: result.isPublic,
      primitiveIds: validPrimitiveIds,
      capabilityIds,
    });
    await db
      .update(templates)
      .set({ contentHash })
      .where(eq(templates.id, result.id));
    await recordVersion({
      entityKind: "template",
      entityId: result.id,
      contentHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    return NextResponse.json({ template: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export function expectedCategoryForKind(kind: TemplateKind): string {
  // Mashu 2026-07-09: deprecated. Category restriction removed across
  // the system — templates can slot any primitive. Kept exported for
  // backward compat (other code may still import it), but always
  // returns an empty string so the previous guard is a no-op.
  void kind;
  return "";
}