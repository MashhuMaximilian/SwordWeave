import type { WorkspaceGraph } from "@/lib/character/workspace/model";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { characters, characterWorkspaceCommands } from "@/db/schema";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";
import { CollaborationError, readCollaboration, submitCharacterProposal, decideCharacterProposal, markCharacterReviewed } from "@/lib/character/workspace/collaboration";
import { executeDraftOperations, getWorkspaceDraft, previewWorkspaceDraft, workspaceBuildFingerprint } from "@/lib/character/workspace/drafts";
import { readWorkspace } from "@/lib/character/workspace/read";
import type { WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";
import type { CharacterDraftProposal } from "@/lib/character/workspace/collaboration-types";

function failure(error: unknown) {
  if (error instanceof CollaborationError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the proposal fields and try again." }, { status: 400 });
  if (error instanceof Error && error.name === "CharacterAccessDenied") return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof Error && error.constructor.name === "WorkspaceConflict") return NextResponse.json({ error: error.message }, { status: 409 });
  console.error("Character collaboration", error);
  return NextResponse.json({ error: "Could not complete this request. Your draft is retained." }, { status: 500 });
}
export async function GET(_request: Request, { params }: {params: Promise<{id: string}>}) {
  try { const {userId} = await auth.protect(); const {id} = await params; return NextResponse.json(await readCollaboration(id, userId)); }
  catch(error) { return failure(error); }
}
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit"), draftId: z.string().uuid(), version: z.number().int().positive(), rationale: z.string().max(2000).default(""), requestId: z.string().uuid() }),
  z.object({ action: z.enum(["approve", "reject", "withdraw", "preview"]), proposalId: z.string().min(1).max(300), note: z.string().max(2000).default("") }),
  z.object({ action: z.literal("reviewed"), revision: z.number().int().nonnegative(), note: z.string().max(2000).default("") }),
]);
class PreviewRollback extends Error { constructor(readonly preview: WorkspaceDraftPreview & {beforeGraph: WorkspaceGraph}) { super("Proposal preview rollback"); } }
export async function POST(request: Request, { params }: {params: Promise<{id: string}>}) {
  try {
    const {userId} = await auth.protect(); const {id} = await params;
    const body = requestSchema.parse(await request.json());
    if (body.action === "submit") {
      const draft = await getWorkspaceDraft(id, userId);
      if (!draft || draft.id !== body.draftId || draft.version !== body.version) throw new CollaborationError("Save and review your current draft before submitting.",409);
      await previewWorkspaceDraft(id, userId, draft.id, draft.version);
      const proposal = await submitCharacterProposal(id, userId, { baseRevision: draft.baseRevision, operations: draft.operations, expectedBaseHash: (draft as unknown as {baseHash: string}).baseHash, rationale: body.rationale, requestId: body.requestId });
      return NextResponse.json({ proposal });
    }
    if (body.action === "reviewed") return NextResponse.json({ review: await markCharacterReviewed(id,userId,body.revision,body.note) });
    if (body.action === "preview") {
      const access = await resolveCharacterAccess(userId, id);
      const [row] = await db.select().from(characterWorkspaceCommands).where(and(eq(characterWorkspaceCommands.characterId,id),eq(characterWorkspaceCommands.commandId,body.proposalId),eq(characterWorkspaceCommands.kind,"character-draft-proposal")));
      const proposal = row?.result as unknown as CharacterDraftProposal | undefined;
      if (!proposal) throw new CollaborationError("Proposal not found.",404);
      if (access.permission !== "OWNER" && proposal.authorId !== userId) throw new CollaborationError("You cannot read this proposal.",403);
      if (proposal.status !== "pending") throw new CollaborationError("This proposal is already resolved.",409);
      await resolveCharacterAccess(proposal.authorId,id,{require:"SUGGESTER"});
      try {
        await withDatabaseTransaction(async () => {
          const [character] = await db.select().from(characters).where(eq(characters.id,id)).for("update");
          const lockedAccess = await resolveCharacterAccess(userId,id);
          if (lockedAccess.permission !== "OWNER" && proposal.authorId !== userId) throw new CollaborationError("You cannot read this proposal.",403);
          await resolveCharacterAccess(proposal.authorId,id,{require:"SUGGESTER"});
          const beforeGraph = await readWorkspace(id);
          if (!character || proposal.baseHash !== workspaceBuildFingerprint(beforeGraph,character)) throw new CollaborationError("This proposal is outdated. Ask its author to refresh and resubmit it.",409);
          throw new PreviewRollback({ ...await executeDraftOperations(id, proposal.authorId, proposal.baseRevision, proposal.operations, true), beforeGraph });
        });
      } catch(error) { if (error instanceof PreviewRollback) return NextResponse.json({preview:error.preview}); throw error; }
      throw new Error("Preview failed to roll back");
    }
    const proposal = await decideCharacterProposal(id,userId,body.proposalId,body.action,body.note,(revision,operations,authorId) => executeDraftOperations(id,authorId,revision,operations));
    return NextResponse.json({proposal});
  } catch(error) { return failure(error); }
}
