import { configuredScopes, type McpConfig } from "./config";

export function protectedResourceMetadata(config: McpConfig | null) {
  if (!config) return new Response(null, { status: 404 });
  return Response.json({
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: configuredScopes(config),
    bearer_methods_supported: ["header"],
  }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

export function protectedResourceOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
