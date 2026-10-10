// =============================================================================
// POST /api/reactions — set user's reaction (like / dislike) on a target
// DELETE /api/reactions — remove the user's reaction
//
// Body: { targetType, targetId, versionId?, kind: "LIKE" | "DISLIKE" }
//
// Note: For unversioned library targets (existing primitives/heritage that
// haven't been published via Phase 5), we synthesize a stable "current"
// versionId from the targetId. Real versioned targets pass versionId
// from the publication.
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";
import { privateJson } from "@/lib/http/private-json";
import { z } from "zod";
import { db } from "@/db/client";
import { visibleEntries } from "@/lib/collections/service";
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
  "EFFECT",
  "LINEAGE_TEMPLATE",
  "UPBRINGING_TEMPLATE",
  "MANIFEST_TEMPLATE",
  "BUILD_TEMPLATE",
  "MONSTER",
  "ENCOUNTER",
  "COLLECTION",
]);

const ReactionSchema = z.object({
  targetType: TargetTypeSchema,
  targetId: z.string().min(1).max(128),
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
    return privateJson({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return privateJson(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return privateJson({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReactionSchema.safeParse(body);
  if (!parsed.success) {
    return privateJson(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { targetType, targetId, versionId, kind } = parsed.data;

  // targetId is allowed to be ANY non-empty string — the canonical store
  // key is (targetType, versionId) where versionId is synthesized via
  // resolveVirtualVersionId() for unversioned items. (Real versioned
  // targets pass their actual version_id, which IS a UUID — and we still
  // validate that one below.)
  if (!targetId) {
    return privateJson(
      { error: "targetId is required" },
      { status: 400 },
    );
  }

  if (!(await visibleEntries([{ targetType, targetId }], userId)).length) {
    return privateJson({ error: "Not found" }, { status: 404 });
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
    return privateJson({ ok: true, ...result });
  } catch (err) {
    console.error("[reactions POST] error:", err);
    return privateJson(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return privateJson({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return privateJson(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  const versionId = url.searchParams.get("versionId");

  if (!targetType || !targetId) {
    return privateJson(
      { error: "targetType and targetId are required" },
      { status: 400 },
    );
  }
  const typeCheck = TargetTypeSchema.safeParse(targetType);
  if (!typeCheck.success) {
    return privateJson({ error: "Invalid targetType" }, { status: 400 });
  }
  // targetId can be any non-empty string (see POST comment for rationale).
  if (!targetId) {
    return privateJson(
      { error: "targetId is required" },
      { status: 400 },
    );
  }
  if (versionId && !isUuid(versionId)) {
    return privateJson(
      { error: "versionId must be a UUID" },
      { status: 400 },
    );
  }

  if (!(await visibleEntries([{ targetType: typeCheck.data, targetId }], userId)).length) {
    return privateJson({ error: "Not found" }, { status: 404 });
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
    return privateJson({ ok: true, ...result });
  } catch (err) {
    console.error("[reactions DELETE] error:", err);
    return privateJson(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}