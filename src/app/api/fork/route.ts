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

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  forkAggregates,
  forks,
  primitives,
  templates,
  templatePrimitives,
} from "@/db/schema";
import { resolveVirtualVersionId } from "@/lib/engagement/version-helpers";

const ForkSchema = z.object({
  targetType: z.enum([
    "PRIMITIVE",
    "CAPABILITY",
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
          ...(await forkPrimitive({ targetId, forkerClerkUserId: userId })),
        });
      case "CAPABILITY":
        return NextResponse.json({
          ok: true,
          ...(await forkCapability({ targetId, forkerUserId: user.id })),
        });
      case "RACE_TEMPLATE":
      case "BACKGROUND_TEMPLATE":
      case "ARCHETYPE_TEMPLATE":
      case "BUILD_TEMPLATE":
        return NextResponse.json({
          ok: true,
          ...(await forkTemplate({ targetId, forkerUserId: user.id })),
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
// ---------------------------------------------------------------------------

async function forkPrimitive(input: {
  targetId: string;
  forkerClerkUserId: string;
}) {
  const { targetId, forkerClerkUserId } = input;

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
  await db.insert(forks).values({
    forkedByUserId: forkerClerkUserId,
    sourceTargetType: "PRIMITIVE",
    sourceTargetId: String(source.id),
    sourceVersionId: versionId,
    sourceAuthorId: null, // primitives.userId is text (Clerk ID), not internal UUID
    forkedTargetType: "PRIMITIVE",
    forkedTargetId: String(forked.id),
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

  return {
    forkedTargetId: String(forked.id),
    sourceTargetId: String(source.id),
    forkCount: Number(agg?.forkCount ?? 1),
  };
}

// ---------------------------------------------------------------------------
// Fork a capability (id is uuid, includes primitive_links)
// ---------------------------------------------------------------------------

async function forkCapability(input: {
  targetId: string;
  forkerUserId: string;
}) {
  const { targetId, forkerUserId } = input;

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
  await db.insert(forks).values({
    forkedByUserId: forkerUserId,
    sourceTargetType: "CAPABILITY",
    sourceTargetId: source.id,
    sourceVersionId: versionId,
    sourceAuthorId: null,
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

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkCount: Number(agg?.forkCount ?? 1),
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
  forkerUserId: string;
}) {
  const { targetId, forkerUserId } = input;

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
      userId: forkerUserId,
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
  await db.insert(forks).values({
    forkedByUserId: forkerUserId,
    sourceTargetType: targetType,
    sourceTargetId: source.id,
    sourceVersionId: versionId,
    sourceAuthorId: null,
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

  return {
    forkedTargetId: forked.id,
    sourceTargetId: source.id,
    forkCount: Number(agg?.forkCount ?? 1),
  };
}