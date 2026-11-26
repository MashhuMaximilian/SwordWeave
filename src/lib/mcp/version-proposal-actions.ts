import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characterWorkspaceState } from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import {
  decideVersionProposal, findPendingVersionProposals, getActiveVersionProposalAccount, loadVersionProposal,
  saveVersionProposal, VersionProposalError, versionProposalInstanceId, withVersionProposalCharacterLock,
  type VersionProposalRow, type VersionProposalTarget,
} from "@/lib/character/version-proposals";
import type { McpActor } from "./auth";
import { CharacterProposalUnavailable, issueAuthorizedVersionProposalRef, resolveVersionProposalRef } from "./character-proposals";
import { getMcpConfig } from "./config";
import { characterIdSchema, CharacterContextUnavailable, requireCharacterAccess, type CharacterActor, type ContextConfig } from "./context-shared";
import { digestJson, operationUuid, permitsOperation, versionProposalReceipt } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, OperationUnavailableError, prepareOperation } from "./operations";
import { exactDirectVersionProposalPath, verifyWritableVersionProposalContent, versionProposalTargetFromPath } from "@/lib/character/version-proposal-details";

const prose = z.string().trim().max(1000).refine(value => !value.includes("\0")).optional();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const decision = z.enum(["approve", "reject"]);
const submitFields = z.strictObject({
  characterId: characterIdSchema,
  path: z.array(z.string().min(1).max(200)).length(1),
  proposedVersionId: operationUuid,
  rationale: prose,
});
const decisionFields = z.strictObject({
  characterId: characterIdSchema,
  decision,
  note: prose,
});
export const prepareVersionProposalInput = submitFields.extend({ supersedesOperationId: operationUuid.optional() });
export const prepareVersionProposalDecisionInput = decisionFields.extend({
  proposalRef: z.string().min(1).max(2048),
  supersedesOperationId: operationUuid.optional(),
});
const operationInput = z.strictObject({ operationId: operationUuid });

const submitReview = z.strictObject({ input: submitFields, priorDigest: digest.nullable(), semanticDigest: digest });
const decisionReview = decisionFields.extend({
  proposalId: operationUuid,
  proposalDigest: digest,
  semanticDigest: digest.nullable(),
}).refine(row => (row.decision === "approve") === (row.semanticDigest !== null));

type Submit = z.output<typeof submitFields>;
type Decision = z.output<typeof decision>;
type VersionOperation = "character_version_proposal_submit" | "character_version_proposal_decide";

function proposalFailure(error: unknown): never {
  if (error instanceof VersionProposalError) {
    if (error.status === 409) throw new OperationBlockError("STALE_REVIEW");
    if (error.status === 400) throw new OperationBlockError("VALIDATION_FAILED");
    throw new OperationUnavailableError();
  }
  if (error instanceof CharacterAccessDenied || error instanceof CharacterProposalUnavailable ||
    error instanceof CharacterContextUnavailable) throw new OperationUnavailableError();
  throw error;
}

function requireStage(actor: McpActor, kind: VersionOperation) {
  const config = getMcpConfig();
  if (!config || !permitsOperation(config, actor, kind, "write", "mcp")) throw new OperationUnavailableError();
}

function proposalDigest(row: VersionProposalRow) {
  const { id, characterId, proposerUserId, targetKind, targetId, currentVersionId, proposedVersionId,
    proposedDiff, rationale, status, updatedAt } = row;
  return digestJson([id, characterId, proposerUserId, targetKind, targetId, currentVersionId, proposedVersionId,
    proposedDiff, rationale, status, updatedAt.toISOString()]);
}

async function reviewContent(actor: CharacterActor, characterId: string, target: VersionProposalTarget) {
  const content = await verifyWritableVersionProposalContent(actor.clerkId, { characterId, ...target, instanceId: target.instanceId ?? null, status: "PENDING" });
  if (!content) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
  if (!content.diff.fieldChanges.length) throw new OperationBlockError("VALIDATION_FAILED");
  const [workspace] = await db.select({ revision: characterWorkspaceState.revision }).from(characterWorkspaceState)
    .where(eq(characterWorkspaceState.characterId, characterId)).limit(1);
  const revision = workspace?.revision ?? 0;
  if (revision >= 2_147_483_647) throw new OperationBlockError("VALIDATION_FAILED");
  return { content, revision, semanticDigest: digestJson({ content, target, revision }) };
}

async function prepareSubmitReview(actor: CharacterActor, input: Submit) {
  const { characterId, path, proposedVersionId } = input;
  const { character } = await requireCharacterAccess(actor, characterId, "SUGGESTER");
  const target = await versionProposalTargetFromPath(characterId, path, proposedVersionId);
  if (!target) throw new OperationBlockError("STALE_REVIEW");
  const proof = await reviewContent(actor, characterId, target);
  if (digestJson(path) !== digestJson(proof.content.path)) throw new OperationBlockError("STALE_REVIEW");
  const pending = await findPendingVersionProposals(characterId, actor.clerkId, target.targetKind, target.targetId);
  const [previous] = pending;
  if (pending.length > 1) throw new OperationBlockError("STALE_REVIEW");
  if (previous) {
    const previousPath = await exactDirectVersionProposalPath({
      ...previous, instanceId: versionProposalInstanceId(previous) ?? null,
    }, target.targetId, target.currentVersionId);
    if (!previousPath || digestJson(previousPath) !== digestJson(path) || previous.currentVersionId !== target.currentVersionId) {
      throw new OperationBlockError("STALE_REVIEW");
    }
  }
  return { target, character, proof, pendingId: previous?.id ?? null, priorDigest: previous ? proposalDigest(previous) : null };
}

export async function prepareVersionProposal(actor: McpActor, raw: z.input<typeof prepareVersionProposalInput>) {
  requireStage(actor, "character_version_proposal_submit");
  const { supersedesOperationId, ...input } = prepareVersionProposalInput.parse(raw);
  const { target, character, proof, priorDigest, pendingId } = await withVersionProposalCharacterLock(input.characterId,
    () => prepareSubmitReview(actor, input)).catch(proposalFailure);
  return prepareOperation({ actor, kind: "character_version_proposal_submit", subject: { kind: "character", characterId: input.characterId },
    payload: submitReview.parse({ input, priorDigest, semanticDigest: proof.semanticDigest }),
    summary: { characterName: character.name, slotKind: target.targetKind, path: proof.content.path, baseRevision: proof.revision,
      changes: proof.content.diff.fieldChanges, replacesPendingProposal: pendingId !== null, markdownRationale: input.rationale ?? "" },
    ...(supersedesOperationId ? { supersedesOperationId } : {}) });
}

async function confirmSubmit(actor: CharacterActor, reviewed: z.output<typeof submitReview>) {
  const current = await prepareSubmitReview(actor, reviewed.input);
  if (current.priorDigest !== reviewed.priorDigest || current.proof.semanticDigest !== reviewed.semanticDigest) {
    throw new OperationBlockError("STALE_REVIEW");
  }
  return current;
}

export async function submitVersionProposal(actor: McpActor, raw: z.input<typeof operationInput>) {
  const { operationId } = operationInput.parse(raw);
  return executeApprovedOperation({ actor, operationId, expectedKind: "character_version_proposal_submit", async execute({ payload, subject }) {
    const parsed = submitReview.safeParse(payload);
    if (!parsed.success || subject.characterId !== parsed.data.input.characterId) throw new OperationBlockError("VALIDATION_FAILED");
    const { input } = parsed.data;
    try {
      const reviewed = await confirmSubmit(actor, parsed.data);
      const { proposalId } = await saveVersionProposal({ ...reviewed.target, characterId: input.characterId,
        proposerUserId: actor.clerkId, rationale: input.rationale, expectedPendingId: reviewed.pendingId, companionOrigin: true });
      return { characterId: input.characterId, proposalId, status: "PENDING" };
    } catch (error) { return proposalFailure(error); }
  } });
}

async function reviewDecision(actor: CharacterActor, row: VersionProposalRow, action: Decision) {
  if (action === "reject") return null;
  const author = await getActiveVersionProposalAccount(row.proposerUserId);
  if (!getMcpConfig()?.fixtureUserIds.includes(author.id)) throw new OperationUnavailableError();
  await requireCharacterAccess(author, row.characterId, "SUGGESTER");
  const target: VersionProposalTarget = {
    targetKind: row.targetKind, targetId: row.targetId, currentVersionId: row.currentVersionId,
    proposedVersionId: row.proposedVersionId, instanceId: versionProposalInstanceId(row),
  };
  const proof = await reviewContent(actor, row.characterId, target);
  const authored = author.id === actor.id ? proof : await reviewContent(author, row.characterId, target);
  if (authored.semanticDigest !== proof.semanticDigest) throw new OperationBlockError("STALE_REVIEW");
  return proof;
}

export async function prepareVersionProposalDecision(actor: McpActor, raw: z.input<typeof prepareVersionProposalDecisionInput>, context: ContextConfig) {
  requireStage(actor, "character_version_proposal_decide");
  const { characterId, proposalRef, decision, note, supersedesOperationId } = prepareVersionProposalDecisionInput.parse(raw);
  const proposalId = resolveVersionProposalRef(actor, characterId, proposalRef, context);
  const reviewed = await withVersionProposalCharacterLock(characterId, async () => {
    const { character } = await requireCharacterAccess(actor, characterId, "OWNER");
    const current = await loadVersionProposal(characterId, proposalId);
    const proof = await reviewDecision(actor, current, decision);
    return { characterName: character.name, proposalDigest: proposalDigest(current), proof,
      markdownRationale: proof ? current.rationale?.slice(0, 1000) ?? "" : "" };
  }).catch(proposalFailure);
  return prepareOperation({ actor, kind: "character_version_proposal_decide", subject: { kind: "proposal", characterId, id: proposalId },
    summary: { characterName: reviewed.characterName, decision, markdownRationale: reviewed.markdownRationale, decisionNote: note ?? "",
      ...(reviewed.proof ? { path: reviewed.proof.content.path, baseRevision: reviewed.proof.revision, changes: reviewed.proof.content.diff.fieldChanges } : {}) },
    payload: decisionReview.parse({ characterId, proposalId, decision, note, proposalDigest: reviewed.proposalDigest,
      semanticDigest: reviewed.proof?.semanticDigest ?? null }),
    ...(supersedesOperationId ? { supersedesOperationId } : {}) });
}

async function confirmDecision(actor: CharacterActor, reviewed: z.output<typeof decisionReview>, row?: VersionProposalRow) {
  await requireCharacterAccess(actor, reviewed.characterId, "OWNER");
  const current = row ?? await loadVersionProposal(reviewed.characterId, reviewed.proposalId);
  if (proposalDigest(current) !== reviewed.proposalDigest) throw new OperationBlockError("STALE_REVIEW");
  const proof = await reviewDecision(actor, current, reviewed.decision);
  if ((proof?.semanticDigest ?? null) !== reviewed.semanticDigest) throw new OperationBlockError("STALE_REVIEW");
  return proof;
}

export async function assertVersionProposalReviewCurrent(kind: VersionOperation, payload: unknown, actor: CharacterActor) {
  try {
    if (kind === "character_version_proposal_submit") {
      const reviewed = submitReview.safeParse(payload);
      if (!reviewed.success) throw new OperationUnavailableError();
      await confirmSubmit(actor, reviewed.data);
    } else {
      const reviewed = decisionReview.safeParse(payload);
      if (!reviewed.success) throw new OperationUnavailableError();
      await confirmDecision(actor, reviewed.data);
    }
  } catch (error) { return proposalFailure(error); }
}

export async function reviewVersionProposal(actor: McpActor, raw: z.input<typeof operationInput>) {
  const { operationId } = operationInput.parse(raw);
  let appliedCharacter: string | undefined;
  return executeApprovedOperation({ actor, operationId, expectedKind: "character_version_proposal_decide", async execute({ payload, subject }) {
    const parsed = decisionReview.safeParse(payload);
    if (!parsed.success || subject.characterId !== parsed.data.characterId || subject.id !== parsed.data.proposalId) {
      throw new OperationBlockError("VALIDATION_FAILED");
    }
    const { characterId, proposalId, decision, note } = parsed.data;
    try {
      let expectedRevision: number | undefined;
      const outcome = await decideVersionProposal({ characterId, proposalId, reviewerUserId: actor.clerkId, note,
        action: decision === "approve" ? "APPROVE" : "REJECT",
        async assertReviewedProposal(row) {
          const proof = await confirmDecision(actor, parsed.data, row);
          if (proof) expectedRevision = proof.revision + 1;
        } });
      if (outcome.status === "APPLIED") {
        if (outcome.appliedRevision !== expectedRevision) throw new OperationBlockError("STALE_REVIEW");
        appliedCharacter = characterId;
      }
      return { characterId, proposalId, status: outcome.status, decision,
        ...(outcome.status === "APPLIED" ? { appliedRevision: outcome.appliedRevision } : {}) };
    } catch (error) { return proposalFailure(error); }
  }, afterCommit() { if (appliedCharacter) bustResolverCache(appliedCharacter); } });
}

export async function projectVersionProposalReceipt(actor: CharacterActor, raw: unknown, config: ContextConfig) {
  const result = versionProposalReceipt.safeParse(raw);
  if (!result.success) throw new OperationUnavailableError();
  const { characterId, proposalId, status, decision, appliedRevision } = result.data;
  try {
    const { proposalRef, currentStatus } = await issueAuthorizedVersionProposalRef(actor, characterId, proposalId, config);
    return { characterId, proposalRef, subtype: "version" as const, status,
      ...(currentStatus !== status ? { currentStatus } : {}), ...(decision ? { decision } : {}),
      ...(appliedRevision !== undefined ? { appliedRevision } : {}) };
  } catch (error) { return proposalFailure(error); }
}
