import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { characterPdfErrorResponse as errorResponse, characterPdfFailure, downloadCharacterPdf } from "@/lib/character-pdf/download";
import { characterPdfOptionsSchema } from "@/lib/character-pdf/options";
import { loadCharacterPdfSnapshot } from "@/lib/character-pdf/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const OPTIONS_LIMIT_BYTES = 4096;

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
    const publicView = new URL(request.url).searchParams.get("view") === "public";
    const snapshot = await loadCharacterPdfSnapshot(id, userId, publicView);
    return await downloadCharacterPdf(request, snapshot, options, publicView ? null : userId);
  } catch (error) {
    return characterPdfFailure(error);
  }
}
