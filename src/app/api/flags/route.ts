// =============================================================================
// POST /api/flags — flag a target with a reason
// DELETE /api/flags — remove a flag
//
// Body: { targetType, targetId, versionId?, reason, note? }
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";
import { privateJson } from "@/lib/http/private-json";
import { z } from "zod";
import { db } from "@/db/client";
import { visibleEntries } from "@/lib/collections/service";
import {
  flagTarget,
  getFlagAggregate,
  listFlagNotes,
  unflagTarget,
} from "@/lib/engagement/flags-service";
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

const ReasonSchema = z.enum([
  "UNBALANCED",
  "BROKEN",
  "INAPPROPRIATE",
  "DUPLICATE",
  "OTHER",
]);

const FlagSchema = z.object({
  targetType: TargetTypeSchema,
  targetId: z.string().min(1).max(128),
  versionId: z.string().uuid().optional(),
  reason: ReasonSchema,
  note: z.string().max(500).optional(),
});

async function resolveUser(clerkUserId: string) {
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
  });
  return user ?? null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsedType = TargetTypeSchema.safeParse(url.searchParams.get("targetType"));
  const targetId = url.searchParams.get("targetId");
  const requestedVersionId = url.searchParams.get("versionId");
  if (!parsedType.success || !targetId) {
    return privateJson(
      { error: "Valid targetType and targetId are required" },
      { status: 400 },
    );
  }
  if (requestedVersionId && !isUuid(requestedVersionId)) {
    return privateJson({ error: "versionId must be a UUID" }, { status: 400 });
  }
  const { userId } = await auth();
  if (!(await visibleEntries([{ targetType: parsedType.data, targetId }], userId)).length) {
    return privateJson({ error: "Not found" }, { status: 404 });
  }
  const versionId = requestedVersionId ?? resolveVirtualVersionId(parsedType.data, targetId);
  try {
    const [distribution, notes] = await Promise.all([
      getFlagAggregate(parsedType.data, targetId, versionId),
      listFlagNotes(parsedType.data, targetId, versionId),
    ]);
    return privateJson({
      distribution,
      notes: notes.map(({ id, note, reportedAt }) => ({ id, note, reportedAt })),
    });
  } catch (err) {
    console.error("[flags GET] error:", err);
    return privateJson({ error: "Failed to load flag details" }, { status: 500 });
  }
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

  const parsed = FlagSchema.safeParse(body);
  if (!parsed.success) {
    return privateJson(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { targetType, targetId, versionId, reason, note } = parsed.data;

  // targetId is allowed to be any non-empty string (see /api/reactions POST
  // for rationale). Only versionId needs to be a UUID when provided.
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
    const result = await flagTarget({
      userId: user.id,
      targetType,
      targetId,
      versionId: finalVersionId,
      reason,
      ...(note ? { note } : {}),
    });
    return privateJson({ ok: true, ...result });
  } catch (err) {
    console.error("[flags POST] error:", err);
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
  const reason = url.searchParams.get("reason");

  if (!targetType || !targetId || !reason) {
    return privateJson(
      { error: "targetType, targetId, and reason are required" },
      { status: 400 },
    );
  }

  const typeCheck = TargetTypeSchema.safeParse(targetType);
  const reasonCheck = ReasonSchema.safeParse(reason);
  if (!typeCheck.success || !reasonCheck.success) {
    return privateJson(
      { error: "Invalid targetType or reason" },
      { status: 400 },
    );
  }
  // targetId can be any non-empty string (see POST for rationale).
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
    const result = await unflagTarget({
      userId: user.id,
      targetType: typeCheck.data,
      targetId,
      versionId: finalVersionId,
      reason: reasonCheck.data,
    });
    return privateJson({ ok: true, ...result });
  } catch (err) {
    console.error("[flags DELETE] error:", err);
    return privateJson(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
