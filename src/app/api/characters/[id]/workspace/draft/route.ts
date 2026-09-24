import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { readWorkspace } from "@/lib/character/workspace/read";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceDraft, saveWorkspaceDraft, previewWorkspaceDraft, applyWorkspaceDraft, discardWorkspaceDraft, undoWorkspaceDraft } from "@/lib/character/workspace/drafts";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { WorkspaceConflict } from "@/lib/character/workspace/commands";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save the draft." }, {
    status: error instanceof CharacterAccessDenied ? 403 : error instanceof WorkspaceConflict ? 409 : 400,
  });
}
export async function GET(_request: Request, { params }: Context) {
  const { userId } = await auth.protect(); const { id } = await params;
  try {
    const draft = await getWorkspaceDraft(id, userId);
    const [sheet, graph] = await Promise.all([readDraftSheet(id), readWorkspace(id)]);
    return NextResponse.json({ draft, sheet, graph });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: Context) {
  const { userId } = await auth.protect(); const { id } = await params;
  try { return NextResponse.json({ draft: await saveWorkspaceDraft(id, userId, await request.json()) }); } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: Context) {
  const { userId } = await auth.protect(); const { id } = await params;
  try {
    const body = z.object({ action: z.enum(["preview", "apply", "undo"]), draftId: z.string().uuid(), expectedVersion: z.number().int().min(1) }).parse(await request.json());
    const result = body.action === "undo"
      ? await undoWorkspaceDraft(id, userId, body.draftId, body.expectedVersion)
      : body.action === "apply"
      ? await applyWorkspaceDraft(id, userId, body.draftId, body.expectedVersion)
      : await previewWorkspaceDraft(id, userId, body.draftId, body.expectedVersion);
    if (body.action !== "preview") bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  const { userId } = await auth.protect(); const { id } = await params;
  try {
    const body = z.object({ draftId: z.string().uuid(), expectedVersion: z.number().int().min(1) }).parse(await request.json());
    return NextResponse.json(await discardWorkspaceDraft(id, userId, body.draftId, body.expectedVersion));
  } catch (error) { return failure(error); }
}
