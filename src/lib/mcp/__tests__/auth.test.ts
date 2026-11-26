import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { GET as metadata } from "@/app/.well-known/oauth-protected-resource/api/mcp/route";
import { getMcpConfig, MCP_SCOPES } from "../config";

const { authenticateRequest, resolveAuthorByClerkId } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  resolveAuthorByClerkId: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ authenticateRequest }),
}));
vi.mock("@/lib/auth/author-resolver", () => ({ resolveAuthorByClerkId }));

const resource = "https://mcp.sw.example/api/mcp";
const issuer = "https://staging.clerk.example";
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const outside = "33333333-3333-4333-8333-333333333333";
const epoch = () => Math.floor(Date.now() / 1000);

function bearer(sub = "user_alpha", changes: Record<string, unknown> = {}) {
  // Signature verification is exercised by Clerk. This fixture mocks its
  // signed request state, then tests the resource server's independent checks.
  const claims = Buffer.from(JSON.stringify({ sub, iss: issuer, aud: resource, exp: epoch() + 120, ...changes })).toString("base64url");
  return `eyJ0eXAiOiJhdCtqd3QifQ.${claims}.fixture`;
}

function grant(token: string, userId = "user_alpha", scopes: readonly string[] = Object.values(MCP_SCOPES)) {
  authenticateRequest.mockResolvedValue({
    isAuthenticated: true, token, toAuth: () => ({ userId, scopes }),
  });
}

function request(method: string, params?: Record<string, unknown>, token?: string) {
  return new Request(resource, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
  });
}

async function call(name: string, token?: string, args: Record<string, unknown> = {}) {
  const response = await POST(request("tools/call", { name, arguments: args }, token));
  return { status: response.status, headers: response.headers, body: await response.json() };
}

beforeEach(() => {
  vi.stubEnv("MCP_RESOURCE_URL", resource);
  vi.stubEnv("MCP_CLERK_ISSUER", issuer);
  vi.stubEnv("MCP_READ_ENABLED", "true");
  vi.stubEnv("MCP_WRITE_ENABLED", "true");
  vi.stubEnv("MCP_CURSOR_HMAC_SECRET", "");
  vi.stubEnv("MCP_FIXTURE_ENABLED", "true");
  vi.stubEnv("MCP_FIXTURE_DATABASE_HOST", "fixtures.example");
  vi.stubEnv("MCP_FIXTURE_USER_IDS", `${first},${second}`);
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("DATABASE_URL", "postgres://fixtures.example/sw_companion_test");
  authenticateRequest.mockReset();
  resolveAuthorByClerkId.mockReset();
  resolveAuthorByClerkId.mockImplementation(async (id: string) =>
    id === "user_alpha" ? { id: first } : id === "user_beth" ? { id: second } : null,
  );
});

afterEach(() => vi.unstubAllEnvs());

describe("isolated Companion authorization", () => {
  it("publishes exact protected-resource discovery and lists only enabled tools", async () => {
    expect(await metadata().json()).toEqual({
      resource,
      authorization_servers: [issuer],
      scopes_supported: Object.values(MCP_SCOPES),
      bearer_methods_supported: ["header"],
    });
    const response = await POST(request("initialize", {
      protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fixture", version: "1.0" },
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).result.serverInfo.name).toBe("swordweave");
    vi.stubEnv("MCP_WRITE_ENABLED", "false");
    expect((await metadata().json()).scopes_supported).toEqual([MCP_SCOPES.read]);
    const listing = await POST(request("tools/list"));
    expect((await listing.json()).result.tools).toMatchObject([
      {
        name: "read_test_fixture",
        securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPES.read] }],
        _meta: { securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPES.read] }] },
      },
    ]);
  });

  it("is off by default and fails closed if fixture isolation is unsafe", async () => {
    vi.stubEnv("MCP_READ_ENABLED", "false");
    vi.stubEnv("MCP_WRITE_ENABLED", "false");
    expect((await POST(request("tools/list"))).status).toBe(404);
    vi.stubEnv("MCP_READ_ENABLED", "true");
    vi.stubEnv("DATABASE_URL", "postgres://fixtures.example/swordweave");
    expect(metadata().status).toBe(404);
    vi.stubEnv("DATABASE_URL", "postgres://shared.example/sw_companion_test");
    expect(getMcpConfig()).toBeNull();
    vi.stubEnv("DATABASE_URL", "postgres://fixtures.example/sw_companion_test");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
    expect(getMcpConfig()).toBeNull();
  });

  it("offers version proposal preparation only when both version gates and fictional staging are enabled", async () => {
    vi.stubEnv("MCP_CURSOR_HMAC_SECRET", "version-proposal-cursor-secret-for-fictional-tests");
    vi.stubEnv("MCP_CHARACTER_EDIT_READ_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_EDIT_WRITE_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_READS_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_WRITE_ENABLED", "true");
    vi.stubEnv("MCP_STAGING_REVIEW_ENABLED", "false");
    const tools = async () => (await (await POST(request("tools/list"))).json()).result.tools;
    expect(await tools()).not.toContainEqual(expect.objectContaining({ name: "prepare_version_proposal" }));

    vi.stubEnv("MCP_STAGING_REVIEW_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_WRITE_ENABLED", "false");
    expect(await tools()).toContainEqual(expect.objectContaining({ name: "list_character_proposals" }));
    expect(await tools()).not.toContainEqual(expect.objectContaining({ name: "prepare_version_proposal" }));

    vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_WRITE_ENABLED", "true");
    expect(await tools()).toContainEqual(expect.objectContaining({
      name: "prepare_version_proposal",
      securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPES.read, "swordweave:edit"] }],
    }));
    vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_READS_ENABLED", "false");
    expect(await tools()).not.toContainEqual(expect.objectContaining({ name: "prepare_version_proposal" }));
  });

  it("challenges missing credentials at tool level and grants no rights from browser cookies", async () => {
    const req = request("tools/call", { name: "read_test_fixture", arguments: {} });
    req.headers.set("Cookie", "__session=fictional-browser-session");
    const body = await (await POST(req)).json();
    expect(body.result.isError).toBe(true);
    expect(body.result._meta["mcp/www_authenticate"][0]).toContain(MCP_SCOPES.read);
    expect(authenticateRequest).not.toHaveBeenCalled();
    expect(resolveAuthorByClerkId).not.toHaveBeenCalled();
  });

  it.each([
    ["missing audience", { aud: undefined }],
    ["wrong audience", { aud: "https://other.example/api/mcp" }],
    ["wrong issuer", { iss: "https://other.example" }],
    ["expired", { exp: 1 }],
    ["not yet valid", { nbf: 4_000_000_000 }],
    ["wrong subject", { sub: "user_different" }],
  ])("denies a verified token with %s", async (_, changes) => {
    const token = bearer("user_alpha", changes);
    grant(token);
    const response = await call("read_test_fixture", token);
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("/.well-known/oauth-protected-resource/api/mcp");
    expect(resolveAuthorByClerkId).not.toHaveBeenCalled();
  });

  it("rejects wrong token types and a rejected Clerk verification", async () => {
    expect((await call("read_test_fixture", "opaque_fixture")).status).toBe(401);
    expect(authenticateRequest).not.toHaveBeenCalled();
    authenticateRequest.mockResolvedValue({ isAuthenticated: false });
    expect((await call("read_test_fixture", bearer())).status).toBe(401);
    expect(authenticateRequest.mock.calls[0]?.[1]).toEqual({ acceptsToken: "oauth_token", audience: resource });
  });

  it("checks an OAuth JWT against the installed Clerk SDK with an isolated signing key", async () => {
    const { createClerkClient } = await vi.importActual<typeof import("@clerk/nextjs/server")>("@clerk/nextjs/server");
    const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const client = createClerkClient({
      secretKey: "sk_test_fixture",
      publishableKey: `pk_test_${Buffer.from("staging.clerk.example$").toString("base64")}`,
      jwtKey: key.publicKey.export({ type: "spki", format: "pem" }).toString(),
    });
    authenticateRequest.mockImplementation((req, options) => client.authenticateRequest(req, options));
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "at+jwt", kid: "fixture" })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({
      sub: "user_alpha", iss: issuer, aud: resource, iat: epoch() - 1, exp: epoch() + 120,
      jti: "clerk-sdk-fixture", client_id: "local-client", scope: MCP_SCOPES.read,
    })).toString("base64url");
    const input = `${header}.${claims}`;
    const signature = sign("RSA-SHA256", Buffer.from(input), key.privateKey).toString("base64url");
    const accepted = await call("read_test_fixture", `${input}.${signature}`);
    expect(accepted.body.result.structuredContent.displayName).toBe("Fictional SwordWeave player 1");
    expect((await call("read_test_fixture", `${input}.fixture`)).status).toBe(401);
  });

  it("separates read from write and refuses unmapped or out-of-fixture accounts", async () => {
    const token = bearer();
    grant(token, "user_alpha", [MCP_SCOPES.read]);
    expect((await call("save_test_fixture", token)).body.result._meta["mcp/www_authenticate"][0]).toContain("insufficient_scope");
    grant(token);
    resolveAuthorByClerkId.mockResolvedValueOnce(null);
    expect((await call("read_test_fixture", token)).body.result.isError).toBe(true);
    resolveAuthorByClerkId.mockResolvedValueOnce({ id: outside });
    expect((await call("save_test_fixture", token)).body.result.isError).toBe(true);
  });

  it("returns the same receipt on retry and reconnect and isolates two users", async () => {
    const alpha = bearer();
    grant(alpha);
    const save = (await call("save_test_fixture", alpha)).body.result.structuredContent;
    expect(save).toMatchObject({ displayName: "Fictional SwordWeave player 1", receipt: expect.any(String) });
    const retry = (await call("save_test_fixture", alpha)).body.result.structuredContent;
    expect(retry).toEqual(save);
    const reconnected = bearer("user_alpha", { jti: "new-connection" });
    grant(reconnected);
    expect((await call("read_test_fixture", reconnected)).body.result.structuredContent).toEqual(save);

    const beth = bearer("user_beth");
    grant(beth, "user_beth");
    expect((await call("read_test_fixture", beth)).body.result.structuredContent).toEqual({
      displayName: "Fictional SwordWeave player 2", receipt: null,
    });
    expect((await call("save_test_fixture", beth)).body.result.structuredContent.receipt).not.toBe(save.receipt);
  });

  it("keeps fixture and write tools out of the regular server", async () => {
    vi.stubEnv("MCP_FIXTURE_ENABLED", "false");
    expect((await metadata().json()).scopes_supported).toEqual([MCP_SCOPES.read]);
    const listing = await POST(request("tools/list"));
    const tools = (await listing.json()).result.tools;
    expect(tools.map((tool: { name: string }) => tool.name)).toEqual(["get_character_sheet_pdf_link", "read_rules", "prepare_portrait_prompt", "preview_character"]);
    expect(tools[0]).toMatchObject({ annotations: { readOnlyHint: true }, _meta: {
      securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPES.read] }],
    } });
    expect(tools[3].description).toContain("Send players to the SwordWeave website");
    expect(tools[3].description).not.toContain("prepare_character_piece");
    const token = bearer();
    grant(token);
    const reply = (await call("read_rules", token, { question: "Vitality" })).body.result;
    expect(reply.structuredContent.entries.length).toBeGreaterThan(0);
    expect(reply.structuredContent.entries[0].url).toMatch(/^https:\/\/mcp\.sw\.example\/rules#/);
  });

  it("advertises the catalogue only when the signing secret is configured", async () => {
    vi.stubEnv("MCP_FIXTURE_ENABLED", "false");
    vi.stubEnv("MCP_CURSOR_HMAC_SECRET", "fictional-test-cursor-secret-with-32-bytes");
    const listing = await POST(request("tools/list"));
    expect((await listing.json()).result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "get_character_sheet_pdf_link", "read_rules", "prepare_portrait_prompt", "find_creations", "preview_character",
    ]);
    expect((await call("find_creations", undefined, { kind: "primitive", query: "ward" })).body.result.isError).toBe(true);
  });

  it("hands off a copyable portrait prompt with read scope, without requiring a saved character", async () => {
    vi.stubEnv("MCP_FIXTURE_ENABLED", "false");
    const listing = await POST(request("tools/list"));
    expect((await listing.json()).result.tools).toContainEqual(expect.objectContaining({
      name: "prepare_portrait_prompt",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPES.read] }] },
    }));
    const token = bearer();
    const input = { name: "Gale Reed", concept: "A storm courier in the flooded marshes.", visualDetails: "A waxed coat and a four-shutter Tidelight." };
    expect((await call("prepare_portrait_prompt", undefined, input)).body.result.isError).toBe(true);
    grant(token, "user_alpha", [MCP_SCOPES.read]);
    const reply = (await call("prepare_portrait_prompt", token, input)).body.result;
    expect(reply.structuredContent.prompt).toContain(input.name);
    expect(reply.structuredContent.prompt).toContain(input.concept);
    expect(reply.structuredContent.prompt).toContain(input.visualDetails);
    expect(reply.structuredContent.prompt).toContain("faceted painted and engraved fantasy style");
    expect(reply.structuredContent.referenceImages.map((reference: { url: string }) => reference.url)).toEqual([
      "https://www.swordweave.quest/images/characters/aster-farwake-graphic-v1.webp",
      "https://www.swordweave.quest/images/lineages/tidekin-graphic-v1.webp",
    ]);
    expect(reply.content[0].text).toContain(reply.structuredContent.referenceImages[0].url);
    expect(reply.structuredContent.nextStep).toContain("new chat with image generation");
    expect(reply.structuredContent).not.toHaveProperty("operationId");
    expect(reply.content[0].text).toContain(reply.structuredContent.prompt);
    const custom = (await call("prepare_portrait_prompt", token, { concept: input.concept, artStyle: "Use watercolor and charcoal." })).body.result;
    expect(custom.structuredContent.prompt).toContain("Use watercolor and charcoal.");
    expect(custom.structuredContent.referenceImages).toEqual([]);
    expect(custom.structuredContent.prompt).not.toContain("faceted painted and engraved");
    expect((await call("prepare_portrait_prompt", token, { ...input, characterId: first })).body.result.isError).toBe(true);
  });

  it("keeps review tools and phase write scopes exclusive to allowlisted staging", async () => {
    vi.stubEnv("MCP_STAGING_REVIEW_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_EDIT_READ_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_EDIT_WRITE_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_PLAY_READ_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_PLAY_WRITE_ENABLED", "true");
    vi.stubEnv("MCP_CURSOR_HMAC_SECRET", "fictional-test-cursor-secret-with-at-least-32-bytes");
    const listing = await POST(request("tools/list"));
    const names = (await listing.json()).result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["prepare_character_save", "apply_character_edit", "apply_play_action"]));
    expect((await metadata().json()).scopes_supported).toContain("swordweave:play");
    vi.stubEnv("MCP_FIXTURE_ENABLED", "false");
    const regular = await POST(request("tools/list"));
    const regularNames = (await regular.json()).result.tools.map((tool: { name: string }) => tool.name);
    expect(regularNames).toContain("preview_character_edit");
    expect(regularNames).not.toContain("apply_play_action");
    expect(regularNames).not.toContain("prepare_character_save");
    expect((await metadata().json()).scopes_supported).toEqual([MCP_SCOPES.read]);
  });
});
