import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { decideVersionProposal, VersionProposalError } from "@/lib/character/version-proposals";

function parsePatchBody(body: unknown):
  | { ok: true; value: { action: "APPROVE" | "REJECT"; note?: string | undefined } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const action = b["action"];
  if (action !== "APPROVE" && action !== "REJECT") {
    return { ok: false, error: "action must be APPROVE or REJECT." };
  }
  const noteRaw = b["note"];
  const note =
    typeof noteRaw === "string" && noteRaw.length > 0
      ? noteRaw.slice(0, 1000)
      : undefined;
  return { ok: true, value: { action, note } };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const { userId: reviewerUserId } = await auth.protect();
    const { id: characterId, proposalId } = await params;
    const parsed = parsePatchBody(await request.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const result = await decideVersionProposal({ characterId, proposalId, reviewerUserId, ...parsed.value });
    if (result.status === "APPLIED") bustResolverCache(characterId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VersionProposalError || error instanceof CharacterAccessDenied) {
      return NextResponse.json({ error: error.message }, { status: error instanceof VersionProposalError ? error.status : 403 });
    }
    console.error("[PATCH /api/characters/[id]/proposals/[proposalId]]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
