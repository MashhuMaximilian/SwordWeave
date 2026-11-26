import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { saveVersionProposal, VersionProposalError } from "@/lib/character/version-proposals";

function parsePostBody(body: unknown):
  | { ok: true; value: {
      targetKind: "PRIMITIVE" | "CAPABILITY" | "ITEM";
      targetId: string;
      currentVersionId: string;
      proposedVersionId: string;
      rationale?: string | undefined;
    } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const targetKind = b["targetKind"];
  if (targetKind !== "PRIMITIVE" && targetKind !== "CAPABILITY" && targetKind !== "ITEM") {
    return { ok: false, error: "targetKind must be PRIMITIVE | CAPABILITY | ITEM." };
  }
  const targetId = b["targetId"];
  const currentVersionId = b["currentVersionId"];
  const proposedVersionId = b["proposedVersionId"];
  if (typeof targetId !== "string" || targetId.length === 0) {
    return { ok: false, error: "targetId is required." };
  }
  if (typeof currentVersionId !== "string" || currentVersionId.length === 0) {
    return { ok: false, error: "currentVersionId is required." };
  }
  if (typeof proposedVersionId !== "string" || proposedVersionId.length === 0) {
    return { ok: false, error: "proposedVersionId is required." };
  }
  if (currentVersionId === proposedVersionId) {
    return {
      ok: false,
      error: "proposedVersionId must differ from currentVersionId.",
    };
  }
  const rationaleRaw = b["rationale"];
  const rationale =
    typeof rationaleRaw === "string" && rationaleRaw.length > 0
      ? rationaleRaw.slice(0, 1000)
      : undefined;
  return {
    ok: true,
    value: { targetKind, targetId, currentVersionId, proposedVersionId, rationale },
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: proposerUserId } = await auth.protect();
    const { id: characterId } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = parsePostBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const instance = (body as Record<string, unknown>)["instanceId"];
    const result = await saveVersionProposal({ characterId, proposerUserId, ...parsed.value,
      ...(typeof instance === "string" ? { instanceId: instance } : {}) });
    return NextResponse.json(result, { status: "created" in result ? 201 : 200 });
  } catch (error) {
    if (error instanceof VersionProposalError || error instanceof CharacterAccessDenied) {
      return NextResponse.json({ error: error.message }, { status: error instanceof VersionProposalError ? error.status : 403 });
    }
    console.error("[POST /api/characters/[id]/proposals]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
