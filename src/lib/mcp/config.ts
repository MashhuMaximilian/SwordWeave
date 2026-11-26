export const MCP_SCOPES = {
  read: "swordweave:read",
  create: "swordweave:create",
} as const;
export const MCP_PLAY_SCOPE = "swordweave:play";
export const MCP_EDIT_SCOPE = "swordweave:edit";

export interface McpConfig {
  resource: string;
  issuer: string;
  metadataUrl: string;
  readEnabled: boolean;
  writeEnabled: boolean;
  fixtureUserIds: readonly string[];
}

export function configuredScopes(config: McpConfig, env = globalThis.process.env): string[] {
  const scopes: string[] = [];
  if (config.readEnabled) scopes.push(MCP_SCOPES.read);
  if (config.writeEnabled && config.fixtureUserIds.length) scopes.push(MCP_SCOPES.create);
  if (config.readEnabled && config.writeEnabled && config.fixtureUserIds.length && env["MCP_STAGING_REVIEW_ENABLED"] === "true") {
    if (env["MCP_CHARACTER_EDIT_READ_ENABLED"] === "true" && env["MCP_CHARACTER_EDIT_WRITE_ENABLED"] === "true") scopes.push(MCP_EDIT_SCOPE);
    if (env["MCP_CHARACTER_PLAY_READ_ENABLED"] === "true" && env["MCP_CHARACTER_PLAY_WRITE_ENABLED"] === "true") scopes.push(MCP_PLAY_SCOPE);
  }
  return scopes;
}

function protectedUrl(input: string | undefined): URL | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && (url.protocol !== "http:" || !loopback)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function fixtureUsers(env: NodeJS.ProcessEnv): string[] {
  if (env["MCP_FIXTURE_ENABLED"] !== "true" || !env["CLERK_SECRET_KEY"]?.startsWith("sk_test_")) return [];
  const host = env["MCP_FIXTURE_DATABASE_HOST"];
  const ids = (env["MCP_FIXTURE_USER_IDS"] ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (new Set(ids).size !== 2 || ids.length !== 2 ||
      !ids.every(id => /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id))) return [];
  try {
    const database = new URL(env["DATABASE_URL"] ?? "");
    if (!host || database.hostname !== host || database.pathname !== "/sw_companion_test" ||
        !["postgres:", "postgresql:"].includes(database.protocol)) return [];
  } catch {
    return [];
  }
  return ids;
}

export function getMcpConfig(env = globalThis.process.env): McpConfig | null {
  const resourceUrl = protectedUrl(env["MCP_RESOURCE_URL"]);
  const issuer = env["MCP_CLERK_ISSUER"]?.trim();
  const issuerUrl = protectedUrl(issuer);
  const readEnabled = env["MCP_READ_ENABLED"] === "true";
  const writeEnabled = env["MCP_WRITE_ENABLED"] === "true";
  const fixtureUserIds = fixtureUsers(env);
  if (!resourceUrl || resourceUrl.pathname !== "/api/mcp" || !issuer || !issuerUrl ||
      issuerUrl.protocol !== "https:" || (!readEnabled && !(writeEnabled && fixtureUserIds.length))) return null;
  // A misconfigured fixture deployment must not fall through to regular data tools.
  if (env["MCP_FIXTURE_ENABLED"] === "true" && fixtureUserIds.length === 0) return null;
  return {
    resource: resourceUrl.href,
    issuer,
    metadataUrl: new URL("/.well-known/oauth-protected-resource" + resourceUrl.pathname, resourceUrl).href,
    readEnabled,
    writeEnabled,
    fixtureUserIds,
  };
}
