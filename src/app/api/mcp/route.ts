import { getMcpConfig } from "@/lib/mcp/config";
import { handleMcpGet, handleMcpPost } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleMcpPost(request, getMcpConfig());
}

export function GET(): Response {
  return handleMcpGet(getMcpConfig());
}
