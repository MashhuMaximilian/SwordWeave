import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readWorkspace } from "@/lib/character/workspace/read";
import {
  canResolveCharacter,
  CharacterAccessDenied,
} from "@/lib/character/can-resolve-character";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    await canResolveCharacter(userId, id);
    const base = await readWorkspace(id);
    const keys = new URL(request.url).searchParams.getAll("piece");
    if (!keys.length) return NextResponse.json(base);
    if (keys.length > 100 || keys.some(key => !/^(primitive|effect|capability|heritage|item):[a-zA-Z0-9-]+$/.test(key))) return NextResponse.json({error:"Invalid requested pieces."},{status:400});
    const {assertReferenceAccess} = await import("@/lib/character/workspace/reference-access");
    const expanded = await readWorkspace(id, keys as import("@/lib/character/workspace/model").EntityKey[]);
    for (const key of keys) {
      const node = expanded.nodes.find(n => n.key === key);
      if (!node) return NextResponse.json({error:"A selected piece no longer exists."},{status:404});
      await assertReferenceAccess(base,node,userId);
    }
    return NextResponse.json(expanded);
  } catch (error) {
    if (error instanceof CharacterAccessDenied) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({error:error instanceof Error?error.message:"Piece unavailable."},{status:400});
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
