import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { effectPrimitives, effects } from "@/db/schema/engine";
import {
  buildCanonicalEffectPayload,
  isEffectDraftEmpty,
  computeEffectContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";

type PrimitiveSlotInput = {
  primitiveId: number;
  quantity: number;
  notes?: string | undefined;
};

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function parsePrimitiveSlots(value: unknown): PrimitiveSlotInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Effect primitives must be an array.");
  }

  const slots = value.map((slotValue) => {
    if (!slotValue || typeof slotValue !== "object") {
      throw new Error("Effect primitive slot must be an object.");
    }

    const slot = slotValue as Record<string, unknown>;
    const primitiveId = Number(slot["primitiveId"]);
    const quantity = Number(slot["quantity"] ?? 1);

    if (!Number.isInteger(primitiveId) || primitiveId <= 0) {
      throw new Error("Primitive slot id must be a positive integer.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Primitive slot quantity must be a positive integer.");
    }

    return {
      primitiveId,
      quantity,
      notes: String(slot["notes"] ?? "").trim() || undefined,
    };
  });

  const mergedSlots = new Map<number, PrimitiveSlotInput>();

  for (const slot of slots) {
    const existing = mergedSlots.get(slot.primitiveId);

    if (existing) {
      mergedSlots.set(slot.primitiveId, {
        ...existing,
        quantity: existing.quantity + slot.quantity,
      });
    } else {
      mergedSlots.set(slot.primitiveId, slot);
    }
  }

  return [...mergedSlots.values()];
}

export async function GET() {
  const rows = await db.query.effects.findMany({
    orderBy: [desc(effects.createdAt), asc(effects.name)],
    with: {
      primitiveLinks: {
        orderBy: [asc(effectPrimitives.sortOrder)],
        with: {
          primitive: true,
        },
      },
    },
  });

  return NextResponse.json({ effects: rows });
}

/**
 * POST /api/effects — creates a brand-new effect.
 *
 * Phase 2: this is the GREENFIELD path. No source row exists, so there's
 * no fork-vs-version-update decision to make. We just INSERT a new row
 * with the form's draft state and a freshly-computed contentHash.
 *
 * For deferred-fork on an existing effect, the form uses PATCH
 * (/api/effects/[id]) with the `intent` field in the body — see
 * /api/effects/[id]/route.ts.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const name = String(values["name"] ?? "").trim();
    const narrativeDescription = String(
      values["narrativeDescription"] ?? "",
    ).trim();
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || null;
    const tags = parseTags(values["tags"]);
    const isPublic = Boolean(values["isPublic"]);
    const primitiveSlots = parsePrimitiveSlots(values["primitiveSlots"]);

    if (!name) {
      return NextResponse.json({ error: "Effect name is required." }, { status: 400 });
    }

    if (primitiveSlots.length === 0) {
      return NextResponse.json(
        { error: "Slot at least one primitive into the effect." },
        { status: 400 },
      );
    }

    // Build the canonical payload + draftHash so subsequent saves on the
    // same draft can short-circuit (no-op).
    const canonicalPayload = buildCanonicalEffectPayload({
      name,
      narrativeDescription,
      tags,
      isPublic,
      primitiveSlots: primitiveSlots.map((s) => ({
        primitiveId: s.primitiveId,
        quantity: s.quantity,
        notes: s.notes ?? "",
      })),
      // Phase 8: per-entity iconography
      iconSource: pickIconSource(values["iconSource"]),
      iconKey: pickStringOrNull(values["iconKey"]),
      iconUrl: pickStringOrNull(values["iconUrl"]),
      iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
    });
    const isEmpty = isEffectDraftEmpty(canonicalPayload);
    if (isEmpty) {
      return NextResponse.json(
        { error: "Effect name is required." },
        { status: 400 },
      );
    }
    const contentHash = await computeEffectContentHash({
      name,
      narrativeDescription,
      tags,
      isPublic,
      primitiveSlots: primitiveSlots.map((s) => ({
        primitiveId: s.primitiveId,
        quantity: s.quantity,
        notes: s.notes ?? "",
      })),
      // Phase 8: per-entity iconography
      iconSource: pickIconSource(values["iconSource"]),
      iconKey: pickStringOrNull(values["iconKey"]),
      iconUrl: pickStringOrNull(values["iconUrl"]),
      iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
    });

    const [created] = await db
      .insert(effects)
      .values({
        name,
        userId,
        narrativeDescription,
        sourceOrigin,
        tags,
        isPublic,
        contentHash,
        // Phase 8: per-entity iconography
        iconSource: pickIconSource(values["iconSource"]),
        iconKey: pickStringOrNull(values["iconKey"]),
        iconUrl: pickStringOrNull(values["iconUrl"]),
        iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
      })
      .returning();

    if (!created) {
      throw new Error("Unable to create effect.");
    }

    await db.insert(effectPrimitives).values(
      primitiveSlots.map((slot, index) => ({
        effectId: created.id,
        primitiveId: slot.primitiveId,
        quantity: slot.quantity,
        sortOrder: index,
        notes: slot.notes,
      })),
    );

    // Phase 4: auto-snapshot the new effect into effect_versions. Same
    // content_hash re-saved will be a no-op (recordVersion is idempotent
    // on the content-addressed id).
    await recordVersion({
      entityKind: "effect",
      entityId: created.id,
      contentHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    const effect = await db.query.effects.findFirst({
      where: eq(effects.id, created.id),
      with: {
        primitiveLinks: {
          orderBy: [asc(effectPrimitives.sortOrder)],
          with: { primitive: true },
        },
      },
    });

    return NextResponse.json({ effect }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
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
