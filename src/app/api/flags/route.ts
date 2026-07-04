// =============================================================================
// POST /api/flags — flag a target with a reason
// DELETE /api/flags — remove a flag
//
// Body: { targetType, targetId, versionId?, reason, note? }
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { flagTarget, unflagTarget } from "@/lib/engagement/flags-service";
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

const ReasonSchema = z.enum([
  "UNBALANCED",
  "BROKEN",
  "INAPPROPRIATE",
  "DUPLICATE",
  "OTHER",
]);

const FlagSchema = z.object({
  targetType: TargetTypeSchema,
  targetId: z.string().min(1),
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

  const parsed = FlagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { targetType, targetId, versionId, reason, note } = parsed.data;

  if (!isUuid(targetId)) {
    return NextResponse.json(
      { error: "targetId must be a UUID" },
      { status: 400 },
    );
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
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[flags POST] error:", err);
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
  const reason = url.searchParams.get("reason");

  if (!targetType || !targetId || !reason) {
    return NextResponse.json(
      { error: "targetType, targetId, and reason are required" },
      { status: 400 },
    );
  }

  const typeCheck = TargetTypeSchema.safeParse(targetType);
  const reasonCheck = ReasonSchema.safeParse(reason);
  if (!typeCheck.success || !reasonCheck.success) {
    return NextResponse.json(
      { error: "Invalid targetType or reason" },
      { status: 400 },
    );
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
    const result = await unflagTarget({
      userId: user.id,
      targetType: typeCheck.data,
      targetId,
      versionId: finalVersionId,
      reason: reasonCheck.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[flags DELETE] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}