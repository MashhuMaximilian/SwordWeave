// =============================================================================
// POST /api/fork — fork any library item (primitive/capability/template) into
// the user's own sandbox with attribution back to the source.
//
// Body: { targetType, targetId }
//
// Schema notes (Phase 4/5 actual shapes):
// - primitives.id is serial (integer), userId is text (Clerk ID format)
// - capabilities.id is uuid, has metadata jsonb + tags text[]
// - templates.id is uuid, NO metadata column (just description + suggestedTraits)
// - templatePrimitives: templateId (uuid), primitiveId (integer), sortOrder, notes
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
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  capabilityEffects,
  effectPrimitives,
  effects,
  effectConditions,
  forkAggregates,
  forks,
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  items,
  primitives,
  templates,
  templatePrimitives,
  userStats,
} from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { resolveVirtualVersionId } from "@/lib/engagement/version-helpers";

/**
 * Increment user_stats.totalForksCreated for the forker.
 *
 * Uses an UPSERT so the first fork by a user without a stats row yet still
 * counts (creates a stats row with totalForksCreated=1 and zeros elsewhere).
 *
 * @returns New totalForksCreated value
 */
async function incrementForksCreated(forkerInternalId: string): Promise<number> {
  const result = await db
    .insert(userStats)
    .values({
      userId: forkerInternalId,
      totalForksCreated: 1,
    })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: {
        totalForksCreated: sql`${userStats.totalForksCreated} + 1`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning({ total: userStats.totalForksCreated });
  return Number(result[0]?.total ?? 1);
}

const ForkSchema = z.object({
  targetType: z.enum([
    "PRIMITIVE",
    "CAPABILITY",
    "EFFECT",
    "RACE_TEMPLATE",
    "BACKGROUND_TEMPLATE",
    "ARCHETYPE_TEMPLATE",
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
      case "RACE_TEMPLATE":
      case "BACKGROUND_TEMPLATE":
      case "ARCHETYPE_TEMPLATE":
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
  const [forked] = await db
    .insert(primitives)
    .values({
      name: `${source.name} (fork)`,
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

  // Attribution. versionId is synthesized from targetId (which is integer).
  const versionId = resolveVirtualVersionId("PRIMITIVE", String(source.id));
  // Resolve source author — source.userId is Clerk ID text; forking wants
  // internal UUID. Null when source is system content (no user).
  const sourceAuthorId = source.userId
    ? await resolveUserIdByClerkId(source.userId)
    : null;
  await db.insert(forks).values({
    // forks.forkedByUserId is uuid → use internal user.id
    forkedByUserId: forkerInternalId,
    sourceTargetType: "PRIMITIVE",
    sourceTargetId: String(source.id),
    sourceVersionId: versionId,
    sourceAuthorId,
    forkedTargetType: "PRIMITIVE",
    forkedTargetId: String(forked.id),
    // forkedVersionId: tracks "the fork's own current published version."
    // At fork time the fork IS a copy of the source version, so we point
    // it at the source's virtual version id. When the forker re-publishes
    // their own version, publish-service updates this to the real version
    // row id (see publish-service.ts post-publish hook).
    forkedVersionId: versionId,
    metadata: { name: source.name, category: source.category },
  });

  // Atomic fork_count increment
  const [agg] = await db
    .insert(forkAggregates)
    .values({
      sourceTargetType: "PRIMITIVE",
      sourceTargetId: String(source.id),
      sourceVersionId: versionId,
      forkCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        forkAggregates.sourceTargetType,
        forkAggregates.sourceTargetId,
        forkAggregates.sourceVersionId,
      ],
      set: {
        forkCount: sql`${forkAggregates.forkCount} + 1`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning({ forkCount: forkAggregates.forkCount });

  const forkCount = await incrementForksCreated(forkerInternalId);

  return {
    forkedTargetId: String(forked.id),
    sourceTargetId: String(source.id),
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

  const [forked] = await db
    .insert(capabilities)
    .values({
      name: `${source.name} (fork)`,
      type: source.type,
      sourceType: source.sourceType,
      verboseDescription: source.verboseDescription,
      isPublic: false,
      // Phase 6 fix: capabilities.userId is text (Clerk ID). Without this
      // line the fork becomes "system content" and can't be edited/deleted
      // by the forker.
      userId: forkerClerkUserId,
      sourceOrigin: `fork:${source.id}`,
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

  const versionId = resolveVirtualVersionId("CAPABILITY", targetId);
  const sourceAuthorId = source.userId
    ? await resolveUserIdByClerkId(source.userId)
    : null;
  await db.insert(forks).values({
    forkedByUserId: forkerInternalId,
    sourceTargetType: "CAPABILITY",
    sourceTargetId: source.id,
    sourceVersionId: versionId,
    sourceAuthorId,
    forkedTargetType: "CAPABILITY",
    forkedTargetId: forked.id,
    forkedVersionId: versionId,
    metadata: { name: source.name },
  });

  const [agg] = await db
    .insert(forkAggregates)
    .values({
      sourceTargetType: "CAPABILITY",
      sourceTargetId: source.id,
      sourceVersionId: versionId,
      forkCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        forkAggregates.sourceTargetType,
        forkAggregates.sourceTargetId,
        forkAggregates.sourceVersionId,
      ],
      set: {
        forkCount: sql`${forkAggregates.forkCount} + 1`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning({ forkCount: forkAggregates.forkCount });

  const forkCount = await incrementForksCreated(forkerInternalId);

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkCount,
  };
}

// ---------------------------------------------------------------------------
// Fork a template (race/background/archetype/build) + bundled primitives.
// templates.id is uuid; templates.userId is text (Clerk ID format).
// templatePrimitives has: templateId (uuid), primitiveId (integer), sortOrder, notes
// templates has NO metadata column — use suggestedTraits/description for fork info.
// ---------------------------------------------------------------------------

async function forkTemplate(input: {
  targetId: string;
  forkerClerkUserId: string;
  forkerInternalId: string;
}) {
  const { targetId, forkerClerkUserId, forkerInternalId } = input;

  const source = await db.query.templates.findFirst({
    where: (table, { eq }) => eq(table.id, targetId),
    with: { primitiveLinks: true },
  });
  if (!source) {
    throw new Error("Source template not found");
  }

  // Append " (fork)" + lineage marker to suggestedTraits so it's recoverable
  const lineageNote = `\n\n---\n_Forked from template ${source.id}_`;
  const newSuggestedTraits = (source.suggestedTraits ?? "") + lineageNote;

  const [forked] = await db
    .insert(templates)
    .values({
      name: `${source.name} (fork)`,
      kind: source.kind,
      description: source.description,
      imageUrl: source.imageUrl,
      suggestedTraits: newSuggestedTraits,
      isPublic: false,
      sourceOrigin: `fork:${source.id}`,
      userId: forkerClerkUserId,
    })
    .returning({ id: templates.id });
  if (!forked) {
    throw new Error("Failed to insert forked template");
  }

  if (source.primitiveLinks.length > 0) {
    await db.insert(templatePrimitives).values(
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
      case "RACE":
        return "RACE_TEMPLATE" as const;
      case "BACKGROUND":
        return "BACKGROUND_TEMPLATE" as const;
      case "ARCHETYPE":
        return "ARCHETYPE_TEMPLATE" as const;
      default:
        // Note: templateKindEnum doesn't include BUILD as of Phase 4/5 —
        // builds live in a separate `builds` table. If source.kind becomes
        // "BUILD" in a future migration, add the case above.
        return "BUILD_TEMPLATE" as const;
    }
  })();

  const versionId = resolveVirtualVersionId(targetType, targetId);
  const sourceAuthorId = source.userId
    ? await resolveUserIdByClerkId(source.userId)
    : null;
  await db.insert(forks).values({
    forkedByUserId: forkerInternalId,
    sourceTargetType: targetType,
    sourceTargetId: source.id,
    sourceVersionId: versionId,
    sourceAuthorId,
    forkedTargetType: targetType,
    forkedTargetId: forked.id,
    forkedVersionId: versionId,
    metadata: { name: source.name, kind: source.kind },
  });

  const [agg] = await db
    .insert(forkAggregates)
    .values({
      sourceTargetType: targetType,
      sourceTargetId: source.id,
      sourceVersionId: versionId,
      forkCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        forkAggregates.sourceTargetType,
        forkAggregates.sourceTargetId,
        forkAggregates.sourceVersionId,
      ],
      set: {
        forkCount: sql`${forkAggregates.forkCount} + 1`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning({ forkCount: forkAggregates.forkCount });

  const forkCount = await incrementForksCreated(forkerInternalId);

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
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

  const [forked] = await db
    .insert(effects)
    .values({
      name: `${source.name} (fork)`,
      narrativeDescription: source.narrativeDescription,
      isPublic: false,
      userId: forkerClerkUserId,
      sourceOrigin: `fork:${source.id}`,
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

  const versionId = resolveVirtualVersionId("EFFECT", targetId);
  const sourceAuthorId = source.userId
    ? await resolveUserIdByClerkId(source.userId)
    : null;
  await db.insert(forks).values({
    forkedByUserId: forkerInternalId,
    sourceTargetType: "EFFECT",
    sourceTargetId: source.id,
    sourceVersionId: versionId,
    sourceAuthorId,
    forkedTargetType: "EFFECT",
    forkedTargetId: forked.id,
    forkedVersionId: versionId,
    metadata: { name: source.name },
  });

  await db
    .insert(forkAggregates)
    .values({
      sourceTargetType: "EFFECT",
      sourceTargetId: source.id,
      sourceVersionId: versionId,
      forkCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        forkAggregates.sourceTargetType,
        forkAggregates.sourceTargetId,
        forkAggregates.sourceVersionId,
      ],
      set: {
        forkCount: sql`${forkAggregates.forkCount} + 1`,
        updatedAt: sql`NOW()`,
      },
    });

  const forkCount = await incrementForksCreated(forkerInternalId);

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
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

  const [forked] = await db
    .insert(items)
    .values({
      name: `${source.name} (fork)`,
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
      sourceOrigin: `fork:${source.id}`,
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

  const versionId = resolveVirtualVersionId("ITEM", targetId);
  const sourceAuthorId = source.userId
    ? await resolveUserIdByClerkId(source.userId)
    : null;
  await db.insert(forks).values({
    forkedByUserId: forkerInternalId,
    sourceTargetType: "ITEM",
    sourceTargetId: source.id,
    sourceVersionId: versionId,
    sourceAuthorId,
    forkedTargetType: "ITEM",
    forkedTargetId: forked.id,
    forkedVersionId: versionId,
    metadata: { name: source.name },
  });

  await db
    .insert(forkAggregates)
    .values({
      sourceTargetType: "ITEM",
      sourceTargetId: source.id,
      sourceVersionId: versionId,
      forkCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        forkAggregates.sourceTargetType,
        forkAggregates.sourceTargetId,
        forkAggregates.sourceVersionId,
      ],
      set: {
        forkCount: sql`${forkAggregates.forkCount} + 1`,
        updatedAt: sql`NOW()`,
      },
    });

  const forkCount = await incrementForksCreated(forkerInternalId);

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkCount,
  };
}

// `randomUUID` is imported to allow future hooks (e.g. synthesizing a
// placeholder forkedVersionId until the fork re-publishes). Keeping it
// referenced so tree-shakers don't drop the import if we wire it later.
void randomUUID;