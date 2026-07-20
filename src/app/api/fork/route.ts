// =============================================================================
// POST /api/fork — fork any library item (primitive/capability/template) into
// the user's own sandbox with attribution back to the source.
//
// Body: { targetType, targetId }
//
// Schema notes (Phase 4/5 actual shapes):
// - primitives.id is serial (integer), userId is text (Clerk ID format)
// - capabilities.id is uuid, has metadata jsonb + tags text[]
// - heritage.id is uuid, NO metadata column (just description + suggestedTraits)
// - heritagePrimitives: templateId (uuid), primitiveId (integer), sortOrder, notes
// - capabilityPrimitives: capabilityId (uuid), primitiveId (integer), role, quantity, sortOrder, slotLabel, notes
//
// Source IDs may be either integer (primitives) or UUID (everything else).
// targetId in the request body is the raw source ID — we look it up as both.
//
// For unversioned library items (none yet published via Phase 5), we
// synthesize a stable virtual versionId using resolveVirtualVersionId().
// =============================================================================

import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  capabilityEffects,
  effectPrimitives,
  effects,
  effectConditions,
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  items,
  primitives,
  heritage,
  heritagePrimitives,
} from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { recordForkAttribution } from "@/lib/publishing/fork-attribution";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";

// Phase 9 follow-up: incrementForksCreated was here. The 5 entity-type
// fork functions below now use the shared recordForkAttribution helper
// (src/lib/publishing/fork-attribution.ts) which does the forker's
// totalForksCreated bump AND the source author's totalForksReceived bump
// in one call. The inline helper is no longer needed.

const ForkSchema = z.object({
  targetType: z.enum([
    "PRIMITIVE",
    "CAPABILITY",
    "EFFECT",
    "LINEAGE_TEMPLATE",
    "UPBRINGING_TEMPLATE",
    "MANIFEST_TEMPLATE",
    "BUILD_TEMPLATE",
    "ITEM",
    "CHARACTER",
  ]),
  targetId: z.string().min(1),
});

async function resolveUser(clerkUserId: string) {
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
  });
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ForkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await resolveUser(userId);
  if (!user) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  try {
    const { targetType, targetId } = parsed.data;

    switch (targetType) {
      case "PRIMITIVE":
        return NextResponse.json({
          ok: true,
          ...(await forkPrimitive({
            targetId,
            forkerClerkUserId: userId,
            forkerInternalId: user.id,
          })),
        });
      case "CAPABILITY":
        return NextResponse.json({
          ok: true,
          ...(await forkCapability({
            targetId,
            forkerClerkUserId: userId,
            forkerInternalId: user.id,
          })),
        });
      case "LINEAGE_TEMPLATE":
      case "UPBRINGING_TEMPLATE":
      case "MANIFEST_TEMPLATE":
      case "BUILD_TEMPLATE":
        return NextResponse.json({
          ok: true,
          ...(await forkTemplate({
            targetId,
            forkerClerkUserId: userId,
            forkerInternalId: user.id,
          })),
        });
      case "EFFECT":
        return NextResponse.json({
          ok: true,
          ...(await forkEffect({
            targetId,
            forkerClerkUserId: userId,
            forkerInternalId: user.id,
          })),
        });
      case "ITEM":
        return NextResponse.json({
          ok: true,
          ...(await forkItem({
            targetId,
            forkerClerkUserId: userId,
            forkerInternalId: user.id,
          })),
        });
      default:
        return NextResponse.json(
          { error: `Forking ${targetType} is not yet supported` },
          { status: 501 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fork] error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ---------------------------------------------------------------------------
// Fork a primitive (id is serial integer)
//
// Phase 6 backend: forked row gets userId = forker; sourceAuthorId resolved
// via Clerk ID → internal user UUID (null when source is system content).
// ---------------------------------------------------------------------------

async function forkPrimitive(input: {
  targetId: string;
  forkerClerkUserId: string;
  forkerInternalId: string;
}) {
  const { targetId, forkerClerkUserId, forkerInternalId } = input;

  // primitives.id is serial — parse targetId as integer
  const numericId = Number(targetId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Primitive targetId must be a positive integer");
  }

  const source = await db.query.primitives.findFirst({
    where: (table, { eq }) => eq(table.id, numericId),
  });
  if (!source) {
    throw new Error("Source primitive not found");
  }

  // Insert cloned primitive (private, owned by forker). userId is text
  // (Clerk ID format) per Phase 4 schema.
  //
  // Fork name uniqueness: the `(name, category, user_id)` constraint means
  // re-forking the same source produces a unique-name collision. We compute
  // a unique name up front (`X (fork)`, `X (fork) 2`, `X (fork) 3`, …)
  // so the INSERT succeeds on the first try. The DB constraint is still
  // the source of truth — see `nameExists` below for the race-condition
  // backup.
  const nameExists = async (candidate: string) => {
    const found = await db.query.primitives.findFirst({
      where: (t, { and, eq }) =>
        and(
          eq(t.name, candidate),
          eq(t.category, source.category),
          eq(t.userId, forkerClerkUserId),
        ),
      columns: { id: true },
    });
    return Boolean(found);
  };
  const forkName = await computeUniqueForkName(source.name, nameExists);

  const [forked] = await db
    .insert(primitives)
    .values({
      name: forkName,
      category: source.category,
      costTier: source.costTier,
      buCost: source.buCost,
      mechanicalOutputText: source.mechanicalOutputText,
      narrativeRule: source.narrativeRule,
      isPublic: false,
      isMirrorable: source.isMirrorable,
      mirrorVector: source.mirrorVector,
      mirrorBuCredit: source.mirrorBuCredit,
      mirrorEligibilityNotes: source.mirrorEligibilityNotes,
      hardModifiers: source.hardModifiers,
      userId: forkerClerkUserId,
    })
    .returning({ id: primitives.id });
  if (!forked) {
    throw new Error("Failed to insert forked primitive");
  }

  // Attribution — Phase 9 follow-up: refactored to use the shared
  // recordForkAttribution helper. Previously this route did the
  // forks-row insert + fork_aggregates UPSERT + user_stats bump
  // inline (and only for the forker's side). The helper does both
  // sides (forker + source author when applicable) and lives in
  // src/lib/publishing/fork-attribution.ts so the atelier API
  // routes can share the same logic.
  const attribution = await recordForkAttribution({
    forkerInternalId,
    forkerClerkId: forkerClerkUserId,
    sourceClerkUserId: source.userId,
    sourceTargetType: "PRIMITIVE",
    sourceTargetId: String(source.id),
    forkedTargetType: "PRIMITIVE",
    forkedTargetId: String(forked.id),
    metadata: { name: source.name, category: source.category },
  });
  const forkCount = attribution.aggregateCount;

  return {
    forkedTargetId: String(forked.id),
    sourceTargetId: String(source.id),
    forkName,
    forkCount,
  };
}

// ---------------------------------------------------------------------------
// Fork a capability (id is uuid, includes primitive_links)
//
// Phase 6 backend: forked row gets userId = forker (was previously NULL —
// bug fixed in commit 8837ed4). sourceAuthorId resolved from source.userId.
// ---------------------------------------------------------------------------

async function forkCapability(input: {
  targetId: string;
  forkerClerkUserId: string;
  forkerInternalId: string;
}) {
  const { targetId, forkerClerkUserId, forkerInternalId } = input;

  const source = await db.query.capabilities.findFirst({
    where: (table, { eq }) => eq(table.id, targetId),
    with: { primitiveLinks: true },
  });
  if (!source) {
    throw new Error("Source capability not found");
  }

  // Compute a unique fork name against the `(name, source_origin)` constraint.
  // Each fork of this source gets the same `sourceOrigin` ("fork:<id>"), so
  // re-forking the same source collides unless we differentiate by name.
  const forkSourceOrigin = `fork:${source.id}`;
  const nameExists = async (candidate: string) => {
    const found = await db.query.capabilities.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.name, candidate), eq(t.sourceOrigin, forkSourceOrigin)),
      columns: { id: true },
    });
    return Boolean(found);
  };
  const forkName = await computeUniqueForkName(source.name, nameExists);

  const [forked] = await db
    .insert(capabilities)
    .values({
      name: forkName,
      type: source.type,
      sourceType: source.sourceType,
      verboseDescription: source.verboseDescription,
      isPublic: false,
      // Phase 6 fix: capabilities.userId is text (Clerk ID). Without this
      // line the fork becomes "system content" and can't be edited/deleted
      // by the forker.
      userId: forkerClerkUserId,
      sourceOrigin: forkSourceOrigin,
      tags: source.tags,
      metadata: {
        ...source.metadata,
        forkedFrom: { capabilityId: source.id },
      },
    })
    .returning({ id: capabilities.id });
  if (!forked) {
    throw new Error("Failed to insert forked capability");
  }

  if (source.primitiveLinks.length > 0) {
    await db.insert(capabilityPrimitives).values(
      source.primitiveLinks.map((link) => ({
        capabilityId: forked.id,
        primitiveId: link.primitiveId,
        role: link.role,
        quantity: link.quantity,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel,
        notes: link.notes,
      })),
    );
  }

  const attribution = await recordForkAttribution({
    forkerInternalId,
    forkerClerkId: forkerClerkUserId,
    sourceClerkUserId: source.userId,
    sourceTargetType: "CAPABILITY",
    sourceTargetId: source.id,
    forkedTargetType: "CAPABILITY",
    forkedTargetId: forked.id,
    metadata: { name: source.name },
  });
  const forkCount = attribution.aggregateCount;

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkName,
    forkCount,
  };
}

// ---------------------------------------------------------------------------
// Fork a template (race/background/archetype/build) + bundled primitives.
// heritage.id is uuid; heritage.userId is text (Clerk ID format).
// heritagePrimitives has: templateId (uuid), primitiveId (integer), sortOrder, notes
// heritage has NO metadata column — use suggestedTraits/description for fork info.
// ---------------------------------------------------------------------------

async function forkTemplate(input: {
  targetId: string;
  forkerClerkUserId: string;
  forkerInternalId: string;
}) {
  const { targetId, forkerClerkUserId, forkerInternalId } = input;

  const source = await db.query.heritage.findFirst({
    where: (table, { eq }) => eq(table.id, targetId),
    with: { primitiveLinks: true },
  });
  if (!source) {
    throw new Error("Source template not found");
  }

  // Append " (fork)" + lineage marker to suggestedTraits so it's recoverable
  const lineageNote = `\n\n---\n_Forked from template ${source.id}_`;
  const newSuggestedTraits = (source.suggestedTraits ?? "") + lineageNote;

  // Unique fork name against the `(name, user_id, kind)` constraint. Same
  // user re-forking the same source produces a collision on the base name
  // — append a numeric suffix.
  const nameExists = async (candidate: string) => {
    const found = await db.query.heritage.findFirst({
      where: (t, { and, eq }) =>
        and(
          eq(t.name, candidate),
          eq(t.userId, forkerClerkUserId),
          eq(t.kind, source.kind),
        ),
      columns: { id: true },
    });
    return Boolean(found);
  };
  const forkName = await computeUniqueForkName(source.name, nameExists);

  const [forked] = await db
    .insert(heritage)
    .values({
      name: forkName,
      kind: source.kind,
      description: source.description,
      imageUrl: source.imageUrl,
      suggestedTraits: newSuggestedTraits,
      isPublic: false,
      sourceOrigin: `fork:${source.id}`,
      userId: forkerClerkUserId,
    })
    .returning({ id: heritage.id });
  if (!forked) {
    throw new Error("Failed to insert forked template");
  }

  if (source.primitiveLinks.length > 0) {
    await db.insert(heritagePrimitives).values(
      source.primitiveLinks.map((link) => ({
        templateId: forked.id,
        primitiveId: link.primitiveId,
        sortOrder: link.sortOrder,
        notes: link.notes,
      })),
    );
  }

  const targetType = (() => {
    switch (source.kind) {
      case "LINEAGE":
        return "LINEAGE_TEMPLATE" as const;
      case "UPBRINGING":
        return "UPBRINGING_TEMPLATE" as const;
      case "MANIFEST":
        return "MANIFEST_TEMPLATE" as const;
      default:
        // Note: heritageKindEnum doesn't include BUILD as of Phase 4/5 —
        // builds live in a separate `builds` table. If source.kind becomes
        // "BUILD" in a future migration, add the case above.
        return "BUILD_TEMPLATE" as const;
    }
  })();

  // Attribution — Phase 9 follow-up: use the shared helper.
  const attribution = await recordForkAttribution({
    forkerInternalId,
    forkerClerkId: forkerClerkUserId,
    sourceClerkUserId: source.userId,
    sourceTargetType: targetType,
    sourceTargetId: source.id,
    forkedTargetType: targetType,
    forkedTargetId: forked.id,
    metadata: { name: source.name, kind: source.kind },
  });
  const forkCount = attribution.aggregateCount;

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkName,
    forkCount,
  };
}

// ---------------------------------------------------------------------------
// Fork an effect (id is uuid, includes primitive_links + condition_links)
// ---------------------------------------------------------------------------

async function forkEffect(input: {
  targetId: string;
  forkerClerkUserId: string;
  forkerInternalId: string;
}) {
  const { targetId, forkerClerkUserId, forkerInternalId } = input;

  const source = await db.query.effects.findFirst({
    where: (table, { eq }) => eq(table.id, targetId),
    with: {
      primitiveLinks: true,
      conditionLinks: true,
    },
  });
  if (!source) {
    throw new Error("Source effect not found");
  }

  // Unique fork name against the `(name, source_origin)` constraint. Same
  // source re-forked → same sourceOrigin → collision unless name differs.
  const forkSourceOrigin = `fork:${source.id}`;
  const nameExists = async (candidate: string) => {
    const found = await db.query.effects.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.name, candidate), eq(t.sourceOrigin, forkSourceOrigin)),
      columns: { id: true },
    });
    return Boolean(found);
  };
  const forkName = await computeUniqueForkName(source.name, nameExists);

  const [forked] = await db
    .insert(effects)
    .values({
      name: forkName,
      narrativeDescription: source.narrativeDescription,
      isPublic: false,
      userId: forkerClerkUserId,
      sourceOrigin: forkSourceOrigin,
      tags: source.tags,
    })
    .returning({ id: effects.id });
  if (!forked) {
    throw new Error("Failed to insert forked effect");
  }

  if (source.primitiveLinks.length > 0) {
    await db.insert(effectPrimitives).values(
      source.primitiveLinks.map((link) => ({
        effectId: forked.id,
        primitiveId: link.primitiveId,
        quantity: link.quantity,
        sortOrder: link.sortOrder,
        notes: link.notes,
      })),
    );
  }

  if (source.conditionLinks.length > 0) {
    await db.insert(effectConditions).values(
      source.conditionLinks.map((link) => ({
        effectId: forked.id,
        conditionId: link.conditionId,
        sortOrder: link.sortOrder,
        notes: link.notes,
      })),
    );
  }

  // Attribution — Phase 9 follow-up: use the shared helper.
  const attribution = await recordForkAttribution({
    forkerInternalId,
    forkerClerkId: forkerClerkUserId,
    sourceClerkUserId: source.userId,
    sourceTargetType: "EFFECT",
    sourceTargetId: source.id,
    forkedTargetType: "EFFECT",
    forkedTargetId: forked.id,
    metadata: { name: source.name },
  });
  const forkCount = attribution.aggregateCount;

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkName,
    forkCount,
  };
}

// ---------------------------------------------------------------------------
// Fork an item (id is uuid, includes capability_links + effect_links +
// primitive_links)
// ---------------------------------------------------------------------------

async function forkItem(input: {
  targetId: string;
  forkerClerkUserId: string;
  forkerInternalId: string;
}) {
  const { targetId, forkerClerkUserId, forkerInternalId } = input;

  const source = await db.query.items.findFirst({
    where: (table, { eq }) => eq(table.id, targetId),
    with: {
      capabilityLinks: true,
      effectLinks: true,
      primitiveLinks: true,
    },
  });
  if (!source) {
    throw new Error("Source item not found");
  }

  // Unique fork name against the `(name, source_origin)` constraint.
  const forkSourceOrigin = `fork:${source.id}`;
  const nameExists = async (candidate: string) => {
    const found = await db.query.items.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.name, candidate), eq(t.sourceOrigin, forkSourceOrigin)),
      columns: { id: true },
    });
    return Boolean(found);
  };
  const forkName = await computeUniqueForkName(source.name, nameExists);

  const [forked] = await db
    .insert(items)
    .values({
      name: forkName,
      itemType: source.itemType,
      rarity: source.rarity,
      buCost: source.buCost,
      description: source.description,
      slotCost: source.slotCost,
      quantity: source.quantity,
      isTwoHanded: source.isTwoHanded,
      isConsumable: source.isConsumable,
      actsAsFocus: source.actsAsFocus,
      isPublic: false,
      userId: forkerClerkUserId,
      sourceOrigin: forkSourceOrigin,
      tags: source.tags,
    })
    .returning({ id: items.id });
  if (!forked) {
    throw new Error("Failed to insert forked item");
  }

  if (source.capabilityLinks.length > 0) {
    await db.insert(itemCapabilities).values(
      source.capabilityLinks.map((link) => ({
        itemId: forked.id,
        capabilityId: link.capabilityId,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel,
        notes: link.notes,
      })),
    );
  }

  if (source.effectLinks.length > 0) {
    await db.insert(itemEffects).values(
      source.effectLinks.map((link) => ({
        itemId: forked.id,
        effectId: link.effectId,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel,
        notes: link.notes,
      })),
    );
  }

  if (source.primitiveLinks.length > 0) {
    await db.insert(itemPrimitives).values(
      source.primitiveLinks.map((link) => ({
        itemId: forked.id,
        primitiveId: link.primitiveId,
        sortOrder: link.sortOrder,
      })),
    );
  }

  // Attribution — Phase 9 follow-up: use the shared helper.
  const attribution = await recordForkAttribution({
    forkerInternalId,
    forkerClerkId: forkerClerkUserId,
    sourceClerkUserId: source.userId,
    sourceTargetType: "ITEM",
    sourceTargetId: source.id,
    forkedTargetType: "ITEM",
    forkedTargetId: forked.id,
    metadata: { name: source.name },
  });
  const forkCount = attribution.aggregateCount;

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkName,
    forkCount,
  };
}

// `randomUUID` is imported to allow future hooks (e.g. synthesizing a
// placeholder forkedVersionId until the fork re-publishes). Keeping it
// referenced so tree-shakers don't drop the import if we wire it later.
void randomUUID;