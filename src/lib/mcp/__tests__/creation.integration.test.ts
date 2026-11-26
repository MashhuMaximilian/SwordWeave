import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { drizzle } from "drizzle-orm/pg-proxy";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { characterPrimitives, characters, follows, primitives, primitiveMarketClassifications, primitiveVersions, publications, users } from "@/db/schema";
import { loadWorkspaceNodes } from "@/lib/character/workspace/load-nodes";
import { resolvePinnedNode } from "@/lib/character/workspace/pinned-versions";
import { readWorkspace } from "@/lib/character/workspace/read";
import { _dryRunRecomputeBuSpent } from "@/lib/engine/recompute-bu-spent";
import { MARKET_FAMILIES } from "@/lib/primitives/canonical-market";
import { getForkSource } from "@/lib/publishing/fork-lineage";
import { and, eq } from "drizzle-orm";
import { findCreations } from "../catalogue";
import { applyApprovedAdvancement, prepareCharacterAdvancement } from "../character-advancement";
import { readCharacterBuild } from "../character-context";
import { prepareCharacterPrimitive, primitiveSnapshotDigest } from "../creation-authoring";
import { getMcpConfig } from "../config";
import { createSwordWeaveMcpServer } from "../server";
import { assertPinnedCreationReviewCurrent, CharacterCapabilityConflictError, CharacterPrimitiveConflictError, creationStepKinds, preparePinnedCharacterCreation,
  performPinnedCharacterCreationStep, persistApprovedPinnedCharacterCreation, StaleCharacterCreationError, type DraftV1 } from "../proposal";
import { approveStagingOperation, executeApprovedOperation, getOperationReview, getOperationStatus, OperationBlockError, prepareOperation } from "../operations";
import { POST as callMcp } from "@/app/api/mcp/route";
import { POST as approveBrowserReview } from "@/app/api/companion/operations/[operationId]/approve/route";
import { GET as downloadCompanionSheet } from "@/app/api/companion/characters/[id]/sheet-pdf/route";
import { POST as downloadWebsiteSheet } from "@/app/api/characters/[id]/pdf/route";
import { POST as levelUpWebsiteCharacter } from "@/app/api/characters/[id]/level-up/route";
import { GET as listWebsiteCompanions } from "@/app/api/characters/[id]/companions/route";
import { PUT as saveWebsiteDraft, POST as decideWebsiteDraft, DELETE as discardWebsiteDraft } from "@/app/api/characters/[id]/workspace/draft/route";
import { GET as readBestiaryEntry } from "@/app/api/monsters/[id]/route";
import { GET as readWebsitePlayCopy, PATCH as changeWebsitePlayCopy, DELETE as deleteWebsitePlayCopy } from "@/app/api/monsters/copies/[id]/route";
import { createMonster, publishMonster } from "@/lib/monsters/service";
import type { listCharacterCompanionLinks } from "../character-companions";

type Database = ReturnType<typeof drizzle<typeof schema>>;
type Connection = {
  query(query: string, parameters: unknown[], options: {
    rowMode: "array" | "object";
    parsers: Record<number, (value: string) => string>;
  }): Promise<{ rows: unknown[] }>;
};
type MemoryDatabase = Connection & {
  exec(query: string): Promise<unknown>;
  close(): Promise<void>;
  transaction<T>(work: (connection: Connection) => Promise<T>): Promise<T>;
};

const state = vi.hoisted(() => ({
  database: vi.fn<() => Database>(),
  transaction: vi.fn(),
  clerkClient: vi.fn(),
  browserSession: vi.fn(),
  protectBrowserSession: vi.fn(),
}));
const creationTestScope = new AsyncLocalStorage<Database>();
vi.mock("@clerk/nextjs/server", async importOriginal => ({
  ...await importOriginal<typeof import("@clerk/nextjs/server")>(),
  clerkClient: state.clerkClient,
  auth: Object.assign(state.browserSession, { protect: state.protectBrowserSession }),
}));
vi.mock("@/db/client", () => ({
  db: new Proxy({}, { get: (_, key) => {
    const db = state.database();
    if (key === "execute") return async (statement: Parameters<Database["execute"]>[0]) => ({ rows: await db.execute(statement) });
    if (key === "transaction") return state.transaction;
    const value = Reflect.get(db, key);
    return typeof value === "function" ? value.bind(db) : value;
  }}),
  getDb: () => new Proxy(state.database(), { get(db, key) {
    if (key === "transaction") return state.transaction;
    const value = Reflect.get(db, key);
    return typeof value === "function" ? value.bind(db) : value;
  } }),
  withExistingTransaction: <T,>(db: Database, work: () => Promise<T>) => creationTestScope.run(db, work),
  withDatabaseTransaction: state.transaction,
}));

// The optional fixture constructs its own in-memory database. No application URL is read.
const pglitePath = process.env["SW_COMPANION_PGLITE_PATH"];
const pdfPython = process.env["SW_COMPANION_NATIVE_PDF_PYTHON"];
function connect(connection: Connection) {
  const unchanged = (value: string) => value;
  return drizzle((query, parameters, method) => connection.query(query, parameters, {
    rowMode: method === "all" ? "array" : "object",
    parsers: { 1082: unchanged, 1114: unchanged, 1184: unchanged, 1186: unchanged },
  }), { schema });
}

const actor = { id: "b0000000-0000-4000-8000-000000000001", clerkId: "user_fiction_starter" };
const author = { id: "b0000000-0000-4000-8000-000000000002", clerkId: "user_fiction_author" };
const ids = { verb: 9011, domain: 9012, die: 9013, count: 9014, range: 32, minor: 19 };
const pin = (id: number, rev = 1) => ({
  kind: "primitive" as const, id: String(id),
  versionId: `a0000000-0000-4000-8000-${String(id * 10 + rev).padStart(12, "0")}`,
});
const opts = { resource: "https://mcp.example/api/mcp", cursorSecret: "fictional-creation-evidence-secret" };
const catalog = [
  { id: ids.verb, category: "VERB_TIER", name: "Verb Tier III", buCost: 8, userId: actor.clerkId, isPublic: false },
  { id: ids.domain, category: "DOMAIN", name: "Storm", buCost: 4, userId: author.clerkId, isPublic: true },
  { id: ids.die, category: "INTENSITY_DICE", name: "Heavy Die Block (d8)", buCost: 4, userId: null, isPublic: true },
  { id: ids.count, category: "OUTPUT", name: "Extra dice count", buCost: 2, userId: null, isPublic: true },
  { id: ids.range, category: "RANGE", name: "Touch Range", buCost: 0, userId: null, isPublic: true, sourceOrigin: "SRD" },
  { id: ids.minor, category: "INTENSITY_DICE", name: "Minor Die Block", buCost: 0, userId: null, isPublic: true, sourceOrigin: "SRD" },
] as const;

const mechanics = (row: (typeof catalog)[number]) => row.id === ids.die
  ? { family: "DICE", bindings: { dice: "1d8" } } : row.id === ids.minor ? { family: "DICE", bindings: { dice: "1d4" } } : {};
const snapshot = (row: (typeof catalog)[number]) => ({
  name: row.name, category: row.category, buCost: row.buCost, mechanicalRule: mechanics(row),
  mechanicalOutputText: "", hardModifiers: [],
});

describe.skipIf(!pglitePath)("isolated starter build database", () => {
  let client: MemoryDatabase;
  let db: Database;

  beforeAll(async () => {
    const fixture = createRequire(import.meta.url)(pglitePath!) as { PGlite: new () => MemoryDatabase };
    client = new fixture.PGlite();
    db = connect(client);
    state.database.mockImplementation(() => creationTestScope.getStore() ?? db);
    state.transaction.mockImplementation((work: (tx: Database) => Promise<unknown>) => {
      const active = creationTestScope.getStore();
      if (active) return work(active);
      return client.transaction(connection => {
        const tx = connect(connection);
        return creationTestScope.run(tx, () => work(tx));
      });
    });

    const outputDirectory = mkdtempSync(join(tmpdir(), "sw-companion-test-schema-"));
    try {
      execFileSync(process.execPath, [
        "node_modules/drizzle-kit/bin.cjs", "generate", "--dialect=postgresql",
        "--schema=./src/db/schema/index.ts", `--out=${outputDirectory}`,
      ], { stdio: "pipe" });
      const schemaFile = readdirSync(outputDirectory).find(name => name.endsWith(".sql"));
      if (!schemaFile) throw new Error("Drizzle generated no fixture schema.");
      await client.exec(readFileSync(join(outputDirectory, schemaFile), "utf8"));
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
    await db.insert(users).values([{ id: actor.id, clerkUserId: actor.clerkId, username: "starter" }, { id: author.id, clerkUserId: author.clerkId, username: "author" }]);
    await db.insert(schema.lexiconFamilies).values(MARKET_FAMILIES.map(({ key, label, chapter, chapterOrder, familyOrder }) => ({
      key, label, chapter, chapterOrder, familyOrder,
    })));
    await db.insert(primitives).values(catalog.map(row => ({ ...row, mechanicalRule: mechanics(row) })));
    // Keep generated IDs above the manually numbered catalogue rows used by these cases.
    // PostgreSQL sequences also advance during rolled-back authoring previews.
    await client.exec("select setval(pg_get_serial_sequence('primitives', 'id'), 1000000)");
    await db.insert(primitiveVersions).values(catalog.map(row => ({
      id: pin(row.id).versionId, primitiveId: row.id, versionNumber: 1, isLatest: true, deltaKind: "FULL" as const, snapshot: snapshot(row),
    })));
    await db.insert(publications).values({ targetType: "PRIMITIVE", targetId: String(ids.domain), versionId: pin(ids.domain).versionId, versionNumber: 1, authorId: author.id, visibility: "FOLLOWERS_ONLY" });
  }, 60000);

  afterAll(async () => { await client?.close(); });

  function draft(selected: number[]): DraftV1 {
    return {
      schemaVersion: 1, name: "Courier", attributes: { physical: 4, mental: 3, magical: 3 },
      backstory: { description: "**Courier**\n\n- Waystones  \n- Weather" },
      pieces: selected.map(id => ({ key: `p${id}`, action: "reuse", pin: pin(id) })),
      placements: selected.map(id => ({ pieceKey: `p${id}`, source: "PERSONAL" })),
    };
  }

  it("checks native permissions, four-part readiness, exact pins, authored Markdown and stale approval", async () => {
    expect((await findCreations({ kind: "primitive", query: "Storm" }, actor, opts)).items).toEqual([]);
    const input = draft([ids.verb, ids.domain, ids.die]);
    expect((await preparePinnedCharacterCreation(input, actor)).prepared).toBeNull();
    await db.insert(follows).values({ followerId: actor.id, followingId: author.id });
    expect((await findCreations({ kind: "primitive", query: "Storm" }, actor, opts)).items[0]?.pin).toEqual(pin(ids.domain));

    const { preview, prepared } = await preparePinnedCharacterCreation(input, actor);
    expect(preview.validationErrors).toEqual([]);
    expect(preview.missing).toEqual([]);
    expect(preview.normalized.startingAccess).toEqual({ verbTier: "selected", domain: "selected", range: "freeBaseline", dieType: "selected" });
    expect(preview.budget).toMatchObject({ positiveSpent: 16, mirrorCredit: 0 });
    expect(prepared).not.toBeNull();
    expect(await db.select().from(characters)).toHaveLength(0);
    const { characterId } = await persistApprovedPinnedCharacterCreation(prepared!, actor);
    const [sheet] = await db.select().from(characters).where(eq(characters.id, characterId));
    expect(sheet).toMatchObject({ name: "Courier", userId: actor.clerkId, isPublic: false, buSpent: 16, backstory: input.backstory });
    const slots = await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, characterId));
    expect(slots.map(slot => slot.versionId).sort()).toEqual([ids.verb, ids.domain, ids.range, ids.die].map(id => pin(id).versionId).sort());
    expect(slots.every(slot => slot.slotSource === "PINNED")).toBe(true);
    const dieSlot = slots.find(slot => slot.primitiveId === ids.die);
    const dieKey = `primitive:${ids.die}` as const;
    const nodes = await loadWorkspaceNodes([dieKey]);
    const dieRule = resolvePinnedNode("primitive", nodes.get(dieKey)!, [dieSlot!.versionId!]);
    expect(dieRule.row).toMatchObject({ workspacePinnedSnapshot: true, mechanicalRule: { family: "DICE", bindings: { dice: "1d8" } } });

    const minorPublication = { targetType: "PRIMITIVE" as const, targetId: String(ids.minor), versionId: pin(ids.minor).versionId, versionNumber: 1, visibility: "PUBLIC" as const, unpublishedAt: new Date() };
    await db.insert(publications).values(minorPublication);
    const noDie = await preparePinnedCharacterCreation(draft([ids.verb, ids.domain, ids.count]), actor);
    expect(noDie.preview.normalized.startingAccess.dieType).toBe("missing");
    expect(noDie.prepared).toBeNull();

    await expect(assertPinnedCreationReviewCurrent(prepared, actor)).resolves.toBeUndefined();
    await db.delete(follows).where(eq(follows.followerId, actor.id));
    await expect(assertPinnedCreationReviewCurrent(prepared, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
    await expect(persistApprovedPinnedCharacterCreation(prepared!, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
    await db.insert(follows).values({ followerId: actor.id, followingId: author.id });
    await db.update(primitiveVersions).set({ isLatest: false }).where(eq(primitiveVersions.id, pin(ids.die).versionId));
    await db.insert(primitiveVersions).values({
      id: pin(ids.die, 2).versionId, primitiveId: ids.die, versionNumber: 2, isLatest: true, deltaKind: "FULL", snapshot: snapshot(catalog[2]),
    });
    await expect(persistApprovedPinnedCharacterCreation(prepared!, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
    expect(await db.select().from(characters)).toHaveLength(1);
  });

  function directAuthoringDraft(name: string, domain: string): DraftV1 {
    return { ...draft([ids.verb]), name, pieces: [...draft([ids.verb]).pieces!,
      { action: "create", kind: "primitive", key: "domain", fields: { name: domain, narrativeRule: "Describe **steady winds**.",
        category: "DOMAIN", costTier: "Tier 1", buCost: 4, mechanicalRule: { family: "DOMAIN_ACCESS", bindings: { domain: "Winds" } } } },
      { action: "create", kind: "primitive", key: "die", fields: { name: `${name} Die`, narrativeRule: "A steady d8.",
        category: "INTENSITY_DICE", costTier: "Tier 2", buCost: 4, mechanicalRule: { family: "DICE", bindings: { dice: "d8" } } } },
    ], placements: [{ pieceKey: `p${ids.verb}`, source: "PERSONAL" }, { pieceKey: "domain", source: "PERSONAL" }, { pieceKey: "die", source: "PERSONAL" }] };
  }

  const linked = { ...actor, scopes: ["swordweave:read", "swordweave:create"] };
  function enableStaging() {
    for (const [key, value] of Object.entries({ MCP_RESOURCE_URL: opts.resource, MCP_CLERK_ISSUER: "https://fictional-clerk.example",
      MCP_READ_ENABLED: "true", MCP_WRITE_ENABLED: "true", MCP_FIXTURE_ENABLED: "true", MCP_STAGING_REVIEW_ENABLED: "true",
      MCP_FIXTURE_DATABASE_HOST: "fixture-db.example", MCP_FIXTURE_USER_IDS: `${actor.id},${author.id}`,
      CLERK_SECRET_KEY: "sk_test_fictional_creation_test", DATABASE_URL: "postgresql://fixture-db.example/sw_companion_test" })) vi.stubEnv(key, value);
  }

  async function openReview(input: DraftV1, player = linked) {
    const { preview, prepared } = await preparePinnedCharacterCreation(input, player);
    expect(preview.validationErrors).toEqual([]);
    expect(preview.missing).toEqual([]);
    expect(prepared).not.toBeNull();
    if (!prepared) throw new Error("Fixture review did not prepare.");
    const operation = await prepareOperation({ actor: player, kind: "character_create", subject: { kind: "creation_series" },
      payload: prepared, summary: preview, steps: creationStepKinds(prepared) });
    return { preview, prepared, ...operation };
  }

  async function approve(operationId: string, player = linked) {
    const { confirmation } = await getOperationReview(player, operationId);
    if (!confirmation) throw new Error("Fixture review cannot be approved.");
    await approveStagingOperation(player, { operationId, origin: "https://mcp.example", nonce: confirmation.nonce, digest: confirmation.digest });
  }

  async function callCreationTool(name: string, args: Record<string, unknown>, toolActor = linked) {
    const config = getMcpConfig();
    if (!config) throw new Error("Synthetic staging configuration is missing");
    const server = createSwordWeaveMcpServer(config, toolActor);
    const client = new Client({ name: "creation-replay-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      return await client.callTool({ name, arguments: args });
    } finally {
      await client.close();
      await server.close();
    }
  }

  function continueWithTool(operationId: string, stepId?: string) {
    return callCreationTool("continue_character_save", { operationId, ...(stepId ? { stepId } : {}) });
  }

  it("reviews the exact pinned drawback and eligibility notes in text, widget and browser before granting credit", async () => {
    enableStaging();
    try {
      const id = 9069;
      const modifiers = [
        { kind: "modify", target: "max_vitality", operation: "add", value: 2 },
        { kind: "modify", target: "load", operation: "multiply", value: 2 },
      ] as const;
      const notes = "The **burden** applies during travel.";
      const source = { name: "Fictional Travel Burden", category: "VITALITY" as const, buCost: 2,
        isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: 2, hardModifiers: [...modifiers], mechanicalOutputText: "" };
      await db.insert(primitives).values({ ...source, id, userId: actor.clerkId, isPublic: false, mirrorEligibilityNotes: "Newer live prose" });
      await db.insert(primitiveVersions).values({ id: pin(id).versionId, primitiveId: id, versionNumber: 1,
        deltaKind: "FULL", isLatest: true, snapshot: { ...source, mirrorEligibilityNotes: notes } });
      const input = directAuthoringDraft("Glass Courier", "Glasswinds");
      input.pieces!.push({ key: "burden", action: "reuse", pin: pin(id) });
      input.placements!.push({ pieceKey: "burden", source: "PERSONAL", isMirrored: true });
      const review = await openReview(input);
      const slot = review.preview.normalized.placements.find(placement => placement.isMirrored)!;
      expect(slot.mirrorCredit).toBe(2);
      expect(slot.drawback?.description).toMatch(/subtract 2 from .*vitality.*divide .*load by 2/i);
      expect(slot.drawback?.eligibilityNotes).toBe(notes);
      const preview = await callCreationTool("preview_character", { draft: input });
      expect(JSON.stringify(preview.content)).toContain(slot.drawback!.description);
      expect(JSON.stringify(preview.content)).toContain(notes);
      expect(preview._meta?.["swordweave/drawbacks"]).toMatchObject([{ mechanicalRule: slot.drawback!.description }]);
      expect(JSON.stringify(preview._meta)).toContain("burden");
      expect(JSON.stringify(preview)).not.toContain("Newer live prose");
      const { confirmation } = await getOperationReview(linked, review.operationId);
      expect(confirmation?.summary).toMatchObject({ normalized: { placements: expect.arrayContaining([expect.objectContaining({ drawback: slot.drawback })]) } });

      await db.update(primitiveVersions).set({ snapshot: { ...source, mirrorEligibilityNotes: "Changed terms" } }).where(eq(primitiveVersions.id, pin(id).versionId));
      await expect(assertPinnedCreationReviewCurrent(review.prepared, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
      await db.update(primitives).set({ hardModifiers: [] }).where(eq(primitives.id, id));
      await db.update(primitiveVersions).set({ snapshot: { ...source, hardModifiers: [], mirrorEligibilityNotes: notes } }).where(eq(primitiveVersions.id, pin(id).versionId));
      const invalid = await preparePinnedCharacterCreation(input, actor);
      expect(invalid.prepared).toBeNull();
      expect(invalid.preview.budget.mirrorCredit).toBe(0);
      expect(invalid.preview.validationErrors).toContainEqual(expect.objectContaining({ code: "INVALID_MIRROR" }));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  const run = (review: Awaited<ReturnType<typeof openReview>>, stepId?: string, player = linked) => executeApprovedOperation({ actor: player,
    operationId: review.operationId, expectedKind: "character_create", ...(stepId ? { stepId } : {}),
    async execute({ operationId, step }) {
      try {
        return await performPinnedCharacterCreationStep(review.prepared, player, operationId, step!.kind);
      } catch (error) {
        if (error instanceof StaleCharacterCreationError) throw new OperationBlockError("STALE_REVIEW");
        if (error instanceof CharacterPrimitiveConflictError || error instanceof CharacterCapabilityConflictError) throw new OperationBlockError("CONFLICT");
        throw error;
      }
    },
  });

  it("reuses a native capability with the exact reviewed members and one charge per inherited access", async () => {
    const id = "b0000000-0000-4000-8000-000000000030";
    const versionId = "a0000000-0000-4000-8000-000000000030";
    const capabilityPin = { kind: "capability", id, versionId } as const;
    const name = "Fictional Storm Capability";
    const members = [
      { primitiveId: ids.verb, role: "VERB", quantity: 1, slotLabel: "", notes: "" },
      { primitiveId: ids.domain, role: "DOMAIN", quantity: 2, slotLabel: "Storm", notes: "**Weather**" },
    ] as const;
    const nestedDie = { ...catalog[2], id: 9023, name: "Fictional Capability d8" };
    await db.insert(primitives).values({ ...nestedDie, mechanicalRule: mechanics(catalog[2]) });
    await db.insert(primitiveVersions).values({
      id: pin(nestedDie.id).versionId, primitiveId: nestedDie.id, versionNumber: 1, isLatest: true,
      deltaKind: "FULL", snapshot: { ...snapshot(catalog[2]), name: nestedDie.name },
    });
    const membershipOrder = [`primitive:${ids.domain}:DOMAIN`, `primitive:${ids.verb}:VERB`];
    const fields = { name, type: "ACTIVE", sourceType: "MAGICAL", verboseDescription: "A fictional action.", membershipOrder, isPublic: true } as const;
    await db.insert(schema.capabilities).values({ id, ...fields, userId: author.clerkId,
      metadata: { totalBu: 12, compiledAt: "2026-11-25T00:00:00.000Z" } });
    await db.insert(schema.capabilityPrimitives).values(members.map((member, sortOrder) => ({ ...member, capabilityId: id, sortOrder })));
    await db.insert(schema.capabilityVersions).values({ id: versionId, capabilityId: id, versionNumber: 1, isLatest: true, deltaKind: "FULL",
      snapshot: { ...fields, primitiveSlots: members, effectIds: [], dependencyPins: members.map(member => ({
        kind: "primitive", id: member.primitiveId, versionId: pin(member.primitiveId).versionId,
        data: { ...member, versionId: pin(member.primitiveId).versionId },
      })) } });

    const builder = draft([ids.verb, nestedDie.id]);
    const input: DraftV1 = { ...builder, name: "Capability Courier", pieces: [...builder.pieces!,
      { key: "storm", action: "reuse", pin: capabilityPin }], placements: [...builder.placements!, { pieceKey: "storm", source: "LINEAGE" }] };
    await db.delete(follows).where(eq(follows.followerId, actor.id));
    try {
      const unavailable = await findCreations({ kind: "capability", query: name }, actor, opts);
      expect(unavailable.items[0]).toMatchObject({ name, versionStatus: "UNAVAILABLE" });
      expect(unavailable.items[0]).not.toHaveProperty("pin");
      expect(unavailable.items[0]).not.toHaveProperty("buCost");
      const denied = await preparePinnedCharacterCreation(input, actor);
      expect(denied.prepared).toBeNull();
      expect(denied.preview.validationErrors).toContainEqual(expect.objectContaining({ code: "PIN_UNAVAILABLE", pieceKey: "storm" }));
      expect(JSON.stringify(denied.preview)).not.toContain("**Weather**");
      await db.insert(follows).values({ followerId: actor.id, followingId: author.id });

      const available = await findCreations({ kind: "capability", query: name, minBu: 12, maxBu: 12 }, actor, opts);
      expect(available.items[0]).toMatchObject({ pin: capabilityPin, buCost: 12, versionStatus: "PINNED" });
      const before = await preparePinnedCharacterCreation(input, actor);
      expect(before.preview.normalized.capabilities).toMatchObject([{ pin: capabilityPin, source: "LINEAGE",
        members: [{ pin: pin(ids.domain), quantity: 2 }, { pin: pin(ids.verb), quantity: 1 }] }]);
      expect(before.preview.normalized.startingAccess).toEqual({ verbTier: "selected", domain: "selected", range: "freeBaseline", dieType: "selected" });
      expect(before.preview.budget.positiveSpent).toBe(16);
      expect(before.preview.normalized.placements).toHaveLength(4);
      expect(before.prepared).not.toBeNull();

      enableStaging();
      const stale = await openReview({ ...input, name: "Stale Capability Courier" });
      await db.delete(follows).where(eq(follows.followerId, actor.id));
      await expect(assertPinnedCreationReviewCurrent(stale.prepared, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
      await expect(persistApprovedPinnedCharacterCreation(stale.prepared, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
      expect(await db.select().from(characters).where(eq(characters.name, "Stale Capability Courier"))).toEqual([]);
      await db.insert(follows).values({ followerId: actor.id, followingId: author.id });

      const review = await openReview(input);
      await approve(review.operationId);
      await run(review);
      const [created] = await db.select().from(characters).where(eq(characters.name, "Capability Courier"));
      expect(created).toMatchObject({ userId: actor.clerkId, isPublic: false, buSpent: 16 });
      const [root] = await db.select().from(schema.characterCapabilities).where(eq(schema.characterCapabilities.characterId, created!.id));
      expect(root).toMatchObject({ capabilityId: id, versionId, slotSource: "PINNED", slotTab: "LINEAGE" });
      const slots = await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, created!.id));
      expect(slots.filter(slot => slot.originCapabilityId === id)).toEqual(expect.arrayContaining([
        expect.objectContaining({ primitiveId: ids.verb, directSource: "PERSONAL", versionId: pin(ids.verb).versionId }),
        expect.objectContaining({ primitiveId: ids.domain, directSource: null, versionId: pin(ids.domain).versionId }),
      ]));
      expect(slots).toHaveLength(4);
      const graph = await readWorkspace(created!.id);
      expect(graph.edges.find(edge => edge.child === `capability:${id}`)).toMatchObject({ parent: null, category: "LINEAGE", versionId });
      expect(graph.edges.filter(edge => edge.parent === `capability:${id}`)).toEqual(expect.arrayContaining([
        expect.objectContaining({ child: `primitive:${ids.domain}`, versionId: pin(ids.domain).versionId, order: 0,
          data: expect.objectContaining({ quantity: 2, notes: "**Weather**" }) }),
        expect.objectContaining({ child: `primitive:${ids.verb}`, versionId: pin(ids.verb).versionId, order: 1 }),
      ]));
      await expect(_dryRunRecomputeBuSpent(created!.id)).resolves.toEqual({ buSpent: 16, instanceCount: 4 });

      const liveDomain = and(eq(schema.capabilityPrimitives.capabilityId, id), eq(schema.capabilityPrimitives.role, "DOMAIN"));
      await db.update(schema.capabilityPrimitives).set({ quantity: 3 }).where(liveDomain);
      await expect(assertPinnedCreationReviewCurrent(review.prepared, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
      expect((await findCreations({ kind: "capability", query: name }, actor, opts)).items[0]?.pin).toBeUndefined();
      const savedGraph = await readWorkspace(created!.id);
      expect(savedGraph.edges.find(edge => edge.parent === `capability:${id}` && edge.child === `primitive:${ids.domain}`))
        .toMatchObject({ data: { quantity: 2 }, versionId: pin(ids.domain).versionId });
    } finally {
      vi.unstubAllEnvs();
      await db.insert(follows).values({ followerId: actor.id, followingId: author.id }).onConflictDoNothing();
    }
  });

  it("commits a newly authored capability's primitive dependencies before binding the native member pins", async () => {
    const input = directAuthoringDraft("Wind Archive Keeper", "Wind Archive Domain");
    input.pieces!.unshift({ key: "windArchive", action: "create", kind: "capability",
      fields: { name: "Wind Archive Assembly", verboseDescription: "A **record** of the wind.", type: "ACTIVE", sourceType: "MAGICAL" },
      members: [
        { ref: { pieceKey: "domain" }, role: "DOMAIN", quantity: 2 },
        { ref: { pieceKey: "die" }, role: "OUTPUT" },
        { ref: { pieceKey: `p${ids.verb}` }, role: "VERB" },
      ],
    });
    input.placements = [{ pieceKey: "windArchive", source: "UPBRINGING" }];
    enableStaging();
    try {
      const review = await openReview(input);
      expect(review.preview.normalized.capabilities?.[0]?.members).toMatchObject([
        { authoredPieceKey: "domain", pin: null, role: "DOMAIN", quantity: 2 },
        { authoredPieceKey: "die", pin: null, role: "OUTPUT" },
        { pin: pin(ids.verb), role: "VERB" },
      ]);
      expect(creationStepKinds(review.prepared)).toEqual(["primitive_0", "primitive_1", "capability_2", "character"]);
      await approve(review.operationId);
      const domainResult = await run(review);
      const domain = domainResult.steps[0]!.result!;
      const dieResult = await run(review);
      const die = dieResult.steps[1]!.result!;
      const capabilityResult = await run(review);
      const capability = capabilityResult.steps[2]!.result!;
      const [version] = await db.select().from(schema.capabilityVersions).where(eq(schema.capabilityVersions.id, capability.versionPin!));
      expect(version?.snapshot).toMatchObject({ dependencyPins: [
        { id: Number(domain.entityId), versionId: domain.versionPin, data: { quantity: 2 } },
        { id: Number(die.entityId), versionId: die.versionPin },
        { id: ids.verb, versionId: pin(ids.verb).versionId },
      ] });
      const saved = await run(review);
      expect(saved.state).toBe("completed");
      const [character] = await db.select().from(characters).where(eq(characters.name, "Wind Archive Keeper"));
      expect(character).toMatchObject({ buSpent: review.preview.budget.positiveSpent, isPublic: false });
      const slots = await db.select().from(schema.characterPrimitives).where(eq(schema.characterPrimitives.characterId, character!.id));
      expect(slots).toEqual(expect.arrayContaining([
        expect.objectContaining({ primitiveId: Number(domain.entityId), versionId: domain.versionPin, originCapabilityId: capability.entityId }),
        expect.objectContaining({ primitiveId: Number(die.entityId), versionId: die.versionPin, originCapabilityId: capability.entityId }),
      ]));
      expect((await run(review)).steps).toEqual(saved.steps);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("forks a pinned primitive-member capability privately and rechecks the original graph even when replacing it", async () => {
    const id = randomUUID(), versionId = randomUUID(), childId = 9078;
    const from = { kind: "capability" as const, id, versionId };
    const sourceName = "Glass courier technique";
    const child = { ...catalog[3], id: childId, name: "Fictional glass burden", userId: author.clerkId };
    const childSnapshot = { ...snapshot(catalog[3]), name: child.name };
    const member = { primitiveId: childId, role: "OTHER" as const, quantity: 2, slotLabel: "Burden", notes: "**Carry** the glass." };
    const fields = { name: sourceName, verboseDescription: "**Balance** the glass.", type: "ACTIVE" as const, sourceType: "PHYSICAL" as const,
      membershipOrder: [`primitive:${childId}:OTHER`] };
    await db.insert(primitives).values(child);
    await db.insert(primitiveVersions).values({ id: pin(childId).versionId, primitiveId: childId, versionNumber: 1, isLatest: true, deltaKind: "FULL", snapshot: childSnapshot });
    await db.insert(schema.capabilities).values({ ...fields, id, userId: author.clerkId, isPublic: true });
    await db.insert(schema.capabilityPrimitives).values({ ...member, capabilityId: id });
    await db.insert(schema.capabilityVersions).values({ id: versionId, capabilityId: id, versionNumber: 1, isLatest: true, deltaKind: "FULL",
      snapshot: { ...fields, isPublic: true, primitiveSlots: [member], dependencyPins: [{ kind: "primitive", id: childId, versionId: pin(childId).versionId, data: member }] } });
    const input = directAuthoringDraft("Glass Fork Courier", "Independent Weather");
    const piece = { key: "copy", action: "fork", from, changes: { name: "Private Glass Technique" } } as const;
    input.pieces!.unshift(piece);
    input.placements!.push({ pieceKey: "copy", source: "MANIFEST" });
    enableStaging();
    try {
      for (const replacement of [{ ...piece, changes: {} }, { ...piece, members: [] }]) {
        const invalid = await preparePinnedCharacterCreation({ ...input, pieces: [replacement, ...input.pieces!.slice(1)] }, actor);
        expect(invalid.prepared).toBeNull();
        expect(invalid.preview.validationErrors[0]?.code).toBe("members" in replacement ? "CAPABILITY_MEMBER_LIMIT" : "UNCHANGED_FORK");
      }
      const review = await openReview(input);
      expect(review.preview.normalized.capabilities?.[0]).toMatchObject({ authored: { forkedFrom: { name: sourceName, pin: from },
        verboseDescription: fields.verboseDescription }, members: [{ pin: pin(childId), notes: member.notes, slotLabel: member.slotLabel, quantity: 2 }] });
      await approve(review.operationId);
      const first = await run(review);
      const fork = first.steps[0]!.result!;
      expect((await run(review, first.steps[0]!.stepId)).steps).toEqual(first.steps);
      const [owned] = await db.select().from(schema.capabilities).where(eq(schema.capabilities.id, fork.entityId));
      expect(owned).toMatchObject({ name: piece.changes.name, isPublic: false, userId: actor.clerkId });
      expect(owned!.sourceOrigin).toMatch(new RegExp(`^fork:${id}:[a-f0-9]{64}$`));
      expect(await getForkSource("CAPABILITY", fork.entityId)).toMatchObject({ sourceTargetId: id, sourceVersionId: versionId });
      const [saved] = await db.select().from(schema.capabilityVersions).where(eq(schema.capabilityVersions.id, fork.versionPin!));
      expect(saved?.snapshot).toMatchObject({ sourceId: id, sourceVersionId: versionId, sourceSnapshotDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        sourceMembersDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        dependencyPins: [{ id: childId, versionId: pin(childId).versionId, data: member }] });
      for (const _ of first.steps.slice(1)) await run(review);
      expect((await run(review)).state).toBe("completed");
      const conflict = await openReview(input);
      await approve(conflict.operationId);
      expect(await run(conflict)).toMatchObject({ state: "blocked", failureCode: "CONFLICT" });
      const secondPlayer = { ...author, scopes: linked.scopes };
      const other = { ...input, pieces: input.pieces!.map(entry => entry.key !== `p${ids.verb}` ? entry : {
        action: "create" as const, key: entry.key, kind: "primitive" as const,
        fields: { name: "Another courier verb", category: "VERB_TIER" as const, costTier: "Tier 1", buCost: 4, narrativeRule: "",
          mechanicalRule: { family: "VERB_ACCESS" as const, bindings: { tier: "Tier I" as const } } },
      }) };
      const independent = await openReview(other, secondPlayer);
      await approve(independent.operationId, secondPlayer);
      const otherFork = (await run(independent, undefined, secondPlayer)).steps[0]!.result!;
      expect(otherFork.entityId).not.toBe(fork.entityId);
      const [otherRow] = await db.select().from(schema.capabilities).where(eq(schema.capabilities.id, otherFork.entityId));
      expect(otherRow).toMatchObject({ userId: author.clerkId, name: piece.changes.name, isPublic: false });
      expect(otherRow!.sourceOrigin).not.toBe(owned!.sourceOrigin);
      const replaced = { ...piece, changes: { verboseDescription: "Apply later." }, members: [{ ref: { pin: pin(ids.range) }, role: "RANGE" as const }] };
      const replacement = await openReview({ ...input, pieces: [replaced, ...input.pieces!.slice(1)] });
      expect(replacement.preview.normalized.capabilities?.[0]?.members).toMatchObject([{ pin: pin(ids.range), quantity: 1, notes: "" }]);
      await db.update(primitiveVersions).set({ snapshot: { ...childSnapshot, narrativeRule: "Changed source terms" } }).where(eq(primitiveVersions.id, pin(childId).versionId));
      await expect(assertPinnedCreationReviewCurrent(replacement.prepared, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
      await db.update(primitives).set({ isPublic: false }).where(eq(primitives.id, childId));
      const denied = await preparePinnedCharacterCreation(replacement.prepared.draft, actor);
      expect(denied.prepared).toBeNull();
      expect(JSON.stringify(denied.preview)).not.toContain(member.notes);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("creates a private capability from exact existing member pins and attaches the committed version", async () => {
    const dieId = 9026;
    const d8 = { ...catalog[2], id: dieId, name: "Fictional Authored Capability d8" };
    await db.insert(primitives).values({ ...d8, mechanicalRule: mechanics(catalog[2]) });
    await db.insert(primitiveVersions).values({ id: pin(dieId).versionId, primitiveId: dieId, versionNumber: 1,
      isLatest: true, deltaKind: "FULL", snapshot: { ...snapshot(catalog[2]), name: d8.name } });
    const capName = "Private Stormworking";
    const description = "Keep **stormwork** within touch.";
    const input = (characterName: string, capabilityName = capName): DraftV1 => ({
      ...draft([]), name: characterName,
      pieces: [
        { key: "stormwork", action: "create", kind: "capability",
          fields: { name: capabilityName, verboseDescription: description, type: "ACTIVE", sourceType: "MAGICAL" },
          members: [
            { ref: { pin: pin(ids.domain) }, role: "DOMAIN", quantity: 2 },
            { ref: { pieceKey: "verb" }, role: "VERB" },
            { ref: { pin: pin(dieId) }, role: "OUTPUT" },
            { ref: { pin: pin(ids.range) }, role: "RANGE" },
          ],
        },
        { key: "verb", action: "reuse", pin: pin(ids.verb) },
      ],
      placements: [{ pieceKey: "stormwork", source: "UPBRINGING" }],
    });
    const visible = () => db.insert(follows).values({ followerId: actor.id, followingId: author.id }).onConflictDoNothing();
    const revoke = () => db.delete(follows).where(eq(follows.followerId, actor.id));

    enableStaging();
    try {
      await visible();
      const mirrored = input("Ineligible Echo");
      const [authored] = mirrored.pieces!;
      if (authored?.action !== "create") throw new Error("The fixture needs an authored capability.");
      authored.members![0]!.isMirrored = true;
      const invalid = await preparePinnedCharacterCreation(mirrored, actor);
      expect(invalid.prepared).toBeNull();
      expect(invalid.preview.validationErrors).toContainEqual(expect.objectContaining({ code: "UNSUPPORTED_CAPABILITY_MEMBER" }));

      const revoked = await openReview(input("Revoked Storm Courier", "Withdrawn Stormworking"));
      await approve(revoked.operationId);
      await revoke();
      expect(await run(revoked)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect(await db.select().from(schema.capabilities).where(eq(schema.capabilities.name, "Withdrawn Stormworking"))).toEqual([]);
      const denied = await preparePinnedCharacterCreation(input("Revoked Storm Courier", "Withdrawn Stormworking"), actor);
      expect(denied.preview.normalized.capabilities).toBeUndefined();
      expect(denied.preview.validationErrors).toContainEqual(expect.objectContaining({ code: "PIN_UNAVAILABLE" }));
      await visible();

      const review = await openReview(input("Storm Courier"));
      expect(review.approvalUrl).toBe(`https://mcp.example/companion/review/${review.operationId}`);
      const memberIds = [ids.domain, ids.verb, dieId, ids.range];
      const roles = ["DOMAIN", "VERB", "OUTPUT", "RANGE"] as const;
      expect(review.preview.normalized.startingAccess).toEqual({ verbTier: "selected", domain: "selected", range: "selected", dieType: "selected" });
      expect(review.preview.budget).toMatchObject({ positiveSpent: 16 });
      expect(review.preview.normalized.capabilities).toMatchObject([{ pin: null, source: "UPBRINGING", name: capName,
        authored: { verboseDescription: description, componentBu: 20, isPublic: false },
        members: memberIds.map((id, ordinal) => ({ pin: pin(id), role: roles[ordinal], quantity: ordinal === 0 ? 2 : 1 })),
      }]);
      await approve(review.operationId);
      const stepId = (await getOperationStatus(linked, review.operationId)).nextStep!.stepId;
      let rolledBackCapabilityId: string | undefined;
      await expect(executeApprovedOperation({ actor: linked, operationId: review.operationId, expectedKind: "character_create", stepId,
        async execute({ operationId, step }) {
          const pending = await performPinnedCharacterCreationStep(review.prepared, linked, operationId, step!.kind);
          if ("entityKind" in pending && pending.entityKind === "capability") rolledBackCapabilityId = pending.entityId;
          throw new Error("Synthetic rollback before the step receipt");
        },
      })).rejects.toThrow("Synthetic rollback");
      expect((await getOperationStatus(linked, review.operationId)).nextStep?.stepId).toBe(stepId);
      expect(rolledBackCapabilityId).toEqual(expect.any(String));
      expect(await db.select().from(schema.capabilities).where(eq(schema.capabilities.name, capName))).toEqual([]);
      expect(await db.select().from(schema.capabilityVersions).where(eq(schema.capabilityVersions.capabilityId, rolledBackCapabilityId!))).toEqual([]);
      expect(await db.select().from(schema.capabilityPrimitives).where(eq(schema.capabilityPrimitives.capabilityId, rolledBackCapabilityId!))).toEqual([]);

      const firstResult = await continueWithTool(review.operationId, stepId);
      expect(firstResult).toMatchObject({ structuredContent: {
        state: "approved", sheetUrl: null, steps: [expect.objectContaining({ kind: "capability_0", state: "committed",
          result: { entityKind: "capability", entityId: expect.any(String), versionPin: expect.any(String) } }), expect.any(Object)],
      } });
      const first = firstResult.structuredContent as Awaited<ReturnType<typeof run>>;
      expect((await run(review, stepId)).steps).toEqual(first.steps);
      const { entityId, versionPin } = first.steps[0]!.result!;
      const [capability] = await db.select().from(schema.capabilities).where(eq(schema.capabilities.id, entityId));
      expect(capability).toMatchObject({ name: capName, verboseDescription: description, isPublic: false,
        userId: actor.clerkId, sourceOrigin: `user:${actor.clerkId}`, metadata: { totalBu: 20 } });
      const links = await db.select().from(schema.capabilityPrimitives).where(eq(schema.capabilityPrimitives.capabilityId, entityId))
        .orderBy(schema.capabilityPrimitives.sortOrder);
      expect(links).toMatchObject(memberIds.map((id, ordinal) => ({ primitiveId: id, sortOrder: ordinal,
        role: roles[ordinal], quantity: ordinal === 0 ? 2 : 1, isMirrored: false })));
      const [version] = await db.select().from(schema.capabilityVersions).where(eq(schema.capabilityVersions.capabilityId, entityId));
      expect(version).toMatchObject({ id: versionPin, deltaKind: "FULL", snapshot: {
        dependencyPins: memberIds.map((id, ordinal) => ({ kind: "primitive", id, versionId: pin(id).versionId,
          data: { role: roles[ordinal], quantity: ordinal === 0 ? 2 : 1 } })),
      } });
      expect((await findCreations({ kind: "capability", query: capName }, author, opts)).items).toEqual([]);
      expect((await findCreations({ kind: "capability", query: capName }, actor, opts)).items[0]?.pin)
        .toEqual({ kind: "capability", id: entityId, versionId: versionPin });

      const saved = await run(review);
      expect(saved).toMatchObject({ state: "completed", receipt: { characterId: expect.any(String) } });
      const [character] = await db.select().from(characters).where(eq(characters.name, "Storm Courier"));
      expect(saved.sheetUrl).toBe(`https://mcp.example/characters/${character!.id}`);
      await expect(_dryRunRecomputeBuSpent(character!.id)).resolves.toEqual({ buSpent: 16, instanceCount: 4 });
      const graph = await readWorkspace(character!.id);
      const rootKey = `capability:${entityId}`;
      expect(graph.edges.find(edge => edge.child === rootKey)).toMatchObject({ category: "UPBRINGING", parent: null, versionId: versionPin });
      expect(graph.edges.filter(edge => edge.parent === rootKey)).toMatchObject(memberIds.map((id, ordinal) => ({
        child: `primitive:${id}`, versionId: pin(id).versionId, order: ordinal, data: { role: roles[ordinal] },
      })));
      expect((await run(review)).receipt).toEqual(saved.receipt);

      const conflict = await openReview(input("Duplicate Storm Courier"));
      await approve(conflict.operationId);
      expect(await run(conflict)).toMatchObject({ state: "blocked", failureCode: "CONFLICT" });
      expect(await db.select().from(schema.capabilities).where(eq(schema.capabilities.name, capName))).toHaveLength(1);

      const detached = await openReview(input("Detached Storm Courier", "Detached Stormworking"));
      await approve(detached.operationId);
      expect((await run(detached)).steps[0]?.state).toBe("committed");
      await revoke();
      expect(await run(detached)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect(await db.select().from(characters).where(eq(characters.name, "Detached Storm Courier"))).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      await visible();
    }
  });

  it("previews separate direct creations and advances only one private, versioned step per approval continuation", async () => {
    enableStaging();
    try {
      const review = await openReview(directAuthoringDraft("Custom Courier", "Winds of Home"));
      expect(review.preview.normalized.placements.find(piece => piece.pieceKey === "domain")).toMatchObject({ pin: null,
        authored: { narrativeRule: "Describe **steady winds**.", isPublic: false, ownership: "player" } });
      expect(review.preview.budget).toMatchObject({ positiveSpent: 16, mirrorCredit: 0 });
      expect(await db.select().from(primitives).where(eq(primitives.name, "Winds of Home"))).toEqual([]);
      await expect(run(review)).rejects.toMatchObject({ code: "UNAVAILABLE" });
      await approve(review.operationId);
      const next = (await getOperationStatus(linked, review.operationId)).nextStep;
      expect(next?.kind).toBe("primitive_0");
      expect(await continueWithTool(review.operationId)).toMatchObject({ isError: true,
        structuredContent: { code: "STEP_REQUIRED", nextStep: { stepId: next!.stepId } } });
      expect(await db.select().from(primitives).where(eq(primitives.name, "Winds of Home"))).toEqual([]);
      const first = (await continueWithTool(review.operationId, next!.stepId)).structuredContent as Awaited<ReturnType<typeof run>>;
      expect(first).toMatchObject({ state: "approved", nextStep: { kind: "primitive_1" }, receipt: null });
      const [domain] = await db.select().from(primitives).where(eq(primitives.name, "Winds of Home"));
      expect(domain).toMatchObject({ isPublic: false, userId: actor.clerkId, sourceOrigin: `user:${actor.clerkId}`, narrativeRule: "Describe **steady winds**." });
      expect(await db.select().from(primitiveMarketClassifications).where(eq(primitiveMarketClassifications.primitiveId, domain!.id))).toHaveLength(1);
      expect(await db.select().from(characters).where(eq(characters.name, "Custom Courier"))).toEqual([]);
      expect(await continueWithTool(review.operationId, next!.stepId)).toMatchObject({ structuredContent: { steps: first.steps } });
      const second = await run(review);
      expect(second).toMatchObject({ state: "approved", nextStep: { kind: "character" } });
      const finished = await run(review);
      expect(finished).toMatchObject({ state: "completed", receipt: { characterId: expect.any(String) } });
      const [character] = await db.select().from(characters).where(eq(characters.name, "Custom Courier"));
      const createdSlots = await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, character!.id));
      expect(createdSlots.find(slot => slot.primitiveId === domain!.id)?.versionId).toBe(first.steps[0]?.result?.versionPin);
      expect(createdSlots).toHaveLength(4);
      expect((await run(review)).receipt).toEqual(finished.receipt);
      const conflict = await openReview(directAuthoringDraft("Conflict Courier", "Winds of Home"));
      await approve(conflict.operationId);
      expect(await run(conflict)).toMatchObject({ state: "blocked", failureCode: "CONFLICT" });
      expect(await db.select().from(primitives).where(eq(primitives.name, "Winds of Home"))).toHaveLength(1);
    } finally { vi.unstubAllEnvs(); }
  });

  it("saves private primitive forks with exact provenance and checks source access at each approved step", async () => {
    const originalId = 9050;
    const originalPin = pin(originalId);
    const original = prepareCharacterPrimitive({
      name: "Fictional Glasswind", category: "DOMAIN", costTier: "Tier 1", buCost: 4,
      narrativeRule: "Shape **glasswind**.", mechanicalRule: { family: "DOMAIN_ACCESS", bindings: { domain: "Glasswind" } },
    }, author.clerkId)!;
    const { rule } = original;
    const sourceSnapshot = { ...original.snapshot, isPublic: true };
    await db.insert(primitives).values({
      id: originalId, name: sourceSnapshot.name, category: original.category, userId: author.clerkId,
      isPublic: true,
      costTier: sourceSnapshot.costTier, buCost: sourceSnapshot.buCost, narrativeRule: sourceSnapshot.narrativeRule,
      mechanicalOutputText: sourceSnapshot.mechanicalOutputText, mechanicalRule: { ...rule }, bindings: rule.bindings ?? {},
      sourceOrigin: original.sourceOrigin,
    });
    await db.insert(primitiveVersions).values({
      id: originalPin.versionId, primitiveId: originalId, versionNumber: 1, isLatest: true, deltaKind: "FULL", snapshot: { ...sourceSnapshot },
    });
    await db.insert(publications).values({ targetType: "PRIMITIVE", targetId: originalPin.id, versionId: originalPin.versionId,
      versionNumber: 1, authorId: author.id, visibility: "FOLLOWERS_ONLY" });
    const restoreVisibility = () => db.insert(follows).values({ followerId: actor.id, followingId: author.id }).onConflictDoNothing();
    const revokeVisibility = () => db.delete(follows).where(eq(follows.followerId, actor.id));
    const input = (characterName: string, forkName: string) => {
      const base = directAuthoringDraft(characterName, "Replace this fixture");
      const draft: DraftV1 = { ...base, pieces: [
        { key: "domain", action: "fork", from: originalPin, changes: { name: forkName, narrativeRule: "**Keep** the glasswind moving." } },
        ...base.pieces!.filter(piece => piece.key !== "domain"),
      ] };
      return draft;
    };

    enableStaging();
    try {
      await restoreVisibility();
      const unchangedInput = input("Unchanged Glasswind", "Unused");
      unchangedInput.pieces![0] = { key: "domain", action: "fork", from: originalPin };
      const unchanged = await preparePinnedCharacterCreation(unchangedInput, actor);
      expect(unchanged.prepared).toBeNull();
      expect(unchanged.preview.validationErrors).toContainEqual(expect.objectContaining({ code: "UNCHANGED_FORK" }));
      await db.update(primitives).set({ targetScope: "AWARENESS" }).where(eq(primitives.id, originalId));
      const unsupported = await preparePinnedCharacterCreation(input("Unsupported Glasswind", "Unsupported Copy"), actor);
      expect(unsupported.prepared).toBeNull();
      expect(unsupported.preview.validationErrors).toContainEqual(expect.objectContaining({ code: "UNSUPPORTED_FORK_SOURCE" }));
      await db.update(primitives).set({ targetScope: null }).where(eq(primitives.id, originalId));

      const withdrawn = await openReview(input("Withdrawn Glasswind", "Withdrawn Copy"));
      await approve(withdrawn.operationId);
      await revokeVisibility();
      await expect(assertPinnedCreationReviewCurrent(withdrawn.prepared, actor)).rejects.toBeInstanceOf(StaleCharacterCreationError);
      const detached = await preparePinnedCharacterCreation(input("Withdrawn Glasswind", "Withdrawn Copy"), actor);
      expect(detached.preview.validationErrors).toContainEqual(expect.objectContaining({ code: "PIN_UNAVAILABLE" }));
      expect(JSON.stringify(detached.preview)).not.toContain(sourceSnapshot.name);
      expect(await run(withdrawn)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect(await db.select().from(primitives).where(eq(primitives.name, "Withdrawn Copy"))).toEqual([]);
      await restoreVisibility();

      const sourceNamespace = `fork:${originalId}:`;
      const review = await openReview(input("Glasswind Courier", "Fictional Glasswind Copy"));
      expect(review.preview.normalized.placements.find(placement => placement.pieceKey === "domain")).toMatchObject({
        pin: null, name: "Fictional Glasswind Copy",
        authored: { ownership: "player", isPublic: false, forkedFrom: { name: sourceSnapshot.name, pin: originalPin } },
      });
      await approve(review.operationId);
      const stepId = (await getOperationStatus(linked, review.operationId)).nextStep!.stepId;
      const first = await run(review, stepId);
      expect(first).toMatchObject({ state: "approved", nextStep: { kind: "primitive_1" } });
      const forkName = "Fictional Glasswind Copy";
      const [fork] = await db.select().from(primitives).where(and(eq(primitives.name, forkName), eq(primitives.userId, actor.clerkId)));
      expect(fork).toMatchObject({ name: "Fictional Glasswind Copy", userId: actor.clerkId, isPublic: false,
        narrativeRule: "**Keep** the glasswind moving.", mechanicalRule: rule, buCost: 4 });
      expect(fork!.sourceOrigin?.startsWith(sourceNamespace)).toBe(true);
      expect(fork!.sourceOrigin).not.toContain(actor.clerkId);
      expect(first.steps[0]?.result).toMatchObject({ entityKind: "primitive", entityId: String(fork!.id), versionPin: expect.any(String) });
      const forkVersionId = first.steps[0]!.result!.versionPin!;
      const [version] = await db.select().from(primitiveVersions).where(eq(primitiveVersions.id, forkVersionId));
      expect(version).toMatchObject({ primitiveId: fork!.id, snapshot: { sourceId: originalPin.id, sourceVersionId: originalPin.versionId,
        sourceSnapshotDigest: primitiveSnapshotDigest(sourceSnapshot), mechanicalRule: rule } });
      await expect(getForkSource("PRIMITIVE", String(fork!.id))).resolves.toMatchObject({
        sourceTargetType: "PRIMITIVE", sourceTargetId: originalPin.id, sourceVersionId: originalPin.versionId, forkedAt: fork!.createdAt,
      });
      expect((await run(review, stepId)).steps).toEqual(first.steps);
      await run(review);
      const saved = await run(review);
      expect(saved).toMatchObject({ state: "completed", receipt: { characterId: expect.any(String) } });
      const [character] = await db.select().from(characters).where(eq(characters.name, "Glasswind Courier"));
      const slots = await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, character!.id));
      expect(slots.filter(slot => slot.primitiveId === fork!.id)).toMatchObject([{ versionId: forkVersionId, slotSource: "PINNED" }]);
      expect(await db.select().from(publications).where(eq(publications.targetId, String(fork!.id)))).toEqual([]);
      expect(await db.select().from(schema.forks).where(eq(schema.forks.forkedTargetId, String(fork!.id)))).toEqual([]);
      expect((await run(review)).receipt).toEqual(saved.receipt);

      const collision = await openReview(input("Collision Glasswind", fork!.name));
      await approve(collision.operationId);
      expect(await run(collision)).toMatchObject({ state: "blocked", failureCode: "CONFLICT" });
      expect(await db.select().from(primitives).where(eq(primitives.sourceOrigin, fork!.sourceOrigin!))).toHaveLength(1);
      const [sameFork] = await db.select().from(primitives).where(eq(primitives.id, fork!.id));
      expect(sameFork).toEqual(fork);

      const secondPlayer = { ...author, scopes: linked.scopes };
      expect((await findCreations({ kind: "primitive", query: forkName }, secondPlayer, opts)).items).toEqual([]);
      const sameName = input("Another Glasswind Courier", forkName);
      const otherPlayerDraft: DraftV1 = { ...sameName, pieces: sameName.pieces!.map(piece => piece.key === `p${ids.verb}` ? {
        key: piece.key, action: "create", kind: "primitive", fields: {
          name: "Another Verb Tier III", category: "VERB_TIER", costTier: "Tier 2", buCost: 8, narrativeRule: "",
          mechanicalRule: { family: "VERB_ACCESS", bindings: { tier: "Tier III" } },
        },
      } : piece) };
      const independent = await openReview(otherPlayerDraft, secondPlayer);
      await approve(independent.operationId, secondPlayer);
      const independentStep = await run(independent, undefined, secondPlayer);
      expect(independentStep.state).toBe("approved");
      expect(independentStep.steps[0]?.state).toBe("committed");
      const copies = await db.select().from(primitives).where(eq(primitives.name, forkName));
      expect(copies).toHaveLength(2);
      expect(new Set(copies.map(copy => copy.sourceOrigin)).size).toBe(2);
      expect(copies.every(copy => !copy.isPublic && copy.sourceOrigin?.startsWith(sourceNamespace))).toBe(true);
      const visible = await findCreations({ kind: "primitive", query: forkName }, secondPlayer, opts);
      expect(visible.items.map(piece => piece.id)).toEqual([independentStep.steps[0]!.result!.entityId]);

      const interrupted = await openReview(input("Interrupted Glasswind", "Interrupted Copy"));
      await approve(interrupted.operationId);
      const partial = await run(interrupted);
      expect(partial.steps[0]?.state).toBe("committed");
      await revokeVisibility();
      expect(await run(interrupted)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect(await db.select().from(characters).where(eq(characters.name, "Interrupted Glasswind"))).toEqual([]);
      expect(await db.select().from(primitives).where(eq(primitives.name, "Interrupted Copy"))).toHaveLength(1);

      await restoreVisibility();
      const superseded = await openReview(input("Superseded Glasswind", "Superseded Copy"));
      await approve(superseded.operationId);
      const updatedNarrative = "Shape glasswind over **cool water**.";
      await db.update(primitives).set({ narrativeRule: updatedNarrative }).where(eq(primitives.id, originalId));
      await db.update(primitiveVersions).set({ isLatest: false }).where(eq(primitiveVersions.id, originalPin.versionId));
      await db.insert(primitiveVersions).values({
        id: pin(originalId, 2).versionId, primitiveId: originalId, versionNumber: 2, isLatest: true,
        deltaKind: "FULL", snapshot: { ...sourceSnapshot, narrativeRule: updatedNarrative },
      });
      expect(await run(superseded)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect(await db.select().from(primitives).where(eq(primitives.name, "Superseded Copy"))).toEqual([]);

      await db.update(primitiveVersions).set({ snapshot: { ...version!.snapshot, sourceId: "1234" } }).where(eq(primitiveVersions.id, forkVersionId));
      await expect(getForkSource("PRIMITIVE", String(fork!.id))).resolves.toMatchObject({
        sourceTargetId: originalPin.id, sourceVersionId: "", forkedAt: fork!.createdAt,
      });
    } finally {
      vi.unstubAllEnvs();
      await restoreVisibility();
    }
  });

  it("verifies signed OAuth at the MCP route and recovers the browser-approved character across replays and expiry", async () => {
    enableStaging();
    try {
      const issuer = "https://fictional-clerk.example";
      const { createClerkClient } = await vi.importActual<typeof import("@clerk/nextjs/server")>("@clerk/nextjs/server");
      const signingKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
      state.clerkClient.mockResolvedValue(createClerkClient({
        secretKey: "sk_test_fictional_creation_test",
        publishableKey: `pk_test_${Buffer.from("fictional-clerk.example$").toString("base64")}`,
        jwtKey: signingKey.publicKey.export({ type: "spki", format: "pem" }).toString(),
        telemetry: { disabled: true },
      }));
      const signedGrant = (subject: string, scope = "swordweave:read swordweave:create", expiresIn = 120) => {
        const now = Math.floor(Date.now() / 1000);
        const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
        const header = encode({ alg: "RS256", typ: "at+jwt", kid: "isolated-fixture" });
        const claims = encode({ sub: subject, iss: issuer, aud: opts.resource, iat: Math.min(now - 1, now + expiresIn - 1),
          exp: now + expiresIn, jti: randomUUID(), client_id: "isolated-staging-client", scope });
        const signed = `${header}.${claims}`;
        return `${signed}.${sign("RSA-SHA256", Buffer.from(signed), signingKey.privateKey).toString("base64url")}`;
      };
      let bearer = signedGrant(linked.clerkId);
      const tool = async (name: string, args: Record<string, unknown>, token = bearer) => {
        const response = await callMcp(new Request(opts.resource, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
        }));
        const json: { result?: { isError?: boolean; structuredContent?: unknown } } = await response.json();
        return { status: response.status, result: json.result };
      };
      const creation = directAuthoringDraft("Wire Courier", "Glasswind Ledger");
      const createArguments = { draft: creation };
      const expired = await tool("prepare_character_save", createArguments, signedGrant(linked.clerkId, undefined, -30));
      expect(expired.status).toBe(401);
      const readOnly = await tool("prepare_character_save", createArguments, signedGrant(linked.clerkId, "swordweave:read"));
      expect(readOnly.result).toMatchObject({ isError: true });
      const prepared = await tool("prepare_character_save", createArguments);
      expect(prepared).toMatchObject({ status: 200, result: { structuredContent: {
        operationId: expect.any(String),
        summary: { budget: { positiveSpent: 16 }, normalized: { startingAccess: {
          verbTier: "selected", domain: "selected", range: "freeBaseline", dieType: "selected",
        } } },
      } } });
      const { operationId } = prepared.result?.structuredContent as { operationId: string };
      const args = { operationId };
      expect((await tool("continue_character_save", args)).result).toMatchObject({ isError: true });
      expect((await tool("get_operation_status", args, signedGrant(author.clerkId))).result).toMatchObject({ isError: true });
      expect(await db.select().from(characters).where(eq(characters.name, creation.name!))).toEqual([]);

      const reviewRow = eq(schema.companionOperations.id, operationId);
      const first = (await getOperationReview(linked, operationId)).confirmation!;
      const second = (await getOperationReview(linked, operationId)).confirmation!;
      const origin = new URL(opts.resource).origin;
      const submitForm = ({ nonce, digest }: { nonce: string; digest: string }) => approveBrowserReview(new Request(
        `${origin}/api/companion/operations/${operationId}/approve`, {
          method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ operationId, nonce, digest }),
        }), { params: Promise.resolve({ operationId }) });
      state.browserSession.mockResolvedValue({ userId: author.clerkId, sessionId: "fictional-other-session" });
      expect((await submitForm(second)).status).toBe(404);
      state.browserSession.mockResolvedValue({ userId: linked.clerkId, sessionId: "fictional-owner-session" });
      expect((await submitForm(first)).status).toBe(404);
      await db.update(schema.companionOperations).set({ nonceExpiresAt: new Date(Date.now() - 1000) }).where(reviewRow);
      expect((await submitForm(second)).status).toBe(404);
      const refreshed = (await getOperationReview(linked, operationId)).confirmation!;
      const approved = await submitForm(refreshed);
      expect(approved.status).toBe(303);
      expect(approved.headers.get("cache-control")).toBe("private, no-store");
      const [initialApproval] = await db.select().from(schema.companionOperations).where(reviewRow);
      expect((await submitForm(refreshed)).status).toBe(303);
      const [replayedApproval] = await db.select().from(schema.companionOperations).where(reviewRow);
      expect(replayedApproval).toMatchObject({ status: "approved", approvalSource: "staging_browser", nonceDigest: null,
        approvedAt: initialApproval!.approvedAt, expiresAt: initialApproval!.expiresAt });
      expect(await db.select().from(characters).where(eq(characters.name, creation.name!))).toEqual([]);

      type Progress = { state: string; nextStep: { stepId: string; kind: string } | null; receipt: { characterId: string }; sheetUrl: string };
      const getProgress = async () => (await tool("get_operation_status", args)).result?.structuredContent as Progress;
      const advance = (stepId: string) => tool("continue_character_save", { ...args, stepId });
      const firstStep = (await getProgress()).nextStep!;
      expect(firstStep.kind).toBe("primitive_0");
      // Deliberately lose the response and reconnect before retrieving the saved result.
      await advance(firstStep.stepId);
      bearer = signedGrant(linked.clerkId);
      expect((await advance(firstStep.stepId)).result?.structuredContent).toMatchObject({ state: "approved", nextStep: { kind: "primitive_1" } });
      expect(await db.select().from(primitives).where(eq(primitives.name, "Glasswind Ledger"))).toHaveLength(1);
      await advance((await getProgress()).nextStep!.stepId);
      const characterStep = (await getProgress()).nextStep!;
      expect(characterStep.kind).toBe("character");
      await advance(characterStep.stepId);
      const saved = await getProgress();
      expect(saved).toMatchObject({ state: "completed", receipt: { characterId: expect.any(String) } });
      expect(saved.sheetUrl).toBe(`${origin}/characters/${saved.receipt.characterId}`);
      const [finished] = await db.select().from(schema.companionOperations).where(reviewRow);
      expect((await advance(characterStep.stepId)).result?.structuredContent).toMatchObject({ receipt: saved.receipt });
      const [replayedSave] = await db.select().from(schema.companionOperations).where(reviewRow);
      expect(replayedSave).toMatchObject({ proposal: null, expiresAt: finished!.expiresAt });
      const savedRows = await db.select().from(characters).where(eq(characters.name, creation.name!));
      expect(savedRows).toHaveLength(1);
      expect(savedRows[0]).toMatchObject({ id: saved.receipt.characterId, userId: linked.clerkId, isPublic: false,
        buSpent: 16, backstory: creation.backstory });
      expect(await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, saved.receipt.characterId))).toHaveLength(4);

      await db.update(schema.companionOperations).set({ expiresAt: new Date(Date.now() - 1000) }).where(reviewRow);
      expect((await tool("get_operation_status", args)).result).toMatchObject({ isError: true });
      expect((await advance(characterStep.stepId)).result).toMatchObject({ isError: true });
      expect(await db.select().from(characters).where(eq(characters.id, saved.receipt.characterId))).toHaveLength(1);
    } finally {
      state.clerkClient.mockReset();
      state.browserSession.mockReset();
      vi.unstubAllEnvs();
    }
  });

  it("rejects a changed authored result before later approved steps can write", async () => {
    enableStaging();
    try {
      const review = await openReview(directAuthoringDraft("Stale Courier", "Lakeside Winds"));
      await approve(review.operationId);
      await run(review);
      await db.update(primitives).set({ narrativeRule: "New unapproved prose." }).where(eq(primitives.name, "Lakeside Winds"));
      expect(await run(review)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect(await db.select().from(primitives).where(eq(primitives.name, "Stale Courier Die"))).toEqual([]);
      expect(await db.select().from(characters).where(eq(characters.name, "Stale Courier"))).toEqual([]);
    } finally { vi.unstubAllEnvs(); }
  });

  it("advances an approved four-primitive character from level 1 to 10 once, preserving wounds and purchases", async () => {
    enableStaging();
    vi.stubEnv("MCP_CHARACTER_EDIT_READ_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_EDIT_WRITE_ENABLED", "true");
    const player = { ...linked, scopes: [...linked.scopes, "swordweave:edit"] };
    const editor = { ...author, scopes: player.scopes };
    const labels = [ids.verb, ids.domain, ids.range, ids.die];
    const [character] = await db.insert(characters).values({ userId: actor.clerkId, name: "Gale Reed Advancement",
      level: 1, startingBu: 25, buSpent: 16, currentVitality: 5, attrPhysical: 4, attrMental: 3, attrMagical: 3,
      backstory: { description: "**A storm courier** who tracks lightning over the marsh." } }).returning();
    const characterId = character!.id;
    try {
      await db.insert(follows).values({ followerId: actor.id, followingId: author.id }).onConflictDoNothing();
      await db.insert(schema.characterShares).values({ characterId, sharedWithUserId: author.id, sharedByUserId: actor.clerkId, canEdit: true });
      for (const primitiveId of labels) {
        const [latest] = await db.select({ versionId: primitiveVersions.id }).from(primitiveVersions)
          .where(and(eq(primitiveVersions.primitiveId, primitiveId), eq(primitiveVersions.isLatest, true)));
        await db.insert(characterPrimitives).values({ characterId, primitiveId, versionId: latest!.versionId,
          source: "PERSONAL", acquiredAtLevel: 1, slotSource: "PINNED" });
      }
      const initialSlots = await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, characterId));
      const input = { characterId, expectedRevision: 0, targetLevel: 10 };
      expect((await callCreationTool("preview_character_advancement", input, editor)).structuredContent).toMatchObject({ code: "UNAVAILABLE" });
      expect((await callCreationTool("prepare_character_advancement", input))._meta).toMatchObject({ "mcp/www_authenticate": expect.any(Array) });
      const { structuredContent: preview } = await callCreationTool("preview_character_advancement", input, player);
      expect(preview).toMatchObject({
        before: { level: 1, progressionPool: 25, progressionSpent: 16, progressionRemaining: 9, proficiencyBonus: 2, maxVitality: 12, volatilityCeiling: 4 },
        after: { level: 10, progressionPool: 127, progressionSpent: 16, progressionRemaining: 111, proficiencyBonus: 4, maxVitality: 140, volatilityCeiling: 12 },
        currentVitality: 5,
        levelThresholds: [35, 45, 55, 69, 79, 89, 99, 117, 127].map((cumulativeBu, i) => ({ level: i + 2, cumulativeBu })),
      });
      const prepared = await callCreationTool("prepare_character_advancement", input, player);
      expect(prepared.structuredContent).toMatchObject({ summary: preview });
      const { operationId } = prepared.structuredContent as { operationId: string };
      expect((await callCreationTool("apply_character_advancement", { operationId }, player)).isError).toBe(true);
      expect((await db.select().from(characters).where(eq(characters.id, characterId)))[0]?.level).toBe(1);
      const competing = await prepareCharacterAdvancement(player, input);
      await approve(operationId, player);
      await approve(competing.operationId, player);

      state.protectBrowserSession.mockResolvedValue({ userId: author.clerkId });
      const nativeRequest = new Request(`${opts.resource}/level-up`, { method: "POST" });
      expect((await levelUpWebsiteCharacter(nativeRequest, { params: Promise.resolve({ id: characterId }) })).status).toBe(404);
      const first = await callCreationTool("apply_character_advancement", { operationId }, player);
      expect(first.structuredContent).toMatchObject({ state: "completed", receipt: { characterId, appliedRevision: 1, fromLevel: 1,
        level: 10, progressionPool: 127, progressionRemaining: 111, maxVitality: 140 } });
      const { receipt } = first.structuredContent as { receipt: unknown };
      expect((await applyApprovedAdvancement(player, operationId)).receipt).toEqual(receipt);
      expect(await applyApprovedAdvancement(player, competing.operationId)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      const [saved] = await db.select().from(characters).where(eq(characters.id, characterId));
      expect(saved).toMatchObject({ level: 10, currentVitality: 5, dmBonusBu: 0, buSpent: 16, backstory: character!.backstory });
      expect(await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, characterId))).toEqual(initialSlots);
      expect((await readCharacterBuild(player, { characterId }, opts))).toMatchObject({
        foundation: { level: 10 }, revision: 1, budget: { progressionPool: 127, progressionSpent: 16, progressionRemaining: 111 },
      });
      const history = await db.select().from(schema.characterLog).where(eq(schema.characterLog.characterId, characterId));
      expect(history).toMatchObject([{ kind: "level_up", payload: { prevLevel: 1, newLevel: 10, buAwarded: 102, dmBonusAwarded: 0 } }]);
      const versions = await db.select().from(schema.characterVersions).where(eq(schema.characterVersions.characterId, characterId));
      expect(versions).toMatchObject([{ snapshot: { level: 10 } }]);
    } finally {
      state.protectBrowserSession.mockReset();
      vi.unstubAllEnvs();
    }
  });

  it("reviews a consumed DM grant against a custom budget and rejects advancement after that grant changes", async () => {
    enableStaging();
    vi.stubEnv("MCP_CHARACTER_EDIT_READ_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_EDIT_WRITE_ENABLED", "true");
    const player = { ...linked, scopes: [...linked.scopes, "swordweave:edit"] };
    const [character] = await db.insert(characters).values({ userId: actor.clerkId, name: "Custom budget advancement",
      level: 4, startingBu: 200, dmBonusBu: 5, buSpent: 203, currentVitality: null,
      attrPhysical: 4, attrMental: 3, attrMagical: 3 }).returning();
    const characterId = character!.id;
    try {
      const mirrorId = 9071;
      const mirror = { id: mirrorId, userId: actor.clerkId, name: "Fictional watched lamp", category: "CONDITION" as const,
        isPublic: false, buCost: 4, isMirrorable: true, mirrorBuCredit: 4 };
      await db.insert(primitives).values(mirror);
      await db.insert(primitiveVersions).values({ id: pin(mirrorId).versionId, primitiveId: mirrorId, versionNumber: 1,
        deltaKind: "FULL", isLatest: true, snapshot: mirror });
      await db.insert(characterPrimitives).values({ characterId, primitiveId: mirrorId, versionId: pin(mirrorId).versionId,
        source: "PERSONAL", acquiredAtLevel: 4, slotSource: "PINNED", isMirrored: true });
      const input = { characterId, expectedRevision: 0, targetLevel: 5 };
      const review = await prepareCharacterAdvancement(player, input);
      expect(review.summary).toMatchObject({ before: { level: 4, progressionPool: 205, dmBonusBu: 5, progressionRemaining: 2, debtUsed: 0 },
        after: { level: 5, progressionPool: 200, dmBonusBu: 0, maxVitality: 65,
          progressionSpent: 203, ordinarySpent: 200, progressionRemaining: 0, debtUsed: 3, uncoveredExcess: 0 },
        currentVitality: "Track as full", levelThresholds: [{ level: 5, cumulativeBu: 69, gainedBu: 14 }] });
      await approve(review.operationId, player);
      await db.update(characters).set({ dmBonusBu: 8 }).where(eq(characters.id, characterId));
      expect(await applyApprovedAdvancement(player, review.operationId)).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect(await db.select().from(schema.characterLog).where(eq(schema.characterLog.characterId, characterId))).toEqual([]);
      state.protectBrowserSession.mockResolvedValue({ userId: actor.clerkId });
      const nativeRequest = new Request("https://mcp.example/level-up", { method: "POST" });
      expect((await levelUpWebsiteCharacter(nativeRequest, { params: Promise.resolve({ id: characterId }) })).status).toBe(200);
      expect((await db.select().from(characters).where(eq(characters.id, characterId)))[0])
        .toMatchObject({ level: 5, dmBonusBu: 0, currentVitality: null, startingBu: 200 });
    } finally {
      state.protectBrowserSession.mockReset();
      vi.unstubAllEnvs();
    }
  });

  it("authors and acquires a private primitive and a capability for an existing level-ten sheet after review", async () => {
    enableStaging();
    vi.stubEnv("MCP_CHARACTER_EDIT_READ_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_EDIT_WRITE_ENABLED", "true");
    const player = { ...linked, scopes: [...linked.scopes, "swordweave:edit"] };
    const [sheet] = await db.insert(characters).values({ userId: actor.id, name: "Marsh Composition",
      level: 10, attrPhysical: 4, attrMental: 3, attrMagical: 3 }).returning({ id: characters.id });
    const characterId = sheet!.id;
    try {
      const primitive = { characterId, expectedRevision: 0, channel: "MANIFEST", piece: { kind: "primitive", fields: {
        name: "Reviewed Marsh Mist", narrativeRule: "Shape **marsh mist** into cover.", category: "DOMAIN", costTier: "Tier 1", buCost: 4,
        mechanicalRule: { family: "DOMAIN_ACCESS", bindings: { domain: "Marsh Mist" } },
      } } };
      const editOnly = { ...player, scopes: ["swordweave:read", "swordweave:edit"] };
      expect((await callCreationTool("prepare_character_piece", primitive, editOnly)).isError).toBe(true);
      const prepared = (await callCreationTool("prepare_character_piece", primitive, player)).structuredContent as { operationId: string; summary: unknown };
      expect(prepared.summary).toMatchObject({ piece: { kind: "primitive", isPublic: false, narrativeRule: primitive.piece.fields.narrativeRule },
        budget: { before: { pool: 127, spent: 0 }, after: { spent: 4, remaining: 123 } } });
      expect(await db.select().from(primitives).where(eq(primitives.name, primitive.piece.fields.name))).toEqual([]);
      expect(await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId, characterId))).toEqual([]);
      expect((await callCreationTool("apply_character_piece", { operationId: prepared.operationId }, player)).isError).toBe(true);
      await approve(prepared.operationId, player);
      type Receipt = { entityId: string; versionPin: string; appliedRevision: number };
      const apply = async (operationId: string) => (await callCreationTool("apply_character_piece", { operationId }, player)).structuredContent as {
        state: string; receipt: Receipt;
      };
      const first = await apply(prepared.operationId);
      expect(first).toMatchObject({ state: "completed", receipt: { entityKind: "primitive", appliedRevision: 1 } });
      expect((await apply(prepared.operationId)).receipt).toEqual(first.receipt);
      const acquired = { kind: "primitive", id: first.receipt.entityId, versionId: first.receipt.versionPin };
      const capability = { characterId, expectedRevision: 1, channel: "MANIFEST", piece: { kind: "capability", fields: {
        name: "Reviewed Gale Veil", type: "ACTIVE", sourceType: "MAGICAL", verboseDescription: "Weave **mist** as cover for a courier.",
      }, members: [{ pin: acquired, role: "DOMAIN" }, { pin: pin(ids.verb), role: "VERB" }] } };
      const capReview = (await callCreationTool("prepare_character_piece", capability, player)).structuredContent as { operationId: string; summary: unknown };
      expect(capReview.summary).toMatchObject({ piece: { kind: "capability", members: [{ pin: acquired }, { pin: pin(ids.verb) }] },
        budget: { before: { spent: 4 }, after: { spent: 12, remaining: 115 } } });
      expect(await db.select().from(schema.capabilities).where(eq(schema.capabilities.name, capability.piece.fields.name))).toEqual([]);
      await approve(capReview.operationId, player);
      const cap = await apply(capReview.operationId);
      expect(cap).toMatchObject({ state: "completed", receipt: { entityKind: "capability", appliedRevision: 2 } });
      expect((await apply(capReview.operationId)).receipt).toEqual(cap.receipt);
      const after = await readCharacterBuild(player, { characterId }, opts);
      expect(after).toMatchObject({ revision: 2, foundation: { level: 10 }, budget: { progressionSpent: 12, progressionRemaining: 115 } });
      const [snapshot] = await db.select().from(schema.capabilityVersions).where(eq(schema.capabilityVersions.id, cap.receipt.versionPin));
      expect(snapshot?.snapshot).toMatchObject({ isPublic: false, dependencyPins: [
        { id: Number(acquired.id), versionId: acquired.versionId }, { id: ids.verb, versionId: pin(ids.verb).versionId },
      ] });
    } finally { vi.unstubAllEnvs(); }
  });

  it("authors effects, effect-backed capabilities, heritages and items from exact pins through the existing-character MCP tools", async () => {
    enableStaging();
    vi.stubEnv("MCP_CHARACTER_EDIT_READ_ENABLED", "true");
    vi.stubEnv("MCP_CHARACTER_EDIT_WRITE_ENABLED", "true");
    const player = { ...linked, scopes: [...linked.scopes, "swordweave:edit"] };
    const [sheet] = await db.insert(characters).values({ userId: actor.id, name: "Canal Rescue",
      level: 10, attrPhysical: 4, attrMental: 3, attrMagical: 3 }).returning({ id: characters.id });
    const characterId = sheet!.id;
    type Receipt = { entityKind: string; entityId: string; versionPin: string; appliedRevision: number };
    let expectedRevision = 0;
    const prepare = (channel: string, piece: Record<string, unknown>) =>
      callCreationTool("prepare_character_piece", { characterId, expectedRevision, channel, piece }, player);
    const apply = async (operationId: string) => {
      const result = await callCreationTool("apply_character_piece", { operationId }, player);
      expect(result, JSON.stringify(result.content)).not.toHaveProperty("isError", true);
      return result.structuredContent as { state: string; receipt: Receipt };
    };
    async function create(channel: string, piece: Record<string, unknown>) {
      const picked = await prepare(channel, piece);
      expect(picked, JSON.stringify(picked.content)).not.toHaveProperty("isError", true);
      const review = picked.structuredContent as { operationId: string; summary: { piece: unknown; budget: unknown } };
      expect(review.summary.piece).toMatchObject({ kind: piece["kind"], isPublic: false });
      expect(await db.select().from(schema.characterWorkspaceState).where(eq(schema.characterWorkspaceState.characterId, characterId))).toEqual(
        expectedRevision ? [expect.objectContaining({ revision: expectedRevision })] : []);
      expect((await callCreationTool("apply_character_piece", { operationId: review.operationId }, player)).isError).toBe(true);
      await approve(review.operationId, player);
      const first = await apply(review.operationId);
      expect(first).toMatchObject({ state: "completed", receipt: { entityKind: piece["kind"], appliedRevision: ++expectedRevision } });
      expect((await apply(review.operationId)).receipt).toEqual(first.receipt);
      return { kind: first.receipt.entityKind, id: first.receipt.entityId, versionId: first.receipt.versionPin };
    }
    try {
      const effectPiece = { kind: "effect", fields: { name: "Glass Tide", narrativeDescription: "Read the **ripples**." },
        members: [{ pin: pin(ids.verb), quantity: 1 }] };
      expect((await prepare("ITEM", effectPiece)).isError).toBe(true);
      const effect = await create("MANIFEST", effectPiece);
      const capability = await create("MANIFEST", { kind: "capability", fields: {
        name: "Read the Sluice", type: "ACTIVE", sourceType: "MAGICAL", verboseDescription: "Find the safe crossing.",
      }, members: [{ pin: effect }, { pin: pin(ids.verb), role: "VERB" }] });
      const heritage = await create("UPBRINGING", { kind: "heritage", fields: {
        kind: "UPBRINGING", name: "Raised by Lockkeepers", description: "Learned the calls used by the night crew.",
      }, members: [{ pin: capability }] });
      const item = await create("ITEM", { kind: "item", fields: { name: "Sluice Lantern", description: "Green glass lantern.", itemType: "TRINKET",
        rarity: "COMMON", size: "SMALL", buCost: 5, slotCost: 1 }, members: [{ pin: capability }, { pin: effect }] });

      const workspace = await readWorkspace(characterId);
      for (const piece of [effect, capability, heritage, item]) {
        expect(workspace.edges).toEqual(expect.arrayContaining([expect.objectContaining({ parent: null, child: `${piece.kind}:${piece.id}`, versionId: piece.versionId })]));
        expect(workspace.nodes.find(node => node.id === piece.id)).toMatchObject({ userId: player.clerkId, versionId: piece.versionId, data: { isPublic: false } });
      }
      expect(workspace.edges.filter(edge => edge.parent === `capability:${capability.id}`).sort((left, right) => left.order - right.order)).toEqual([
        expect.objectContaining({ child: `effect:${effect.id}`, versionId: effect.versionId }),
        expect.objectContaining({ child: `primitive:${ids.verb}`, versionId: pin(ids.verb).versionId }),
      ]);
      expect(await readCharacterBuild(player, { characterId }, opts)).toMatchObject({ revision: 4, budget: { progressionSpent: 8, itemSpent: 5 } });

      const stale = await prepare("MANIFEST", { kind: "capability", fields: {
        name: "Stale Sluice", type: "ACTIVE", sourceType: "MAGICAL", verboseDescription: "Requires unchanged junctions.",
      }, members: [{ pin: effect }] });
      expect(stale, JSON.stringify(stale.content)).not.toHaveProperty("isError", true);
      const { operationId } = stale.structuredContent as { operationId: string };
      await approve(operationId, player);
      await db.update(schema.effectPrimitives).set({ quantity: 2 }).where(eq(schema.effectPrimitives.effectId, effect.id));
      const denied = await callCreationTool("apply_character_piece", { operationId }, player);
      expect(denied.structuredContent).toMatchObject({ state: "blocked", failureCode: "DEPENDENCY_UNAVAILABLE" });
      expect(await db.select().from(schema.capabilities).where(eq(schema.capabilities.name, "Stale Sluice"))).toEqual([]);
      expect((await readWorkspace(characterId)).revision).toBe(4);
    } finally { vi.unstubAllEnvs(); }
  }, 15_000);

  it.skipIf(!pdfPython)("downloads the identical native character sheet after save with current browser access", async () => {
    enableStaging();
    vi.stubEnv("SWORDWEAVE_PDF_PYTHON", pdfPython!);
    vi.stubEnv("VERCEL", undefined);
    const artifacts = mkdtempSync(join(tmpdir(), "sw-sheet-pdf-test-"));
    try {
      const playerName = "Lantern Courier";
      const review = await openReview(directAuthoringDraft(playerName, "Lantern Wind"));
      await approve(review.operationId);
      await run(review);
      await run(review);
      const saved = await run(review);
      const characterId = (saved.receipt as { characterId: string }).characterId;
      await db.update(characters).set({ notes: "Woven Lantern Signature", dmNotes: "Hidden GM Detail" }).where(eq(characters.id, characterId));
      const config = getMcpConfig()!;
      const identity = { ...actor, scopes: ["swordweave:read"] };
      const server = createSwordWeaveMcpServer(config, identity);
      const client = new Client({ name: "sheet-pdf-fixture", version: "1.0.0" });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const call = async (options?: { orientation: "landscape"; workbench: boolean }) => client.callTool({
        name: "get_character_sheet_pdf_link", arguments: { characterId, ...(options ? { options } : {}) },
      });
      let href: string;
      let customHref: string;
      try {
        const linked = await call();
        const customized = await call({ orientation: "landscape", workbench: true });
        href = (linked.structuredContent as { downloadUrl: string }).downloadUrl;
        customHref = (customized.structuredContent as { downloadUrl: string }).downloadUrl;
      } finally {
        await client.close();
        await server.close();
      }
      expect(href).toBe(`https://mcp.example/api/companion/characters/${characterId}/sheet-pdf`);
      expect(customHref).toBe(`${href}?orientation=landscape&workbench=true`);
      const params = { params: Promise.resolve({ id: characterId }) };

      state.browserSession.mockResolvedValue({ userId: null, sessionId: null });
      const signIn = await downloadCompanionSheet(new Request(customHref), params);
      expect(signIn.status).toBe(307);
      const destination = new URL(signIn.headers.get("Location")!);
      expect(destination.origin + destination.pathname).toBe("https://mcp.example/sign-in");
      expect(destination.searchParams.get("redirect_url")).toBe(customHref);
      state.browserSession.mockResolvedValue({ userId: author.clerkId, sessionId: "fictional-other-session" });
      expect((await downloadCompanionSheet(new Request(href), params)).status).toBe(404);
      expect((await downloadCompanionSheet(new Request(`${href}?view=public`), params)).status).toBe(400);

      state.browserSession.mockResolvedValue({ userId: actor.clerkId, sessionId: "fictional-owner-session" });
      const companion = await downloadCompanionSheet(new Request(href), params);
      const website = await downloadWebsiteSheet(new Request(`https://mcp.example/api/characters/${characterId}/pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      }), params);
      for (const pdf of [companion, website]) {
        expect(pdf.status).toBe(200);
        expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
        expect(pdf.headers.get("Cache-Control")).toContain("private, no-store");
        expect(pdf.headers.get("Content-Disposition")).toBe('attachment; filename="swordweave-lantern-courier-aegis-portrait.pdf"');
      }
      const companionBytes = Buffer.from(await companion.arrayBuffer());
      const websiteBytes = Buffer.from(await website.arrayBuffer());
      expect(companionBytes.toString("ascii", 0, 5)).toBe("%PDF-");
      expect(companionBytes.equals(websiteBytes)).toBe(true);
      const custom = await downloadCompanionSheet(new Request(customHref), params);
      expect(custom.status).toBe(200);
      expect(custom.headers.get("Content-Disposition")).toContain("aegis-landscape.pdf");

      const [share] = await db.insert(schema.characterShares).values({ characterId, sharedWithUserId: author.id, sharedByUserId: actor.clerkId })
        .returning({ id: schema.characterShares.id });
      state.browserSession.mockResolvedValue({ userId: author.clerkId, sessionId: "fictional-collaborator-session" });
      const collaborator = await downloadCompanionSheet(new Request(href), params);
      expect(collaborator.status).toBe(200);
      await db.update(schema.characterShares).set({ revokedAt: new Date() }).where(eq(schema.characterShares.id, share!.id));
      // Revoking the URL's viewer remains effective even if the website's
      // separate public-preview rules would now allow a sanitized sheet.
      await db.update(characters).set({ isPublic: true }).where(eq(characters.id, characterId));
      expect((await downloadCompanionSheet(new Request(href), params)).status).toBe(404);

      const ownerFile = join(artifacts, "owner.pdf");
      const collaboratorFile = join(artifacts, "collaborator.pdf");
      writeFileSync(ownerFile, companionBytes);
      writeFileSync(collaboratorFile, Buffer.from(await collaborator.arrayBuffer()));
      const extract = (file: string) => execFileSync(pdfPython!, ["-c",
        "import sys; from pypdf import PdfReader; print(chr(10).join(page.extract_text() for page in PdfReader(sys.argv[1]).pages))", file], { encoding: "utf8" });
      const ownerText = extract(ownerFile);
      expect(ownerText).toContain(playerName);
      expect(ownerText).toContain("Woven Lantern Signature");
      expect(ownerText).not.toContain("Hidden GM Detail");
      expect(extract(collaboratorFile)).not.toContain("Woven Lantern Signature");
    } finally {
      rmSync(artifacts, { recursive: true, force: true });
      state.browserSession.mockReset();
      vi.unstubAllEnvs();
    }
  }, 30000);

  it("opens only authorized companions and their exact Bestiary pins, and exports both independent sheets", async () => {
    enableStaging();
    vi.stubEnv("MCP_CHARACTER_COMPANIONS_READ_ENABLED", "true");
    vi.stubEnv("SWORDWEAVE_PDF_PYTHON", pdfPython);
    vi.stubEnv("VERCEL", undefined);
    const ownerSession = { userId: actor.clerkId, sessionId: "fictional-owner-session" };
    const shareSession = { userId: author.clerkId, sessionId: "fictional-share-session" };
    const origin = new URL(opts.resource).origin;
    const json = (url: string, method: string, body: unknown) => new Request(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const config = getMcpConfig()!;
    const withClient = async <T>(identity: { clerkId: string; scopes: string[] }, work: (client: Client) => Promise<T>) => {
      const server = createSwordWeaveMcpServer(config, identity);
      const client = new Client({ name: "character-companions-fixture", version: "1.0.0" });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        return await work(client);
      } finally {
        await client.close();
        await server.close();
      }
    };
    try {
      const [characterRow] = await db.insert(characters).values({ name: "Estuary Scout", userId: actor.clerkId,
        attrPhysical: 4, attrMental: 3, attrMagical: 3 }).returning({ id: characters.id });
      const characterId = characterRow!.id;
      const characterParams = { params: Promise.resolve({ id: characterId }) };
      const keeperClerkId = "user_fiction_bestiary_keeper";
      await db.insert(users).values({ clerkUserId: keeperClerkId, username: "bestiary_keeper" });
      const definition = { name: "Original Marsh Kite", budget: 25, baselineVitality: 13,
        attributes: { physical: 1, mental: 1, magical: 1 }, concept: "An **estuary** scout." };
      const template = await createMonster(keeperClerkId, definition, true);
      const templateParams = { params: Promise.resolve({ id: template.id }) };
      const companionApi = `${origin}/api/characters/${characterId}/companions`;
      const draftApi = `${origin}/api/characters/${characterId}/workspace/draft`;
      const listFor = (clerkId: string, scopes = ["swordweave:read"]) => withClient({ clerkId, scopes }, client =>
        client.callTool({ name: "list_character_companions", arguments: { characterId } }));
      const getLinks = async (clerkId: string) => {
        const response = await listFor(clerkId);
        expect(response.isError).not.toBe(true);
        return response.structuredContent as Awaited<ReturnType<typeof listCharacterCompanionLinks>>;
      };
      expect((await getLinks(actor.clerkId)).companions).toEqual([]);
      expect((await listFor(actor.clerkId, [])).isError).toBe(true);
      expect((await listFor(author.clerkId)).isError).toBe(true);

      state.browserSession.mockResolvedValue(ownerSession);
      state.protectBrowserSession.mockResolvedValue(ownerSession);
      const names = ["Reef Scout", "Mire Scout"];
      const saved = await saveWebsiteDraft(json(draftApi, "PUT", { expectedVersion: 0, baseRevision: 0, review: true,
        operations: names.map(name => ({ id: randomUUID(), type: "companion", payload: { action: "add", templateId: template.id, name, version: 1 } })),
      }), characterParams);
      expect(saved.status).toBe(200);
      const { draft: pending, preview } = await saved.json();
      expect(preview).toMatchObject({ applied: false, companionChanges: names.map(name => ({ action: "add", name })) });
      expect((await getLinks(actor.clerkId)).companions).toEqual([]);
      const applyDraft = () => decideWebsiteDraft(json(draftApi, "POST", { action: "apply", draftId: pending.id,
        expectedVersion: pending.version }), characterParams);
      const applied = await applyDraft();
      expect(applied.status).toBe(200);
      expect(await applied.json()).toMatchObject({ applied: true, revision: 1, buSpent: 0 });
      expect((await applyDraft()).status).toBe(200);

      const links = await getLinks(actor.clerkId);
      expect(links.sheetUrl).toBe(`${origin}/characters/${characterId}?section=companions`);
      expect(links.companions.map(({ name }) => name)).toEqual(names);
      const copies = links.companions.map(companion => new URL(companion.playSheetUrl!));
      expect(copies[0]?.pathname).not.toBe(copies[1]?.pathname);
      expect(copies.every(url => url.origin === origin && url.searchParams.get("character") === characterId)).toBe(true);
      const copyIds = copies.map(url => url.pathname.split("/").at(-1)!);
      const copyParams = copyIds.map(id => ({ params: Promise.resolve({ id }) }));
      const copyRequests = copyIds.map(id => `${origin}/api/monsters/copies/${id}`);
      expect((await deleteWebsitePlayCopy(new Request(copyRequests[0]!, { method: "DELETE" }), copyParams[0]!)).status).toBe(409);
      const bestiaryUrl = `${origin}/api/monsters/${template.id}?version=1`;
      expect(links.companions[0]?.bestiary).toEqual({ name: definition.name, version: 1,
        url: `${origin}/monsters/${template.id}?version=1` });
      await publishMonster(template.id, keeperClerkId, { ...definition, name: "Renewed Marsh Kite" }, true);
      const pinned = await readBestiaryEntry(new Request(bestiaryUrl), templateParams);
      expect(pinned.status).toBe(200);
      expect((await pinned.json()).monster.name).toBe(definition.name);

      const injury = { id: "torn-sail", title: "Torn Sail", description: "**Brine-stiff** wing membranes.",
        tags: [], modifiers: [], durationTier: "short_rest", active: true, createdAt: 1, source: "custom", status: "active" };
      const mutation = { opId: randomUUID(), baseRevision: 0, changes: [
        { field: "currentVitality", value: 4 }, { field: "consequence:torn-sail", value: injury },
      ] };
      const change = await changeWebsitePlayCopy(json(copyRequests[0]!, "PATCH", mutation), copyParams[0]!);
      expect(change.status).toBe(200);
      expect(await change.json()).toMatchObject({ state: { revision: 1 } });
      const firstCopy = await readWebsitePlayCopy(new Request(copyRequests[0]!), copyParams[0]!);
      expect(await firstCopy.json()).toMatchObject({ sheet: { currentVitality: 4, maximum: 13 },
        state: { overrides: { "consequence:torn-sail": injury } } });

      const [share] = await db.insert(schema.characterShares).values({ characterId, sharedWithUserId: author.id,
        sharedByUserId: actor.clerkId }).returning({ id: schema.characterShares.id });
      if (pdfPython) {
        // Only the first copy has been opened. Export must not initialize the other one.
        const unopened = () => db.select().from(schema.playStates).where(and(
          eq(schema.playStates.subjectKind, "MONSTER_PLAY_COPY"), eq(schema.playStates.subjectId, copyIds[1]!),
        ));
        expect(await unopened()).toHaveLength(0);
        const companionPdf = await downloadCompanionSheet(new Request(links.downloadUrl), characterParams);
        const websitePdf = await downloadWebsiteSheet(json(`${origin}/api/characters/${characterId}/pdf`, "POST", {}), characterParams);
        expect(companionPdf.status).toBe(200);
        expect(websitePdf.status).toBe(200);
        const bytes = Buffer.from(await companionPdf.arrayBuffer());
        expect(bytes.equals(Buffer.from(await websitePdf.arrayBuffer()))).toBe(true);
        const pages = (data: Buffer): string[] => JSON.parse(execFileSync(pdfPython, ["-c", [
          "import io, json, sys", "from pypdf import PdfReader",
          "print(json.dumps([page.extract_text() for page in PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages]))",
        ].join("\n")], { input: data, encoding: "utf8" }));
        const printed = pages(bytes);
        expect(printed.at(-2)).toMatch(/Reef Scout[\s\S]*Torn Sail[\s\S]*Brine-stiff/);
        expect(printed.at(-1)).toContain("Mire Scout");
        expect(printed.at(-1)).not.toContain("Torn Sail");
        expect(await unopened()).toHaveLength(0);
        state.browserSession.mockResolvedValue(shareSession);
        const shared = await downloadCompanionSheet(new Request(links.downloadUrl), characterParams);
        expect(shared.status).toBe(200);
        expect(pages(Buffer.from(await shared.arrayBuffer())).join("\n")).not.toMatch(/Reef Scout|Mire Scout|Torn Sail/);
      }
      state.browserSession.mockResolvedValue(ownerSession);
      const secondCopy = await readWebsitePlayCopy(new Request(copyRequests[1]!), copyParams[1]!);
      expect(await secondCopy.json()).toMatchObject({ sheet: { currentVitality: 13, maximum: 13 }, state: { overrides: {} } });

      const mixed = await saveWebsiteDraft(json(draftApi, "PUT", { expectedVersion: 0, baseRevision: 1, review: true, operations: [
        { id: randomUUID(), type: "character", payload: { name: "Uncommitted change" } },
        { id: randomUUID(), type: "companion", payload: { action: "add", templateId: template.id, version: 2, name: "Uncommitted copy" } },
      ] }), characterParams);
      expect(mixed.status).toBe(200);
      const { draft: stale, preview: mixedPreview } = await mixed.json();
      expect(mixedPreview).toMatchObject({ applied: false, companionChanges: [{ action: "add", name: "Uncommitted copy" }] });
      await publishMonster(template.id, keeperClerkId, { ...definition, name: "Night Tide Kite" }, true);
      expect((await decideWebsiteDraft(json(draftApi, "POST", { action: "apply", draftId: stale.id, expectedVersion: stale.version }), characterParams)).status).toBe(409);
      expect(await db.select({ name: characters.name }).from(characters).where(eq(characters.id, characterId))).toEqual([{ name: "Estuary Scout" }]);
      expect(await getLinks(actor.clerkId)).toEqual(links);
      expect(await db.select({ id: schema.monsterCopies.id }).from(schema.monsterCopies)
        .where(eq(schema.monsterCopies.templateId, template.id))).toHaveLength(2);
      expect((await discardWebsiteDraft(json(draftApi, "DELETE", { draftId: stale.id, expectedVersion: stale.version }), characterParams)).status).toBe(200);

      const detached = await saveWebsiteDraft(json(draftApi, "PUT", { expectedVersion: 0, baseRevision: 1, operations: [
        { id: randomUUID(), type: "companion", payload: { action: "remove", attachmentId: pending.operations[0].id } },
      ] }), characterParams);
      expect(detached.status).toBe(200);
      const { draft: removal } = await detached.json();
      const decideRemoval = (action: "apply" | "undo") => decideWebsiteDraft(json(draftApi, "POST", {
        action, draftId: removal.id, expectedVersion: removal.version,
      }), characterParams);
      expect((await decideRemoval("apply")).status).toBe(200);
      expect((await getLinks(actor.clerkId)).companions).toEqual(links.companions.slice(1));
      expect((await decideRemoval("undo")).status).toBe(200);
      expect(await getLinks(actor.clerkId)).toEqual(links);
      expect(await (await readWebsitePlayCopy(new Request(copyRequests[0]!), copyParams[0]!)).json())
        .toMatchObject({ sheet: { currentVitality: 4 }, state: { overrides: { "consequence:torn-sail": injury } } });

      state.browserSession.mockResolvedValue(shareSession);
      const shared = await getLinks(author.clerkId);
      expect(shared.companions).toEqual(names.map(() => ({ name: definition.name, bestiary: links.companions[0]?.bestiary })));
      expect((await readWebsitePlayCopy(new Request(copyRequests[0]!), copyParams[0]!)).status).toBe(404);
      await db.update(schema.characterShares).set({ canEdit: true }).where(eq(schema.characterShares.id, share!.id));
      state.protectBrowserSession.mockResolvedValue(shareSession);
      expect(await getLinks(author.clerkId)).toEqual(shared);
      const editorDraft = await saveWebsiteDraft(json(draftApi, "PUT", { expectedVersion: 0, baseRevision: 3, operations: [
        { id: randomUUID(), type: "companion", payload: { action: "remove", attachmentId: pending.operations[0].id } },
      ] }), characterParams);
      expect(editorDraft.status).toBe(403);
      expect(await (await listWebsiteCompanions(new Request(`${companionApi}?view=public`), characterParams)).json())
        .toEqual({ companions: [] });

      await publishMonster(template.id, keeperClerkId, { ...definition, name: "Night Tide Kite" }, false);
      expect((await getLinks(author.clerkId)).companions).toEqual([]);
      expect((await readBestiaryEntry(new Request(bestiaryUrl), templateParams)).status).toBe(404);
      const privateSource = await getLinks(actor.clerkId);
      expect(privateSource.companions).toEqual(links.companions.map(({ name, playSheetUrl }) => ({ name, playSheetUrl })));
      state.browserSession.mockResolvedValue(ownerSession);
      expect(await (await readWebsitePlayCopy(new Request(copyRequests[0]!), copyParams[0]!)).json())
        .toMatchObject({ sheet: { currentVitality: 4 } });

      await db.update(schema.characterShares).set({ revokedAt: new Date() }).where(eq(schema.characterShares.id, share!.id));
      expect((await listFor(author.clerkId)).isError).toBe(true);
      state.browserSession.mockResolvedValue(shareSession);
      expect((await downloadCompanionSheet(new Request(links.downloadUrl), characterParams)).status).toBe(404);
    } finally {
      state.browserSession.mockReset();
      state.protectBrowserSession.mockReset();
      vi.unstubAllEnvs();
    }
  }, 45000);
});
