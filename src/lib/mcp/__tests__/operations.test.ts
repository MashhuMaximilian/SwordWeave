import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as approveReviewRequest } from "@/app/api/companion/operations/[operationId]/approve/route";
import { companionOperations, companionOperationSteps } from "@/db/schema";
import { getMcpConfig, getPrivateTestMcpConfig } from "../config";
import { CharacterContextUnavailable } from "../context-shared";
import { digestJson, digestText, operationExpiry, permitsOperation } from "../operation-policy";
import { prepareSessionNote } from "../session-notes";
import { withMcpRequestConfig } from "../request-config";
import {
  approveStagingOperation, executeApprovedOperation, expireCompanionOperations, getApprovedProgressionDocument,
  getOperationReview, getOperationStatus, OperationBlockError, OperationUnavailableError, prepareOperation,
} from "../operations";

const owner = { id: "e5102529-3658-4d92-8574-3d937d10a1ad", clerkId: "user_example_one", scopes: ["swordweave:read", "swordweave:create", "swordweave:play"] };
const other = { ...owner, id: "ad2772f7-d5dd-46af-80d1-16b949a5a628", clerkId: "user_example_two" };
const characterId = "91a1ca1a-677e-434b-8c84-c40f239bdfb9";
const origin = "https://fictional-stage.example";
const env = {
  MCP_RESOURCE_URL: `${origin}/api/mcp`, MCP_CLERK_ISSUER: "https://fictional-clerk.example", MCP_READ_ENABLED: "true", MCP_WRITE_ENABLED: "true",
  MCP_FIXTURE_ENABLED: "true", MCP_FIXTURE_DATABASE_HOST: "fictional-db.example", MCP_FIXTURE_USER_IDS: `${owner.id},${other.id}`,
  CLERK_SECRET_KEY: "sk_test_example", DATABASE_URL: "postgresql://fictional-db.example/sw_companion_test",
  MCP_STAGING_REVIEW_ENABLED: "true", MCP_CHARACTER_PLAY_READ_ENABLED: "true", MCP_CHARACTER_PLAY_WRITE_ENABLED: "true",
};
const operationsFixture = vi.hoisted(() => ({
  database: (): object => { throw new Error("Synthetic database was not initialized"); },
  transaction: vi.fn(),
  resolveMcpActor: vi.fn(),
  characterAccess: vi.fn(),
  browserActor: vi.fn(),
}));
vi.mock("@/db/client", () => ({ db: new Proxy({}, { get: (_, property) => {
  const database = operationsFixture.database();
  const value = Reflect.get(database, property);
  return typeof value === "function" ? value.bind(database) : value;
} }), withDatabaseTransaction: operationsFixture.transaction }));
vi.mock("../auth", () => ({ resolveMcpActor: operationsFixture.resolveMcpActor }));
vi.mock("../browser-approval", () => ({ resolveCompanionBrowserActor: operationsFixture.browserActor }));
vi.mock("../proposal", () => ({ assertPinnedCreationReviewCurrent: vi.fn(), StaleCharacterCreationError: class extends Error {} }));
vi.mock("../play-actions", () => ({ assertPlayReviewCurrent: vi.fn() }));
vi.mock("../context-shared", async importOriginal => ({
  ...await importOriginal<typeof import("../context-shared")>(),
  requireCharacterAccess: operationsFixture.characterAccess,
}));

it("binds nested JSON values independent of key order", () => {
  expect(digestJson({ b: 4, a: ["x", { a: 2, z: 3 }] })).toBe(digestJson({ a: ["x", { z: 3, a: 2 }], b: 4 }));
  expect(digestJson({ a: [1, 2] })).not.toBe(digestJson({ a: [2, 1] }));
});

it("uses the original progression lifetime and distinct character recovery and terminal deadlines", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const pdf = operationExpiry("progression_pdf", "prepare", now);
  expect(pdf.toISOString()).toBe("2026-11-25T13:00:00.000Z");
  expect(operationExpiry("progression_pdf", "approve", new Date(now.getTime() + 500), pdf)).toEqual(pdf);
  expect(operationExpiry("character_create", "approve", now).toISOString()).toBe("2027-02-23T12:00:00.000Z");
  expect(operationExpiry("session_note", "finish", now).toISOString()).toBe("2026-12-25T12:00:00.000Z");
});

it("requires isolated staging as well as a writer, scope, phase controls, and allowlisted linked actor", () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  try {
    const stage = getMcpConfig()!;
    expect(permitsOperation(stage, owner, "character_create", "write", "mcp")).toBe(true);
    expect(permitsOperation(stage, { ...owner, scopes: ["swordweave:read"] }, "character_create", "write", "mcp")).toBe(false);
    expect(permitsOperation(stage, { ...owner, id: characterId }, "character_create", "write", "browser")).toBe(false);
    const publicConfig = getMcpConfig({ ...env, NODE_ENV: "test", MCP_FIXTURE_ENABLED: "false" })!;
    expect(permitsOperation(publicConfig, owner, "character_create", "write", "mcp")).toBe(false);
    vi.stubEnv("MCP_CHARACTER_PLAY_WRITE_ENABLED", "false");
    expect(permitsOperation(stage, owner, "session_note", "write", "mcp")).toBe(false);
    expect(permitsOperation(stage, owner, "session_note", "read", "mcp")).toBe(true);
    vi.stubEnv("MCP_STAGING_REVIEW_ENABLED", "false");
    expect(permitsOperation(stage, owner, "character_create", "write", "browser")).toBe(false);
  } finally { vi.unstubAllEnvs(); }
});

// Supply an absolute path to an installed @electric-sql/pglite for an isolated PostgreSQL fixture.
// This suite cannot use the application's DATABASE_URL or touch real data.
const pglitePath = process.env["SW_COMPANION_PGLITE_PATH"];
type Connection = { query(query: string, params: unknown[], options: {
  rowMode: "array" | "object"; parsers: Record<number, (value: string) => string>;
}): Promise<{ rows: unknown[] }> };
type FixtureClient = Connection & { exec(query: string): Promise<unknown>; close(): Promise<void>;
  transaction<T>(work: (connection: Connection) => Promise<T>): Promise<T> };
type ProxyDatabase = ReturnType<typeof drizzle>;
type Database = Omit<ProxyDatabase, "execute"> & { execute(query: Parameters<ProxyDatabase["execute"]>[0]): Promise<{ rows: unknown[] }> };

function connect(connection: Connection): Database {
  const unchanged = (value: string) => value;
  const adapter = drizzle((query, params, method) => connection.query(query, params, {
    rowMode: method === "all" ? "array" : "object",
    parsers: { 1082: unchanged, 1114: unchanged, 1184: unchanged, 1186: unchanged },
  }));
  return new Proxy(adapter, { get(target, key) {
    if (key === "execute") return async (query: Parameters<ProxyDatabase["execute"]>[0]) => ({ rows: await target.execute(query) });
    const value: unknown = Reflect.get(target, key);
    return typeof value === "function" ? value.bind(target) : value;
  } }) as unknown as Database;
}

describe.skipIf(!pglitePath)("durable save with an in-memory PostgreSQL fixture", () => {
  const scope = new AsyncLocalStorage<Database>();
  let client: FixtureClient;
  let testDb: Database;
  const prepare = (supersedesOperationId?: string) => prepareOperation({ actor: owner, kind: "character_create", subject: { kind: "creation_series" },
    summary: { name: "Wayfarer" }, payload: { name: "Wayfarer", backstory: { history: "**A ferry guide.**" } }, ...(supersedesOperationId ? { supersedesOperationId } : {}) });
  const getConfirmation = async (operationId: string) => {
    const page = await getOperationReview(owner, operationId);
    expect(page.confirmation).not.toBeNull();
    return { operationId, nonce: page.confirmation!.nonce, digest: page.confirmation!.digest, origin };
  };
  const execute = async (operationId: string, callback = vi.fn(async () => {
    await scope.getStore()!.execute(sql`insert into fake_native_results (id) values (${characterId})`);
    return { characterId };
  })) => executeApprovedOperation({ actor: owner, operationId, expectedKind: "character_create", execute: callback });

  beforeAll(async () => {
    const fixture = createRequire(import.meta.url)(pglitePath!) as { PGlite: new () => typeof client };
    client = new fixture.PGlite();
    testDb = connect(client);
    await client.exec("create table users (id uuid primary key); create table characters (id uuid primary key); create table fake_native_results (id uuid primary key)");
    await client.exec(await readFile("src/db/migrations/0077_companion_operations.sql", "utf8"));
    operationsFixture.database = () => scope.getStore() ?? testDb;
    operationsFixture.transaction.mockImplementation((work: (db: Database) => Promise<unknown>) => client.transaction(connection => {
      const transaction = connect(connection);
      return scope.run(transaction, () => work(transaction));
    }));
  }, 12_000);
  beforeEach(async () => {
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    await client.exec(`truncate users, characters, fake_native_results cascade; insert into users (id) values ('${owner.id}'), ('${other.id}'); insert into characters values ('${characterId}')`);
    operationsFixture.resolveMcpActor.mockImplementation(async actor => actor);
    operationsFixture.browserActor.mockResolvedValue(owner);
    operationsFixture.characterAccess.mockImplementation(async (actor) => {
      if (actor.id !== owner.id) throw new CharacterContextUnavailable();
      return { permission: "OWNER" };
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  afterAll(async () => { await client?.close(); });

  it("rotates and consumes the exact nonce and rejects cross-owner, wrong origin, wrong hash, and unapproved execution", async () => {
    const { operationId } = await prepare();
    const first = await getConfirmation(operationId);
    const second = await getConfirmation(operationId);
    expect(first.nonce).not.toEqual(second.nonce);
    await expect(execute(operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    await expect(approveStagingOperation(owner, first)).rejects.toBeInstanceOf(OperationUnavailableError);
    await expect(approveStagingOperation(other, second)).rejects.toBeInstanceOf(OperationUnavailableError);
    await expect(approveStagingOperation(owner, { ...second, origin: "https://fictional-other.example" })).rejects.toBeInstanceOf(OperationUnavailableError);
    await expect(approveStagingOperation(owner, { ...second, digest: "f".repeat(64) })).rejects.toBeInstanceOf(OperationUnavailableError);
    await expect(Promise.all([approveStagingOperation(owner, second), approveStagingOperation(owner, second)])).resolves.toEqual([operationId, operationId]);
    const [operation] = await testDb.select().from(companionOperations);
    expect(operation).toMatchObject({ nonceDigest: null, nonceExpiresAt: null, approvalSource: "staging_browser", status: "approved" });
    expect(await testDb.execute(sql`select * from fake_native_results`)).toMatchObject({ rows: [] });
  });

  it("records one committed result and returns it after a lost or concurrent response", async () => {
    const { operationId } = await prepare();
    await approveStagingOperation(owner, await getConfirmation(operationId));
    const results = await Promise.all([execute(operationId), execute(operationId)]);
    expect(results).toEqual([expect.objectContaining({ state: "completed", receipt: { characterId } }), expect.objectContaining({ state: "completed", receipt: { characterId } })]);
    const callback = vi.fn();
    await expect(execute(operationId, callback)).resolves.toMatchObject({ state: "completed", receipt: { characterId } });
    expect(callback).not.toHaveBeenCalled();
    expect((await testDb.execute(sql`select * from fake_native_results`)).rows).toHaveLength(1);
    expect((await testDb.select().from(companionOperations))[0]?.proposal).toBeNull();
    await expect(getOperationStatus(other, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    operationsFixture.characterAccess.mockRejectedValue(new CharacterContextUnavailable());
    await expect(getOperationStatus(owner, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
  });

  it("requires same-origin approval and ownership for private test writes", async () => {
    vi.stubEnv("MCP_FIXTURE_ENABLED", "false");
    vi.stubEnv("MCP_WRITE_ENABLED", "false");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
    vi.stubEnv("MCP_PRIVATE_TEST_ENABLED", "true");
    vi.stubEnv("MCP_PRIVATE_TEST_USER_IDS", owner.id);
    vi.stubEnv("MCP_PRIVATE_TEST_CLIENT_ID", "client_private_example");
    const config = getPrivateTestMcpConfig()!;
    await withMcpRequestConfig(config, async () => {
      const edit = () => prepareOperation({ actor: owner, kind: "session_note", subject: { kind: "character", characterId }, summary: {}, payload: {} });
      const { operationId } = await prepare();
      const confirmation = await getConfirmation(operationId);
      await expect(execute(operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
      await expect(approveStagingOperation(other, confirmation)).rejects.toBeInstanceOf(OperationUnavailableError);
      await expect(approveStagingOperation(owner, { ...confirmation, origin: "null" })).rejects.toBeInstanceOf(OperationUnavailableError);
      await approveStagingOperation(owner, confirmation);
      const [approved] = await testDb.select().from(companionOperations);
      expect(approved).toMatchObject({ approvalSource: "private_test_browser", status: "approved" });
      await expect(execute(operationId)).resolves.toMatchObject({ state: "completed", receipt: { characterId } });
      await expect(edit()).resolves.toHaveProperty("approvalUrl");
      operationsFixture.characterAccess.mockResolvedValue({ permission: "EDITOR" });
      await expect(edit()).rejects.toBeInstanceOf(OperationUnavailableError);
    });
  });

  it("serves a private 303 only after an authenticated same-origin form approval", async () => {
    const { operationId } = await prepare();
    const { nonce, digest } = await getConfirmation(operationId);
    const sendForm = (formOrigin: string, formOperationId = operationId) => approveReviewRequest(new Request(`${origin}/api/companion/operations/${operationId}/approve`, {
      method: "POST", headers: { Origin: formOrigin }, body: new URLSearchParams({ operationId: formOperationId, nonce, digest }),
    }), { params: Promise.resolve({ operationId }) });
    expect((await sendForm("https://fictional-attacker.example")).status).toBe(404);
    expect((await sendForm(origin, characterId)).status).toBe(404);
    operationsFixture.browserActor.mockResolvedValue(null);
    expect((await sendForm(origin)).status).toBe(404);
    operationsFixture.browserActor.mockResolvedValue(owner);
    const response = await sendForm(origin);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/companion/review/${operationId}`);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await getOperationStatus(owner, operationId)).state).toBe("approved");
  });

  it("replaces only the specified earlier draft and invalidates its review", async () => {
    const { operationId } = await prepare();
    const confirmation = await getConfirmation(operationId);
    const replacement = await prepare(operationId);
    await expect(approveStagingOperation(owner, confirmation)).rejects.toBeInstanceOf(OperationUnavailableError);
    await expect(getOperationStatus(owner, operationId)).resolves.toMatchObject({ state: "superseded", supersededBy: replacement.operationId });
    await expect(prepare(operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    const [first] = await testDb.select().from(companionOperations).where(eq(companionOperations.id, operationId));
    const [second] = await testDb.select().from(companionOperations).where(eq(companionOperations.id, replacement.operationId));
    expect(first?.subjectId).toEqual(second?.subjectId);
    expect(first).toMatchObject({ nonceDigest: null, proposal: null });
  });

  it("rolls back writes on interruption or stale review, retaining only the appropriate status", async () => {
    const { operationId } = await prepare();
    await approveStagingOperation(owner, await getConfirmation(operationId));
    const interrupt = (error: Error) => vi.fn(async () => {
      await scope.getStore()!.execute(sql`insert into fake_native_results (id) values (${characterId})`);
      throw error;
    });
    await expect(execute(operationId, interrupt(new Error("synthetic interruption")))).rejects.toThrow("synthetic interruption");
    expect(await getOperationStatus(owner, operationId)).toMatchObject({ state: "approved" });
    expect((await testDb.execute(sql`select * from fake_native_results`)).rows).toHaveLength(0);
    await expect(execute(operationId, interrupt(new OperationBlockError("STALE_REVIEW")))).resolves.toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
    expect((await testDb.execute(sql`select * from fake_native_results`)).rows).toHaveLength(0);
    expect((await testDb.select().from(companionOperations))[0]?.proposal).toBeNull();
  });

  it("keeps a committed step when a later step is blocked and never rewrites the earlier result", async () => {
    const { operationId } = await prepareOperation({ actor: owner, kind: "character_create", subject: { kind: "creation_series" },
      summary: {}, payload: {}, steps: ["effect", "character"] });
    await approveStagingOperation(owner, await getConfirmation(operationId));
    const first = (await getOperationStatus(owner, operationId)).nextStep!.stepId;
    const args = { actor: owner, operationId, expectedKind: "character_create" } as const;
    const started = await executeApprovedOperation({ ...args, stepId: first, execute: async () => {
      await scope.getStore()!.execute(sql`insert into fake_native_results (id) values (${characterId})`);
      return { entityKind: "effect", entityId: other.id };
    } });
    expect(started).toMatchObject({ state: "approved", nextStep: { kind: "character" } });
    await expect(prepare(operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    const retry = vi.fn();
    await executeApprovedOperation({ ...args, stepId: first, execute: retry });
    expect(retry).not.toHaveBeenCalled();
    const blocked = await executeApprovedOperation({ ...args, stepId: started.nextStep!.stepId, execute: async () => {
      await scope.getStore()!.execute(sql`insert into fake_native_results (id) values (${other.id})`);
      throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
    } });
    expect(blocked).toMatchObject({ state: "blocked", failureCode: "DEPENDENCY_UNAVAILABLE", nextStep: null });
    expect((await testDb.select().from(companionOperationSteps)).map(step => step.status).sort()).toEqual(["blocked", "committed"]);
    expect((await testDb.execute(sql`select * from fake_native_results`)).rows).toEqual([{ id: characterId }]);
  });

  it("rechecks character permission before entering a previously approved writer", async () => {
    operationsFixture.characterAccess.mockResolvedValue({ permission: "OWNER",
      character: { id: characterId, name: "Wayfarer", notes: "An existing **watch report**." } });
    const { operationId } = await prepareSessionNote(owner, { characterId, text: "**Add this.**" });
    await approveStagingOperation(owner, await getConfirmation(operationId));
    operationsFixture.characterAccess.mockResolvedValue({ permission: "VIEWER" });
    const callback = vi.fn();
    await expect(executeApprovedOperation({ actor: owner, operationId, expectedKind: "session_note", execute: callback })).rejects.toBeInstanceOf(OperationUnavailableError);
    expect(callback).not.toHaveBeenCalled();
    await expect(getOperationStatus(owner, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    expect((await testDb.select().from(companionOperations))[0]?.status).toBe("approved");
    operationsFixture.characterAccess.mockRejectedValue(new CharacterContextUnavailable());
    await expect(getOperationStatus(owner, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
  });

  it("rechecks the immutable review, original PDF deadline, owner and retention in the database", async () => {
    const { operationId } = await prepareOperation({ actor: owner, kind: "progression_pdf", subject: { kind: "progression_series" },
      summary: {}, payload: {}, document: { title: " Lantern ", ideas: [" **Learn** a new song. "] } });
    const confirmation = await getConfirmation(operationId);
    expect(await getOperationReview(owner, operationId)).toMatchObject({ confirmation: { document: { title: "Lantern", ideas: ["**Learn** a new song."] } } });
    await expect(getApprovedProgressionDocument(owner, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    const newest = await getConfirmation(operationId);
    expect(confirmation.digest).toBe(newest.digest);
    await approveStagingOperation(owner, newest);
    await expect(getApprovedProgressionDocument(other, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    expect(await getApprovedProgressionDocument(owner, operationId)).toEqual({ title: "Lantern", ideas: ["**Learn** a new song."] });
    await testDb.execute(sql`update companion_progression_documents set digest = ${digestText("tampered")}`);
    await expect(getApprovedProgressionDocument(owner, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
    await testDb.execute(sql`insert into fake_native_results (id) values (${characterId})`);
    vi.setSystemTime(new Date("2026-11-25T13:00:00Z"));
    expect(await expireCompanionOperations()).toBe(1);
    expect((await testDb.execute(sql`select * from companion_progression_documents`)).rows).toHaveLength(0);
    expect((await testDb.execute(sql`select * from fake_native_results`)).rows).toHaveLength(1);
  });
});
