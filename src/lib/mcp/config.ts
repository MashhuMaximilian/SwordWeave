export const MCP_SCOPES = {
  read: "swordweave:read",
  create: "swordweave:create",
} as const;
export const MCP_PLAY_SCOPE = "swordweave:play";
export const MCP_EDIT_SCOPE = "swordweave:edit";
export const MCP_PRIVATE_TEST_PATH = "/api/mcp/private-test";

type PrivateTest = { userIds: readonly string[]; clientId: string };

export interface McpConfig {
  resource: string;
  issuer: string;
  metadataUrl: string;
  readEnabled: boolean;
  writeEnabled: boolean;
  fixtureUserIds: readonly string[];
  privateTest?: PrivateTest;
}

export function characterToolsEnabled(
  config: McpConfig,
  group: "EDIT" | "PLAY" | "COMPANIONS",
  action: "READ" | "WRITE",
  env = globalThis.process.env,
): boolean {
  return !!config.privateTest || env[`MCP_CHARACTER_${group}_${action}_ENABLED`] === "true";
}

export function configuredScopes(config: McpConfig, env = globalThis.process.env): string[] {
  const scopes: string[] = [];
  if (config.readEnabled) scopes.push(MCP_SCOPES.read);
  if (config.writeEnabled && (config.fixtureUserIds.length || config.privateTest)) scopes.push(MCP_SCOPES.create);
  if (config.readEnabled && config.writeEnabled && (config.privateTest || (config.fixtureUserIds.length && env["MCP_STAGING_REVIEW_ENABLED"] === "true"))) {
    if (characterToolsEnabled(config, "EDIT", "READ", env) && characterToolsEnabled(config, "EDIT", "WRITE", env)) scopes.push(MCP_EDIT_SCOPE);
    if (characterToolsEnabled(config, "PLAY", "READ", env) && characterToolsEnabled(config, "PLAY", "WRITE", env)) scopes.push(MCP_PLAY_SCOPE);
  }
  return scopes;
}

export function getPrivateTestMcpConfig(env = globalThis.process.env): McpConfig | null {
  if (env["MCP_PRIVATE_TEST_ENABLED"] !== "true" || env["MCP_FIXTURE_ENABLED"] === "true" ||
      !env["CLERK_SECRET_KEY"]?.startsWith("sk_live_")) return null;
  const live = getMcpConfig(env);
  const clientId = env["MCP_PRIVATE_TEST_CLIENT_ID"]?.trim();
  const userIds = (env["MCP_PRIVATE_TEST_USER_IDS"] ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!live?.readEnabled || !live.resource.startsWith("https://") || !clientId || !/^[a-zA-Z0-9_-]{8,128}$/.test(clientId) ||
      !userIds.length || userIds.length > 2 || new Set(userIds).size !== userIds.length ||
      userIds.some(id => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id))) return null;
  const resource = new URL(MCP_PRIVATE_TEST_PATH, live.resource);
  return { ...live, resource: resource.href, writeEnabled: true, privateTest: { clientId, userIds },
    metadataUrl: new URL("/.well-known/oauth-protected-resource" + resource.pathname, resource).href };
}

export function getBrowserReviewMcpConfig(): McpConfig | null {
  return getPrivateTestMcpConfig() ?? getMcpConfig();
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
