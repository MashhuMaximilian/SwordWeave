import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cloneCharacter } from "@/lib/character/clone-character";

/** POST /api/characters/[id]/clone — make a private copy owned by the caller. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const character = await cloneCharacter(id, userId);
    if (!character) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }
    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
