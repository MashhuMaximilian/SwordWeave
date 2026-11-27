import { resolveCompanionBrowserActor } from "@/lib/mcp/browser-approval";
import { getBrowserReviewMcpConfig } from "@/lib/mcp/config";
import { approveStagingOperation, operationReviewPath, OperationUnavailableError } from "@/lib/mcp/operations";
import { withMcpRequestConfig } from "@/lib/mcp/request-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

function unavailable() {
  return new Response("This review is unavailable.", { status: 404, headers: privateHeaders });
}

export async function POST(request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  const config = getBrowserReviewMcpConfig();
  const origin = request.headers.get("origin");
  if (!config || origin !== new URL(config.resource).origin ||
      request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") return unavailable();
  const actor = await resolveCompanionBrowserActor(config);
  if (!actor || !request.body) return unavailable();
  const reader = request.body.getReader();
  const pieces: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) {
        await reader.cancel();
        return unavailable();
      }
      pieces.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const form = new URLSearchParams(Buffer.concat(pieces).toString("utf8"));
  const operationId = form.get("operationId");
  const nonce = form.get("nonce");
  const digest = form.get("digest");
  if (!operationId || !nonce || !digest || operationId !== (await params).operationId) return unavailable();
  try {
    const id = await withMcpRequestConfig(config, () => approveStagingOperation(actor, { operationId, nonce, digest, origin }));
    return new Response(null, { status: 303, headers: { ...privateHeaders, Location: operationReviewPath(id) } });
  } catch (error) {
    if (error instanceof OperationUnavailableError) return unavailable();
    throw error;
  }
}
