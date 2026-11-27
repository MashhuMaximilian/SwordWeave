import { CharacterPdfRenderError, renderProgressionPdf } from "@/lib/character-pdf/render";
import { resolveCompanionBrowserActor } from "@/lib/mcp/browser-approval";
import { getBrowserReviewMcpConfig } from "@/lib/mcp/config";
import { operationUuid } from "@/lib/mcp/operation-policy";
import { getApprovedProgressionDocument, OperationUnavailableError } from "@/lib/mcp/operations";
import { withMcpRequestConfig } from "@/lib/mcp/request-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const parsed = operationUuid.safeParse((await params).documentId);
  if (!parsed.success) return new Response(null, { status: 404, headers });
  try {
    const config = getBrowserReviewMcpConfig();
    if (!config) return new Response(null, { status: 404, headers });
    const actor = await resolveCompanionBrowserActor(config);
    if (!actor) return new Response(null, { status: 404, headers });
    const document = await withMcpRequestConfig(config, () => getApprovedProgressionDocument(actor, parsed.data, "browser"));
    const pdf = await renderProgressionPdf(document, request.signal);
    return new Response(new Uint8Array(pdf), { headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="swordweave-progression.pdf"',
    } });
  } catch (error) {
    if (error instanceof OperationUnavailableError) return new Response(null, { status: 404, headers });
    const status = error instanceof CharacterPdfRenderError ? error.status : 503;
    return new Response("Progression PDF unavailable.", { status, headers });
  }
}
