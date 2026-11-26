import { auth } from "@clerk/nextjs/server";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { characterPdfErrorResponse, characterPdfFailure, characterPdfPrivateHeaders, downloadCharacterPdf } from "@/lib/character-pdf/download";
import { loadCharacterPdfSnapshot } from "@/lib/character-pdf/snapshot";
import { resolveMcpActor } from "@/lib/mcp/auth";
import { characterSheetPdfPath, readCharacterSheetPdfOptions } from "@/lib/mcp/character-sheet-pdf";
import { getMcpConfig } from "@/lib/mcp/config";
import { characterIdSchema, CharacterContextUnavailable, readOnlyCharacterContext, requireCharacterAccess } from "@/lib/mcp/context-shared";
import { stagingReviewEnabled } from "@/lib/mcp/operation-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const unavailable = () => new Response(null, { status: 404, headers: characterPdfPrivateHeaders });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = characterIdSchema.safeParse((await params).id);
  const config = getMcpConfig();
  if (!parsed.success || !config?.readEnabled || (config.fixtureUserIds.length && !stagingReviewEnabled(config))) return unavailable();
  const options = readCharacterSheetPdfOptions(new URL(request.url).searchParams);
  if (!options) return characterPdfErrorResponse("Invalid PDF export options.", 400);
  if (request.signal.aborted) return characterPdfErrorResponse("PDF export was cancelled.", 499);

  try {
    const session = await auth();
    if (!session.userId || !session.sessionId) {
      const signIn = new URL("/sign-in", config.resource);
      signIn.searchParams.set("redirect_url", new URL(characterSheetPdfPath(parsed.data, options), config.resource).href);
      return new Response(null, { status: 307, headers: { ...characterPdfPrivateHeaders,
        "Referrer-Policy": "no-referrer", Location: signIn.href } });
    }
    const actor = await resolveMcpActor({ clerkId: session.userId, scopes: [] });
    if (!actor || (config.fixtureUserIds.length && !config.fixtureUserIds.includes(actor.id))) return unavailable();
    const snapshot = await readOnlyCharacterContext(async () => {
      // Match the tool's exact owner or active share grant before loading
      // the website snapshot. Both reads see the same database state.
      await requireCharacterAccess(actor, parsed.data);
      return loadCharacterPdfSnapshot(parsed.data, actor.clerkId);
    });
    const response = await downloadCharacterPdf(request, snapshot, options, actor.clerkId);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof CharacterContextUnavailable || error instanceof CharacterAccessDenied) return unavailable();
    return characterPdfFailure(error);
  }
}
