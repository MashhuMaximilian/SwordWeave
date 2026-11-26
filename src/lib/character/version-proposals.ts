import { and, eq, isNull, sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { characterCapabilities, characterItems, characterPrimitives, characterProposals,
  characters, characterWorkspaceState, users } from "@/db/schema";
import { acquirePublishingLock } from "@/lib/publishing/save-transaction";
import { getPinnedVersionPayload } from "@/lib/versions/version-payload";
import { computeProposalDiff } from "./compute-proposal-diff";
import type { ProposalTargetKind } from "./proposal-types";
import { resolveCharacterAccess } from "./resolve-character-access";
import { validateVersionProposal } from "./validate-version-proposal";
import { exactDirectVersionProposalPath, verifyWritableVersionProposalContent } from "./version-proposal-details";
import { readDraftSheet } from "./workspace/draft-sheet";

export type VersionProposalRow = typeof characterProposals.$inferSelect;
export type VersionProposalTarget = Pick<VersionProposalRow, "targetKind" | "targetId" | "currentVersionId" | "proposedVersionId"> & {
  instanceId?: string | undefined;
};
export type VersionProposalDecision = "APPROVE" | "REJECT";

export class VersionProposalError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

export async function withVersionProposalCharacterLock<T>(characterId: string, work: () => Promise<T>) {
  return withDatabaseTransaction(async () => {
    const [character] = await db.select({ id: characters.id }).from(characters)
      .where(eq(characters.id, characterId)).for("update");
    if (!character) throw new VersionProposalError(403, "This character is unavailable.");
    await acquirePublishingLock();
    return work();
  });
}

export async function getActiveVersionProposalAccount(clerkId: string) {
  const [account] = await db.select({ id: users.id, clerkId: users.clerkUserId }).from(users)
    .where(and(eq(users.clerkUserId, clerkId), eq(users.isAnonymized, false), isNull(users.deletedAt)))
    .for("share");
  if (!account?.clerkId) throw new VersionProposalError(403, "This proposal participant is unavailable.");
  return { id: account.id, clerkId: account.clerkId };
}

export async function loadVersionProposal(characterId: string, proposalId: string) {
  const [proposal] = await db.select().from(characterProposals).where(and(
    eq(characterProposals.characterId, characterId), eq(characterProposals.id, proposalId))).limit(1);
  if (!proposal) throw new VersionProposalError(404, "Proposal not found.");
  if (proposal.status !== "PENDING") {
    throw new VersionProposalError(409, `Cannot review a ${proposal.status} proposal. Only PENDING proposals can be reviewed.`);
  }
  return proposal;
}

export async function findPendingVersionProposals(characterId: string, proposerUserId: string, kind: ProposalTargetKind, targetId: string) {
  return db.select().from(characterProposals).where(and(eq(characterProposals.characterId, characterId),
    eq(characterProposals.proposerUserId, proposerUserId), eq(characterProposals.targetKind, kind),
    eq(characterProposals.targetId, targetId), eq(characterProposals.status, "PENDING")))
    .orderBy(characterProposals.id).limit(2);
}

export function versionProposalInstanceId(proposal: Pick<VersionProposalRow, "proposedDiff">) {
  const data = proposal.proposedDiff as Record<string, unknown> | null;
  const instanceId = data?.["instanceId"];
  if (instanceId == null) return undefined;
  if (typeof instanceId !== "string" || !instanceId) {
    throw new VersionProposalError(409, "This proposal lacks a valid occurrence ID.");
  }
  return instanceId;
}

function isCompanionVersionProposal(proposal: VersionProposalRow) {
  return (proposal.proposedDiff as Record<string, unknown> | null)?.["companionOrigin"] === true;
}

async function requireVersionSources(clerkId: string, characterId: string, target: VersionProposalTarget) {
  const evidence = await verifyWritableVersionProposalContent(clerkId, {
    ...target, characterId, instanceId: target.instanceId ?? null, status: "PENDING",
  });
  if (!evidence?.diff.fieldChanges.length) {
    throw new VersionProposalError(409, "One of the exact versions or its dependencies is no longer eligible. Review the proposal again.");
  }
  return evidence;
}

export async function saveVersionProposal(args: VersionProposalTarget & {
  characterId: string; proposerUserId: string; rationale?: string | undefined; expectedPendingId?: string | null | undefined;
  companionOrigin?: true;
}) {
  const { characterId, proposerUserId, targetKind, targetId, currentVersionId, proposedVersionId, rationale } = args;
  return withVersionProposalCharacterLock(characterId, async () => {
    await getActiveVersionProposalAccount(proposerUserId);
    await resolveCharacterAccess(proposerUserId, characterId, { require: "SUGGESTER" });
    const binding = await validateVersionProposal(characterId, targetKind, targetId, currentVersionId, proposedVersionId, args.instanceId);
    if (!binding) throw new VersionProposalError(409, "The versions must belong to this definition and match one current character occurrence. Select the occurrence again.");
    const [current, proposed] = await Promise.all([
      getPinnedVersionPayload(targetKind, targetId, currentVersionId),
      getPinnedVersionPayload(targetKind, targetId, proposedVersionId),
    ]);
    if (!current || !proposed) throw new VersionProposalError(404, "Could not reconstruct one of the requested versions.");
    const diff = { ...computeProposalDiff(current.payload, proposed.payload), ...binding };
    if (!diff.fieldChanges.length) throw new VersionProposalError(400, "Both versions have identical field values. Nothing to propose.");
    const pending = await findPendingVersionProposals(characterId, proposerUserId, targetKind, targetId);
    const [previous] = pending;
    if (args.expectedPendingId !== undefined &&
      (pending.length > 1 || (previous?.id ?? null) !== args.expectedPendingId)) {
      throw new VersionProposalError(409, "The pending proposal changed. Review the proposal again.");
    }
    const companionOrigin = args.companionOrigin === true || (previous && isCompanionVersionProposal(previous));
    if (companionOrigin) {
      const evidence = await requireVersionSources(proposerUserId, characterId, { ...args, instanceId: binding.instanceId });
      if (previous) {
        const oldPath = await exactDirectVersionProposalPath({ ...previous, instanceId: versionProposalInstanceId(previous) ?? null },
          previous.targetId, previous.currentVersionId);
        if (pending.length > 1 || oldPath?.[0] !== evidence.path[0] || previous.currentVersionId !== currentVersionId) {
          throw new VersionProposalError(409, "The pending proposal belongs to a different occurrence or version. Review it separately.");
        }
      }
    }
    const values = { currentVersionId, proposedVersionId, proposedDiff: { ...diff, ...(companionOrigin ? { companionOrigin: true } : {}) },
      rationale: rationale ?? null };
    if (previous) {
      await db.update(characterProposals).set({ ...values, updatedAt: new Date() })
        .where(eq(characterProposals.id, previous.id));
      return { proposalId: previous.id, updated: true as const };
    }
    const [inserted] = await db.insert(characterProposals).values({ characterId, proposerUserId, targetKind, targetId, ...values })
      .returning({ id: characterProposals.id });
    if (!inserted) throw new Error("The version proposal was not inserted.");
    return { proposalId: inserted.id, created: true as const };
  });
}

async function writeSlotVersion(proposal: VersionProposalRow, instanceId?: string) {
  const { characterId, targetKind, targetId, currentVersionId, proposedVersionId } = proposal;
  const patch = { versionId: proposedVersionId };
  if (targetKind === "PRIMITIVE" && instanceId) {
    return db.update(characterPrimitives).set(patch).where(and(
      eq(characterPrimitives.characterId, characterId), eq(characterPrimitives.primitiveId, Number(targetId)),
      eq(characterPrimitives.instanceId, instanceId), eq(characterPrimitives.versionId, currentVersionId)))
      .returning({ versionId: characterPrimitives.versionId });
  }
  if (targetKind === "CAPABILITY") return db.update(characterCapabilities).set(patch).where(and(
    eq(characterCapabilities.characterId, characterId), eq(characterCapabilities.capabilityId, targetId),
    eq(characterCapabilities.versionId, currentVersionId))).returning({ versionId: characterCapabilities.versionId });
  if (targetKind === "ITEM") return db.update(characterItems).set(patch).where(and(
    eq(characterItems.characterId, characterId), eq(characterItems.itemId, targetId),
    eq(characterItems.versionId, currentVersionId))).returning({ versionId: characterItems.versionId });
  return [];
}

export async function decideVersionProposal(args: {
  characterId: string; proposalId: string; reviewerUserId: string; action: VersionProposalDecision;
  note?: string | undefined; assertReviewedProposal?: (proposal: VersionProposalRow) => Promise<void>;
}) {
  const { characterId, proposalId, reviewerUserId, action, note, assertReviewedProposal } = args;
  return withVersionProposalCharacterLock(characterId, async () => {
    await getActiveVersionProposalAccount(reviewerUserId);
    await resolveCharacterAccess(reviewerUserId, characterId, { require: "OWNER" });
    const proposal = await loadVersionProposal(characterId, proposalId);
    await assertReviewedProposal?.(proposal);
    const now = new Date();
    const review = { reviewerUserId, reviewerNote: note || null, reviewedAt: now, updatedAt: now };
    if (action === "REJECT") {
      await db.update(characterProposals).set({ ...review, status: "REJECTED" }).where(eq(characterProposals.id, proposalId));
      return { status: "REJECTED" as const, proposalId };
    }
    await getActiveVersionProposalAccount(proposal.proposerUserId);
    await resolveCharacterAccess(proposal.proposerUserId, characterId, { require: "SUGGESTER" });
    const instanceId = versionProposalInstanceId(proposal);
    const binding = await validateVersionProposal(characterId, proposal.targetKind, proposal.targetId,
      proposal.currentVersionId, proposal.proposedVersionId, instanceId);
    if (!binding) throw new VersionProposalError(409, "This occurrence changed or is ambiguous. Ask for an updated proposal; nothing was applied.");
    const companionOrigin = isCompanionVersionProposal(proposal);
    if (companionOrigin) {
      await requireVersionSources(reviewerUserId, characterId, { ...proposal, instanceId });
      if (reviewerUserId !== proposal.proposerUserId) await requireVersionSources(proposal.proposerUserId, characterId, { ...proposal, instanceId });
    }
    const proposed = await getPinnedVersionPayload(proposal.targetKind, proposal.targetId, proposal.proposedVersionId);
    if (!proposed || typeof proposed.payload["name"] !== "string" || !proposed.payload["name"]) {
      throw new VersionProposalError(409, "This version can no longer be reconstructed. Nothing was applied.");
    }
    const updated = await writeSlotVersion(proposal, binding.instanceId);
    if (updated.length !== 1 || updated[0]?.versionId !== proposal.proposedVersionId) {
      throw new VersionProposalError(409, "This occurrence changed. Ask for an updated proposal; nothing was applied.");
    }
    const sheet = await readDraftSheet(characterId);
    if ((assertReviewedProposal || companionOrigin) && sheet.volatility.exceeded) {
      throw new VersionProposalError(400, "This version would exceed the drawback credit limit.");
    }
    await db.update(characters).set({ buSpent: sheet.buLedger.positiveSpent }).where(eq(characters.id, characterId));
    const [result] = await db.insert(characterWorkspaceState).values({ characterId, revision: 1 })
      .onConflictDoUpdate({ target: characterWorkspaceState.characterId, set: { revision: sql`${characterWorkspaceState.revision} + 1` } })
      .returning({ revision: characterWorkspaceState.revision });
    if (!result) throw new Error("The workspace revision was not updated.");
    await db.update(characterProposals).set({ ...review, status: "APPLIED", appliedAt: now }).where(eq(characterProposals.id, proposalId));
    return { status: "APPLIED" as const, proposalId, appliedRevision: result.revision, slotUpdated: true as const };
  });
}
