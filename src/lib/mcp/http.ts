import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { readBoundedJson, RequestSizeError } from "@/lib/http/read-bounded-json";
import { mcpChallenge, verifyMcpIdentity } from "@/lib/mcp/auth";
import type { McpConfig } from "./config";
import { withMcpRequestConfig } from "./request-config";
import { createSwordWeaveMcpServer } from "@/lib/mcp/server";

const noStore = { "Cache-Control": "no-store" };

function error(status: number, code: number, message: string, headers?: HeadersInit) {
  const output = new Headers(headers);
  output.set("Cache-Control", "no-store");
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: output });
}

function unauthorized(config: McpConfig) {
  return error(401, -32001, "SwordWeave authentication required", {
    "WWW-Authenticate": mcpChallenge(config),
  });
}

async function advertiseToolSecurity(body: unknown, response: Response): Promise<Response> {
  const requests: unknown[] = Array.isArray(body) ? body : [body];
  const listsTools = requests.some(item => item && typeof item === "object" && "method" in item && item.method === "tools/list");
  if (!listsTools || !response.ok || !response.headers.get("content-type")?.startsWith("application/json")) return response;
  // The v1 MCP SDK preserves _meta but drops ChatGPT's top-level extension
  // from listed descriptors. Keep both representations on the wire.
  type ListResponse = { result?: { tools?: Array<{
    _meta?: { securitySchemes?: unknown };
    securitySchemes?: unknown;
  }> } };
  const result = await response.json() as ListResponse | ListResponse[];
  for (const message of Array.isArray(result) ? result : [result]) {
    for (const tool of message.result?.tools ?? []) {
      if (tool._meta?.securitySchemes) tool.securitySchemes = tool._meta.securitySchemes;
    }
  }
  return Response.json(result, { status: response.status, headers: response.headers });
}

export async function handleMcpPost(request: Request, config: McpConfig | null): Promise<Response> {
  if (!config) return new Response(null, { status: 404, headers: noStore });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(config.resource).origin && origin !== "https://chatgpt.com") {
    return error(403, -32000, "Origin not allowed");
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request, 131_072);
  } catch (cause) {
    return cause instanceof RequestSizeError
      ? error(413, -32600, "Request too large")
      : error(400, -32700, "Invalid JSON");
  }
  let identity = null;
  if (request.headers.has("authorization")) {
    try {
      identity = await verifyMcpIdentity(request, config);
    } catch {
      return error(503, -32000, "SwordWeave authentication is temporarily unavailable");
    }
    if (!identity) return unauthorized(config);
  }
  const server = createSwordWeaveMcpServer(config, identity);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await withMcpRequestConfig(config, () => transport.handleRequest(request, { parsedBody: body }));
    response.headers.set("Cache-Control", "no-store");
    return await advertiseToolSecurity(body, response);
  } finally {
    await server.close();
  }
}

export function handleMcpGet(config: McpConfig | null) {
  return config
    ? new Response(null, { status: 405, headers: { ...noStore, Allow: "POST" } })
    : new Response(null, { status: 404, headers: noStore });
}
