import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { DELETE as revokeShare } from "@/app/api/characters/[id]/shares/[shareId]/route";
import { POST as setVisibility } from "@/app/api/creations/visibility/route";
import { followUser, isFollowing, unfollowUser } from "@/lib/engagement/follows-service";
import { unpublishTarget } from "@/lib/publishing/publish-service";
import { approveStagingOperation, executeApprovedOperation, getOperationReview, getOperationStatus, OperationBlockError, OperationUnavailableError, prepareOperation } from "../operations";
import { prepareProgressionNote, saveProgressionNote } from "../progression-note";
import { preparePinnedCharacterCreation, persistApprovedPinnedCharacterCreation, StaleCharacterCreationError, type DraftV1, type PinnedCharacterCreation } from "../proposal";

type Database = ReturnType<typeof drizzle<typeof schema>>;
type QueryResult = { rows: unknown[] };
type Connection = {
  query(query: string | { text: string; values: unknown[]; rowMode: string; types: object }): Promise<QueryResult>;
};
type Client = Connection & { release(): void };
type Pool = Connection & { connect(): Promise<Client>; end(): Promise<void> };
type PgDriver = {
  Pool: new (options: Record<string, string | number>) => Pool;
  types: { getTypeParser(oid: number, format: "text" | "binary"): (value: string) => unknown };
};

const fixture = vi.hoisted(() => ({
  database: vi.fn<() => Database>(),
  transaction: vi.fn(),
  clerk: vi.fn(),
}));
vi.mock("@/db/client", () => ({
  db: new Proxy({}, { get: (_, key) => {
    const db = fixture.database();
    if (key === "execute") return async (statement: Parameters<Database["execute"]>[0]) => ({ rows: await db.execute(statement) });
    const value = Reflect.get(db, key);
    return typeof value === "function" ? value.bind(db) : value;
  } }),
  getDb: fixture.database,
  withDatabaseTransaction: fixture.transaction,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: Object.assign(fixture.clerk, { protect: fixture.clerk }) }));

const socket = process.env["SW_COMPANION_POSTGRES_SOCKET"];
const driverPath = process.env["SW_COMPANION_POSTGRES_DRIVER"];
const port = Number(process.env["SW_COMPANION_POSTGRES_PORT"] ?? 54986);
const origin = "https://fictional-companion.example";
const actor = { id: "b0000000-0000-4000-8000-000000000001", clerkId: "user_fiction_starter", scopes: ["swordweave:read", "swordweave:create"] };
const author = { id: "b0000000-0000-4000-8000-000000000002", clerkId: "user_fiction_author" };
const relation = { followerUserId: actor.id, followingUserId: author.id };
const ids = { verb: 9011, domain: 9012, die: 9013, range: 32 };
const pin = (id: number) => ({
  kind: "primitive" as const, id: String(id), versionId: `a0000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
});
const initialPrimitives = [
  { id: ids.verb, category: "VERB_TIER", name: "Verb Tier III", buCost: 8, userId: actor.clerkId, isPublic: false },
  { id: ids.domain, category: "DOMAIN", name: "Storm", buCost: 4, userId: author.clerkId, isPublic: true },
  { id: ids.die, category: "INTENSITY_DICE", name: "Heavy Die Block (d8)", buCost: 4, userId: null, isPublic: true },
  { id: ids.range, category: "RANGE", name: "Touch Range", buCost: 0, userId: null, isPublic: true, sourceOrigin: "SRD" },
] as const;
const draft: DraftV1 = {
  schemaVersion: 1, name: "Courier", attributes: { physical: 4, mental: 3, magical: 3 },
  pieces: [ids.verb, ids.domain, ids.die].map(id => ({ key: `p${id}`, action: "reuse", pin: pin(id) })),
  placements: [ids.verb, ids.domain, ids.die].map(id => ({ pieceKey: `p${id}`, source: "PERSONAL" })),
};

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

// A dedicated Unix-socket-only cluster is required. Each run creates a randomly
// named database, and the application's DATABASE_URL is never used by this suite.
describe.skipIf(!socket || !driverPath)("real PostgreSQL companion lock ordering", () => {
  const databaseName = `sw_companion_lock_${randomUUID().replaceAll("-", "")}`;
  const scope = new AsyncLocalStorage<Database>();
  let maintenance: Pool;
  let pool: Pool;
  let db: Database;
  let publicationId: string;
  let createdDatabase = false;

  beforeAll(async () => {
    if (!socket || !driverPath || !isAbsolute(socket) || !isAbsolute(driverPath) || !basename(dirname(socket)).startsWith("sw-pg-lock.") ||
      !statSync(socket).isDirectory() || (statSync(socket).mode & 0o077) !== 0 || !Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error("The lock fixture needs a private Unix socket in a temporary sw-pg-lock directory.");
    }
    const pg = createRequire(import.meta.url)(driverPath) as PgDriver;
    const connection = { host: socket, port, user: "sw_lock_fixture", connectionTimeoutMillis: 3000, statement_timeout: 8000 };
    maintenance = new pg.Pool({ ...connection, database: "postgres" });
    await maintenance.query(`create database ${databaseName}`);
    createdDatabase = true;
    pool = new pg.Pool({ ...connection, database: databaseName, max: 4 });
    function bind(client: Connection) {
      return drizzle((text, values, method) => client.query({ text, values, rowMode: method === "all" ? "array" : "object",
        types: { getTypeParser: (oid: number, format: "text" | "binary") => [1082, 1114, 1184, 1186].includes(oid) ?
          (value: string) => value : pg.types.getTypeParser(oid, format) },
      }), { schema });
    }
    db = bind(pool);
    fixture.database.mockImplementation(() => scope.getStore() ?? db);
    fixture.transaction.mockImplementation(async (work: (transaction: Database) => Promise<unknown>) => {
      const active = scope.getStore();
      if (active) return work(active);
      const client = await pool.connect();
      try {
        await client.query("begin");
        const transaction = bind(client);
        const result = await scope.run(transaction, () => work(transaction));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    });

    const output = mkdtempSync(join(tmpdir(), "sw-companion-lock-schema-"));
    try {
      execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "generate", "--dialect=postgresql",
        "--schema=./src/db/schema/index.ts", `--out=${output}`], { stdio: "pipe" });
      const file = readdirSync(output).find(name => name.endsWith(".sql"));
      if (!file) throw new Error("Drizzle generated no fixture schema.");
      await pool.query(readFileSync(join(output, file), "utf8"));
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
    await db.insert(schema.users).values([{ id: actor.id, clerkUserId: actor.clerkId, username: "starter" }, { id: author.id, clerkUserId: author.clerkId, username: "author" }]);
    await db.insert(schema.primitives).values(initialPrimitives.map(row => ({ ...row })));
    await db.insert(schema.primitiveVersions).values(initialPrimitives.map(row => ({
      id: pin(row.id).versionId, primitiveId: row.id, versionNumber: 1, isLatest: true, deltaKind: "FULL" as const,
      snapshot: { name: row.name, category: row.category, buCost: row.buCost, mechanicalOutputText: "", hardModifiers: [] },
    })));
    const [publication] = await db.insert(schema.publications).values({ targetType: "PRIMITIVE", targetId: String(ids.domain),
      versionId: pin(ids.domain).versionId, versionNumber: 1, authorId: author.id, visibility: "FOLLOWERS_ONLY" }).returning({ id: schema.publications.id });
    publicationId = publication!.id;
  }, 30_000);

  beforeEach(async () => {
    const env = {
      MCP_RESOURCE_URL: `${origin}/api/mcp`, MCP_CLERK_ISSUER: "https://fictional-clerk.example",
      MCP_READ_ENABLED: "true", MCP_WRITE_ENABLED: "true", MCP_FIXTURE_ENABLED: "true", MCP_STAGING_REVIEW_ENABLED: "true",
      MCP_FIXTURE_DATABASE_HOST: "fictional-db.example", MCP_FIXTURE_USER_IDS: `${actor.id},${author.id}`,
      CLERK_SECRET_KEY: "sk_test_fictional_sw_lock", DATABASE_URL: "postgresql://fictional-db.example/sw_companion_test",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    fixture.clerk.mockResolvedValue({ userId: author.clerkId });
    await db.delete(schema.companionOperations);
    await db.delete(schema.characters);
    await followUser(relation);
    await db.update(schema.publications).set({ unpublishedAt: null, visibility: "FOLLOWERS_ONLY" }).where(eq(schema.publications.id, publicationId));
    await db.update(schema.primitives).set({ isPublic: true }).where(eq(schema.primitives.id, ids.domain));
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    await pool?.end();
    if (createdDatabase) await maintenance.query(`drop database ${databaseName}`);
    await maintenance?.end();
  });

  async function approval() {
    const { preview, prepared } = await preparePinnedCharacterCreation(draft, actor);
    expect(prepared, JSON.stringify(preview.validationErrors)).not.toBeNull();
    const { operationId } = await prepareOperation({ actor, kind: "character_create", subject: { kind: "creation_series" }, summary: preview, payload: prepared });
    await approve(operationId);
    return operationId;
  }

  async function approve(operationId: string) {
    const review = await getOperationReview(actor, operationId);
    expect(review.confirmation).not.toBeNull();
    await approveStagingOperation(actor, { operationId, origin, nonce: review.confirmation!.nonce, digest: review.confirmation!.digest });
  }

  function execute(operationId: string, beforeCommit?: () => Promise<void>) {
    return executeApprovedOperation({ actor, operationId, expectedKind: "character_create", execute: async ({ payload }) => {
      try {
        const result = await persistApprovedPinnedCharacterCreation(payload as PinnedCharacterCreation, actor);
        await beforeCommit?.();
        return result;
      } catch (error) {
        if (error instanceof StaleCharacterCreationError) throw new OperationBlockError("STALE_REVIEW");
        throw error;
      }
    } });
  }

  async function waitForDatabaseLock(waitEvent: "advisory" | "row") {
    const events = waitEvent === "advisory" ? "'advisory'" : "'transactionid', 'tuple'";
    await expect.poll(async () => (await pool.query(`select pid from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock' and wait_event in (${events})
        and cardinality(pg_blocking_pids(pid)) > 0`)).rows.length, { timeout: 4000 }).toBe(1);
  }

  async function revoke(mode: "follow" | "publication" | "visibility") {
    if (mode === "follow") return void await unfollowUser(relation);
    if (mode === "publication") return unpublishTarget(publicationId, author.id);
    const response = await setVisibility(new NextRequest(`${origin}/api/creations/visibility`, { method: "POST",
      body: JSON.stringify({ targetType: "PRIMITIVE", targetId: String(ids.domain), visibility: "PRIVATE" }) }));
    expect(response.status).toBe(200);
  }

  it.each(["follow", "publication", "visibility"] as const)("rejects a queued creation after %s access is revoked", async (mode) => {
    const operationId = await approval();
    const changed = barrier();
    const release = barrier();
    const revocation = fixture.transaction(async () => {
      await revoke(mode);
      changed.resolve();
      await release.promise;
    }) as Promise<void>;
    let save: ReturnType<typeof execute> | undefined;
    try {
      await Promise.race([changed.promise, revocation]);
      save = execute(operationId);
      await waitForDatabaseLock("advisory");
    } finally {
      release.resolve();
      await Promise.allSettled([revocation, save]);
    }
    await revocation;
    await expect(save).resolves.toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW", receipt: null });
    expect(await db.select().from(schema.characters)).toEqual([]);
  }, 15_000);

  it.each(["follow", "publication", "visibility"] as const)("commits a queued %s revocation after the approved save and receipt", async (mode) => {
    const operationId = await approval();
    const written = barrier();
    const release = barrier();
    const save = execute(operationId, async () => { written.resolve(); await release.promise; });
    let revocation: Promise<void> | undefined;
    try {
      await Promise.race([written.promise, save]);
      revocation = revoke(mode);
      await waitForDatabaseLock("advisory");
      expect(await db.select().from(schema.characters)).toEqual([]);
    } finally {
      release.resolve();
      await Promise.allSettled([save, revocation]);
    }
    await revocation;
    const result = await save;
    expect(result).toMatchObject({ state: "completed", receipt: { characterId: expect.any(String) } });
    expect(await db.select().from(schema.characters)).toMatchObject([{ isPublic: false, userId: actor.clerkId }]);
    if (mode === "follow") expect(await isFollowing(actor.id, author.id)).toBe(false);
    else expect((await db.select().from(schema.publications)).find(row => row.id === publicationId)?.unpublishedAt).toBeInstanceOf(Date);
    if (mode === "visibility") expect((await db.select().from(schema.primitives)).find(row => row.id === ids.domain)?.isPublic).toBe(false);
    await expect(execute(operationId)).resolves.toMatchObject({ state: "completed", receipt: result.receipt });
  }, 15_000);

  const originalNotes = "**Original notes**  \n";
  const addedNotes = "\n## Progression plan: Choose a direction\n\n- First fictional entry\n- **Second fictional entry**";

  async function sharedNoteApproval() {
    const [character] = await db.insert(schema.characters).values({ userId: author.clerkId, name: "Shared Courier", notes: originalNotes,
      attrPhysical: 4, attrMental: 3, attrMagical: 3 }).returning();
    const characterId = character!.id;
    const [share] = await db.insert(schema.characterShares).values({ characterId, sharedWithUserId: actor.id,
      sharedByUserId: author.clerkId, canEdit: true }).returning();
    const { operationId: documentId } = await prepareOperation({ actor, kind: "progression_pdf", subject: { kind: "progression_series" },
      summary: {}, payload: {}, document: { title: "Choose a direction", ideas: ["- First fictional entry\n- **Second fictional entry**"] } });
    await approve(documentId);
    const { operationId } = await prepareProgressionNote(actor, { characterId, documentId });
    await approve(operationId);
    return { characterId, shareId: share!.id, operationId };
  }

  async function revokeCharacterShare(characterId: string, shareId: string) {
    const response = await revokeShare(new NextRequest(`${origin}/api/characters/${characterId}/shares/${shareId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: characterId, shareId }) });
    expect(response.status).toBe(200);
  }

  it("denies a queued note save after the website revokes its editor share", async () => {
    const { operationId, characterId, shareId } = await sharedNoteApproval();
    const changed = barrier();
    const release = barrier();
    const revocation = fixture.transaction(async () => {
      await revokeCharacterShare(characterId, shareId);
      changed.resolve();
      await release.promise;
    }) as Promise<void>;
    let save: ReturnType<typeof saveProgressionNote> | undefined;
    try {
      await Promise.race([changed.promise, revocation]);
      save = saveProgressionNote(actor, operationId);
      await waitForDatabaseLock("row");
    } finally {
      release.resolve();
      await Promise.allSettled([revocation, save]);
    }
    await revocation;
    await expect(save).rejects.toBeInstanceOf(OperationUnavailableError);
    expect((await db.select().from(schema.characters))[0]?.notes).toBe(originalNotes);
    expect((await db.select().from(schema.companionOperations).where(eq(schema.companionOperations.id, operationId)))[0])
      .toMatchObject({ status: "approved", terminalReceipt: null });
  }, 15_000);

  it("commits an approved note before a queued share revocation and then denies receipt access", async () => {
    const { operationId, characterId, shareId } = await sharedNoteApproval();
    const originalTransaction = fixture.transaction.getMockImplementation()!;
    const written = barrier();
    const release = barrier();
    fixture.transaction.mockImplementationOnce((work: (transaction: Database) => Promise<unknown>) => originalTransaction(async (transaction: Database) => {
      const result = await work(transaction);
      written.resolve();
      await release.promise;
      return result;
    }));
    const save = saveProgressionNote(actor, operationId);
    let revocation: Promise<void> | undefined;
    try {
      await Promise.race([written.promise, save]);
      revocation = revokeCharacterShare(characterId, shareId);
      await waitForDatabaseLock("row");
      expect((await db.select().from(schema.characters))[0]?.notes).toBe(originalNotes);
    } finally {
      release.resolve();
      const [result] = await Promise.allSettled([save, revocation]);
      if (result?.status === "rejected") expect(result.reason).toBeInstanceOf(OperationUnavailableError);
    }
    await revocation;
    expect((await db.select().from(schema.characters))[0]?.notes).toBe(originalNotes + addedNotes);
    expect((await db.select().from(schema.characterWorkspaceState))[0]?.revision).toBe(1);
    expect((await db.select().from(schema.companionOperations).where(eq(schema.companionOperations.id, operationId)))[0])
      .toMatchObject({ status: "completed", terminalReceipt: { receipt: { characterId, appliedRevision: 1 } } });
    await expect(getOperationStatus(actor, operationId)).rejects.toBeInstanceOf(OperationUnavailableError);
  }, 15_000);

  it("checks native ownership on the first visibility change", async () => {
    const [row] = await db.insert(schema.primitives).values({ name: "Unpublished test primitive", category: "DOMAIN", userId: author.clerkId, isPublic: false })
      .returning({ id: schema.primitives.id });
    const targetId = String(row!.id);
    const request = () => new NextRequest(`${origin}/api/creations/visibility`, { method: "POST",
      body: JSON.stringify({ targetType: "PRIMITIVE", targetId, visibility: "PUBLIC" }) });
    fixture.clerk.mockResolvedValue({ userId: actor.clerkId });
    expect((await setVisibility(request())).status).toBe(404);
    expect((await db.select().from(schema.primitives).where(eq(schema.primitives.id, row!.id)))[0]?.isPublic).toBe(false);
    expect(await db.select().from(schema.publications).where(eq(schema.publications.targetId, targetId))).toEqual([]);
    fixture.clerk.mockResolvedValue({ userId: author.clerkId });
    expect((await setVisibility(request())).status).toBe(200);
    expect((await db.select().from(schema.primitives).where(eq(schema.primitives.id, row!.id)))[0]?.isPublic).toBe(true);
    expect((await db.select().from(schema.publications).where(eq(schema.publications.targetId, targetId)))[0]?.visibility).toBe("PUBLIC");
  });
});
