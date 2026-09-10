// =============================================================================
// PATCH /api/characters/[id]/proposals/[proposalId] — PLAN Eilxina
// Part C (Mashu 2026-09-09).
//
// Approve or reject a PENDING proposal. Only the OWNER can decide —
// EDITORs who propose don't get to approve their own proposals
// (preserves the proposer/reviewer separation).
//
// On APPROVE:
//   1. Status → APPROVED.
//   2. Find the slot row matching (character, target_kind, target_id).
//      The slot lives in:
//        character_primitives   for PRIMITIVE
//        character_capabilities for CAPABILITY
//        character_items        for ITEM
//   3. UPDATE slot's versionId → proposed_version_id.
//   4. Bust resolver cache + recompute bu_spent.
//   5. Status → APPLIED, applied_at = now.
//
// On REJECT:
//   1. Status → REJECTED, reviewer_note + reviewed_at.
//
// Body: { action: "APPROVE" | "REJECT", note?: string }
// Response: 200 { status: "APPROVED" | "REJECTED" | "APPLIED", slotUpdated?: boolean }
//
// Auth: OWNER only.
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterProposals,
  characterPrimitives,
  characterCapabilities,
  characterItems,
} from "@/db/schema";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";
import { recomputeBuSpentAndBustCache } from "@/lib/engine/recompute-bu-spent";

function parsePatchBody(body: unknown):
  | { ok: true; value: { action: "APPROVE" | "REJECT"; note?: string | undefined } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const action = b["action"];
  if (action !== "APPROVE" && action !== "REJECT") {
    return { ok: false, error: "action must be APPROVE or REJECT." };
  }
  const noteRaw = b["note"];
  const note =
    typeof noteRaw === "string" && noteRaw.length > 0
      ? noteRaw.slice(0, 1000)
      : undefined;
  return { ok: true, value: { action, note } };
}

export async function PATCH(
  request: Request,
  { params }: {
    params: Promise<{ id: string; proposalId: string }>;
  },
) {
  try {
    const { userId: clerkUserId } = await auth.protect();
    const { id: characterId, proposalId } = await params;
    await resolveCharacterAccess(clerkUserId, characterId, {
      require: "OWNER",
    });

    const body: unknown = await request.json().catch(() => ({}));
    const parsed = parsePatchBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { action, note } = parsed.value;

    const existing = await db
      .select({
        id: characterProposals.id,
        status: characterProposals.status,
        targetKind: characterProposals.targetKind,
        targetId: characterProposals.targetId,
        proposedVersionId: characterProposals.proposedVersionId,
        currentVersionId: characterProposals.currentVersionId,
      })
      .from(characterProposals)
      .where(
        and(
          eq(characterProposals.id, proposalId),
          eq(characterProposals.characterId, characterId),
        ),
      )
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 },
      );
    }
    const proposal = existing[0]!;
    if (proposal.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Cannot review a ${proposal.status} proposal. Only PENDING proposals can be reviewed.`,
        },
        { status: 409 },
      );
    }

    if (action === "REJECT") {
      await db
        .update(characterProposals)
        .set({
          status: "REJECTED",
          reviewerUserId: clerkUserId,
          reviewerNote: note ?? null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(characterProposals.id, proposalId));
      return NextResponse.json(
        { status: "REJECTED", proposalId },
        { status: 200 },
      );
    }

    // APPROVE path — write the slot's versionId.
    const slotUpdated = await writeSlotVersionId({
      characterId,
      targetKind: proposal.targetKind,
      // For primitives, the slot's primitiveId is the integer id.
      // The proposal's targetId is the same primitive id (we
      // validated the proposal's versionId belongs to that
      // primitive when we computed the diff).
      targetId: proposal.targetId,
      proposedVersionId: proposal.proposedVersionId,
    });

    if (!slotUpdated) {
      // Slot missing — likely the entity was detached since the
      // proposal was created. Mark the proposal SUPERSEDED so
      // the audit trail captures "approved but couldn't apply."
      await db
        .update(characterProposals)
        .set({
          status: "SUPERSEDED",
          reviewerUserId: clerkUserId,
          reviewerNote:
            (note ? note + " — " : "") +
            "Approved but slot no longer exists; marked SUPERSEDED.",
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(characterProposals.id, proposalId));
      return NextResponse.json(
        {
          status: "SUPERSEDED",
          proposalId,
          reason: "Slot no longer exists on this character.",
        },
        { status: 200 },
      );
    }

    // Mark APPROVED then APPLIED. We do it in two updates so the
    // reviewerNote + reviewedAt are captured at the approval moment
    // even if the slot write fails downstream (it can't, but the
    // split keeps the audit trail clean).
    await db
      .update(characterProposals)
      .set({
        status: "APPROVED",
        reviewerUserId: clerkUserId,
        reviewerNote: note ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(characterProposals.id, proposalId));

    await db
      .update(characterProposals)
      .set({
        status: "APPLIED",
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(characterProposals.id, proposalId));

    // Recompute BU so the next sheet render shows the new totals.
    // recomputeBuSpentAndBustCache already busts the resolver cache.
    await recomputeBuSpentAndBustCache(characterId);

    return NextResponse.json(
      { status: "APPLIED", proposalId, slotUpdated: true },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error(
      "[PATCH /api/characters/[id]/proposals/[proposalId]] unexpected:",
      e,
    );
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

async function writeSlotVersionId(args: {
  characterId: string;
  targetKind: "PRIMITIVE" | "CAPABILITY" | "ITEM";
  targetId: string;
  proposedVersionId: string;
}): Promise<boolean> {
  const { characterId, targetKind, targetId, proposedVersionId } = args;
  if (targetKind === "PRIMITIVE") {
    // targetId is an integer (primitive id). Drizzle bigserial.
    const primId = Number(targetId);
    if (!Number.isFinite(primId)) return false;
    const result = await db
      .update(characterPrimitives)
      .set({ versionId: proposedVersionId })
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.primitiveId, primId),
        ),
      )
      .returning({ characterId: characterPrimitives.characterId });
    return result.length > 0;
  }
  if (targetKind === "CAPABILITY") {
    const result = await db
      .update(characterCapabilities)
      .set({ versionId: proposedVersionId })
      .where(
        and(
          eq(characterCapabilities.characterId, characterId),
          eq(characterCapabilities.capabilityId, targetId),
        ),
      )
      .returning({
        characterId: characterCapabilities.characterId,
      });
    return result.length > 0;
  }
  // ITEM
  const result = await db
    .update(characterItems)
    .set({ versionId: proposedVersionId })
    .where(
      and(
        eq(characterItems.characterId, characterId),
        eq(characterItems.itemId, targetId),
      ),
    )
    .returning({ characterId: characterItems.characterId });
  return result.length > 0;
}
