import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";

/**
 * GET /api/primitives/[id]
 *
 * Phase 8.3e (Mashu 2026-07-27): returns the full primitive row
 * for the character sheet's PrimitivePreviewCard to feed into
 * EntityPreview. Mirrors the shape SandboxPrimitiveRow expects
 * (see src/components/library/library-item-preview.tsx).
 *
 * The primitive detail endpoint didn't exist before this commit;
 * /api/primitives was a list-only endpoint. Adding [id] is a small
 * additive change — no breaking changes to existing routes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return NextResponse.json(
      { error: "Invalid primitive id." },
      { status: 400 },
    );
  }

  const row = await db.query.primitives.findFirst({
    where: eq(primitives.id, parsedId),
  });

  if (!row) {
    return NextResponse.json(
      { error: "Primitive not found." },
      { status: 404 },
    );
  }

  // Project the row into the SandboxPrimitiveRow shape so
  // EntityPreview can render it without further transformation.
  // latestVersionNumber is set client-side by the caller; we omit
  // it here so the shape stays minimal.
  const primitive = {
    id: row.id,
    name: row.name,
    category: row.category,
    buCost: row.buCost,
    isPublic: row.isPublic,
    costTier: row.costTier,
    mechanicalOutputText: row.mechanicalOutputText ?? "",
    narrativeRule: row.narrativeRule ?? "",
    isMirrorable: row.isMirrorable,
    mirrorVector: row.mirrorVector,
    mirrorBuCredit: row.mirrorBuCredit,
    mirrorEligibilityNotes: row.mirrorEligibilityNotes ?? "",
    sourceOrigin: row.sourceOrigin ?? null,
    tags: row.tags ?? [],
    hardModifiers: row.hardModifiers ?? [],
    iconSource: row.iconSource ?? null,
    iconKey: row.iconKey ?? null,
    iconUrl: row.iconUrl ?? null,
    iconColor: row.iconColor,
  };

  return NextResponse.json({ primitive });
}