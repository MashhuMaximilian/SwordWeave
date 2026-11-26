import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { resolveCharacterPdfMedia } from "./media";
import { characterPdfFilename, type CharacterPdfOptions } from "./options";
import { CharacterPdfRenderError, renderCharacterPdf } from "./render";
import type { CharacterPdfSnapshot } from "./types";

export const characterPdfPrivateHeaders = {
  "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization", "X-Content-Type-Options": "nosniff",
};

export function characterPdfErrorResponse(message: string, status: number, extra: Record<string, string> = {}) {
  return Response.json({ error: message }, { status, headers: { ...characterPdfPrivateHeaders, ...extra } });
}

export function characterPdfFailure(error: unknown) {
  if (error instanceof CharacterAccessDenied) return characterPdfErrorResponse("You do not have access to this character.", 403);
  if (error instanceof CharacterPdfRenderError) return characterPdfErrorResponse(error.message, error.status, error.code === "BUSY" ? { "Retry-After": "2" } : {});
  // Keep authored text and access diagnostics out of server/browser logs.
  return characterPdfErrorResponse("The character PDF could not be prepared. Please try again.", 503);
}

/** Both website and companion downloads use the same media, renderer and attachment. */
export async function downloadCharacterPdf(request: Request, snapshot: CharacterPdfSnapshot, options: CharacterPdfOptions, viewerId: string | null) {
  const character = await resolveCharacterPdfMedia(snapshot, { viewerId, signal: request.signal, color: options.color });
  const bytes = await renderCharacterPdf(character, options, {
    signal: request.signal, requestUrl: request.url, cookieHeader: request.headers.get("cookie"),
  });
  return new Response(new Uint8Array(bytes), { status: 200, headers: {
    ...characterPdfPrivateHeaders,
    "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength),
    "Content-Disposition": `attachment; filename="${characterPdfFilename(character.name, options)}"`,
    "X-SwordWeave-PDF-Artwork-Warnings": String(character.pdfMedia?.warnings.length ?? 0),
  } });
}
