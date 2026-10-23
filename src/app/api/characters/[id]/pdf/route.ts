import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { characterPdfFilename, characterPdfOptionsSchema } from "@/lib/character-pdf/options";
import { loadCharacterPdfSnapshot } from "@/lib/character-pdf/snapshot";
import { CharacterPdfRenderError, renderCharacterPdf } from "@/lib/character-pdf/render";
import { resolveCharacterPdfMedia } from "@/lib/character-pdf/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const OPTIONS_LIMIT_BYTES = 4096;
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization", "X-Content-Type-Options": "nosniff" };
const errorResponse = (message: string, status: number, extra: Record<string, string> = {}) =>
  Response.json({ error: message }, { status, headers: { ...privateHeaders, ...extra } });

async function readOptions(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > OPTIONS_LIMIT_BYTES) throw new RangeError("Export options are too large.");
  if (!request.body) throw new SyntaxError("Export options must be JSON.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > OPTIONS_LIMIT_BYTES) { await reader.cancel(); throw new RangeError("Export options are too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return errorResponse("Invalid character ID.", 400);
  let options;
  try { options = characterPdfOptionsSchema.parse(await readOptions(request)); }
  catch (error) {
    return errorResponse(error instanceof RangeError ? error.message : "Invalid PDF export options.", error instanceof RangeError ? 413 : 400);
  }
  if (request.signal.aborted) return errorResponse("PDF export was cancelled.", 499);
  try {
    const { userId } = await auth();
    const snapshot = await loadCharacterPdfSnapshot(id, userId);
    const character = await resolveCharacterPdfMedia(snapshot, { viewerId: userId, signal: request.signal, color: options.color });
    const bytes = await renderCharacterPdf(character, options, {
      signal: request.signal,
      requestUrl: request.url,
      cookieHeader: request.headers.get("cookie"),
    });
    return new Response(new Uint8Array(bytes), { status: 200, headers: {
      ...privateHeaders, "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${characterPdfFilename(character.name, options)}"`,
      "X-SwordWeave-PDF-Artwork-Warnings": String(character.pdfMedia?.warnings.length ?? 0),
    } });
  } catch (error) {
    if (error instanceof CharacterAccessDenied) return errorResponse("You do not have access to this character.", 403);
    if (error instanceof CharacterPdfRenderError) return errorResponse(error.message, error.status, error.code === "BUSY" ? { "Retry-After": "2" } : {});
    // Keep authored text and access diagnostics out of server/browser logs.
    return errorResponse("The character PDF could not be prepared. Please try again.", 503);
  }
}
