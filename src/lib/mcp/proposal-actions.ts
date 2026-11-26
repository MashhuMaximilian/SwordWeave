import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characters, characterWorkspaceCommands, users } from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { CollaborationError, decideCharacterProposal, submitCharacterProposal as submitNativeProposal } from "@/lib/character/workspace/collaboration";
import { WorkspaceConflict } from "@/lib/character/workspace/commands";
import { characterDraftSchema, executeDraftOperations, rollbackWorkspacePreview } from "@/lib/character/workspace/drafts";
import type { DraftOperation, WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";
import { recordCharacterForkGrants } from "@/lib/character/workspace/fork-grants";
import { splitProgressionSpend } from "@/lib/engine/bu-balance";
import { validateAttributes } from "@/lib/engine/practices";
import { withPublishingTransaction } from "@/lib/publishing/save-transaction";
import type { McpActor } from "./auth";
import { CharacterEditUnavailable, checkedSlotResult, deriveSlotEdit, type SlotEdit } from "./character-edit-slots";
import { previewWorkspaceSuggestion, workspaceEditChange, verifyWorkspaceSuggestion, verifyWorkspaceSuggestionBase } from "./character-edits";
import { CharacterProposalUnavailable, issueAuthorizedWorkspaceProposalRef, resolveWorkspaceProposalRef } from "./character-proposals";
import { getMcpConfig } from "./config";
import { pinnedRef } from "./draft";
import { characterIdSchema, CharacterContextUnavailable, characterSheetUrl, ownsCharacter, requireCharacterAccess, type CharacterActor, type ContextConfig } from "./context-shared";
import { digestJson, isStagingOperationActor, operationUuid, workspaceProposalReceipt } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, OperationUnavailableError, prepareOperation } from "./operations";

const editFields = z.strictObject({
  characterId: characterIdSchema, expectedRevision: z.number().int().min(0).max(2_147_483_635),
  intent: z.literal("propose"), changes: z.array(workspaceEditChange).min(1).max(12),
});
const shortMarkdown = z.string().trim().max(2_000).refine(value => !value.includes("\0")).optional();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const nativeId = z.string().min(10).max(240).startsWith("proposal:");
const decision = z.enum(["approve", "reject", "withdraw"]);
const proposalStatus = z.enum(["pending", "applied", "rejected", "withdrawn"]);
const submitFields = editFields.extend({ rationale: shortMarkdown });
const foundationKeys = ["name", "attrPhysical", "attrMental", "attrMagical", "attrProficient", "size"] as const;
const backstoryKeys = new Set(["description", "personality", "origin", "motivation", "ties", "flaw"]);
const draftFields = characterDraftSchema.pick({ name: true, attrPhysical: true, attrMental: true, attrMagical: true,
  attrProficient: true, size: true, backstory: true });
const foundationStep = z.strictObject({ id: operationUuid, type: z.literal("character"), payload: draftFields,
  label: z.string().max(200).optional(), groupId: z.string().max(160).optional() })
  .transform(step => {
    const payload: Extract<DraftOperation, { type: "character" }>["payload"] = {};
    for (const [key, value] of Object.entries(step.payload)) if (value !== undefined) Object.assign(payload, { [key]: value });
    return { id: step.id, type: step.type, payload,
      ...(step.label !== undefined ? { label: step.label } : {}), ...(step.groupId !== undefined ? { groupId: step.groupId } : {}) };
  });
const attachStep = z.strictObject({ id: operationUuid, type: z.literal("create"), payload: z.strictObject({
  kind: z.enum(["primitive", "capability", "effect", "item", "heritage"]), category: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]),
  existingId: z.string().min(1).max(36), expectedVersionId: operationUuid, mirrored: z.boolean(), draft: z.strictObject({}),
}) });
const edgeId = z.string().min(1).max(200);
const commandTarget = z.string().min(1).max(100);
const commandFields = { target: commandTarget, path: z.tuple([edgeId]), expectedHash: z.string().nullable() };
const exactSlotCommand = z.strictObject({ id: operationUuid, type: z.literal("command"), payload: z.union([
  z.strictObject({ ...commandFields, operation: z.enum(["detach", "mirror-instance"]) }),
  z.strictObject({ ...commandFields, operation: z.enum(["remove-reference", "mirror-reference"]), edgeId }),
  z.strictObject({ ...commandFields, operation: z.literal("move-reference"), edgeId,
    destination: commandTarget, destinationPath: z.tuple([edgeId]), destinationHash: z.string().nullable() }),
]) });
const draftSteps = z.array(z.union([foundationStep, attachStep, exactSlotCommand]))
  .min(1).max(12).refine(steps => new Set(steps.map(step => step.id)).size === steps.length);
const workspaceKind = "character-draft-proposal";
const coreProposal = z.object({ id: nativeId, authorId: z.string().min(1).max(220), baseRevision: z.number().int().nonnegative(),
  baseHash: digest, status: proposalStatus, rationale: z.string().max(2_000), operations: z.unknown() });

export const previewCharacterProposalInput = editFields;
export const prepareCharacterProposalInput = submitFields.extend({ supersedesOperationId: operationUuid.optional() });
export const submitCharacterProposalInput = z.strictObject({ operationId: operationUuid });
export const prepareProposalDecisionInput = z.strictObject({ characterId: characterIdSchema, proposalRef: z.string().min(1).max(2_048),
  decision, note: shortMarkdown, supersedesOperationId: operationUuid.optional() });
export const reviewCharacterProposalInput = submitCharacterProposalInput;

const submitReview = z.strictObject({ input: submitFields, baseFingerprint: digest, operations: draftSteps });
const decisionReview = z.strictObject({ characterId: characterIdSchema, decision, proposalId: nativeId,
  proposalDigest: digest, note: z.string().max(2_000), semanticDigest: digest.nullable() })
  .refine(value => (value.decision === "approve") === (value.semanticDigest !== null));

type Decision = z.output<typeof decision>;
type NativeProposal = z.output<typeof coreProposal>;
type FoundationSteps = z.output<typeof foundationStep>[];
type Foundation = typeof characters.$inferSelect;
type Difference = { field: string; before: string | number | null; after: string | number | null };

export function workspaceProposalSubjectId(characterId: string, proposalId: string) {
  const value = digestJson(["swordweave-workspace-proposal", characterId, proposalId]);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function draftInput(input: z.output<typeof previewCharacterProposalInput>) {
  const { characterId, expectedRevision, changes } = input;
  return { characterId, expectedRevision, changes, intent: "apply" as const };
}

function proposalFailure(error: unknown): never {
  if (error instanceof WorkspaceConflict || (error instanceof CollaborationError && error.status === 409)) throw new OperationBlockError("STALE_REVIEW");
  if (error instanceof CharacterEditUnavailable) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
  if (error instanceof CharacterContextUnavailable || error instanceof CharacterProposalUnavailable || error instanceof CharacterAccessDenied ||
      (error instanceof CollaborationError && (error.status === 403 || error.status === 404))) throw new OperationUnavailableError();
  throw error;
}

export async function previewCharacterProposal(actor: CharacterActor, raw: z.input<typeof previewCharacterProposalInput>, config: ContextConfig) {
  const input = previewCharacterProposalInput.parse(raw);
  const sheetUrl = characterSheetUrl(config.resource, input.characterId);
  try {
    const { summary } = await previewWorkspaceSuggestion(actor, draftInput(input));
    return { ...summary, sheetUrl };
  } catch (error) {
    if (!(error instanceof WorkspaceConflict) && !(error instanceof CharacterEditUnavailable)) throw error;
    return { characterId: input.characterId, revision: input.expectedRevision, changes: [], budgetDelta: null,
      blockers: [error.message], tableQuestions: [], sheetUrl };
  }
}

export async function prepareCharacterProposal(actor: McpActor, raw: z.input<typeof prepareCharacterProposalInput>) {
  const { supersedesOperationId, ...input } = prepareCharacterProposalInput.parse(raw);
  const reviewed = await previewWorkspaceSuggestion(actor, draftInput(input)).catch(proposalFailure);
  if (reviewed.summary.blockers.length) throw new OperationBlockError("VALIDATION_FAILED");
  const payload = submitReview.parse({ input, baseFingerprint: reviewed.baseFingerprint, operations: reviewed.operations });
  return prepareOperation({ actor, kind: "character_proposal_submit", subject: { kind: "character", characterId: input.characterId },
    payload, summary: { ...reviewed.summary, markdownRationale: input.rationale ?? "" },
    ...(supersedesOperationId ? { supersedesOperationId } : {}) });
}

async function verifySubmit(actor: CharacterActor, payload: z.output<typeof submitReview>) {
  const current = await verifyWorkspaceSuggestion(actor, draftInput(payload.input));
  const editedValues = (steps: { type: string; payload?: unknown }[]) => steps.map(step => [step.type, step.payload]);
  if (current.baseFingerprint !== payload.baseFingerprint ||
      digestJson(editedValues(current.operations)) !== digestJson(editedValues(payload.operations))) throw new OperationBlockError("STALE_REVIEW");
}

export async function submitCharacterProposal(actor: McpActor, raw: z.input<typeof submitCharacterProposalInput>) {
  const { operationId } = submitCharacterProposalInput.parse(raw);
  return executeApprovedOperation({ actor, operationId, expectedKind: "character_proposal_submit", async execute({ payload, subject }) {
    const review = submitReview.safeParse(payload);
    if (!review.success || review.data.input.characterId !== subject.characterId) throw new OperationBlockError("VALIDATION_FAILED");
    const { input, operations, baseFingerprint } = review.data;
    try {
      await verifySubmit(actor, review.data);
      const hasNestedEdit = operations.some(step => step.type === "command" && "edgeId" in step.payload);
      const proposal = await submitNativeProposal(input.characterId, actor.clerkId, { baseRevision: input.expectedRevision,
        operations, expectedBaseHash: baseFingerprint, rationale: input.rationale ?? "", requestId: operationId,
        ...(hasNestedEdit ? { reviewChannel: "companion" } : {}) });
      if (proposal.status !== "pending") throw new OperationBlockError("STALE_REVIEW");
      return { characterId: input.characterId, proposalId: proposal.id, status: proposal.status };
    } catch (error) { return proposalFailure(error); }
  } });
}

async function loadPending(actor: CharacterActor, characterId: string, proposalId: string, action: Decision | "read") {
  const { character, permission } = await requireCharacterAccess(actor, characterId,
    action === "read" ? "VIEWER" : action === "withdraw" ? "SUGGESTER" : "OWNER");
  const [row] = await db.select({ result: characterWorkspaceCommands.result }).from(characterWorkspaceCommands)
    .where(and(eq(characterWorkspaceCommands.characterId, characterId), eq(characterWorkspaceCommands.commandId, proposalId),
      eq(characterWorkspaceCommands.kind, workspaceKind))).limit(1);
  const proposal = coreProposal.safeParse(row?.result);
  const authorOnly = action === "withdraw" || (action === "read" && permission !== "OWNER");
  if (!proposal.success || proposal.data.id !== proposalId || (authorOnly && proposal.data.authorId !== actor.clerkId)) {
    throw new OperationUnavailableError();
  }
  if (proposal.data.status !== "pending") throw new OperationBlockError("STALE_REVIEW");
  return { proposal: proposal.data, character, proposalDigest: digestJson(row!.result) };
}

function foundationDifferences(character: Foundation, steps: FoundationSteps) {
  let current = character;
  return steps.map(step => {
    const fields: Difference[] = [];
    for (const field of foundationKeys) {
      const value = step.payload[field];
      if (value !== undefined && value !== current[field]) fields.push({ field, before: current[field], after: value });
    }
    const nextBackstory = step.payload.backstory;
    if (nextBackstory) {
      const previous = z.record(z.string(), z.string()).safeParse(current.backstory);
      if (!previous.success) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
      for (const key of new Set([...Object.keys(previous.data), ...Object.keys(nextBackstory)])) {
        const before = Object.hasOwn(previous.data, key) ? previous.data[key] ?? null : null;
        const after = Object.hasOwn(nextBackstory, key) ? nextBackstory[key] ?? null : null;
        if (before === after) continue;
        if (after === null || !backstoryKeys.has(key) || after.length > 4_000 || after.includes("\0")) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
        fields.push({ field: `backstory.${key}`, before, after });
      }
    }
    current = { ...current, ...step.payload };
    if (!fields.length || !validateAttributes({ physical: current.attrPhysical, mental: current.attrMental, magical: current.attrMagical }).valid) {
      throw new OperationBlockError("VALIDATION_FAILED");
    }
    return { kind: "set_foundation" as const, fields };
  });
}

async function approvalBase(actor: CharacterActor, characterId: string, proposal: NativeProposal) {
  const steps = draftSteps.safeParse(proposal.operations);
  if (!steps.success) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
  if (proposal.baseRevision + steps.data.length > 2_147_483_647) throw new OperationBlockError("VALIDATION_FAILED");
  const [account] = await db.select({ id: users.id, clerkId: users.clerkUserId }).from(users)
    .where(and(eq(users.clerkUserId, proposal.authorId), eq(users.isAnonymized, false), isNull(users.deletedAt))).for("share");
  if (!account?.clerkId || !getMcpConfig()?.fixtureUserIds.includes(account.id)) throw new OperationUnavailableError();
  const author = { id: account.id, clerkId: account.clerkId };
  const base = await verifyWorkspaceSuggestionBase(author, characterId, proposal.baseRevision);
  if (base.baseFingerprint !== proposal.baseHash) throw new OperationBlockError("STALE_REVIEW");
  if (author.id !== actor.id) {
    const ownerBase = await verifyWorkspaceSuggestionBase(actor, characterId, proposal.baseRevision);
    if (ownerBase.baseFingerprint !== base.baseFingerprint) throw new OperationBlockError("STALE_REVIEW");
  }
  const foundation = foundationDifferences(base.character, steps.data.filter(step => step.type === "character"));
  const changes: (typeof foundation[number] | SlotEdit["review"])[] = [];
  const slotEdits: SlotEdit[] = [];
  const touched = new Set<string>();
  for (const step of steps.data) {
    if (step.type === "character") {
      changes.push(foundation.shift()!);
      continue;
    }
    let change: Parameters<typeof deriveSlotEdit>[2];
    if (step.type === "create") {
      const { kind, existingId, expectedVersionId, category, mirrored } = step.payload;
      const ref = pinnedRef.safeParse({ kind, id: existingId, versionId: expectedVersionId });
      if (!ref.success) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
      change = { kind: "attach_library_piece", ref: ref.data, channel: category, isMirrored: mirrored };
    } else {
      const { operation, path } = step.payload;
      const edge = base.graph.edges.find(candidate => candidate.parent === null && candidate.id === path[0]);
      if (!edge) throw new OperationBlockError("STALE_REVIEW");
      if ("edgeId" in step.payload) {
        const { edgeId: memberId } = step.payload;
        const member = base.graph.edges.find(candidate => candidate.parent === edge.child && candidate.id === memberId);
        if (!member) throw new OperationBlockError("STALE_REVIEW");
        const memberPath = [...path, member.id];
        if (step.payload.operation === "move-reference") {
          change = { kind: "move_reference", path: memberPath, destinationPath: step.payload.destinationPath };
        } else {
          change = operation === "remove-reference" ? { kind: "remove_reference", path: memberPath }
            : { kind: "mirror_primitive", path: memberPath, isMirrored: !member.isMirrored };
        }
      } else {
        change = operation === "detach" ? { kind: "remove_reference", path }
          : { kind: "mirror_primitive", path, isMirrored: !edge.isMirrored };
      }
    }
    const slot = await deriveSlotEdit(author, base.graph, change, author.id === actor.id ? undefined : actor.clerkId);
    if (!slot || slot.operation.type !== step.type || !("payload" in slot.operation) ||
      digestJson(slot.operation.payload) !== digestJson(step.payload)) throw new OperationBlockError("STALE_REVIEW");
    const occurrences = [slot.replacedEdgeId ?? slot.child, ...slot.containers?.map(container => container.rootId) ?? []];
    if (occurrences.some(occurrence => touched.has(occurrence))) throw new OperationBlockError("VALIDATION_FAILED");
    for (const occurrence of occurrences) touched.add(occurrence);
    changes.push(slot.review);
    slotEdits.push({ ...slot, operation: { ...slot.operation, id: step.id } });
  }
  return { author, base: { ...base, verifiedAuthorId: author.clerkId }, steps: steps.data, changes, slotEdits };
}

function appliedSummary(plan: Awaited<ReturnType<typeof approvalBase>>, draft: WorkspaceDraftPreview) {
  if (!draft.beforeSnapshot || !draft.afterSnapshot || draft.sheet.volatility.exceeded) throw new OperationBlockError("VALIDATION_FAILED");
  const expected = Object.assign({}, ...plan.steps.flatMap(step => step.type === "character" ? [step.payload] : [])) as Record<string, unknown>;
  const actual = draft.afterSnapshot.foundation;
  if (Object.entries(expected).some(([field, value]) => !Object.hasOwn(actual, field) || digestJson(value) !== digestJson(actual[field]))) {
    throw new OperationBlockError("STALE_REVIEW");
  }
  const before = draft.beforeSheet.buBalance;
  const after = draft.sheet.buBalance;
  const beforeSpending = splitProgressionSpend(before.progressionSpent, before.progressionPool, draft.beforeSheet.volatility.rating);
  const afterSpending = splitProgressionSpend(after.progressionSpent, after.progressionPool, draft.sheet.volatility.rating);
  const summary = { changes: plan.changes, resultRevision: draft.revision, warnings: draft.warnings ?? [],
    budgetDelta: { before: beforeSpending.remaining, after: afterSpending.remaining },
    ...(beforeSpending.debtUsed !== afterSpending.debtUsed ? { debtUsedDelta: { before: beforeSpending.debtUsed, after: afterSpending.debtUsed } } : {}),
    ...(before.itemBuSpent !== after.itemBuSpent ? { itemBuDelta: { before: before.itemBuSpent, after: after.itemBuSpent } } : {}) };
  const slots = plan.slotEdits.length
    ? checkedSlotResult(draft.beforeSnapshot.graph, draft.afterSnapshot.graph, plan.slotEdits, draft.results, plan.author) : null;
  return { summary, forkGrants: slots?.forkGrants ?? [],
    semanticDigest: digestJson(slots ? { summary, slots: slots.slotDigest } : summary) };
}

/** Execute only the recognized pending operations in a rollback transaction.
 * Both the actual owner and the active proposal author must still see the sources. */
export async function previewStoredWorkspaceProposal(actor: CharacterActor, characterId: string, proposalId: string) {
  const config = getMcpConfig();
  if (!config || !isStagingOperationActor(config, { ...actor, scopes: [] })) return { diffState: "unavailable" as const };
  try {
    return await rollbackWorkspacePreview(async () => {
      await requireCharacterAccess(actor, characterId);
      await db.select({ id: characters.id }).from(characters).where(eq(characters.id, characterId)).for("update");
      return withPublishingTransaction(async () => {
        const { character, proposal } = await loadPending(actor, characterId, proposalId, "read");
        let owner = actor;
        if (!ownsCharacter(actor, character.userId)) {
          const ownerId = character.userId;
          if (!ownerId) throw new OperationUnavailableError();
          const accounts = await db.select({ id: users.id, clerkId: users.clerkUserId }).from(users).where(and(
            or(eq(users.clerkUserId, ownerId), eq(sql`${users.id}::text`, ownerId)),
            eq(users.isAnonymized, false), isNull(users.deletedAt),
          )).limit(2);
          const account = accounts.length === 1 ? accounts[0] : undefined;
          if (!account?.clerkId) throw new OperationUnavailableError();
          owner = { id: account.id, clerkId: account.clerkId };
          await requireCharacterAccess(owner, characterId, "OWNER");
        }
        const plan = await approvalBase(owner, characterId, proposal);
        const preview = await executeDraftOperations(characterId, plan.author.clerkId, proposal.baseRevision, plan.steps, true, plan.base);
        return { diffState: "available" as const, diff: appliedSummary(plan, preview).summary };
      });
    });
  } catch (error) {
    if (error instanceof WorkspaceConflict || (error instanceof OperationBlockError && error.code === "STALE_REVIEW")) {
      return { diffState: "stale" as const };
    }
    return { diffState: "unavailable" as const };
  }
}

export async function prepareProposalDecision(actor: McpActor, raw: z.input<typeof prepareProposalDecisionInput>, config: ContextConfig) {
  const { characterId, proposalRef, decision, note, supersedesOperationId } = prepareProposalDecisionInput.parse(raw);
  const proposalId = resolveWorkspaceProposalRef(actor, characterId, proposalRef, config);
  const reviewed = await rollbackWorkspacePreview(async () => {
    await requireCharacterAccess(actor, characterId, decision === "withdraw" ? "SUGGESTER" : "OWNER");
    await db.select({ id: characters.id }).from(characters).where(eq(characters.id, characterId)).for("update");
    return withPublishingTransaction(async () => {
      const { character, proposal, proposalDigest } = await loadPending(actor, characterId, proposalId, decision);
      let result = null;
      if (decision === "approve") {
        const plan = await approvalBase(actor, characterId, proposal);
        const preview = await executeDraftOperations(characterId, plan.author.clerkId, proposal.baseRevision, plan.steps, true, plan.base);
        result = appliedSummary(plan, preview);
      }
      return { proposalDigest, semanticDigest: result?.semanticDigest ?? null,
        summary: { decision, characterId, characterName: character.name, baseRevision: proposal.baseRevision,
          markdownRationale: proposal.rationale, decisionNote: note ?? "", ...result?.summary } };
    });
  }).catch(proposalFailure);
  return prepareOperation({ actor, kind: "character_proposal_decide", subject: { kind: "proposal", characterId,
    id: workspaceProposalSubjectId(characterId, proposalId) }, summary: reviewed.summary,
    payload: decisionReview.parse({ characterId, decision, proposalId, note: note ?? "",
      proposalDigest: reviewed.proposalDigest, semanticDigest: reviewed.semanticDigest }),
    ...(supersedesOperationId ? { supersedesOperationId } : {}) });
}

export async function assertWorkspaceProposalReviewCurrent(kind: "character_proposal_submit" | "character_proposal_decide", payload: unknown, actor: CharacterActor) {
  try {
    if (kind === "character_proposal_submit") {
      const review = submitReview.safeParse(payload);
      if (!review.success) throw new OperationUnavailableError();
      await verifySubmit(actor, review.data);
      return;
    }
    const review = decisionReview.safeParse(payload);
    if (!review.success) throw new OperationUnavailableError();
    const { characterId, proposalId, decision, proposalDigest } = review.data;
    const current = await loadPending(actor, characterId, proposalId, decision);
    if (current.proposalDigest !== proposalDigest) throw new OperationBlockError("STALE_REVIEW");
    if (decision === "approve") await approvalBase(actor, characterId, current.proposal);
  } catch (error) { return proposalFailure(error); }
}

export async function reviewCharacterProposal(actor: McpActor, raw: z.input<typeof reviewCharacterProposalInput>) {
  const { operationId } = reviewCharacterProposalInput.parse(raw);
  let appliedCharacter: string | undefined;
  return executeApprovedOperation({ actor, operationId, expectedKind: "character_proposal_decide", async execute({ payload, subject }) {
    const reviewed = decisionReview.safeParse(payload);
    if (!reviewed.success) throw new OperationBlockError("VALIDATION_FAILED");
    const { characterId, proposalId, proposalDigest, decision, note, semanticDigest } = reviewed.data;
    if (subject.characterId !== characterId || subject.id !== workspaceProposalSubjectId(characterId, proposalId)) throw new OperationBlockError("VALIDATION_FAILED");
    try {
      const current = await loadPending(actor, characterId, proposalId, decision);
      if (current.proposalDigest !== proposalDigest) throw new OperationBlockError("STALE_REVIEW");
      const plan = decision === "approve" ? await approvalBase(actor, characterId, current.proposal) : null;
      const proposal = await decideCharacterProposal(characterId, actor.clerkId, proposalId, decision, note, async (revision, operations, authorId) => {
        if (!plan || authorId !== plan.author.clerkId || revision !== current.proposal.baseRevision || digestJson(operations) !== digestJson(plan.steps)) {
          throw new OperationBlockError("STALE_REVIEW");
        }
        const result = await executeDraftOperations(characterId, authorId, revision, plan.steps, false, plan.base);
        const applied = appliedSummary(plan, result);
        if (applied.semanticDigest !== semanticDigest) throw new OperationBlockError("STALE_REVIEW");
        await recordCharacterForkGrants(characterId, applied.forkGrants);
        appliedCharacter = characterId;
        return { revision: result.revision };
      }, "companion");
      return { characterId, proposalId: proposal.id, status: proposal.status, decision,
        ...(proposal.appliedRevision !== undefined ? { appliedRevision: proposal.appliedRevision } : {}) };
    } catch (error) { return proposalFailure(error); }
  }, afterCommit() { if (appliedCharacter) bustResolverCache(appliedCharacter); } });
}

export async function projectWorkspaceProposalReceipt(actor: CharacterActor, raw: unknown, config: ContextConfig) {
  const result = workspaceProposalReceipt.safeParse(raw);
  if (!result.success) throw new OperationUnavailableError();
  const { characterId, proposalId, status, decision, appliedRevision } = result.data;
  try {
    const { proposalRef, currentStatus } = await issueAuthorizedWorkspaceProposalRef(actor, characterId, proposalId, config);
    return { characterId, proposalRef, status, ...(currentStatus !== status ? { currentStatus } : {}),
      ...(decision ? { decision } : {}), ...(appliedRevision !== undefined ? { appliedRevision } : {}) };
  } catch (error) { return proposalFailure(error); }
}
