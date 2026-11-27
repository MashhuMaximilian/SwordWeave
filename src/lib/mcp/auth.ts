import { clerkClient } from "@clerk/nextjs/server";
import { resolveAuthorByClerkId } from "@/lib/auth/author-resolver";
import type { McpConfig } from "./config";

export interface McpIdentity {
  clerkId: string;
  scopes: readonly string[];
}

export interface McpActor extends McpIdentity {
  id: string;
}

export function bearerToken(request: Request): string | undefined {
  return /^Bearer ([^\s,]{1,8192})$/i.exec(request.headers.get("authorization") ?? "")?.[1];
}

export async function verifyMcpIdentity(request: Request, config: McpConfig): Promise<McpIdentity | null> {
  const token = bearerToken(request);
  const parts = token?.split(".");
  if (!token || parts?.length !== 3 || parts.some(part => !/^[\w-]+$/.test(part))) return null;

  const clerk = await clerkClient();
  // Pass only the bearer header. A Clerk website cookie is not MCP authorization.
  const credentialRequest = new Request(config.resource, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const state = await clerk.authenticateRequest(credentialRequest, {
    acceptsToken: "oauth_token",
    audience: config.resource,
  });
  if (!state.isAuthenticated || state.token !== token) return null;

  // These claims come from the very JWT whose signature Clerk just verified.
  // Check the resource explicitly, including the absence of an aud claim.
  const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
    iss?: unknown; aud?: unknown; sub?: unknown; exp?: unknown; nbf?: unknown;
  } | null;
  const auth = state.toAuth();
  if (!claims || claims.iss !== config.issuer ||
      !(claims.aud === config.resource || (Array.isArray(claims.aud) && claims.aud.includes(config.resource))) ||
      typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() ||
      (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf * 1000 > Date.now())) ||
      typeof auth.userId !== "string" || auth.userId !== claims.sub || !Array.isArray(auth.scopes)) return null;
  if (config.privateTest && auth.clientId !== config.privateTest.clientId) return null;
  return { clerkId: auth.userId, scopes: auth.scopes };
}

export async function resolveMcpActor(identity: McpIdentity): Promise<McpActor | null> {
  const account = await resolveAuthorByClerkId(identity.clerkId);
  return account ? { ...identity, id: account.id } : null;
}

export function mcpChallenge(config: McpConfig, scope?: string, hasIdentity = false): string {
  const error = hasIdentity ? "insufficient_scope" : "invalid_token";
  const description = hasIdentity ? "Authorize the requested SwordWeave permission" : "Connect your SwordWeave account";
  return `Bearer resource_metadata="${config.metadataUrl}"${scope ? `, scope="${scope}"` : ""}, error="${error}", error_description="${description}"`;
}
