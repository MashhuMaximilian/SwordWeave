// =============================================================================
// POST /api/characters/[id]/proposals — PLAN Eilxina Part C
// (Mashu 2026-09-09).
//
// An EDITOR (or OWNER) proposes a slot change. The proposal points
// at a NEW version_id (not a new primitive authoring — that's
// separate) of an already-existing entity. The OWNER reviews via
// /characters/[id]/proposals/[proposalId] and either approves or
// rejects.
//
// Body: {
//   targetKind: "PRIMITIVE" | "CAPABILITY" | "ITEM",
//   targetId: string,           // the entity id (NOT the slot instance id)
//   currentVersionId: string,   // pinned on the slot today
//   proposedVersionId: string,  // the new version the proposer wants
//   rationale?: string,
// }
// Response: 201 { proposal: { id, status: "PENDING", ... } }
//
// Auth: OWNER OR EDITOR (i.e. permission !== "VIEWER" and !== NONE).
// Viewers can't propose (read-only).
//
// Idempotency: if a PENDING proposal already exists for the same
// (character_id, target_kind, target_id), the existing proposal is
// UPDATED with the new proposed_version_id (not 409). This matches
// the "edit an existing proposal" semantic — typical DM flow:
// propose v2, see the diff, decide v3 is actually better, edit.
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterProposals } from "@/db/schema";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";
import {
  computeProposalDiff,
} from "@/lib/character/compute-proposal-diff";
import {
  primitiveVersions,
  capabilityVersions,
  itemVersions,
} from "@/db/schema";

function parsePostBody(body: unknown):
  | { ok: true; value: {
      targetKind: "PRIMITIVE" | "CAPABILITY" | "ITEM";
      targetId: string;
      currentVersionId: string;
      proposedVersionId: string;
      rationale?: string | undefined;
    } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const targetKind = b["targetKind"];
  if (targetKind !== "PRIMITIVE" && targetKind !== "CAPABILITY" && targetKind !== "ITEM") {
    return { ok: false, error: "targetKind must be PRIMITIVE | CAPABILITY | ITEM." };
  }
  const targetId = b["targetId"];
  const currentVersionId = b["currentVersionId"];
  const proposedVersionId = b["proposedVersionId"];
  if (typeof targetId !== "string" || targetId.length === 0) {
    return { ok: false, error: "targetId is required." };
  }
  if (typeof currentVersionId !== "string" || currentVersionId.length === 0) {
    return { ok: false, error: "currentVersionId is required." };
  }
  if (typeof proposedVersionId !== "string" || proposedVersionId.length === 0) {
    return { ok: false, error: "proposedVersionId is required." };
  }
  if (currentVersionId === proposedVersionId) {
    return {
      ok: false,
      error: "proposedVersionId must differ from currentVersionId.",
    };
  }
  const rationaleRaw = b["rationale"];
  const rationale =
    typeof rationaleRaw === "string" && rationaleRaw.length > 0
      ? rationaleRaw.slice(0, 1000)
      : undefined;
  return {
    ok: true,
    value: { targetKind, targetId, currentVersionId, proposedVersionId, rationale },
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth.protect();
    const { id: characterId } = await params;
    // EDITOR or OWNER — i.e. NOT VIEWER. require: "EDITOR" because
    // OWNER > EDITOR in the rank order.
    const { permission } = await resolveCharacterAccess(
      clerkUserId,
      characterId,
      { require: "EDITOR" },
    );
    // (permission is guaranteed OWNER | EDITOR here.)
    void permission;

    const body: unknown = await request.json().catch(() => ({}));
    const parsed = parsePostBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { targetKind, targetId, currentVersionId, proposedVersionId, rationale } =
      parsed.value;

    // Load both version snapshots so we can build the diff.
    const currentSnap = await loadSnapshot(targetKind, currentVersionId);
    const proposedSnap = await loadSnapshot(targetKind, proposedVersionId);
    if (!currentSnap || !proposedSnap) {
      return NextResponse.json(
        { error: "Could not find one of the requested versions." },
        { status: 404 },
      );
    }
    const diff = computeProposalDiff(currentSnap, proposedSnap);
    if (diff.fieldChanges.length === 0) {
      return NextResponse.json(
        {
          error:
            "Both versions have identical field values. Nothing to propose.",
        },
        { status: 400 },
      );
    }

    // Idempotency: find existing PENDING proposal for this (char,
    // targetKind, targetId) → update instead of insert.
    const existing = await db
      .select({ id: characterProposals.id })
      .from(characterProposals)
      .where(
        and(
          eq(characterProposals.characterId, characterId),
          eq(characterProposals.targetKind, targetKind),
          eq(characterProposals.targetId, targetId),
          eq(characterProposals.status, "PENDING"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(characterProposals)
        .set({
          currentVersionId,
          proposedVersionId,
          proposedDiff: diff,
          rationale: rationale ?? null,
          updatedAt: new Date(),
        })
        .where(eq(characterProposals.id, existing[0]!.id));
      return NextResponse.json(
        { proposalId: existing[0]!.id, updated: true },
        { status: 200 },
      );
    }

    const inserted = await db
      .insert(characterProposals)
      .values({
        characterId,
        proposerUserId: clerkUserId,
        targetKind,
        targetId,
        currentVersionId,
        proposedVersionId,
        proposedDiff: diff,
        rationale: rationale ?? null,
      })
      .returning({ id: characterProposals.id });

    return NextResponse.json(
      { proposalId: inserted[0]!.id, created: true },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[POST /api/characters/[id]/proposals] unexpected:", e);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

/** Fetch the snapshot jsonb from the correct version table for the
 *  given target_kind. Returns the inner object (not the {kind, data}
 *  envelope — the diff helper expects the unwrapped shape). */
async function loadSnapshot(
  targetKind: "PRIMITIVE" | "CAPABILITY" | "ITEM",
  versionId: string,
): Promise<Record<string, unknown> | null> {
  const table =
    targetKind === "PRIMITIVE"
      ? primitiveVersions
      : targetKind === "CAPABILITY"
        ? capabilityVersions
        : itemVersions;
  const rows = await db
    .select({ snapshot: table.snapshot })
    .from(table)
    .where(eq(table.id, versionId))
    .limit(1);
  const snap = rows[0]?.snapshot;
  if (!snap || typeof snap !== "object") return null;
  // The version table stores the FULL payload directly (not wrapped).
  return snap as Record<string, unknown>;
}
