import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { executeWorkspaceCreate } from "@/lib/character/workspace/create";
import { WorkspaceConflict } from "@/lib/character/workspace/commands";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    const result = await executeWorkspaceCreate(id, userId, await request.json());
    bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed." },
      { status: error instanceof WorkspaceConflict ? 409 : 400 });
  }
}
