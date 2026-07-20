import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  primitives,
  heritageCapabilities,
  heritagePrimitives,
  heritage,
} from "@/db/schema";
import {
  buildCanonicalTemplatePayload,
  computeTemplateContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { autoPublishOnCreate } from "@/lib/publishing/auto-publish";

type HeritageKind = "LINEAGE" | "UPBRINGING" | "MANIFEST";

const VALID_KINDS: HeritageKind[] = ["LINEAGE", "UPBRINGING", "MANIFEST"];

function parseKind(value: unknown): HeritageKind | null {
  if (typeof value !== "string") return null;
  // URL values are lowercase (?kind=lineage|upbringing|manifest);
  // normalize before validating.
  const normalized = value.toUpperCase();
  if ((VALID_KINDS as string[]).includes(normalized)) {
    return normalized as HeritageKind;
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
 * GET /api/heritage
 *
 * Lists heritage. Public + user-owned.
 * Optional filters: ?kind=lineage|upbringing|manifest
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kindFilter = searchParams.get("kind");

  const whereClause = kindFilter && parseKind(kindFilter)
    ? eq(heritage.kind, kindFilter as HeritageKind)
    : undefined;

  const rows = await db.query.heritage.findMany({
    where: whereClause,
    orderBy: [asc(heritage.kind), asc(heritage.name)],
    with: {
      primitiveLinks: {
        orderBy: [asc(heritagePrimitives.sortOrder)],
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

  return NextResponse.json({ heritage: enriched });
}

/**
 * POST /api/heritage
 *
 * Create a new template. Requires authentication.
 *
 * Body:
 *   - kind: lineage | upbringing | manifest (required)
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
    // Phase 7 Q-M-UX: accept primitiveSlots ({primitiveId, isMirrored}[])
    // for new clients. Fall back to primitiveIds (number[]) for legacy
    // payloads — those parse as non-mirrored (the safe default).
    const primitiveSlotsInput = Array.isArray(values["primitiveSlots"])
      ? (values["primitiveSlots"] as unknown[]).map((slotValue) => {
          const slot = slotValue as Record<string, unknown>;
          return {
            primitiveId: Number(slot["primitiveId"] ?? slot["id"]),
            isMirrored: Boolean(
              slot["is_mirrored"] ?? slot["isMirrored"] ?? false,
            ),
          };
        })
      : [];
    const legacyPrimitiveIds = Array.isArray(values["primitiveIds"])
      ? (values["primitiveIds"] as unknown[])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
          .map((id) => ({ primitiveId: id, isMirrored: false }))
      : [];
    const primitiveSlots =
      primitiveSlotsInput.length > 0 ? primitiveSlotsInput : legacyPrimitiveIds;
    const capabilityIds = Array.isArray(values["capabilityIds"])
      ? (values["capabilityIds"] as unknown[]).filter((id) => typeof id === "string")
      : [];

    if (!kind) {
      return NextResponse.json(
        { error: "kind must be lineage, upbringing, or manifest." },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    // Mashu 2026-07-09: removed category restriction. Templates can
    // slot any primitive regardless of kind. The schema-level slot
    // rules (heritage = primitives + capabilities only, no effects)
    // are the only safety constraints; designers decide what belongs
    // to a race/background/archetype based on intent. The previous
    // HERITAGE_AUGMENT / BACKGROUND_AUGMENT / CHARACTER_SHEET_AUGMENT
    // taxonomy is preserved in the primitive `category` column so
    // authors can still search/filter, but it's no longer enforced
    // server-side.
    // Phase 7 Q-M-UX: filter only the primitive IDs against the
    // canonical primitives table to validate they exist; we keep the
    // isMirrored flag from the slot input.
    let validSlots: { primitiveId: number; isMirrored: boolean }[] = [];
    if (primitiveSlots.length > 0) {
      const ids = primitiveSlots.map((s) => s.primitiveId);
      const prims = await db
        .select({ id: primitives.id })
        .from(primitives)
        .where(inArray(primitives.id, ids));

      const validIdSet = new Set(prims.map((p) => p.id));
      validSlots = primitiveSlots.filter((s) => validIdSet.has(s.primitiveId));
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(heritage)
        .values({
          kind,
          name,
          imageUrl,
          description,
          suggestedTraits,
          isPublic,
          sourceOrigin: `manual:${kind.toLowerCase()}`,
          // Phase 8: per-entity iconography
          iconSource: pickIconSource(values["iconSource"]),
          iconKey: pickStringOrNull(values["iconKey"]),
          iconUrl: pickStringOrNull(values["iconUrl"]),
          iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
        })
        .returning();

      if (!created) throw new Error("Unable to create template.");

      if (validSlots.length > 0) {
        await tx.insert(heritagePrimitives).values(
          validSlots.map((slot, idx) => ({
            templateId: created.id,
            primitiveId: slot.primitiveId,
            sortOrder: idx,
            // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
            isMirrored: slot.isMirrored,
          })),
        );
      }

      if (capabilityIds.length > 0) {
        await tx.insert(heritageCapabilities).values(
          capabilityIds.map((cid) => ({
            templateId: created.id,
            capabilityId: cid,
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

    if (!result) {
      throw new Error("Unable to create template.");
    }

    // Phase 9 round 8: auto-publish when isPublic=true so the
    // library visibility filter (publications-table-driven) treats
    // the new template as public immediately.
    //
    // `result.kind` is one of LINEAGE / UPBRINGING / MANIFEST — we
    // map to the matching publications target_type so the row
    // appears in the right library tab.
    if (result.isPublic) {
      try {
        const authorUuid = await resolveUserIdByClerkId(userId);
        if (authorUuid) {
          const targetType =
            result.kind === "LINEAGE"
              ? "LINEAGE_TEMPLATE"
              : result.kind === "UPBRINGING"
                ? "UPBRINGING_TEMPLATE"
                : result.kind === "MANIFEST"
                  ? "MANIFEST_TEMPLATE"
                  : "BUILD_TEMPLATE";
          await autoPublishOnCreate({
            targetType,
            targetId: result.id,
            authorId: authorUuid,
            isPublic: true,
          });
        }
      } catch (err) {
        console.error("[heritage POST] auto-publish failed:", err);
      }
    }

    // Phase 4: compute content hash + auto-snapshot.
    const canonicalPayload = buildCanonicalTemplatePayload({
      kind: result.kind,
      name: result.name,
      description: result.description ?? "",
      suggestedTraits: result.suggestedTraits ?? "",
      isPublic: result.isPublic,
      primitiveIds: validSlots.map((s) => s.primitiveId),
      primitiveSlots: validSlots,
      capabilityIds,
    });
    const contentHash = await computeTemplateContentHash({
      kind: result.kind,
      name: result.name,
      description: result.description ?? "",
      suggestedTraits: result.suggestedTraits ?? "",
      isPublic: result.isPublic,
      primitiveIds: validSlots.map((s) => s.primitiveId),
      primitiveSlots: validSlots,
      capabilityIds,
    });
    await db
      .update(heritage)
      .set({ contentHash })
      .where(eq(heritage.id, result.id));
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

export function expectedCategoryForKind(kind: HeritageKind): string {
  // Mashu 2026-07-09: deprecated. Category restriction removed across
  // the system — heritage can slot any primitive. Kept exported for
  // backward compat (other code may still import it), but always
  // returns an empty string so the previous guard is a no-op.
  void kind;
  return "";
}

/**
 * Phase 8: per-entity iconography helpers. See the matching block in
 * src/app/api/primitives/route.ts for the rationale.
 */
function pickIconSource(value: unknown): "GAME_ICONS" | "UPLOAD" | null {
  if (value === "GAME_ICONS" || value === "UPLOAD") return value;
  return null;
}
function pickStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function pickStringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}