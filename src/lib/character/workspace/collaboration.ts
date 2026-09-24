import { workspaceBuildFingerprint } from "./drafts";
import { readWorkspace } from "./read";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { characters, characterWorkspaceCommands, characterWorkspaceState, users } from "@/db/schema";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";
import type { CharacterDraftProposal, CharacterRevisionReview, CharacterCollaborationState } from "./collaboration-types";
import { validateProposalOperations } from "./collaboration-types";
import type { DraftOperation } from "./draft-types";

export class CollaborationError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const kind = "character-draft-proposal";
async function revisionFor(characterId: string) {
  const [row] = await db.select().from(characterWorkspaceState).where(eq(characterWorkspaceState.characterId, characterId));
  return row?.revision ?? 0;
}
async function lockCharacter(characterId: string) {
  await db.select({ id: characters.id }).from(characters).where(eq(characters.id, characterId)).for("update");
}
async function writeRecord(characterId: string, id: string, recordKind: string, result: object) {
  await db.insert(characterWorkspaceCommands).values({ characterId, commandId: id, kind: recordKind, requestHash: createHash("sha256").update(JSON.stringify(result)).digest("hex"), result: result as Record<string, unknown> }).onConflictDoUpdate({ target: [characterWorkspaceCommands.characterId, characterWorkspaceCommands.commandId], set: { result: result as Record<string, unknown>, updatedAt: new Date() } });
}
export async function readCollaboration(characterId: string, actorId: string): Promise<CharacterCollaborationState> {
  const access = await resolveCharacterAccess(actorId, characterId);
  const rows = await db.select().from(characterWorkspaceCommands).where(and(eq(characterWorkspaceCommands.characterId, characterId), inArray(characterWorkspaceCommands.kind, [kind, "character-revision-review"])));
  const proposals = rows.filter(row => row.kind === kind).map(row => row.result as unknown as CharacterDraftProposal).filter(proposal => access.permission === "OWNER" || proposal.authorId === actorId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const reviews = rows.filter(row => row.kind === "character-revision-review").map(row => row.result as unknown as CharacterRevisionReview);
  const ids = [...new Set([...proposals.map(p => p.authorId), ...reviews.map(r => r.reviewerId)])];
  const people = ids.length ? await db.select({ id: users.clerkUserId, name: users.displayName, username: users.username }).from(users).where(inArray(users.clerkUserId, ids)) : [];
  const names = new Map(people.map(person => [person.id, person.name || person.username || "Collaborator"]));
  const [character] = await db.select().from(characters).where(eq(characters.id,characterId));
  const graph = await readWorkspace(characterId);
  const currentHash = character ? workspaceBuildFingerprint(graph,character) : "";
  return { revision: await revisionFor(characterId), proposals: proposals.map(proposal => ({ ...proposal, authorName: names.get(proposal.authorId) ?? "Collaborator" })), reviews: reviews.map(review => ({ ...review, reviewerName: names.get(review.reviewerId) ?? "Collaborator", changedSinceReview: review.revision !== graph.revision || review.buildHash !== currentHash })) };
}
export async function submitCharacterProposal(characterId: string, actorId: string, input: { baseRevision: number; operations: DraftOperation[]; expectedBaseHash?: string; rationale?: string; requestId?: string }) {
  await resolveCharacterAccess(actorId, characterId, { require: "SUGGESTER" });
  if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0 || !validateProposalOperations(input.operations)) throw new CollaborationError("A proposal needs a valid base revision and between 1 and 100 draft changes.");
  if (JSON.stringify(input.operations).length > 2_000_000) throw new CollaborationError("This proposal is too large.");
  return withDatabaseTransaction(async () => {
    await lockCharacter(characterId);
    await resolveCharacterAccess(actorId, characterId, { require: "SUGGESTER" });
    const id = input.requestId ? `proposal:${actorId}:${input.requestId.slice(0,100)}` : `proposal:${randomUUID()}`;
    const [existing] = await db.select().from(characterWorkspaceCommands).where(and(eq(characterWorkspaceCommands.characterId, characterId), eq(characterWorkspaceCommands.commandId, id)));
    if (existing) {
      const previous = existing.result as unknown as CharacterDraftProposal;
      if (previous.authorId !== actorId || JSON.stringify(previous.operations) !== JSON.stringify(input.operations) || previous.baseRevision !== input.baseRevision) throw new CollaborationError("This submission ID was already used for different changes.", 409);
      return previous;
    }
    if (await revisionFor(characterId) !== input.baseRevision) throw new CollaborationError("The character changed. Refresh the draft and review it before proposing changes.", 409);
    const [character] = await db.select().from(characters).where(eq(characters.id, characterId));
    const baseHash = workspaceBuildFingerprint(await readWorkspace(characterId), character!);
    if (input.expectedBaseHash && input.expectedBaseHash !== baseHash) throw new CollaborationError("The build changed after preview. Refresh your draft before submitting.",409);
    const proposal: CharacterDraftProposal = { id, baseHash, authorId: actorId, baseRevision: input.baseRevision, operations: input.operations, rationale: input.rationale?.trim().slice(0,2000) ?? "", status: "pending", createdAt: new Date().toISOString() };
    await writeRecord(characterId, id, kind, proposal);
    return proposal;
  });
}

export async function markCharacterReviewed(characterId: string, actorId: string, revision: number, note: string) {
  return withDatabaseTransaction(async () => {
    await lockCharacter(characterId);
    await resolveCharacterAccess(actorId, characterId, { require: "SUGGESTER" });
    if (revision !== await revisionFor(characterId)) throw new CollaborationError("The character changed while you were reviewing it. Review the current build first.", 409);
    const [character] = await db.select().from(characters).where(eq(characters.id,characterId));
    const buildHash = workspaceBuildFingerprint(await readWorkspace(characterId),character!);
    const review: CharacterRevisionReview = { buildHash, reviewerId: actorId, revision, note: note.trim().slice(0,2000), reviewedAt: new Date().toISOString() };
    await writeRecord(characterId, `review:${actorId}`, "character-revision-review", review);
    return review;
  });
}

/** The caller supplies the canonical draft executor; it joins this transaction, so the proposal receipt and every operation commit or roll back together. */
export async function decideCharacterProposal(characterId: string, actorId: string, proposalId: string, action: "approve" | "reject" | "withdraw", note: string, execute: (baseRevision: number, operations: DraftOperation[], authorId: string) => Promise<{ revision: number }>) {
  return withDatabaseTransaction(async () => {
    await lockCharacter(characterId);
    const access = await resolveCharacterAccess(actorId, characterId);
    const [row] = await db.select().from(characterWorkspaceCommands).where(and(eq(characterWorkspaceCommands.characterId, characterId), eq(characterWorkspaceCommands.commandId, proposalId), eq(characterWorkspaceCommands.kind, kind)));
    if (!row) throw new CollaborationError("Proposal not found.",404);
    const proposal = row.result as unknown as CharacterDraftProposal;
    if (action === "withdraw" ? proposal.authorId !== actorId : access.permission !== "OWNER") throw new CollaborationError("Only the owner can approve or reject; only the author can withdraw.",403);
    if (proposal.status !== "pending") {
      if ((action === "approve" && proposal.status === "applied") || (action === "reject" && proposal.status === "rejected") || (action === "withdraw" && proposal.status === "withdrawn")) return proposal;
      throw new CollaborationError(`This proposal is already ${proposal.status}.`,409);
    }
    if (action === "approve") {
      await resolveCharacterAccess(proposal.authorId, characterId, { require: "SUGGESTER" });
      if (proposal.baseRevision !== await revisionFor(characterId)) throw new CollaborationError("This proposal is based on an older build. Nothing was applied; ask the author to refresh and resubmit it.",409);
      const [character] = await db.select().from(characters).where(eq(characters.id, characterId));
      if (proposal.baseHash !== workspaceBuildFingerprint(await readWorkspace(characterId), character!)) throw new CollaborationError("A referenced rule or character foundation changed. Review and resubmit this proposal before applying it.", 409);
      const result = await execute(proposal.baseRevision, proposal.operations, proposal.authorId);
      proposal.appliedRevision = result.revision;
    }
    proposal.status = action === "approve" ? "applied" : action === "reject" ? "rejected" : "withdrawn";
    proposal.reviewerId = actorId;
    proposal.reviewerNote = note.trim().slice(0,2000);
    proposal.reviewedAt = new Date().toISOString();
    await writeRecord(characterId, proposalId, kind, proposal);
    return proposal;
  });
}
