import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { readWorkspace } from "@/lib/character/workspace/read";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const character = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    columns: { userId: true },
  });
  if (!character)
    return NextResponse.json(
      { error: "Character not found." },
      { status: 404 },
    );
  if (character.userId !== userId)
    return NextResponse.json(
      { error: "You do not own this character." },
      { status: 403 },
    );
  return NextResponse.json(await readWorkspace(id));
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
