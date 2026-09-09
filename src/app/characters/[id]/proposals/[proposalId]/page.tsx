// =============================================================================
// /characters/[id]/proposals/[proposalId] — PLAN Eilxina Part C
// (Mashu 2026-09-09).
//
// Proposal review page. Server component:
//   1. Resolve the viewer's permission on the character.
//      - OWNER can see the full review screen (approve/reject).
//      - EDITOR can see the diff (read-only — they proposed it).
//      - VIEWER/NONE redirected to /characters.
//   2. Load the proposal row + both version snapshots.
//   3. Pass everything to <ProposalReviewScreen client component>.
//
// Layout: the screen has three panels (desktop) or a tab strip
// (mobile, per the codebase §0 two-panel-on-mobile rule):
//   - "Current": the slot's pinned version
//   - "Proposed": the new version the proposer wants
//   - "Diff": the field-level changes
//
// Approve and Reject call PATCH /api/characters/[id]/proposals/[id]
// with { action: "APPROVE" | "REJECT", note?: string }.
// =============================================================================

import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { characterProposals } from "@/db/schema";
import {
  primitiveVersions,
  capabilityVersions,
  itemVersions,
  users,
} from "@/db/schema";
import {
  canResolveCharacterForPage,
} from "@/lib/character/can-resolve-character";
import type { FieldChange } from "@/lib/character/proposal-types";
import {
  ProposalReviewScreen,
} from "@/components/characters/proposal-review-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; proposalId: string }>;
}

export default async function ProposalPage({ params }: PageProps) {
  const { id: characterId, proposalId } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const resolved = await canResolveCharacterForPage(clerkUserId, characterId);
  if (!resolved) redirect("/characters");
  const permission = resolved.permission;

  const proposalRow = await db
    .select()
    .from(characterProposals)
    .where(
      and(
        eq(characterProposals.id, proposalId),
        eq(characterProposals.characterId, characterId),
      ),
    )
    .limit(1);
  if (proposalRow.length === 0) notFound();
  const proposal = proposalRow[0]!;

  // Load both versions so the screen can show current vs proposed.
  const currentSnap = await loadSnapshot(
    proposal.targetKind,
    proposal.currentVersionId,
  );
  const proposedSnap = await loadSnapshot(
    proposal.targetKind,
    proposal.proposedVersionId,
  );

  // Proposer display name for the "Proposed by @user" line.
  const proposer = await db
    .select({
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.clerkUserId, proposal.proposerUserId))
    .limit(1);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <ProposalReviewScreen
        characterId={characterId}
        characterName={resolved.character.name}
        viewerPermission={permission}
        proposal={{
          id: proposal.id,
          status: proposal.status,
          targetKind: proposal.targetKind,
          targetId: proposal.targetId,
          rationale: proposal.rationale,
          proposer: proposer[0] ?? null,
          proposedDiff:
            proposal.proposedDiff as unknown as {
              fieldChanges: FieldChange[];
            },
          createdAt:
            proposal.createdAt instanceof Date
              ? proposal.createdAt.toISOString()
              : String(proposal.createdAt),
          reviewedAt:
            proposal.reviewedAt instanceof Date
              ? proposal.reviewedAt.toISOString()
              : proposal.reviewedAt
                ? String(proposal.reviewedAt)
                : null,
          reviewerNote: proposal.reviewerNote,
        }}
        currentSnapshot={currentSnap}
        proposedSnapshot={proposedSnap}
      />
    </div>
  );
}

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
  return snap as Record<string, unknown>;
}
