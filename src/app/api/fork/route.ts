// =============================================================================
// POST /api/fork — fork a published target into your own sandbox
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { forkCapability } from "@/lib/publishing/fork-service";

const ForkSchema = z.object({
  publicationId: z.string().uuid(),
});

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

  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, userId),
  });
  if (!user) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  try {
    const result = await forkCapability({
      publicationId: parsed.data.publicationId,
      forkerUserId: user.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fork] error:", err);
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}