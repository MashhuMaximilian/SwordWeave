import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readWorkspace } from "@/lib/character/workspace/read";
import {
  canResolveCharacter,
  CharacterAccessDenied,
} from "@/lib/character/can-resolve-character";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    await canResolveCharacter(userId, id);
    return NextResponse.json(await readWorkspace(id));
  } catch (error) {
    if (error instanceof CharacterAccessDenied) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const { executeWorkspaceCommand, WorkspaceConflict } =
    await import("@/lib/character/workspace/commands");
  try {
    const result = await executeWorkspaceCommand(
      id,
      userId,
      await request.json(),
    );
    const { bustResolverCache } =
      await import("@/lib/cache/character-resolver-cache");
    bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Workspace save failed.",
      },
      { status: error instanceof WorkspaceConflict ? 409 : 400 },
    );
  }
}
