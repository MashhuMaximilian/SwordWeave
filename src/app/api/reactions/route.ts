// =============================================================================
// POST /api/reactions — set user's reaction (like / dislike) on a target
// DELETE /api/reactions — remove the user's reaction
//
// Body: { targetType, targetId, versionId?, kind: "LIKE" | "DISLIKE" }
//
// Note: For unversioned library targets (existing primitives/templates that
// haven't been published via Phase 5), we synthesize a stable "current"
// versionId from the targetId. Real versioned targets pass versionId
// from the publication.
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import {
  setReaction,
  removeReaction,
} from "@/lib/engagement/reactions-service";
import {
  isUuid,
  resolveVirtualVersionId,
} from "@/lib/engagement/version-helpers";

const TargetTypeSchema = z.enum([
  "PRIMITIVE",
  "CAPABILITY",
  "CHARACTER",
  "ITEM",
  "RACE_TEMPLATE",
  "BACKGROUND_TEMPLATE",
  "ARCHETYPE_TEMPLATE",
  "BUILD_TEMPLATE",
]);

const ReactionSchema = z.object({
  targetType: TargetTypeSchema,
  targetId: z.string().min(1),
  versionId: z.string().uuid().optional(),
  kind: z.enum(["LIKE", "DISLIKE"]),
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

  const user = await resolveUser(userId);
  if (!user) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { targetType, targetId, versionId, kind } = parsed.data;

  // Validate targetId is UUID-shaped (required for our reactions.aggregate PK
  // synthetic row key). Versioned targets pass an explicit UUID.
  if (!isUuid(targetId)) {
    return NextResponse.json(
      { error: "targetId must be a UUID" },
      { status: 400 },
    );
  }

  const finalVersionId =
    versionId ?? resolveVirtualVersionId(targetType, targetId);

  try {
    const result = await setReaction({
      userId: user.id,
      targetType,
      targetId,
      versionId: finalVersionId,
      kind,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[reactions POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  const versionId = url.searchParams.get("versionId");

  if (!targetType || !targetId) {
    return NextResponse.json(
      { error: "targetType and targetId are required" },
      { status: 400 },
    );
  }
  const typeCheck = TargetTypeSchema.safeParse(targetType);
  if (!typeCheck.success) {
    return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
  }
  if (!isUuid(targetId)) {
    return NextResponse.json(
      { error: "targetId must be a UUID" },
      { status: 400 },
    );
  }
  if (versionId && !isUuid(versionId)) {
    return NextResponse.json(
      { error: "versionId must be a UUID" },
      { status: 400 },
    );
  }

  const finalVersionId =
    (versionId as string | null) ??
    resolveVirtualVersionId(typeCheck.data, targetId);

  try {
    const result = await removeReaction({
      userId: user.id,
      targetType: typeCheck.data,
      targetId,
      versionId: finalVersionId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[reactions DELETE] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}