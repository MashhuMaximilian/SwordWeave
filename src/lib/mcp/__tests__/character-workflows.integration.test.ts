import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { submitCharacterProposal as submitNativeProposal } from "@/lib/character/workspace/collaboration";
import { readWorkspace } from "@/lib/character/workspace/read";
import { buildCanonicalEffectPayload, buildCanonicalItemPayload, buildCanonicalTemplatePayload } from "@/lib/publishing/hash-content";
import { withDependencyPins } from "@/lib/versions/capture-dependency-pins";
import type { McpActor } from "../auth";
import { findCreations } from "../catalogue";
import { listAccessibleCharacters, readCharacterBuild, CharacterContextUnavailable, ContextCursorError } from "../character-context";
import { applyCharacterEdit, prepareCharacterEdit, previewCharacterEdit } from "../character-edits";
import { listCharacterProposals, readCharacterProposal } from "../character-proposals";
import { getOperationReview, getOperationStatus, approveStagingOperation } from "../operations";
import { previewPlayAction, preparePlayAction, applyPlayAction } from "../play-actions";
import { readCharacterHistory, readCharacterPlayState } from "../play-context";
import { prepareCharacterProposal, prepareProposalDecision, previewCharacterProposal, reviewCharacterProposal, submitCharacterProposal } from "../proposal-actions";
import { prepareVersionProposal, prepareVersionProposalDecision, reviewVersionProposal, submitVersionProposal } from "../version-proposal-actions";
import { saveVersionProposal } from "@/lib/character/version-proposals";
import { previewSessionNote, prepareSessionNote, saveSessionNote } from "../session-notes";
import { readCharacterConsequencePackage } from "@/lib/character/consequences/apply-package";
import { PATCH as decideWebsiteProposal } from "@/app/api/characters/[id]/proposals/[proposalId]/route";
import { POST as decideWebsiteWorkspaceProposal } from "@/app/api/characters/[id]/workspace/collaboration/route";
import { getMcpConfig } from "../config";
import { createSwordWeaveMcpServer } from "../server";

type Database = ReturnType<typeof drizzle<typeof schema>>;
type Row = Record<string, unknown>;
type FixtureConnection = {
  query(text: string, parameters?: unknown[], options?: {
    rowMode: "array" | "object";
    parsers: Record<number, (value: string) => string>;
  }): Promise<{ rows: Row[] }>;
};
type FixtureDatabase = FixtureConnection & {
  exec(text: string): Promise<unknown>;
  close(): Promise<void>;
  transaction<T>(work: (connection: FixtureConnection) => Promise<T>): Promise<T>;
};

const scope = new AsyncLocalStorage<Database>();
const fixture = vi.hoisted(() => ({ database: vi.fn<() => Database>(), transaction: vi.fn() }));
const authFixture = vi.hoisted(() => ({ protect: vi.fn() }));
vi.mock("@clerk/nextjs/server", async importOriginal => ({
  ...await importOriginal<typeof import("@clerk/nextjs/server")>(),
  auth: Object.assign(() => authFixture.protect(), { protect: authFixture.protect }),
}));
vi.mock("@/db/client", () => ({
  db: new Proxy({}, { get(_, key) {
    const active = fixture.database();
    if (key === "execute") return async (query: Parameters<Database["execute"]>[0]) => ({ rows: await active.execute(query) });
    if (key === "transaction") return fixture.transaction;
    const value = Reflect.get(active, key);
    return typeof value === "function" ? value.bind(active) : value;
  }}),
  getDb: () => new Proxy(fixture.database(), { get(database, key) {
    if (key === "transaction") return fixture.transaction;
    return Reflect.get(database, key);
  }}),
  withExistingTransaction: <T,>(tx: Database, work: () => T) => scope.run(tx, work),
  withDatabaseTransaction: fixture.transaction,
}));

// Optional PostgreSQL-compatible fixture, always in memory. No site database is opened.
const fixturePath = process.env["SW_COMPANION_PGLITE_PATH"];
function connect(connection: FixtureConnection) {
  const unchanged = (value: string) => value;
  return drizzle((query, parameters, method) => connection.query(query, parameters, {
    rowMode: method === "all" ? "array" : "object",
    parsers: { 1082: unchanged, 1114: unchanged, 1184: unchanged, 1186: unchanged },
  }), { schema });
}

const owner = { id: "10000000-0000-4000-8000-000000000001", clerkId: "user_owner" };
const editor = { id: "10000000-0000-4000-8000-000000000002", clerkId: "user_editor" };
const outsider = { id: "10000000-0000-4000-8000-000000000003", clerkId: "user_outside" };
const suggester = { id: "10000000-0000-4000-8000-000000000004", clerkId: "user_suggest" };
const viewer = { id: "10000000-0000-4000-8000-000000000005", clerkId: "user_view" };
const id = "20000000-0000-4000-8000-000000000001";
const plain = "20000000-0000-4000-8000-000000000002";
const publicOnly = "20000000-0000-4000-8000-000000000003";
const heritage = "30000000-0000-4000-8000-000000000001";
const config = { resource: "https://example.test/api/mcp", cursorSecret: "fictional-cursor-secret-at-least-32-bytes" };

describe.skipIf(!fixturePath)("isolated companion character workflows", () => {
  let pg: FixtureDatabase;
  let database: Database;

  beforeAll(async () => {
    const { PGlite } = createRequire(import.meta.url)(fixturePath!) as { PGlite: new () => FixtureDatabase };
    pg = new PGlite();
    database = connect(pg);
    fixture.database.mockImplementation(() => scope.getStore() ?? database);
    fixture.transaction.mockImplementation((work: (transaction: Database) => Promise<unknown>) => {
      const active = scope.getStore();
      return active ? work(active) : pg.transaction(connection => {
        const transaction = connect(connection);
        return scope.run(transaction, () => work(transaction));
      });
    });
    const ddl = execFileSync(process.execPath, [
      "node_modules/drizzle-kit/bin.cjs", "export", "--dialect=postgresql",
      "--schema=./src/db/schema/index.ts", "--sql",
    ], { encoding: "utf8", maxBuffer: 2_000_000 });
    await pg.exec(ddl);
    await pg.exec(`
      INSERT INTO users (id, clerk_user_id, username) VALUES
      ('${owner.id}', '${owner.clerkId}', 'row-owner'), ('${editor.id}', '${editor.clerkId}', 'row-editor'),
      ('${outsider.id}', '${outsider.clerkId}', 'row-outsider'), ('${suggester.id}', '${suggester.clerkId}', 'row-suggester'),
      ('${viewer.id}', '${viewer.clerkId}', 'row-viewer');
      INSERT INTO characters (id, user_id, name, is_public, current_vitality, notes, dm_notes, attr_physical, attr_mental, attr_magical) VALUES
      ('${id}', '${owner.clerkId}', 'A playable example', true, 7, 'Secret notes', 'Secret DM notes', 4, 3, 3),
      ('${plain}', '${owner.id}', 'B owner UUID', false, null, null, null, 4, 3, 3),
      ('${publicOnly}', '${editor.clerkId}', 'Public only', true, null, null, null, 4, 3, 3);
      INSERT INTO characters (user_id, name, attr_physical, attr_mental, attr_magical) SELECT '${owner.clerkId}', 'Roster ' || x, 4, 3, 3 FROM generate_series(1, 9) x;
      INSERT INTO character_shares (character_id, shared_with_user_id, shared_by_user_id, can_edit)
      VALUES ('${id}', '${editor.id}', '${owner.clerkId}', true),
      ('${id}', '${suggester.id}', '${owner.clerkId}', false), ('${id}', '${viewer.id}', '${owner.clerkId}', false);
      INSERT INTO character_workspace_commands (character_id, command_id, kind, request_hash, result)
      SELECT character_id, 'share-role:' || id::text, 'share-role', '', '{"canSuggest":true}' FROM character_shares
      WHERE shared_with_user_id = '${suggester.id}';
      INSERT INTO heritage (id, user_id, kind, name, is_public)
      VALUES ('${heritage}', '${owner.clerkId}', 'LINEAGE', 'Visible lineage', true);
      INSERT INTO primitives (id, user_id, category, name, is_public, bu_cost)
      VALUES (100, '${outsider.clerkId}', 'VITALITY', 'Private primitive name', false, 9);
      INSERT INTO heritage_primitives (template_id, primitive_id) VALUES ('${heritage}', 100);
      INSERT INTO character_heritages (character_id, heritage_id) VALUES ('${id}', '${heritage}');
      INSERT INTO character_primitives (character_id, primitive_id, origin_heritage_id, source) VALUES ('${id}', 100, '${heritage}', 'LINEAGE');
      INSERT INTO character_log (character_id, kind, payload, created_at)
      SELECT '${id}', 'vitality_change', jsonb_build_object('prev', x, 'next', x+1, 'delta', 1, 'extra', 'private'), '2026-11-23T17:00:00Z'::timestamptz + (x * interval '1 microsecond')
      FROM generate_series(1, 25) x;
    `);
  }, 60_000);
  afterAll(() => pg?.close());

  it("uses exact owner and share roles, handles revocations, and scopes a roster cursor", async () => {
    const page = await listAccessibleCharacters(owner, {}, config);
    expect(page.items).toHaveLength(8);
    expect(page.items.slice(0,2).map(item => item.permission)).toEqual(["OWNER", "OWNER"]);
    expect(page.nextCursor).toBeTruthy();
    expect((await listAccessibleCharacters(owner, {cursor:page.nextCursor!}, config)).items).toHaveLength(3);
    await expect(listAccessibleCharacters(editor, {cursor:page.nextCursor!}, config)).rejects.toBeInstanceOf(ContextCursorError);
    expect((await listAccessibleCharacters(suggester, {}, config)).items[0]?.permission).toBe("SUGGESTER");
    expect((await listAccessibleCharacters(viewer, {}, config)).items[0]?.permission).toBe("VIEWER");
    expect((await listAccessibleCharacters(outsider, {}, config)).items).toEqual([]);
    await expect(readCharacterBuild(outsider, {characterId:id}, config)).rejects.toBeInstanceOf(CharacterContextUnavailable);
    await pg.query("UPDATE character_shares SET revoked_at=now() WHERE shared_with_user_id=$1", [viewer.id]);
    expect((await listAccessibleCharacters(viewer, {}, config)).items).toEqual([]);
  });
  it("filters nested private details and budget, and projects absent or divergent play rows without writes", async () => {
    const build = await readCharacterBuild(editor, {characterId:id}, config);
    expect(build.slots.map(slot => slot.name)).toEqual(["Visible lineage"]);
    expect(build).toMatchObject({budget:null,partial:true,revision:0});
    expect(JSON.stringify(build)).not.toMatch(/Private primitive|Secret DM|Secret notes/);
    expect((await readCharacterBuild(owner, {characterId:plain}, config)).budget?.progressionPool).toBe(25);
    const state = await readCharacterPlayState(editor, {characterId:id}, config);
    expect(state).toMatchObject({revision:1,currentVitality:7,maxVitality:null});
    expect(state).not.toHaveProperty("consequences");
    expect((await pg.query("SELECT count(*)::int AS count FROM play_states")).rows[0]?.["count"]).toBe(0);
    await pg.query("INSERT INTO play_states (subject_kind,subject_id,revision,overrides) VALUES ('CHARACTER',$1,3,'{\"currentVitality\":2}')", [id]);
    expect((await readCharacterPlayState(owner, {characterId:id}, config)).revision).toBe(4);
    expect((await pg.query("SELECT revision,overrides FROM play_states WHERE subject_id=$1", [id])).rows)
      .toEqual([{revision:3,overrides:{currentVitality:2}}]);
  });
  it("keeps a full authorized budget on a truncated build and applies drawback credit to spending", async () => {
    const characterId = "20000000-0000-4000-8000-000000000110";
    await pg.exec(`
      INSERT INTO characters (id, user_id, name, level, bu_spent, attr_physical, attr_mental, attr_magical)
      VALUES ('${characterId}', '${owner.clerkId}', 'Large budget read', 10, 139, 4, 3, 3);
      INSERT INTO character_shares (character_id, shared_with_user_id, shared_by_user_id, can_edit)
      VALUES ('${characterId}', '${editor.id}', '${owner.clerkId}', true);
      INSERT INTO primitives (id, user_id, category, name, is_public, bu_cost, is_mirrorable, mirror_bu_credit)
      SELECT 9500 + x, '${owner.clerkId}', 'VITALITY', 'Purchase ' || x, x <> 44,
        CASE WHEN x = 41 THEN 19 WHEN x >= 42 THEN 4 ELSE 3 END, x >= 42, CASE WHEN x >= 42 THEN 4 ELSE 0 END
      FROM generate_series(1, 44) x;
      INSERT INTO character_primitives (character_id, primitive_id, is_mirrored)
      SELECT '${characterId}', 9500 + x, x >= 42 FROM generate_series(1, 44) x;
    `);
    const completeBudget = await readCharacterBuild(owner, { characterId }, config);
    expect(completeBudget.slots).toHaveLength(40);
    expect(completeBudget).toMatchObject({ partial: true, budget: {
      progressionPool: 127, progressionSpent: 139, progressionRemaining: 0, ordinarySpent: 127, netSpent: 127,
      drawbackCredit: 12, debtUsed: 12, debtAvailable: 0, debtCeiling: 12, debtExceeded: false, uncoveredExcess: 0, itemSpent: 0,
    } });
    const preview = await previewCharacterEdit(owner, { characterId, expectedRevision: 0, intent: "apply",
      changes: [{ kind: "set_foundation", fields: { name: "Large budget renamed" } }] }, config);
    const expectedSpending = { spent: 139, pool: 127, remaining: 0, debtUsed: 12, debtAvailable: 0, uncoveredExcess: 0 };
    expect(preview).toMatchObject({ blockers: [], warnings: [], budgetDelta: { before: expectedSpending, after: expectedSpending } });
    const restricted = await readCharacterBuild(editor, { characterId }, config);
    expect(restricted.slots).toHaveLength(40);
    expect(restricted).toMatchObject({ partial: true, budget: null });
    expect(JSON.stringify(restricted)).not.toContain("Purchase 44");
  });
  it("lists only owner history and preserves microsecond ordering across pages", async () => {
    await expect(readCharacterHistory(editor, {characterId:id}, config)).rejects.toBeInstanceOf(CharacterContextUnavailable);
    const page = await readCharacterHistory(owner, {characterId:id}, config);
    expect(page.entries).toHaveLength(20);
    expect(page.entries.map(entry => "previous" in entry ? entry.previous : null)).toEqual(Array.from({length:20},(_,i)=>25-i));
    expect(JSON.stringify(page)).not.toContain("private");
    const next = await readCharacterHistory(owner, {characterId:id,cursor:page.nextCursor!}, config);
    expect(next.entries.map(entry => "previous" in entry ? entry.previous : null)).toEqual([5,4,3,2,1]);
    await expect(readCharacterHistory(owner, {characterId:plain,cursor:page.nextCursor!}, config)).rejects.toBeInstanceOf(ContextCursorError);
  });

  it("reads the exact primitive occurrence and reconstructs wrapped FULL and DELTA with subtype-scoped references", async () => {
    const characterId = "20000000-0000-4000-8000-000000000123";
    const original = "41000000-0000-4000-8000-000000000001";
    const proposed = "41000000-0000-4000-8000-000000000002";
    const otherPin = "41000000-0000-4000-8000-000000000003";
    const first = "42000000-0000-4000-8000-000000000001";
    const second = "42000000-0000-4000-8000-000000000002";
    const proposalId = "43000000-0000-4000-8000-000000000010";
    const versionConfig = { ...config, versionProposalReads: true };
    await pg.exec(`
      INSERT INTO characters (id, user_id, name, attr_physical, attr_mental, attr_magical)
      VALUES ('${characterId}', '${owner.id}', 'Exact version reviewer', 4, 3, 3);
      INSERT INTO character_shares (character_id, shared_with_user_id, shared_by_user_id, can_edit)
      VALUES ('${characterId}', '${editor.id}', '${owner.clerkId}', true),
      ('${characterId}', '${suggester.id}', '${owner.clerkId}', false);
      INSERT INTO primitives (id, user_id, category, name, is_public, bu_cost) VALUES
      (123, '${owner.clerkId}', 'VITALITY', 'Live name', true, 7),
      (124, '${owner.clerkId}', 'VITALITY', 'Other definition', true, 9);
      INSERT INTO primitive_versions (id, primitive_id, version_number, delta_kind, snapshot)
      VALUES ('${original}', 123, 1, 'FULL', '{"id":123,"data":{"name":"Before","buCost":4}}'),
      ('${proposed}', 123, 2, 'DELTA', '{"data":{"value":{"name":"After","buCost":6},"__prev":{"name":"Before","buCost":4}}}'),
      ('${otherPin}', 124, 1, 'FULL', '{"name":"Other definition","buCost":9}');
      INSERT INTO character_primitives (character_id, primitive_id, instance_id, version_id)
      VALUES ('${characterId}', 123, '${first}', '${original}'), ('${characterId}', 123, '${second}', '${original}');
      INSERT INTO character_proposals (id, character_id, proposer_user_id, target_kind, target_id,
        current_version_id, proposed_version_id, proposed_diff, rationale, updated_at)
      VALUES ('${proposalId}', '${characterId}', '${editor.clerkId}', 'PRIMITIVE', '123', '${original}', '${proposed}',
        '{"instanceId":"${second}","fieldChanges":[{"field":"raw replay"}]}', '**Fictional reason**', '2026-11-23 17:00:00.000010Z');
      INSERT INTO character_proposals (id, character_id, proposer_user_id, target_kind, target_id,
        current_version_id, proposed_version_id, proposed_diff, updated_at)
      SELECT ('43000000-0000-4000-8000-00000000000' || n)::uuid,
        '${characterId}', '${suggester.clerkId}', 'PRIMITIVE', '123', '${original}', '${proposed}', '{}',
        '2026-11-23 17:00:00Z'::timestamptz + interval '1 microsecond' * n
      FROM generate_series(1,9) n;
    `);
    const listing = { characterId, subtype: "version" as const };
    await expect(listCharacterProposals(owner, listing, config)).rejects.toThrow(/unavailable/i);
    expect((await listCharacterProposals(owner, { characterId }, versionConfig)).items).toEqual([]);
    const page = await listCharacterProposals(owner, listing, versionConfig);
    expect(page.items).toHaveLength(8);
    expect(page.items[0]).toMatchObject({ status: "PENDING", subtype: "version" });
    expect(JSON.stringify(page)).not.toContain(proposalId);
    const next = await listCharacterProposals(owner, { ...listing, cursor: page.nextCursor! }, versionConfig);
    expect(next.items).toHaveLength(2);
    await expect(listCharacterProposals(owner, { characterId, cursor: page.nextCursor! }, versionConfig)).rejects.toThrow(/unavailable/i);
    await expect(listCharacterProposals(editor, { ...listing, cursor: page.nextCursor! }, versionConfig)).rejects.toThrow(/unavailable/i);

    const detailInput = { characterId, proposalRef: page.items[0]!.proposalRef };
    await expect(readCharacterProposal(owner, detailInput, config)).rejects.toThrow(/unavailable/i);
    await expect(readCharacterProposal(editor, detailInput, versionConfig)).rejects.toThrow(/unavailable/i);
    await expect(readCharacterProposal(owner, { ...detailInput, characterId: plain }, versionConfig)).rejects.toThrow(/unavailable/i);
    const detail = await readCharacterProposal(owner, detailInput, versionConfig);
    expect(detail).toMatchObject({
      description: "**Fictional reason**", reviewAvailable: true, path: [second],
      diff: { fieldChanges: [{ field: "name", from: "Before", to: "After" }, { field: "buCost", from: 4, to: 6 }] },
    });
    expect(JSON.stringify(detail)).not.toMatch(/raw replay|Live name/);
    expect(await readCharacterProposal(owner, { characterId, proposalRef: next.items[0]!.proposalRef }, versionConfig))
      .toMatchObject({ reviewAvailable: false, description: "" });
    await pg.query("UPDATE character_primitives SET origin_heritage_id=$1 WHERE instance_id=$2", [heritage, second]);
    expect(await readCharacterProposal(owner, { characterId, proposalRef: next.items[0]!.proposalRef }, versionConfig))
      .toMatchObject({ reviewAvailable: false, description: "" });
    await pg.query("UPDATE character_primitives SET origin_heritage_id=null WHERE instance_id=$1", [second]);
    const authorPage = await listCharacterProposals(editor, listing, versionConfig);
    expect(authorPage.items).toHaveLength(1);
    const asAuthor = { characterId, proposalRef: authorPage.items[0]!.proposalRef };
    expect(await readCharacterProposal(editor, asAuthor, versionConfig)).toMatchObject({ path: [second] });
    await pg.query("UPDATE character_shares SET revoked_at=now() WHERE character_id=$1 AND shared_with_user_id=$2", [characterId, editor.id]);
    await expect(readCharacterProposal(editor, asAuthor, versionConfig)).rejects.toBeInstanceOf(CharacterContextUnavailable);

    await pg.query("UPDATE character_proposals SET proposed_version_id=$1 WHERE id=$2", [otherPin, proposalId]);
    expect(await readCharacterProposal(owner, detailInput, versionConfig)).toMatchObject({ reviewAvailable: false, description: "" });
    await pg.query("UPDATE character_proposals SET proposed_version_id=$1 WHERE id=$2", [proposed, proposalId]);
    await pg.query("UPDATE primitive_versions SET version_number=3 WHERE id=$1", [proposed]);
    expect(await readCharacterProposal(owner, detailInput, versionConfig)).toMatchObject({ reviewAvailable: false, description: "" });
    await pg.query("UPDATE primitive_versions SET version_number=2 WHERE id=$1", [proposed]);
    await pg.query("UPDATE character_primitives SET version_id=$1 WHERE instance_id=$2", [proposed, second]);
    expect(await readCharacterProposal(owner, detailInput, versionConfig)).toMatchObject({ reviewAvailable: false, description: "" });
    await pg.query("UPDATE character_proposals SET status='APPLIED' WHERE id=$1", [proposalId]);
    expect(await readCharacterProposal(owner, detailInput, versionConfig)).toMatchObject({ reviewAvailable: true, path: [second] });
  });

  it("withholds version prose and diff when either exact historical composition has a private dependency", async () => {
    const characterId = "20000000-0000-4000-8000-000000000124";
    const capability = "44000000-0000-4000-8000-000000000001";
    const effect = "44000000-0000-4000-8000-000000000002";
    const original = "45000000-0000-4000-8000-000000000001";
    const proposed = "45000000-0000-4000-8000-000000000002";
    const effectPin = "45000000-0000-4000-8000-000000000003";
    const primitivePin = "45000000-0000-4000-8000-000000000004";
    const versionConfig = { ...config, versionProposalReads: true };
    await pg.exec(`
      INSERT INTO characters (id, user_id, name, attr_physical, attr_mental, attr_magical)
      VALUES ('${characterId}', '${owner.id}', 'Dependency visibility reviewer', 4, 3, 3);
      INSERT INTO capabilities (id, user_id, name, is_public, type, source_type)
      VALUES ('${capability}', NULL, 'Capability source', true, 'ACTIVE', 'PHYSICAL');
      INSERT INTO effects (id, user_id, name, is_public)
      VALUES ('${effect}', '${editor.clerkId}', 'Effect source', true);
      INSERT INTO primitives (id, user_id, category, name, is_public, bu_cost)
      VALUES (125, '${outsider.clerkId}', 'VITALITY', 'Restricted dependency', false, 4);
      INSERT INTO primitive_versions (id, primitive_id, version_number, delta_kind, snapshot)
      VALUES ('${primitivePin}', 125, 1, 'FULL', '{"name":"Restricted dependency"}');
      INSERT INTO effect_versions (id, effect_id, version_number, delta_kind, snapshot)
      VALUES ('${effectPin}', '${effect}', 1, 'FULL',
        '{"name":"Effect version","primitiveSlots":[{"primitiveId":125}],
          "dependencyPins":[{"kind":"primitive","id":125,"versionId":"${primitivePin}","data":{"primitiveId":125}}]}');
      INSERT INTO capability_versions (id, capability_id, version_number, delta_kind, snapshot)
      VALUES ('${original}', '${capability}', 1, 'FULL', '{"name":"Original version"}'),
      ('${proposed}', '${capability}', 2, 'FULL', '{"name":"Updated version","effectIds":["${effect}"],
        "dependencyPins":[{"kind":"effect","id":"${effect}","versionId":"${effectPin}","data":{"effectId":"${effect}"}}]}');
      INSERT INTO character_capabilities (character_id, capability_id, version_id)
      VALUES ('${characterId}', '${capability}', '${original}');
      INSERT INTO character_proposals (character_id, proposer_user_id, target_kind, target_id,
        current_version_id, proposed_version_id, proposed_diff, rationale)
      VALUES ('${characterId}', '${owner.clerkId}', 'CAPABILITY', '${capability}', '${original}', '${proposed}',
        '{"fieldChanges":[{"field":"secret raw diff"}]}', 'A reviewed reason');
    `);
    const page = await listCharacterProposals(owner, { characterId, subtype: "version" }, versionConfig);
    const input = { characterId, proposalRef: page.items[0]!.proposalRef };
    const hidden = await readCharacterProposal(owner, input, versionConfig);
    expect(hidden).toMatchObject({ reviewAvailable: false, description: "" });
    expect(JSON.stringify(hidden)).not.toMatch(/A reviewed reason|Restricted dependency|Updated version|raw diff/);
    await pg.query("UPDATE primitives SET is_public=true WHERE id=125");
    const available = await readCharacterProposal(owner, input, versionConfig);
    expect(available).toMatchObject({
      reviewAvailable: true, description: "A reviewed reason",
      diff: { fieldChanges: [{ field: "name", from: "Original version", to: "Updated version" }], otherChanges: true },
    });
    await pg.query("UPDATE primitives SET is_public=false WHERE id=125");
    await pg.query(`UPDATE capability_versions SET snapshot=jsonb_build_object('kind','FULL','data',snapshot,'dependencyPins',
      jsonb_build_array(jsonb_build_object('kind','primitive','id',125,'versionId',$1::text,'data',jsonb_build_object('primitiveId',125))))
      WHERE id=$2`, [primitivePin, original]);
    await pg.query(`UPDATE capability_versions SET snapshot = '{"name":"Unrelated safe proposal"}' WHERE id=$1`, [proposed]);
    const wrapped = await readCharacterProposal(owner, input, versionConfig);
    expect(wrapped).toMatchObject({ reviewAvailable: false, description: "" });
    expect(wrapped).not.toHaveProperty("diff");
    await pg.query("UPDATE capability_versions SET snapshot=snapshot->'data' WHERE id=$1", [original]);
    await pg.query(`UPDATE capability_versions SET snapshot=jsonb_build_object('name','Updated version','effectIds',jsonb_build_array($1::text),
      'dependencyPins',jsonb_build_array(jsonb_build_object('kind','effect','id',$1::text,'versionId',$2::text,'data',jsonb_build_object('effectId',$1::text))))
      WHERE id=$3`, [effect, effectPin, proposed]);
    await pg.query("UPDATE primitives SET is_public=true WHERE id=125");
    await pg.query("UPDATE effect_versions SET snapshot=snapshot-'dependencyPins' WHERE id=$1", [effectPin]);
    expect(await readCharacterProposal(owner, input, versionConfig)).toMatchObject({ reviewAvailable: false, description: "" });
  });

  async function approve(actor: McpActor, operationId: string) {
    const { confirmation } = await getOperationReview(actor, operationId);
    if (!confirmation) throw new Error("Synthetic operation is not ready for review.");
    await approveStagingOperation(actor, { operationId, nonce: confirmation.nonce, digest: confirmation.digest, origin: "https://example.test" });
  }
  async function withCompanionClient<T>(verifiedIdentity: McpActor, work: (client: Client) => Promise<T>) {
    const stagingConfig = getMcpConfig();
    if (!stagingConfig) throw new Error("Synthetic staging configuration is missing.");
    const server = createSwordWeaveMcpServer(stagingConfig, verifiedIdentity);
    const client = new Client({ name: "character-workflow-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      return await work(client);
    } finally {
      await client.close();
      await server.close();
    }
  }
  function preparedOperationId(structuredContent: unknown) {
    expect(structuredContent).toMatchObject({ operationId: expect.any(String) });
    return (structuredContent as { operationId: string }).operationId;
  }
  function stagingEnvironment() {
    const env = {
      MCP_RESOURCE_URL: config.resource, MCP_CLERK_ISSUER: "https://issuer.example.test",
      MCP_READ_ENABLED: "true", MCP_WRITE_ENABLED: "true", MCP_FIXTURE_ENABLED: "true",
      CLERK_SECRET_KEY: "sk_test_synthetic_not_a_credential", MCP_FIXTURE_DATABASE_HOST: "fixture.example.test",
      DATABASE_URL: "postgresql://fixture.example.test/sw_companion_test",
      MCP_FIXTURE_USER_IDS: [owner.id, editor.id].join(","), MCP_STAGING_REVIEW_ENABLED: "true",
      MCP_CHARACTER_PLAY_READ_ENABLED: "true", MCP_CHARACTER_PLAY_WRITE_ENABLED: "true",
      MCP_CHARACTER_EDIT_READ_ENABLED: "true", MCP_CHARACTER_EDIT_WRITE_ENABLED: "true",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  }
  const scopes = ["swordweave:read", "swordweave:play"];

  it("answers a rules-only request, runs reviewed play tools and preserves live state across a build edit with play tools off", async () => {
    const characterId = randomUUID();
    const actor = { ...owner, scopes: [...scopes, "swordweave:edit"] };
    const text = "**Watch report**\n\nSet a *second* lookout.";
    await database.insert(schema.characters).values({ id: characterId, userId: owner.clerkId, name: "North Window rehearsal",
      mode: "PLAY", currentVitality: 7, attrPhysical: 4, attrMental: 3, attrMagical: 3, notes: "Existing report." });
    stagingEnvironment();
    try {
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      await withCompanionClient({ ...actor, scopes: ["swordweave:read"] }, async client => {
        const denied = await client.callTool({ name: "prepare_session_note", arguments: { characterId, text } });
        expect(denied).toMatchObject({ isError: true });
        expect(JSON.stringify(denied._meta)).toContain("swordweave:play");
      });
      await withCompanionClient(actor, async client => {
        const rules = await client.callTool({ name: "read_rules", arguments: { question: "Vitality" } });
        expect(rules.structuredContent).toMatchObject({ entries: [expect.objectContaining({
          topicId: "vitality", url: "https://example.test/rules#vitality", ruleDetails: expect.any(Array),
        }), ...Array.from({ length: 4 }, () => expect.any(Object))] });
        expect(JSON.stringify(rules.content)).toContain("(10 + PB) × level");
        expect(JSON.stringify(rules.content)).toContain("half maximum Vitality rounded up");
        expect(JSON.stringify(rules.content)).toContain("refreshes the short-rest allowance");
        const play = await client.callTool({ name: "read_character_play_state", arguments: { characterId } });
        expect(play.structuredContent).toMatchObject({ currentVitality: 7, permission: "OWNER" });
        expect(JSON.stringify(play.content)).toContain("North Window rehearsal** · Vitality 7 /");
        expect((await pg.query("SELECT revision FROM play_states WHERE subject_id=$1", [characterId])).rows).toEqual([]);
        expect((await pg.query("SELECT kind FROM character_log WHERE character_id=$1", [characterId])).rows).toEqual([]);

        const note = await client.callTool({ name: "prepare_session_note", arguments: { characterId, text } });
        const operationId = preparedOperationId(note.structuredContent);
        await approve(actor, operationId);
        const noteSave = await client.callTool({ name: "save_session_note", arguments: { operationId } });
        const noteReplay = await client.callTool({ name: "save_session_note", arguments: { operationId } });
        expect(noteSave.structuredContent).toMatchObject({ state: "completed", receipt: { characterId, appliedRevision: 1 } });
        expect(noteReplay.structuredContent).toEqual(noteSave.structuredContent);

        const input = { characterId, action: { kind: "set_current_vitality", value: 5 } };
        const preview = await client.callTool({ name: "preview_play_action", arguments: input });
        expect(JSON.stringify(preview.content)).toContain("Current Vitality 7 → 5");
        const prepared = await client.callTool({ name: "prepare_play_action", arguments: input });
        const vitalityId = preparedOperationId(prepared.structuredContent);
        await approve(actor, vitalityId);
        const saved = await client.callTool({ name: "apply_play_action", arguments: { operationId: vitalityId } });
        expect(JSON.stringify(saved.content)).toContain("Saved Current Vitality: 5.");
        const history = await client.callTool({ name: "read_character_history", arguments: { characterId } });
        expect(JSON.stringify(history.content)).toContain("Vitality 7 → 5");

        const consequence = await preparePlayAction(actor, { characterId, action: { kind: "record_consequence", title: "Waterlogged gear", durationTier: "short_rest" } });
        await approve(actor, consequence.operationId);
        expect(await applyPlayAction(actor, { operationId: consequence.operationId })).toMatchObject({ state: "completed" });
      });
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", "");
      await withCompanionClient(actor, async client => {
        const tools = (await client.listTools()).tools.map(tool => tool.name);
        expect(tools).toContain("read_character_play_state");
        expect(tools).not.toContain("read_character_history");
      });

      const liveRows = async () => Promise.all([
        pg.query("SELECT current_vitality, notes FROM characters WHERE id=$1", [characterId]),
        pg.query("SELECT * FROM character_consequences WHERE character_id=$1", [characterId]),
        pg.query("SELECT * FROM play_states WHERE subject_id=$1", [characterId]),
        pg.query("SELECT * FROM character_log WHERE character_id=$1", [characterId]),
      ]).then(sets => sets.map(set => set.rows));
      const before = await liveRows();
      expect(before[0]).toEqual([{ current_vitality: 5, notes: `Existing report.\n\n${text}` }]);
      expect(before[1]).toHaveLength(1);
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      vi.stubEnv("MCP_CHARACTER_PLAY_READ_ENABLED", "false");
      vi.stubEnv("MCP_CHARACTER_PLAY_WRITE_ENABLED", "false");
      await withCompanionClient(actor, async client => {
        const tools = (await client.listTools()).tools.map(tool => tool.name);
        expect(tools).toContain("prepare_character_edit");
        expect(tools).not.toContain("read_character_play_state");
        expect(tools).not.toContain("prepare_play_action");
        const input = { characterId, expectedRevision: 1, intent: "apply", changes: [
          { kind: "set_foundation", fields: { backstory: { origin: "A **night courier**." } } },
        ] };
        const preview = await client.callTool({ name: "preview_character_edit", arguments: input });
        expect(JSON.stringify(preview.content)).toContain("preserves saved Current Vitality, consequences, and Player Notes");
        const prepared = await client.callTool({ name: "prepare_character_edit", arguments: input });
        const operationId = preparedOperationId(prepared.structuredContent);
        await approve(actor, operationId);
        const saved = await client.callTool({ name: "apply_character_edit", arguments: { operationId } });
        expect(saved.structuredContent).toMatchObject({ state: "completed", receipt: { characterId, appliedRevision: 2 } });
      });
      expect(await liveRows()).toEqual(before);
      expect((await pg.query("SELECT mode, backstory FROM characters WHERE id=$1", [characterId])).rows).toEqual([
        { mode: "PLAY", backstory: { origin: "A **night courier**." } },
      ]);
    } finally { vi.unstubAllEnvs(); }
  });

  it("applies a staged version proposal once, preserves distinct occurrences and rejects stale or revoked approvals", async () => {
    stagingEnvironment();
    const versionConfig = { ...config, versionProposalReads: true };
    const editScopes = ["swordweave:read", "swordweave:edit"];
    const writer = { ...editor, scopes: editScopes };
    const reviewer = { ...owner, scopes: editScopes };
    const characterId = "20000000-0000-4000-8000-000000000125";
    const base = "46000000-0000-4000-8000-000000000001";
    const proposed = "46000000-0000-4000-8000-000000000002";
    const later = "46000000-0000-4000-8000-000000000003";
    const otherSlot = "47000000-0000-4000-8000-000000000001";
    const slot = "47000000-0000-4000-8000-000000000002";
    const input = { characterId, path: [slot], proposedVersionId: proposed, rationale: "**Improve this one occurrence**" };
    try {
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_READS_ENABLED", "true");
      vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_WRITE_ENABLED", "false");
      await expect(prepareVersionProposal(writer, input)).rejects.toThrow(/unavailable/i);
      vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_WRITE_ENABLED", "true");
      await pg.exec(`
        INSERT INTO characters (id, user_id, name, attr_physical, attr_mental, attr_magical)
        VALUES ('${characterId}', '${owner.id}', 'Staged occurrence', 4, 3, 3);
        INSERT INTO character_shares (character_id, shared_with_user_id, shared_by_user_id, can_edit)
        VALUES ('${characterId}', '${editor.id}', '${owner.clerkId}', false);
        INSERT INTO character_workspace_commands (character_id, command_id, kind, request_hash, result)
        SELECT character_id, 'share-role:' || id::text, 'share-role', '', '{"canSuggest":true}'
        FROM character_shares WHERE character_id='${characterId}' AND shared_with_user_id='${editor.id}';
        INSERT INTO primitives (id, user_id, category, name, is_public, bu_cost)
        VALUES (126, '${outsider.clerkId}', 'VITALITY', 'Live definition', true, 10);
        INSERT INTO primitive_versions (id, primitive_id, version_number, delta_kind, snapshot)
        VALUES ('${base}', 126, 1, 'FULL', '{"id":126,"data":{"name":"Before","buCost":4}}'),
          ('${proposed}', 126, 2, 'DELTA', '{"data":{"value":{"name":"After","buCost":6}}}'),
          ('${later}', 126, 3, 'FULL', '{"kind":"FULL","data":{"name":"Another offer","buCost":5}}');
        INSERT INTO character_primitives (character_id, primitive_id, instance_id, version_id)
        VALUES ('${characterId}', 126, '${otherSlot}', '${base}'), ('${characterId}', 126, '${slot}', '${base}');
      `);
      const prepare = await prepareVersionProposal(writer, input);
      expect(prepare.summary).toMatchObject({ path: [slot], replacesPendingProposal: false,
        changes: [{ field: "name", from: "Before", to: "After" }, { field: "buCost", from: 4, to: 6 }] });
      expect((await pg.query("SELECT id FROM character_proposals WHERE character_id=$1", [characterId])).rows).toEqual([]);
      await expect(submitVersionProposal(writer, { operationId: prepare.operationId })).rejects.toThrow(/unavailable/i);
      expect((await getOperationReview(writer, prepare.operationId)).confirmation?.payload).toBeNull();
      await approve(writer, prepare.operationId);
      const submitInput = { operationId: prepare.operationId };
      const completed = await withCompanionClient(writer, client => client.callTool({
        name: "submit_character_proposal", arguments: { operationId: prepare.operationId },
      }));
      expect(completed.structuredContent).toMatchObject({ state: "completed", receipt: { subtype: "version", status: "PENDING", proposalRef: expect.any(String) } });
      expect(completed.structuredContent).not.toHaveProperty("receipt.proposalId");
      expect(await submitVersionProposal(writer, submitInput)).toMatchObject({ state: "completed" });
      expect((await pg.query("SELECT id FROM character_proposals WHERE character_id=$1", [characterId])).rows).toHaveLength(1);
      await expect(prepareVersionProposal(writer, { ...input, path: [otherSlot] })).rejects.toThrow(/STALE_REVIEW/);

      const [asAuthor] = (await listCharacterProposals(writer, { characterId, subtype: "version" }, versionConfig)).items;
      await expect(prepareVersionProposalDecision(writer, { characterId, proposalRef: asAuthor!.proposalRef,
        decision: "approve" }, versionConfig)).rejects.toThrow(/unavailable/i);
      const [asOwner] = (await listCharacterProposals(reviewer, { characterId, subtype: "version" }, versionConfig)).items;
      const approveInput = { characterId, proposalRef: asOwner!.proposalRef, decision: "approve" as const };
      const firstApproval = await prepareVersionProposalDecision(reviewer, approveInput, versionConfig);
      expect(firstApproval.summary).toMatchObject({ path: [slot], decision: "approve" });
      expect((await getOperationReview(reviewer, firstApproval.operationId)).confirmation?.payload).toBeNull();
      await approve(reviewer, firstApproval.operationId);
      await saveVersionProposal({ characterId, proposerUserId: writer.clerkId, targetKind: "PRIMITIVE", targetId: "126",
        currentVersionId: base, proposedVersionId: later, instanceId: slot, rationale: "Edited in SwordWeave" });
      expect(await reviewVersionProposal(reviewer, { operationId: firstApproval.operationId }))
        .toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect((await pg.query("SELECT version_id FROM character_primitives WHERE instance_id=$1", [slot])).rows).toEqual([{ version_id: base }]);

      const currentApproval = await prepareVersionProposalDecision(reviewer, approveInput, versionConfig);
      await approve(reviewer, currentApproval.operationId);
      const decide = { operationId: currentApproval.operationId };
      expect(await reviewVersionProposal(reviewer, decide)).toMatchObject({ state: "completed",
        receipt: { status: "APPLIED", decision: "approve", appliedRevision: 1, subtype: "version" } });
      expect(await reviewVersionProposal(reviewer, decide)).toMatchObject({ state: "completed", receipt: { appliedRevision: 1 } });
      expect((await pg.query("SELECT instance_id, version_id FROM character_primitives WHERE character_id=$1 ORDER BY instance_id", [characterId])).rows)
        .toEqual([{ instance_id: otherSlot, version_id: base }, { instance_id: slot, version_id: later }]);
      expect((await pg.query("SELECT bu_spent FROM characters WHERE id=$1", [characterId])).rows).toEqual([{ bu_spent: 9 }]);
      expect(await submitVersionProposal(writer, submitInput)).toMatchObject({ receipt: { status: "PENDING", currentStatus: "APPLIED" } });

      await saveVersionProposal({ characterId, proposerUserId: writer.clerkId, targetKind: "PRIMITIVE", targetId: "126",
        currentVersionId: later, proposedVersionId: base, instanceId: slot });
      const [next] = (await listCharacterProposals(reviewer, { characterId, subtype: "version" }, versionConfig)).items;
      const availableApproval = await prepareVersionProposalDecision(reviewer, { ...approveInput, proposalRef: next!.proposalRef }, versionConfig);
      await approve(reviewer, availableApproval.operationId);
      await pg.query("UPDATE character_shares SET revoked_at=now() WHERE character_id=$1 AND shared_with_user_id=$2", [characterId, editor.id]);
      await expect(reviewVersionProposal(reviewer, { operationId: availableApproval.operationId })).rejects.toThrow(/unavailable/i);
      const rejection = await prepareVersionProposalDecision(reviewer, { ...approveInput, proposalRef: next!.proposalRef,
        decision: "reject", note: "**Already reviewed**" }, versionConfig);
      await approve(reviewer, rejection.operationId);
      expect(await reviewVersionProposal(reviewer, { operationId: rejection.operationId })).toMatchObject({ state: "completed",
        receipt: { status: "REJECTED", decision: "reject" } });
      expect((await pg.query("SELECT revision FROM character_workspace_state WHERE character_id=$1", [characterId])).rows).toEqual([{ revision: 1 }]);

      await pg.query("UPDATE character_shares SET revoked_at=null WHERE character_id=$1 AND shared_with_user_id=$2", [characterId, editor.id]);
      const webApproval = await prepareVersionProposal(writer, input);
      await approve(writer, webApproval.operationId);
      await submitVersionProposal(writer, { operationId: webApproval.operationId });
      const [websiteRow] = (await pg.query(`SELECT id, proposed_diff->>'companionOrigin' as origin
        FROM character_proposals WHERE character_id=$1 AND status='PENDING'`, [characterId])).rows;
      expect(websiteRow?.["origin"]).toBe("true");
      const proposalId = String(websiteRow?.["id"]);
      authFixture.protect.mockResolvedValue({ userId: reviewer.clerkId });
      const decideViaWebsite = () => decideWebsiteProposal(new Request(`https://example.test/api/characters/${characterId}/proposals/${proposalId}`, {
        method: "PATCH", body: JSON.stringify({ action: "APPROVE" }),
      }), { params: Promise.resolve({ id: characterId, proposalId }) });
      await pg.query("UPDATE primitives SET is_public=false WHERE id=126");
      expect((await decideViaWebsite()).status).toBe(409);
      expect((await pg.query("SELECT version_id FROM character_primitives WHERE instance_id=$1", [slot])).rows).toEqual([{ version_id: later }]);
      await pg.query("UPDATE primitives SET is_public=true WHERE id=126");
      const websiteResult = await decideViaWebsite();
      expect(websiteResult.status).toBe(200);
      expect(await websiteResult.json()).toMatchObject({ status: "APPLIED", slotUpdated: true });
      expect((await pg.query("SELECT bu_spent FROM characters WHERE id=$1", [characterId])).rows).toEqual([{ bu_spent: 10 }]);
    } finally { vi.unstubAllEnvs(); }
  });

  it("keeps existing container memberships when applying reviewed capability and item pins", async () => {
    stagingEnvironment();
    try {
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_READS_ENABLED", "true");
      vi.stubEnv("MCP_CHARACTER_VERSION_PROPOSAL_WRITE_ENABLED", "true");
      const versionConfig = { ...config, versionProposalReads: true };
      const actor = { ...owner, scopes: ["swordweave:read", "swordweave:edit"] };
      const characterId = "20000000-0000-4000-8000-000000000126";
      const capability = "48000000-0000-4000-8000-000000000001";
      const item = "48000000-0000-4000-8000-000000000002";
      const capBase = "49000000-0000-4000-8000-000000000001";
      const capProposed = "49000000-0000-4000-8000-000000000002";
      const capWithMember = "49000000-0000-4000-8000-000000000003";
      const itemBase = "49000000-0000-4000-8000-000000000004";
      const itemProposed = "49000000-0000-4000-8000-000000000005";
      const primitivePin = "49000000-0000-4000-8000-000000000006";
      const capMechanics = "49000000-0000-4000-8000-000000000007";
      await pg.exec(`
        INSERT INTO characters (id, user_id, name, attr_physical, attr_mental, attr_magical)
        VALUES ('${characterId}', '${owner.id}', 'Container pin test', 4, 3, 3);
        INSERT INTO capabilities (id, name, is_public, type, source_type)
        VALUES ('${capability}', 'Capability source', true, 'ACTIVE', 'PHYSICAL');
        INSERT INTO items (id, name, is_public, item_type)
        VALUES ('${item}', 'Item source', true, 'WEAPON');
        INSERT INTO primitives (id, category, name, is_public, bu_cost)
        VALUES (127, 'VITALITY', 'New member', true, 4);
        INSERT INTO primitive_versions (id, primitive_id, version_number, delta_kind, snapshot)
        VALUES ('${primitivePin}', 127, 1, 'FULL', '{"name":"New member","buCost":4}');
        INSERT INTO capability_versions (id, capability_id, version_number, delta_kind, snapshot)
        VALUES ('${capBase}', '${capability}', 1, 'FULL', '{"name":"Capability name","verboseDescription":"Old description"}'),
          ('${capProposed}', '${capability}', 2, 'FULL', '{"name":"Capability name","verboseDescription":"New description"}'),
          ('${capWithMember}', '${capability}', 3, 'FULL', '{"name":"Capability name","verboseDescription":"New description",
            "primitiveSlots":[{"primitiveId":127}],
            "dependencyPins":[{"kind":"primitive","id":127,"versionId":"${primitivePin}","data":{"primitiveId":127}}]}'),
          ('${capMechanics}', '${capability}', 4, 'FULL', '{"name":"Capability name","verboseDescription":"Old description","type":"PASSIVE"}');
        INSERT INTO item_versions (id, item_id, version_number, delta_kind, snapshot)
        VALUES ('${itemBase}', '${item}', 1, 'FULL', '{"name":"Item name","description":"Old description"}'),
          ('${itemProposed}', '${item}', 2, 'FULL', '{"name":"Item name","description":"New description"}');
        INSERT INTO character_capabilities (character_id, capability_id, version_id)
        VALUES ('${characterId}', '${capability}', '${capBase}');
        INSERT INTO character_items (character_id, item_id, version_id)
        VALUES ('${characterId}', '${item}', '${itemBase}');
      `);
      const capPath = [`MANIFEST:capability:${capability}`];
      await expect(prepareVersionProposal(actor, { characterId, path: capPath, proposedVersionId: capWithMember }))
        .rejects.toThrow(/DEPENDENCY_UNAVAILABLE/);
      await expect(prepareVersionProposal(actor, { characterId, path: capPath, proposedVersionId: capMechanics }))
        .rejects.toThrow(/DEPENDENCY_UNAVAILABLE/);
      for (const [path, proposedVersionId] of [[capPath, capProposed], [[`ITEM:item:${item}`], itemProposed]] as const) {
        const proposal = await prepareVersionProposal(actor, { characterId, path: [...path], proposedVersionId });
        await approve(actor, proposal.operationId);
        await submitVersionProposal(actor, { operationId: proposal.operationId });
        const page = await listCharacterProposals(actor, { characterId, subtype: "version" }, versionConfig);
        const pending = page.items.find(entry => entry.status === "PENDING");
        const review = await prepareVersionProposalDecision(actor, { characterId, proposalRef: pending!.proposalRef,
          decision: "approve" }, versionConfig);
        await approve(actor, review.operationId);
        expect(await reviewVersionProposal(actor, { operationId: review.operationId })).toMatchObject({
          state: "completed", receipt: { status: "APPLIED" },
        });
      }
      expect((await pg.query("SELECT version_id FROM character_capabilities WHERE character_id=$1", [characterId])).rows)
        .toEqual([{ version_id: capProposed }]);
      expect((await pg.query("SELECT version_id FROM character_items WHERE character_id=$1", [characterId])).rows)
        .toEqual([{ version_id: itemProposed }]);
      expect((await pg.query("SELECT instance_id FROM character_primitives WHERE character_id=$1", [characterId])).rows).toEqual([]);
    } finally { vi.unstubAllEnvs(); }
  });
  it("submits a private suggestion and applies the exact owner-approved foundation change once", async () => {
    stagingEnvironment();
    try {
      const characterId = "20000000-0000-4000-8000-000000000120";
      const scopes = ["swordweave:read", "swordweave:edit"];
      const writer = { ...suggester, scopes };
      const reviewer = { ...owner, scopes };
      vi.stubEnv("MCP_FIXTURE_USER_IDS", [owner.id, suggester.id].join(","));
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      await database.insert(schema.characters).values({ id: characterId, name: "Original", userId: owner.id,
        attrPhysical: 4, attrMental: 3, attrMagical: 3, backstory: { origin: "Old", legacy: "Retained" } });
      const [share] = await database.insert(schema.characterShares).values({ characterId, sharedWithUserId: writer.id,
        sharedByUserId: owner.clerkId, canEdit: false }).returning();
      await database.insert(schema.characterWorkspaceCommands).values({ characterId, commandId: `share-role:${share!.id}`,
        kind: "share-role", requestHash: "", result: { canSuggest: true } });
      const input = { characterId, expectedRevision: 0, intent: "propose" as const,
        changes: [{ kind: "set_foundation" as const, fields: { name: "Reviewed", backstory: { origin: "**New**" } } }] };
      await expect(previewCharacterProposal(viewer, input, config)).rejects.toBeInstanceOf(CharacterContextUnavailable);
      expect(await previewCharacterProposal(writer, input, config)).toMatchObject({ blockers: [], resultRevision: 1 });
      const submission = await prepareCharacterProposal(writer, { ...input, rationale: "**Please review**" });
      const submitInput = { operationId: submission.operationId };
      await expect(submitCharacterProposal(writer, submitInput)).rejects.toThrow(/unavailable/i);
      await approve(writer, submission.operationId);
      const pending = await submitCharacterProposal(writer, submitInput);
      expect(pending).toMatchObject({ state: "completed", receipt: { status: "pending", proposalRef: expect.any(String) } });
      expect(JSON.stringify(pending)).not.toContain(`proposal:${writer.clerkId}`);
      expect(await submitCharacterProposal(writer, submitInput)).toMatchObject({ state: "completed", receipt: { status: "pending" } });
      expect((await pg.query("select name from characters where id=$1", [characterId])).rows[0]).toEqual({ name: "Original" });
      expect((await pg.query("select count(*)::int as n from character_workspace_commands where character_id=$1 and kind='character-draft-proposal'", [characterId])).rows[0]).toEqual({ n: 1 });

      const [holder] = (await listCharacterProposals(reviewer, { characterId }, config)).items;
      const [author] = (await listCharacterProposals(writer, { characterId }, config)).items;
      await expect(prepareProposalDecision(writer, { characterId, proposalRef: author!.proposalRef, decision: "approve" }, config)).rejects.toThrow(/unavailable/i);
      await expect(prepareProposalDecision(reviewer, { characterId, proposalRef: holder!.proposalRef, decision: "withdraw" }, config)).rejects.toThrow(/unavailable/i);
      const decision = await prepareProposalDecision(reviewer, { characterId, proposalRef: holder!.proposalRef,
        decision: "approve", note: "*Reviewed*" }, config);
      await approve(reviewer, decision.operationId);
      const decisionInput = { operationId: decision.operationId };
      expect(await reviewCharacterProposal(reviewer, decisionInput)).toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: 1 } });
      expect(await reviewCharacterProposal(reviewer, decisionInput)).toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: 1 } });
      expect((await pg.query("select name,backstory from characters where id=$1", [characterId])).rows[0]).toEqual({ name: "Reviewed", backstory: { origin: "**New**", legacy: "Retained" } });
      expect((await pg.query("select revision from character_workspace_state where character_id=$1", [characterId])).rows[0]).toEqual({ revision: 1 });
      expect(await submitCharacterProposal(writer, submitInput)).toMatchObject({ receipt: { status: "pending", currentStatus: "applied" } });

      await submitNativeProposal(characterId, writer.clerkId, { baseRevision: 1,
        operations: [{ id: "be000000-0000-4000-8000-000000000001", type: "character", label: "Update character foundation",
          payload: { name: "Edited on the website" } }] });
      const website = (await listCharacterProposals(reviewer, { characterId }, config)).items.find(item => item.status === "pending");
      expect(website).toBeDefined();
      const websiteReview = await prepareProposalDecision(reviewer, { characterId, proposalRef: website!.proposalRef, decision: "approve" }, config);
      await approve(reviewer, websiteReview.operationId);
      expect(await reviewCharacterProposal(reviewer, { operationId: websiteReview.operationId })).toMatchObject({
        state: "completed", receipt: { status: "applied", appliedRevision: 2 },
      });
      expect((await pg.query("select name from characters where id=$1", [characterId])).rows[0]).toEqual({ name: "Edited on the website" });
    } finally { vi.unstubAllEnvs(); }
  });

  it("binds decision content, denies revoked authors and allows rejection or author withdrawal without applying the draft", async () => {
    stagingEnvironment();
    try {
      const characterId = "20000000-0000-4000-8000-000000000121";
      const scopes = ["swordweave:read", "swordweave:edit"];
      const writer = { ...suggester, scopes };
      const reviewer = { ...owner, scopes };
      vi.stubEnv("MCP_FIXTURE_USER_IDS", [owner.id, suggester.id].join(","));
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      await database.insert(schema.characters).values({ id: characterId, name: "Unchanged", userId: owner.clerkId,
        attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      const [share] = await database.insert(schema.characterShares).values({ characterId, sharedWithUserId: writer.id,
        sharedByUserId: owner.clerkId, canEdit: false }).returning();
      await database.insert(schema.characterWorkspaceCommands).values({ characterId, commandId: `share-role:${share!.id}`,
        kind: "share-role", requestHash: "", result: { canSuggest: true } });
      const openProposal = async (revision: number) => {
        const { operationId } = await prepareCharacterProposal(writer, { characterId, expectedRevision: revision, intent: "propose",
          changes: [{ kind: "set_foundation", fields: { name: "Suggested" } }] });
        await approve(writer, operationId);
        const result = await submitCharacterProposal(writer, { operationId });
        expect(result).toMatchObject({ state: "completed", receipt: { status: "pending" } });
        return `proposal:${writer.clerkId}:${operationId}`;
      };

      const native = await openProposal(0);
      const [holder] = (await listCharacterProposals(reviewer, { characterId }, config)).items;
      const approved = await prepareProposalDecision(reviewer, { characterId, proposalRef: holder!.proposalRef, decision: "approve" }, config);
      await approve(reviewer, approved.operationId);
      await pg.query("update character_shares set revoked_at=now() where id=$1", [share!.id]);
      await expect(reviewCharacterProposal(reviewer, { operationId: approved.operationId })).rejects.toThrow(/unavailable/i);
      await pg.query("update character_shares set revoked_at=null where id=$1", [share!.id]);
      await pg.query("update users set deleted_at=now() where id=$1", [writer.id]);
      await expect(reviewCharacterProposal(reviewer, { operationId: approved.operationId })).rejects.toThrow(/unavailable/i);
      await pg.query("update users set deleted_at=null where id=$1", [writer.id]);
      await pg.query("update character_workspace_commands set result = jsonb_set(result, '{rationale}', '\"Edited pending material\"') where character_id=$1 and command_id=$2", [characterId, native]);
      expect(await reviewCharacterProposal(reviewer, { operationId: approved.operationId })).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });

      await database.insert(schema.characterWorkspaceState).values({ characterId, revision: 1 });
      const rejected = await prepareProposalDecision(reviewer, { characterId, proposalRef: holder!.proposalRef, decision: "reject", note: "*Review a new base.*" }, config);
      await approve(reviewer, rejected.operationId);
      expect(await reviewCharacterProposal(reviewer, { operationId: rejected.operationId })).toMatchObject({ state: "completed", receipt: { status: "rejected" } });

      await openProposal(1);
      const author = (await listCharacterProposals(writer, { characterId }, config)).items.find(item => item.status === "pending");
      const withdrawn = await prepareProposalDecision(writer, { characterId, proposalRef: author!.proposalRef, decision: "withdraw" }, config);
      await approve(writer, withdrawn.operationId);
      expect(await reviewCharacterProposal(writer, { operationId: withdrawn.operationId })).toMatchObject({ state: "completed", receipt: { status: "withdrawn" } });
      expect((await pg.query("select name from characters where id=$1", [characterId])).rows[0]).toEqual({name: "Unchanged"});
      expect((await pg.query("select revision from character_workspace_state where character_id=$1", [characterId])).rows[0]).toEqual({revision: 1});
    } finally { vi.unstubAllEnvs(); }
  });

  it("previews exact Markdown, commits one note receipt and rejects an intervening page edit", async () => {
    stagingEnvironment();
    try {
      const actor = { ...editor, scopes };
      const input = { characterId: id, text: "  **Entry**\r\n\r\n- first detail  " };
      expect((await previewSessionNote(actor, input, config)).addition).toBe("\n\n**Entry**\n\n- first detail");
      const prepared = await prepareSessionNote(actor, input);
      await expect(saveSessionNote(actor, { operationId: prepared.operationId })).rejects.toThrow(/unavailable/i);
      await approve(actor, prepared.operationId);
      const receipt = await saveSessionNote(actor, { operationId: prepared.operationId });
      const replay = await saveSessionNote(actor, { operationId: prepared.operationId });
      expect(receipt).toMatchObject({ state: "completed", receipt: { appliedRevision: 1, characterId: id } });
      expect(replay.receipt).toEqual(receipt.receipt);
      const applied = (await pg.query("SELECT notes, dm_notes FROM characters WHERE id=$1", [id])).rows[0];
      expect(applied).toEqual({notes:"Secret notes\n\n**Entry**\n\n- first detail",dm_notes:"Secret DM notes"});
      const stale = await prepareSessionNote(actor, { characterId:id, text:"Do not overwrite" });
      await approve(actor, stale.operationId);
      await pg.query("UPDATE characters SET notes=$1 WHERE id=$2", ["Page edit", id]);
      expect(await saveSessionNote(actor,{ operationId:stale.operationId })).toMatchObject({state:"blocked",failureCode:"STALE_REVIEW"});
      expect((await pg.query("SELECT notes FROM characters WHERE id=$1",[id])).rows[0]?.["notes"]).toBe("Page edit");

      const early = await prepareSessionNote(actor, { characterId: id, text: "A previously reviewed idea" });
      const { confirmation } = await getOperationReview(actor, early.operationId);
      expect(confirmation).not.toBeNull();
      await pg.query("UPDATE characters SET notes=$1 WHERE id=$2", ["New site edit", id]);
      await expect(getOperationReview(actor, early.operationId)).rejects.toThrow(/unavailable/i);
      await expect(approveStagingOperation(actor, { operationId: early.operationId, nonce: confirmation!.nonce,
        digest: confirmation!.digest, origin: "https://example.test" })).rejects.toThrow(/unavailable/i);
      await pg.query("UPDATE character_shares SET can_edit=false WHERE character_id=$1 AND shared_with_user_id=$2", [id, editor.id]);
      try {
        await expect(getOperationStatus(actor, prepared.operationId)).rejects.toThrow(/unavailable/i);
        await expect(prepareSessionNote(actor, input)).rejects.toThrow(/unavailable/i);
      } finally {
        await pg.query("UPDATE character_shares SET can_edit=true WHERE character_id=$1 AND shared_with_user_id=$2", [id, editor.id]);
      }
    } finally { vi.unstubAllEnvs(); }
  });

  it("retains the dynamic full marker for no-op, updates once for an actual Vitality change and rejects stale state", async () => {
    stagingEnvironment();
    try {
      const actor = { ...owner, scopes };
      const input = { characterId: plain, action: { kind: "set_current_vitality" as const, value: 2000 } };
      const preview = await previewPlayAction(actor, input, config);
      expect(preview.before).toMatchObject({ usesDynamicMaximum: true });
      expect(preview.before).toEqual(preview.after);
      const noop = await preparePlayAction(actor, input);
      await approve(actor, noop.operationId);
      expect(await applyPlayAction(actor, {operationId:noop.operationId})).toMatchObject({state:"completed",receipt:{appliedRevision:0}});
      expect((await pg.query("SELECT current_vitality FROM characters WHERE id=$1",[plain])).rows[0]?.["current_vitality"]).toBeNull();
      expect((await pg.query("SELECT count(*)::int AS n FROM play_states WHERE subject_id=$1",[plain])).rows[0]?.["n"]).toBe(0);
      const changed = await preparePlayAction(actor,{...input,action:{...input.action,value:1}});
      await approve(actor, changed.operationId);
      const receipt = await applyPlayAction(actor,{operationId:changed.operationId});
      expect(receipt).toMatchObject({state:"completed",receipt:{appliedRevision:1,vitality:1}});
      expect((await applyPlayAction(actor,{operationId:changed.operationId})).receipt).toEqual(receipt.receipt);
      expect((await pg.query("SELECT count(*)::int AS n FROM character_log WHERE character_id=$1",[plain])).rows[0]?.["n"]).toBe(1);
      const stale = await preparePlayAction(actor,{...input,action:{...input.action,value:2}});
      await approve(actor, stale.operationId);
      await pg.query("UPDATE characters SET current_vitality=3 WHERE id=$1", [plain]);
      expect(await applyPlayAction(actor,{operationId:stale.operationId})).toMatchObject({state:"blocked",failureCode:"STALE_REVIEW"});
      expect((await pg.query("SELECT current_vitality FROM characters WHERE id=$1",[plain])).rows[0]?.["current_vitality"]).toBe(3);
    } finally { vi.unstubAllEnvs(); }
  });


  it("returns the last persisted revision for a no-op on a divergent runtime row", async () => {
    stagingEnvironment();
    try {
      const actor = {...owner,scopes};
      await pg.query("UPDATE characters SET current_vitality=NULL WHERE id=$1", [plain]);
      const rows = (await pg.query("SELECT revision, overrides FROM play_states WHERE subject_id=$1", [plain])).rows;
      const prepared = await preparePlayAction(actor,{characterId:plain,action:{kind:"set_current_vitality",value:900}});
      await approve(actor,prepared.operationId);
      expect(await applyPlayAction(actor,{operationId:prepared.operationId})).toMatchObject({state:"completed",receipt:{appliedRevision:rows[0]?.["revision"]}});
      expect((await pg.query("SELECT revision, overrides FROM play_states WHERE subject_id=$1", [plain])).rows).toEqual(rows);
    } finally { vi.unstubAllEnvs(); }
  });

  it("rolls back the native foundation preview, then applies an approved edit once and rejects a stale build", async () => {
    stagingEnvironment();
    try {
      const actor = {...owner,scopes:["swordweave:read","swordweave:edit"]};
      const input = {characterId:plain,expectedRevision:0,intent:"apply" as const,changes:[
        {kind:"set_foundation" as const,fields:{name:"Changed by review",attrPhysical:3,attrMental:4,
          backstory:{origin:"**From the coast**"}}}
      ]};
      await pg.query("UPDATE characters SET backstory=$1 WHERE id=$2", [JSON.stringify({motivation:"Keep me", manifestDescription:"Exact retained"}),plain]);
      const before = (await pg.query("SELECT * FROM characters WHERE id=$1", [plain])).rows[0];
      const preview = await previewCharacterEdit(actor, input, config);
      expect(preview).toMatchObject({blockers:[],resultRevision:1});
      expect(preview.changes.map(change => change.kind === "set_foundation" ? change.fields.map(field => field.field) : [])).toEqual([["name","attrPhysical","attrMental","backstory.origin"]]);
      expect((await pg.query("SELECT * FROM characters WHERE id=$1", [plain])).rows[0]).toEqual(before);
      expect((await pg.query("SELECT count(*)::int AS n FROM character_workspace_state WHERE character_id=$1", [plain])).rows[0]?.["n"]).toBe(0);
      const dependency = await previewCharacterEdit(actor, { ...input, characterId: id, expectedRevision: 1 }, config);
      expect(dependency.blockers[0]).toContain("dependencies");
      const prepared = await prepareCharacterEdit(actor,input);
      await expect(applyCharacterEdit(actor,{operationId:prepared.operationId})).rejects.toThrow(/unavailable/i);
      await approve(actor,prepared.operationId);
      const receipt = await applyCharacterEdit(actor,{operationId:prepared.operationId});
      expect(receipt).toMatchObject({state:"completed",receipt:{appliedRevision:1}});
      expect((await applyCharacterEdit(actor,{operationId:prepared.operationId})).receipt).toEqual(receipt.receipt);
      expect((await pg.query("SELECT * FROM characters WHERE id=$1", [plain])).rows[0]).toMatchObject({
        name:"Changed by review", attr_physical:3, attr_mental:4,
        backstory: {motivation:"Keep me", manifestDescription:"Exact retained",origin:"**From the coast**"},
      });
      const stale = await prepareCharacterEdit(actor,{...input,expectedRevision:1,changes:[{kind:"set_foundation" as const,fields:{name:"Do not apply"}}]});
      await approve(actor,stale.operationId);
      await pg.query("UPDATE character_workspace_state SET revision=2 WHERE character_id=$1", [plain]);
      expect(await applyCharacterEdit(actor,{operationId:stale.operationId})).toMatchObject({state:"blocked",failureCode:"STALE_REVIEW"});
      expect((await pg.query("SELECT name FROM characters WHERE id=$1",[plain])).rows[0]?.["name"]).toBe("Changed by review");
    } finally { vi.unstubAllEnvs(); }
  });

  it("keeps a shared editor's new primitive visible to the actual character owner", async () => {
    const sheet = "20000000-0000-4000-8000-000000000009";
    const pin = "c0000000-0000-4000-8000-000000000001";
    await database.insert(schema.characters).values({ id: sheet, userId: owner.id, name: "Shared starter", attrPhysical: 4, attrMental: 3, attrMagical: 3 });
    await database.insert(schema.characterShares).values({ characterId: sheet, sharedWithUserId: editor.id, sharedByUserId: owner.clerkId, canEdit: true });
    await database.insert(schema.primitives).values({ id: 611, userId: editor.clerkId, name: "Shared storm", category: "DOMAIN", buCost: 4, isPublic: false });
    await database.insert(schema.primitiveVersions).values({ id: pin, primitiveId: 611, versionNumber: 1, isLatest: true, deltaKind: "FULL",
      snapshot: { name: "Shared storm", category: "DOMAIN", buCost: 4, mechanicalOutputText: "", hardModifiers: [] } });
    const input = { characterId: sheet, expectedRevision: 0, intent: "apply" as const, changes: [{ kind: "attach_library_piece" as const,
      ref: { kind: "primitive" as const, id: "611", versionId: pin }, channel: "MANIFEST" as const }] };
    expect((await previewCharacterEdit(editor, input, config)).blockers).toHaveLength(1);
    expect((await pg.query("select * from character_primitives where character_id = $1", [sheet])).rows).toEqual([]);
    await pg.query("update primitives set is_public = true where id = 611");
    expect((await previewCharacterEdit(editor, input, config)).blockers).toEqual([]);
    expect((await pg.query("select * from character_primitives where character_id = $1", [sheet])).rows).toEqual([]);
  });

  async function seedExactCapabilityAttachment(fixture = 1) {
    const suffix = (value: number) => String(value).padStart(12, "0");
    const capabilityId = `b4100000-0000-4000-8000-${suffix(fixture)}`;
    const versionId = `b4200000-0000-4000-8000-${suffix(fixture)}`;
    const historicalVersionId = `b4400000-0000-4000-8000-${suffix(fixture)}`;
    const members = [{
      primitiveId: 659 + 2 * fixture, versionId: `b4300000-0000-4000-8000-${suffix(2 * fixture - 1)}`, role: "VERB" as const,
      name: "Shape clear light", category: "VERB_TIER" as const, quantity: 1, buCost: 4,
    }, {
      primitiveId: 660 + 2 * fixture, versionId: `b4300000-0000-4000-8000-${suffix(2 * fixture)}`, role: "DOMAIN" as const,
      name: "Domain of silver light", category: "DOMAIN" as const, quantity: 2, buCost: 6,
    }];
    for (const { primitiveId, versionId: pin, name, category, buCost } of members) {
      const definition = { name, category, buCost, mechanicalOutputText: "", hardModifiers: [] };
      await database.insert(schema.primitives).values({ id: primitiveId, userId: editor.clerkId, isPublic: true, ...definition });
      await database.insert(schema.primitiveVersions).values({
        id: pin, primitiveId, versionNumber: 1, isLatest: true, deltaKind: "FULL", snapshot: definition,
      });
    }
    const membershipOrder = [...members].reverse().map(member => `primitive:${member.primitiveId}:${member.role}`);
    const { name, type, sourceType, verboseDescription } = {
      name: `Silver Lamp ${fixture}`, type: "ACTIVE" as const, sourceType: "MAGICAL" as const, verboseDescription: "**Carry** the light.",
    };
    await database.insert(schema.capabilities).values({ id: capabilityId, name, type, sourceType, verboseDescription,
      userId: suggester.clerkId, isPublic: true, membershipOrder });
    const slots = members.map(({ primitiveId, role, quantity }) => ({ primitiveId, role, quantity, slotLabel: "", notes: "" }));
    await database.insert(schema.capabilityPrimitives).values(slots.map((slot, sortOrder) => ({ capabilityId, ...slot, sortOrder })));
    const snapshot = { name, type, sourceType, verboseDescription, membershipOrder, primitiveSlots: slots, effectIds: [],
      dependencyPins: slots.map((slot, i) => ({ kind: "primitive", id: slot.primitiveId, versionId: members[i]!.versionId,
        data: { ...slot, versionId: members[i]!.versionId } })),
    };
    await database.insert(schema.capabilityVersions).values([
      { id: historicalVersionId, capabilityId, versionNumber: 1, isLatest: false, deltaKind: "FULL", snapshot: { ...snapshot, verboseDescription: "" } },
      { id: versionId, capabilityId, versionNumber: 2, isLatest: true, deltaKind: "FULL", snapshot },
    ]);
    return { capabilityId, versionId, historicalVersionId, members, name, ref: { kind: "capability" as const, id: capabilityId, versionId } };
  }

  it("catalogues and attaches a pinned effect, heritage and item to a level-ten build with native budgets", async () => {
    stagingEnvironment();
    try {
      const actor = { ...owner, scopes: ["swordweave:read", "swordweave:edit"] };
      const characterId = randomUUID();
      const effectId = randomUUID();
      const heritageId = randomUUID();
      const itemId = randomUUID();
      const effectPin = randomUUID();
      const heritagePin = randomUUID();
      const itemPin = randomUUID();
      const { capabilityId, versionId: capabilityPin, members } = await seedExactCapabilityAttachment(15);
      const utility = [{ id: 701, name: "Light signal", cost: 4 }, { id: 702, name: "Courier lore", cost: 5 },
        { id: 703, name: "Satchel insulation", cost: 8 }].map(row => ({ ...row, pin: randomUUID() }));
      for (const { id, name, cost, pin } of utility) {
        const definition = { name, category: "DOMAIN" as const, buCost: cost, mechanicalOutputText: "", hardModifiers: [] };
        await database.insert(schema.primitives).values({ id, userId: editor.clerkId, isPublic: true, ...definition });
        await database.insert(schema.primitiveVersions).values({ id: pin, primitiveId: id, versionNumber: 1, isLatest: true, deltaKind: "FULL", snapshot: definition });
      }
      await database.insert(schema.characters).values({ id: characterId, userId: owner.clerkId, name: "Gale attachment fixture",
        level: 10, attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      const visible = { userId: editor.clerkId, isPublic: true };
      const effect = { name: "Courier light effect", narrativeDescription: "Send **one pulse**.", tags: [], isPublic: true };
      const effectSlot = { primitiveId: utility[0]!.id, quantity: 2, notes: "**Flash** twice." };
      await database.insert(schema.effects).values({ id: effectId, ...visible, ...effect });
      await database.insert(schema.effectPrimitives).values({ effectId, ...effectSlot });
      await database.insert(schema.effectVersions).values({
        id: effectPin, effectId, isLatest: true, versionNumber: 1, deltaKind: "FULL",
        snapshot: await withDependencyPins({ ...buildCanonicalEffectPayload({ ...effect, primitiveSlots: [effectSlot] }) }),
      });
      const heritage = { kind: "UPBRINGING" as const, name: "Courier upbringing", description: "**Lantern** messenger.", suggestedTraits: "Careful.", isPublic: true };
      const heritageOrder = [`capability:${capabilityId}`, `primitive:${utility[1]!.id}`];
      await database.insert(schema.heritage).values({ id: heritageId, ...visible, ...heritage, membershipOrder: heritageOrder });
      await database.insert(schema.heritagePrimitives).values({ templateId: heritageId, primitiveId: utility[1]!.id });
      await database.insert(schema.heritageCapabilities).values({ templateId: heritageId, capabilityId });
      await database.insert(schema.heritageVersions).values({
        id: heritagePin, templateId: heritageId, isLatest: true, versionNumber: 1, deltaKind: "FULL",
        snapshot: await withDependencyPins({ ...buildCanonicalTemplatePayload({ ...heritage, membershipOrder: heritageOrder,
          primitiveIds: [utility[1]!.id], capabilityIds: [capabilityId] }) }),
      });
      const item = { name: "Courier satchel", itemType: "TRINKET" as const, size: "SMALL" as const, rarity: "COMMON" as const,
        buCost: 7, description: "A **lined** satchel.", slotCost: 1, quantity: 1, actsAsFocus: false,
        isTwoHanded: false, isConsumable: false, isPublic: true, tags: [] };
      const itemOrder = [`effect:${effectId}`, `primitive:${utility[2]!.id}`, `capability:${capabilityId}`];
      await database.insert(schema.items).values({ id: itemId, ...visible, ...item, membershipOrder: itemOrder });
      await database.insert(schema.itemPrimitives).values({ itemId, primitiveId: utility[2]!.id });
      await database.insert(schema.itemCapabilities).values({ itemId, capabilityId });
      await database.insert(schema.itemEffects).values({ itemId, effectId });
      await database.insert(schema.itemVersions).values({
        id: itemPin, itemId, isLatest: true, versionNumber: 1, deltaKind: "FULL",
        snapshot: await withDependencyPins({ ...buildCanonicalItemPayload({ ...item, membershipOrder: itemOrder,
          primitiveIds: [utility[2]!.id], capabilityIds: [capabilityId], effectIds: [effectId] }) }),
      });
      const choices = [
        { kind: "effect", channel: "MANIFEST", id: effectId, versionId: effectPin, name: effect.name, cost: 4 },
        { kind: "heritage", channel: "UPBRINGING", id: heritageId, versionId: heritagePin, name: heritage.name, cost: 15 },
        { kind: "item", channel: "ITEM", id: itemId, versionId: itemPin, name: item.name, cost: 7 },
      ] as const;
      const changes = choices.map(({ kind, id, versionId, channel }) => ({
        kind: "attach_library_piece" as const, ref: { kind, id, versionId }, channel,
      }));
      const input = { characterId, expectedRevision: 0, intent: "apply" as const, changes };
      for (const { kind, name, id, versionId, cost } of choices) {
        const search = await findCreations({ kind, query: name, minBu: cost, maxBu: cost }, actor, config);
        expect(search.items[0]).toMatchObject({ pin: { kind, id, versionId }, buCost: cost, versionStatus: "PINNED" });
      }
      expect((await previewCharacterEdit(actor, { ...input, changes: [{ ...changes[1]!, channel: "LINEAGE" }] }, config)).blockers).toHaveLength(1);
      expect((await previewCharacterEdit(actor, { ...input, changes: [{ ...changes[2]!, channel: "MANIFEST" }] }, config)).blockers).toHaveLength(1);
      await database.update(schema.primitives).set({ isPublic: false }).where(eq(schema.primitives.id, utility[0]!.id));
      const denied = await findCreations({ kind: "item", query: item.name }, actor, config);
      expect(denied.items[0]).toMatchObject({ versionStatus: "UNAVAILABLE" });
      expect(denied.items[0]).not.toHaveProperty("buCost");
      expect((await previewCharacterEdit(actor, input, config)).blockers).toHaveLength(1);
      await database.update(schema.primitives).set({ isPublic: true }).where(eq(schema.primitives.id, utility[0]!.id));

      const preview = await previewCharacterEdit(actor, input, config);
      expect(preview).toMatchObject({ blockers: [], resultRevision: 3,
        budgetDelta: { before: { spent: 0, itemSpent: 0 }, after: { spent: 19, itemSpent: 7 } } });
      expect((await readWorkspace(characterId)).edges).toEqual([]);
      const outdated = await prepareCharacterEdit(actor, input);
      await approve(actor, outdated.operationId);
      await database.update(schema.effectPrimitives).set({ notes: "Changed after review." })
        .where(eq(schema.effectPrimitives.effectId, effectId));
      try {
        expect(await applyCharacterEdit(actor, { operationId: outdated.operationId }))
          .toMatchObject({ state: "blocked", failureCode: "DEPENDENCY_UNAVAILABLE" });
        expect((await readWorkspace(characterId)).edges).toEqual([]);
      } finally {
        await database.update(schema.effectPrimitives).set({ notes: effectSlot.notes })
          .where(eq(schema.effectPrimitives.effectId, effectId));
      }
      const operation = await prepareCharacterEdit(actor, input);
      await approve(actor, operation.operationId);
      const result = await applyCharacterEdit(actor, { operationId: operation.operationId });
      expect(result).toMatchObject({ state: "completed", receipt: { appliedRevision: 3 } });
      expect((await applyCharacterEdit(actor, { operationId: operation.operationId })).receipt).toEqual(result.receipt);
      const graph = await readWorkspace(characterId);
      for (const { kind, id, versionId, channel } of choices) {
        expect(graph.edges.find(edge => edge.parent === null && edge.child === `${kind}:${id}`))
          .toMatchObject({ versionId, category: channel });
      }
      expect(graph.edges.filter(edge => edge.parent === `item:${itemId}`).sort((left, right) => left.order - right.order)
        .map(edge => [edge.child, edge.versionId])).toEqual([
        [`effect:${effectId}`, effectPin], [`primitive:${utility[2]!.id}`, utility[2]!.pin], [`capability:${capabilityId}`, capabilityPin],
      ]);
      expect(graph.edges.find(edge => edge.parent === `effect:${effectId}`)).toMatchObject({
        child: `primitive:${utility[0]!.id}`, versionId: utility[0]!.pin, data: { quantity: 2, notes: effectSlot.notes },
      });
      expect((await pg.query("SELECT primitive_id,version_id,origin_item_id FROM character_primitives WHERE character_id=$1 ORDER BY primitive_id", [characterId])).rows)
        .toEqual([...members.map(member => ({ primitive_id: member.primitiveId, version_id: member.versionId, origin_item_id: null })),
          ...utility.map((member, index) => ({ primitive_id: member.id, version_id: member.pin, origin_item_id: index === 2 ? itemId : null }))]);
      expect((await pg.query("SELECT quantity,equipped FROM character_items WHERE character_id=$1", [characterId])).rows)
        .toEqual([{ quantity: 1, equipped: false }]);
    } finally { vi.unstubAllEnvs(); }
  });

  it("attaches a reproducible capability with ordered member pins and blocks inaccessible or changed versions", async () => {
    stagingEnvironment();
    try {
      const actor = { ...owner, scopes: ["swordweave:read", "swordweave:edit"] };
      const characterId = randomUUID();
      const { capabilityId, versionId, historicalVersionId, name, members, ref } = await seedExactCapabilityAttachment();
      await database.insert(schema.characters).values({ id: characterId, userId: owner.clerkId, name: "Lantern Keeper",
        attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      const input = { characterId, expectedRevision: 0, intent: "apply" as const, changes: [
        { kind: "attach_library_piece" as const, ref, channel: "UPBRINGING" as const },
      ] };
      await database.update(schema.primitives).set({ isPublic: false }).where(eq(schema.primitives.id, members[1]!.primitiveId));
      const denied = await previewCharacterEdit(actor, input, config);
      expect(denied.blockers).toHaveLength(1);
      expect(JSON.stringify(denied)).not.toContain(members[1]!.name);
      await database.update(schema.primitives).set({ isPublic: true }).where(eq(schema.primitives.id, members[1]!.primitiveId));
      const historical = { ...input, changes: [{ ...input.changes[0]!, ref: { ...ref, versionId: historicalVersionId } }] };
      expect((await previewCharacterEdit(actor, historical, config)).blockers).toHaveLength(1);

      const preview = await previewCharacterEdit(actor, input, config);
      expect(preview).toMatchObject({ blockers: [], budgetDelta: { before: { spent: 0 }, after: { spent: 10 } }, changes: [{
        after: { name, pin: versionId, placement: "UPBRINGING" },
        members: [...members].reverse().map(member => ({ name: member.name, pin: member.versionId, role: member.role, quantity: member.quantity })),
      }] });
      expect((await pg.query("SELECT * FROM character_capabilities WHERE character_id=$1", [characterId])).rows).toEqual([]);
      const stale = await prepareCharacterEdit(actor, input);
      await approve(actor, stale.operationId);
      await pg.query("UPDATE capability_primitives SET quantity=3 WHERE capability_id=$1 AND primitive_id=$2", [capabilityId, members[1]!.primitiveId]);
      expect(await applyCharacterEdit(actor, { operationId: stale.operationId })).toMatchObject({ state: "blocked", failureCode: "DEPENDENCY_UNAVAILABLE" });
      expect((await pg.query("SELECT * FROM character_capabilities WHERE character_id=$1", [characterId])).rows).toEqual([]);
      await pg.query("UPDATE capability_primitives SET quantity=2 WHERE capability_id=$1 AND primitive_id=$2", [capabilityId, members[1]!.primitiveId]);
      const reviewed = await prepareCharacterEdit(actor, input);
      await approve(actor, reviewed.operationId);
      const result = await applyCharacterEdit(actor, { operationId: reviewed.operationId });
      expect(result).toMatchObject({ state: "completed", receipt: { appliedRevision: 1 } });
      expect((await pg.query("SELECT capability_id,version_id,slot_tab FROM character_capabilities WHERE character_id=$1", [characterId])).rows)
        .toEqual([{ capability_id: capabilityId, version_id: versionId, slot_tab: "UPBRINGING" }]);
      expect((await pg.query("SELECT primitive_id,version_id,origin_capability_id FROM character_primitives WHERE character_id=$1 ORDER BY primitive_id", [characterId])).rows)
        .toEqual(members.map(member => ({ primitive_id: member.primitiveId, version_id: member.versionId, origin_capability_id: capabilityId })));
      expect((await applyCharacterEdit(actor, { operationId: reviewed.operationId })).receipt).toEqual(result.receipt);
    } finally { vi.unstubAllEnvs(); }
  });

  it("submits suggester slot proposals without changing the sheet and applies only the owner-approved exact root", async () => {
    stagingEnvironment();
    try {
      const scopes = ["swordweave:read", "swordweave:edit"];
      const writer = { ...suggester, scopes };
      const reviewer = { ...owner, scopes };
      vi.stubEnv("MCP_FIXTURE_USER_IDS", [owner.id, suggester.id].join(","));
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      const characterId = randomUUID();
      const { capabilityId, versionId, name } = await seedExactCapabilityAttachment(2);
      await database.insert(schema.characters).values({ id: characterId, userId: owner.id, name: "Lantern Proposal",
        attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      const drawbackPin = "b4300000-0000-4000-8000-000000000005";
      const drawback = { name: "Silver guard", category: "DEFENSE" as const, buCost: 4, mechanicalOutputText: "+2 Defense",
        isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: 4,
        hardModifiers: [{ kind: "modify" as const, operation: "add" as const, target: "defense_dc", value: 2 }] };
      await database.insert(schema.primitives).values({ id: 665, userId: editor.clerkId, isPublic: true, ...drawback });
      await database.insert(schema.primitiveVersions).values({ id: drawbackPin, primitiveId: 665, versionNumber: 1,
        isLatest: true, deltaKind: "FULL", snapshot: drawback });
      await database.insert(schema.characterPrimitives).values({ characterId, primitiveId: 665, versionId: drawbackPin, source: "MANIFEST" });
      const [share] = await database.insert(schema.characterShares).values({ characterId, sharedWithUserId: writer.id,
        sharedByUserId: owner.clerkId }).returning();
      await database.insert(schema.characterWorkspaceCommands).values({ characterId, commandId: `share-role:${share!.id}`,
        kind: "share-role", requestHash: "", result: { canSuggest: true } });
      const input = { characterId, expectedRevision: 0, intent: "propose" as const, changes: [{
        kind: "attach_library_piece" as const, ref: { kind: "capability" as const, id: capabilityId, versionId }, channel: "MANIFEST" as const,
      }] };
      await expect(previewCharacterProposal(viewer, input, config)).rejects.toBeInstanceOf(CharacterContextUnavailable);
      await database.update(schema.capabilities).set({ isPublic: false }).where(eq(schema.capabilities.id, capabilityId));
      expect((await previewCharacterProposal(writer, input, config)).blockers).toHaveLength(1);
      await database.update(schema.capabilities).set({ isPublic: true }).where(eq(schema.capabilities.id, capabilityId));
      expect(await previewCharacterProposal(writer, input, config)).toMatchObject({ blockers: [], resultRevision: 1,
        changes: [{ after: { name, pin: versionId, placement: "MANIFEST" } }] });
      const proposal = await prepareCharacterProposal(writer, input);
      await approve(writer, proposal.operationId);
      expect(await submitCharacterProposal(writer, { operationId: proposal.operationId })).toMatchObject({ state: "completed", receipt: { status: "pending" } });
      expect((await pg.query("SELECT * FROM character_capabilities WHERE character_id=$1", [characterId])).rows).toEqual([]);
      const [pending] = (await listCharacterProposals(reviewer, { characterId }, config)).items;
      const action = { characterId, proposalRef: pending!.proposalRef, decision: "approve" as const };
      const readInput = { characterId, proposalRef: pending!.proposalRef };
      const commands = (await pg.query("SELECT command_id FROM character_workspace_commands WHERE character_id=$1 ORDER BY command_id", [characterId])).rows;
      expect(await readCharacterProposal(reviewer, readInput, config)).toMatchObject({
        diffState: "available", sheetUrl: new URL(`/characters/${characterId}`, config.resource).href,
        diff: { changes: [{ after: { name, pin: versionId }, members: expect.arrayContaining([{ name: "Domain of silver light", role: "DOMAIN", quantity: 2, pin: expect.any(String) }]) }] },
      });
      const [authorPending] = (await listCharacterProposals(writer, { characterId }, config)).items;
      expect(await readCharacterProposal(writer, { characterId, proposalRef: authorPending!.proposalRef }, config)).toMatchObject({ diffState: "available" });
      await expect(readCharacterProposal(viewer, readInput, config)).rejects.toThrow(/unavailable/i);
      expect((await pg.query("SELECT command_id FROM character_workspace_commands WHERE character_id=$1 ORDER BY command_id", [characterId])).rows).toEqual(commands);
      expect((await pg.query("SELECT * FROM character_capabilities WHERE character_id=$1", [characterId])).rows).toEqual([]);

      await database.update(schema.characters).set({ name: "Changed outside the proposal" }).where(eq(schema.characters.id, characterId));
      const staleRead = await readCharacterProposal(reviewer, readInput, config);
      expect(staleRead).toMatchObject({ stale: true, diffState: "stale" });
      expect(staleRead).not.toHaveProperty("diff");
      await database.update(schema.characters).set({ name: "Lantern Proposal" }).where(eq(schema.characters.id, characterId));
      const stale = await prepareProposalDecision(reviewer, action, config);
      await approve(reviewer, stale.operationId);
      await database.update(schema.capabilities).set({ isPublic: false }).where(eq(schema.capabilities.id, capabilityId));
      const unavailable = await readCharacterProposal(reviewer, readInput, config);
      expect(unavailable).toMatchObject({ diffState: "unavailable" });
      expect(unavailable).not.toHaveProperty("diff");
      expect(JSON.stringify(unavailable)).not.toContain(name);
      expect(await readCharacterProposal(writer, { characterId, proposalRef: authorPending!.proposalRef }, config))
        .toMatchObject({ diffState: "unavailable" });
      expect(await reviewCharacterProposal(reviewer, { operationId: stale.operationId }))
        .toMatchObject({ state: "blocked", failureCode: "DEPENDENCY_UNAVAILABLE" });
      expect((await pg.query("SELECT * FROM character_capabilities WHERE character_id=$1", [characterId])).rows).toEqual([]);
      await database.update(schema.capabilities).set({ isPublic: true }).where(eq(schema.capabilities.id, capabilityId));
      const decision = await prepareProposalDecision(reviewer, action, config);
      await approve(reviewer, decision.operationId);
      const result = await reviewCharacterProposal(reviewer, { operationId: decision.operationId });
      expect(result).toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: 1 } });
      expect(await reviewCharacterProposal(reviewer, { operationId: decision.operationId }))
        .toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: 1 } });
      expect(await readCharacterProposal(reviewer, readInput, config)).toMatchObject({ diffState: "not_pending", status: "applied" });
      const root = (await readCharacterBuild(reviewer, { characterId }, config)).slots.find(slot => slot.name === name);
      expect(root?.path).toHaveLength(1);
      const detach = await prepareCharacterProposal(writer, { characterId, expectedRevision: 1, intent: "propose",
        changes: [{ kind: "remove_reference", path: root!.path }] });
      await approve(writer, detach.operationId);
      await submitCharacterProposal(writer, { operationId: detach.operationId });
      const next = (await listCharacterProposals(reviewer, { characterId }, config)).items.find(item => item.status === "pending");
      const removal = await prepareProposalDecision(reviewer, { characterId, proposalRef: next!.proposalRef, decision: "approve" }, config);
      await approve(reviewer, removal.operationId);
      expect(await reviewCharacterProposal(reviewer, { operationId: removal.operationId }))
        .toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: 2 } });
      expect((await pg.query("SELECT * FROM character_capabilities WHERE character_id=$1", [characterId])).rows).toEqual([]);
      expect((await pg.query("SELECT primitive_id,is_mirrored FROM character_primitives WHERE character_id=$1", [characterId])).rows)
        .toEqual([{ primitive_id: 665, is_mirrored: false }]);

      const mirrorPath = (await readCharacterBuild(writer, { characterId }, config)).slots.find(slot => slot.name === drawback.name)?.path;
      expect(mirrorPath).toHaveLength(1);
      const mirror = { characterId, expectedRevision: 2, intent: "propose" as const, changes: [{
        kind: "mirror_primitive" as const, path: mirrorPath!, isMirrored: true,
      }] };
      expect(await previewCharacterProposal(writer, mirror, config)).toMatchObject({ blockers: [], changes: [{
        after: { pin: drawbackPin, isMirrored: true, drawback: { description: expect.stringContaining("2"), mirrorCredit: 4 } },
      }] });
      const mirrorReview = await prepareCharacterProposal(writer, mirror);
      await approve(writer, mirrorReview.operationId);
      await submitCharacterProposal(writer, { operationId: mirrorReview.operationId });
      const pendingMirror = (await listCharacterProposals(reviewer, { characterId }, config)).items.find(item => item.status === "pending");
      const flip = await prepareProposalDecision(reviewer, { characterId, proposalRef: pendingMirror!.proposalRef, decision: "approve" }, config);
      await approve(reviewer, flip.operationId);
      expect(await reviewCharacterProposal(reviewer, { operationId: flip.operationId }))
        .toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: 3 } });
      expect((await pg.query("SELECT primitive_id,version_id,is_mirrored FROM character_primitives WHERE character_id=$1", [characterId])).rows)
        .toEqual([{ primitive_id: 665, version_id: drawbackPin, is_mirrored: true }]);
    } finally { vi.unstubAllEnvs(); }
  });

  it("applies owner-approved nested suggester moves, mirrors and removals as exact private character forks", async () => {
    stagingEnvironment();
    try {
      const scopes = ["swordweave:read", "swordweave:edit"];
      const writer = { ...suggester, scopes };
      const reviewer = { ...owner, scopes };
      vi.stubEnv("MCP_FIXTURE_USER_IDS", [owner.id, suggester.id].join(","));
      vi.stubEnv("MCP_CURSOR_HMAC_SECRET", config.cursorSecret);
      const characterId = randomUUID();
      const source = await seedExactCapabilityAttachment(16);
      const destination = await seedExactCapabilityAttachment(17);
      const moved = source.members[1]!;
      const drawback = { isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: 2,
        hardModifiers: [{ kind: "modify" as const, operation: "add" as const, target: "defense_dc", value: 2 }] };
      await database.update(schema.primitives).set(drawback).where(eq(schema.primitives.id, moved.primitiveId));
      const [movedVersion] = await database.select({ snapshot: schema.primitiveVersions.snapshot })
        .from(schema.primitiveVersions).where(eq(schema.primitiveVersions.id, moved.versionId));
      await database.update(schema.primitiveVersions).set({ snapshot: { ...movedVersion!.snapshot, ...drawback } })
        .where(eq(schema.primitiveVersions.id, moved.versionId));
      await database.insert(schema.characters).values({ id: characterId, userId: owner.clerkId, name: "Shared lantern drill",
        attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      const [share] = await database.insert(schema.characterShares).values({ characterId, sharedWithUserId: writer.id,
        sharedByUserId: owner.clerkId }).returning();
      await database.insert(schema.characterWorkspaceCommands).values({ characterId, commandId: `share-role:${share!.id}`,
        kind: "share-role", requestHash: "", result: { canSuggest: true } });
      await database.insert(schema.characterCapabilities).values([
        { characterId, capabilityId: source.capabilityId, versionId: source.versionId },
        { characterId, capabilityId: destination.capabilityId, versionId: destination.versionId, slotTab: "UPBRINGING" },
      ]);
      const originalGraph = await readWorkspace(characterId);
      const build = await readCharacterBuild(writer, { characterId }, config);
      const sourcePath = build.slots.find(slot => slot.pin === source.versionId)!.path;
      const destinationPath = build.slots.find(slot => slot.pin === destination.versionId)!.path;
      const path = build.slots.find(slot => slot.pin === moved.versionId && slot.path[0] === sourcePath[0])!.path;
      expect(path).toHaveLength(2);
      const input = { characterId, expectedRevision: build.revision, intent: "propose" as const, changes: [
        { kind: "move_reference" as const, path, destinationPath },
      ] };
      const diff = { kind: "move_reference", path, sourceContainer: source.name, destinationContainer: destination.name,
        before: { pin: moved.versionId, placement: "MANIFEST" }, after: { pin: moved.versionId, placement: "UPBRINGING" } };
      const grants = () => database.select().from(schema.characterWorkspaceForkGrants)
        .where(eq(schema.characterWorkspaceForkGrants.characterId, characterId));
      const changeVisibility = (isPublic: boolean) => database.update(schema.capabilities).set({ isPublic })
        .where(eq(schema.capabilities.id, source.capabilityId));

      expect(await previewCharacterProposal(writer, input, config)).toMatchObject({ blockers: [], changes: [diff], resultRevision: build.revision + 2 });
      const submission = await prepareCharacterProposal(writer, input);
      await approve(writer, submission.operationId);
      const submitted = await submitCharacterProposal(writer, { operationId: submission.operationId });
      expect(submitted).toMatchObject({ state: "completed", receipt: { status: "pending" } });
      const [record] = (await pg.query("SELECT command_id FROM character_workspace_commands WHERE character_id=$1 AND kind='character-draft-proposal'", [characterId])).rows;
      const proposalId = record?.["command_id"];
      expect(typeof proposalId).toBe("string");
      authFixture.protect.mockResolvedValue({ userId: reviewer.clerkId });
      for (const action of ["preview", "approve"]) {
        const request = new Request(new URL(`/api/characters/${characterId}/workspace/collaboration`, config.resource), {
          method: "POST", body: JSON.stringify({ action, proposalId }),
        });
        const response = await decideWebsiteWorkspaceProposal(request, { params: Promise.resolve({ id: characterId }) });
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: "Open your SwordWeave companion conversation to review and approve this proposal." });
      }
      expect(await readWorkspace(characterId)).toEqual(originalGraph);
      expect(await grants()).toEqual([]);
      const [pending] = (await listCharacterProposals(reviewer, { characterId }, config)).items;
      const read = { characterId, proposalRef: pending!.proposalRef };
      const action = { ...read, decision: "approve" as const };
      expect(await readCharacterProposal(reviewer, read, config)).toMatchObject({ diffState: "available", diff: { changes: [diff] } });
      expect(await grants()).toEqual([]);

      const revoked = await prepareProposalDecision(reviewer, action, config);
      await approve(reviewer, revoked.operationId);
      await changeVisibility(false);
      try {
        const hidden = await readCharacterProposal(reviewer, read, config);
        expect(hidden).toMatchObject({ diffState: "unavailable" });
        expect(hidden).not.toHaveProperty("diff");
        expect(await reviewCharacterProposal(reviewer, { operationId: revoked.operationId }))
          .toMatchObject({ state: "blocked", failureCode: "DEPENDENCY_UNAVAILABLE" });
        expect(await grants()).toEqual([]);
      } finally { await changeVisibility(true); }
      expect(await readWorkspace(characterId)).toEqual(originalGraph);

      const decision = await prepareProposalDecision(reviewer, action, config);
      await approve(reviewer, decision.operationId);
      const result = await reviewCharacterProposal(reviewer, { operationId: decision.operationId });
      expect(result).toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: build.revision + 2 } });
      expect(await reviewCharacterProposal(reviewer, { operationId: decision.operationId })).toMatchObject({
        state: "completed", receipt: { characterId, decision: "approve", status: "applied", appliedRevision: build.revision + 2 },
      });
      const saved = await grants();
      const sourceFork = saved.find(row => row.sourceCapabilityId === source.capabilityId)!;
      const destinationFork = saved.find(row => row.sourceCapabilityId === destination.capabilityId)!;
      expect(saved).toHaveLength(2);
      expect((await readCharacterBuild(reviewer, { characterId }, config))).toMatchObject({ partial: false, slots: expect.arrayContaining([
        expect.objectContaining({ path: [sourceFork.rootEdgeId], pin: sourceFork.versionId }),
        expect.objectContaining({ path: [destinationFork.rootEdgeId], pin: destinationFork.versionId }),
        expect.objectContaining({ path: [destinationFork.rootEdgeId, expect.any(String)], pin: moved.versionId }),
      ]) });
      const { visibleDefinitionKeys } = await import("@/lib/publishing/definition-visibility");
      expect(await visibleDefinitionKeys(owner.clerkId, [`capability:${sourceFork.capabilityId}`, `capability:${destinationFork.capabilityId}`])).toEqual(new Set());
      expect((await pg.query("SELECT primitive_id, role, quantity FROM capability_primitives WHERE capability_id=$1 AND primitive_id=$2", [
        destinationFork.capabilityId, moved.primitiveId,
      ])).rows).toEqual([{ primitive_id: moved.primitiveId, role: moved.role, quantity: moved.quantity }]);
      expect((await pg.query("SELECT primitive_id FROM capability_primitives WHERE capability_id=$1 AND primitive_id=$2", [
        source.capabilityId, moved.primitiveId,
      ])).rows).toEqual([{ primitive_id: moved.primitiveId }]);

      const retained = source.members[0]!;
      const latest = await readCharacterBuild(writer, { characterId }, config);
      const movedPath = latest.slots.find(slot => slot.pin === moved.versionId)!;
      const retainedPath = latest.slots.find(slot => slot.pin === retained.versionId)!;
      const second = { characterId, expectedRevision: latest.revision, intent: "propose" as const, changes: [
        { kind: "mirror_primitive" as const, path: movedPath.path, isMirrored: true },
        { kind: "remove_reference" as const, path: retainedPath.path },
      ] };
      const secondProposal = await prepareCharacterProposal(writer, second);
      await approve(writer, secondProposal.operationId);
      await submitCharacterProposal(writer, { operationId: secondProposal.operationId });
      const next = (await listCharacterProposals(reviewer, { characterId }, config)).items.find(item => item.status === "pending")!;
      const nextDecision = await prepareProposalDecision(reviewer, { characterId, proposalRef: next.proposalRef, decision: "approve" }, config);
      await approve(reviewer, nextDecision.operationId);
      expect(await reviewCharacterProposal(reviewer, { operationId: nextDecision.operationId }))
        .toMatchObject({ state: "completed", receipt: { status: "applied", appliedRevision: latest.revision + 2 } });
      const final = await readCharacterBuild(reviewer, { characterId }, config);
      expect(final.partial).toBe(false);
      expect(final.slots.find(slot => slot.pin === moved.versionId)).toMatchObject({ isMirrored: true });
      expect(final.slots.some(slot => slot.pin === retained.versionId)).toBe(false);
      expect((await grants()).map(row => row.sourceCapabilityId).sort()).toEqual([source.capabilityId, destination.capabilityId].sort());
    } finally { vi.unstubAllEnvs(); }
  });

  it("limits an editor's private fork to its exact character occurrence, source eligibility and pin", async () => {
    stagingEnvironment();
    try {
      const actor = { ...editor, scopes: ["swordweave:read", "swordweave:edit"] };
      const characterId = randomUUID();
      const { capabilityId, versionId, members } = await seedExactCapabilityAttachment(8);
      await database.insert(schema.characters).values({ id: characterId, userId: owner.id, name: "Shared Lamplighter",
        attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      await database.insert(schema.characterShares).values([editor, viewer].map(user => ({
        characterId, sharedWithUserId: user.id, sharedByUserId: owner.clerkId, canEdit: user.id === editor.id,
      })));
      await database.insert(schema.characterCapabilities).values({ characterId, capabilityId, versionId });
      const build = await readCharacterBuild(actor, { characterId }, config);
      const path = build.slots.find(slot => slot.name === members[0]!.name)!.path;
      const input = { characterId, expectedRevision: build.revision, intent: "apply" as const,
        changes: [{ kind: "remove_reference" as const, path }] };
      const prepared = await prepareCharacterEdit(actor, input);
      const grants = () => database.select().from(schema.characterWorkspaceForkGrants)
        .where(eq(schema.characterWorkspaceForkGrants.characterId, characterId));
      expect(await grants()).toEqual([]);
      await approve(actor, prepared.operationId);
      const applied = await applyCharacterEdit(actor, { operationId: prepared.operationId });
      expect(applied.state).toBe("completed");
      expect((await applyCharacterEdit(actor, { operationId: prepared.operationId })).receipt).toEqual(applied.receipt);
      const rows = await grants();
      expect(rows).toHaveLength(1);
      const fork = rows[0]!;
      expect(fork.sourceCapabilityId).toBe(capabilityId);
      const { visibleDefinitionKeys } = await import("@/lib/publishing/definition-visibility");
      expect(await visibleDefinitionKeys(owner.clerkId, [`capability:${fork.capabilityId}`])).toEqual(new Set());
      const attached = () => readCharacterBuild(owner, { characterId }, config);
      const workspace = await import("@/lib/character/workspace/drafts");
      const draft = await workspace.saveWorkspaceDraft(characterId, owner.clerkId, {
        baseRevision: (await attached()).revision, expectedVersion: 0,
        operations: [{ id: randomUUID(), type: "character", payload: { name: "Lantern at Dawn" } }],
      });
      await workspace.applyWorkspaceDraft(characterId, owner.clerkId, draft.id, draft.version);
      await workspace.undoWorkspaceDraft(characterId, owner.clerkId, draft.id, draft.version);
      expect(await grants()).toEqual(rows);
      const ownerBuild = await attached();
      expect(ownerBuild.partial).toBe(false);
      expect(ownerBuild.slots).toContainEqual(expect.objectContaining({ path: [fork.rootEdgeId], pin: fork.versionId }));
      const retainedPath = ownerBuild.slots.find(slot => slot.name === members[1]!.name)!.path;
      expect((await previewCharacterEdit(owner, { ...input, expectedRevision: ownerBuild.revision,
        changes: [{ kind: "remove_reference", path: retainedPath }] }, config)).blockers).toEqual([]);
      expect((await readCharacterBuild(viewer, { characterId }, config)).partial).toBe(false);
      const otherCharacterId = randomUUID();
      await database.insert(schema.characters).values({ id: otherCharacterId, userId: owner.id, name: "Other Lantern",
        attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      await database.insert(schema.characterCapabilities).values({ characterId: otherCharacterId, capabilityId: fork.capabilityId, versionId: fork.versionId });
      expect((await readCharacterBuild(owner, { characterId: otherCharacterId }, config)).slots).toEqual([]);
      await database.update(schema.characterCapabilities).set({ versionId: null }).where(eq(schema.characterCapabilities.characterId, characterId));
      expect((await attached()).slots.some(slot => slot.pin === fork.versionId)).toBe(false);
      await database.update(schema.characterCapabilities).set({ versionId: fork.versionId }).where(eq(schema.characterCapabilities.characterId, characterId));
      await database.update(schema.primitives).set({ isPublic: false }).where(eq(schema.primitives.id, members[1]!.primitiveId));
      const restricted = await attached();
      expect(restricted).toMatchObject({ partial: true, budget: null });
      expect(restricted.slots.some(slot => slot.name === members[1]!.name)).toBe(false);
      await database.update(schema.primitives).set({ isPublic: true }).where(eq(schema.primitives.id, members[1]!.primitiveId));
      await pg.query("UPDATE character_shares SET revoked_at=now() WHERE character_id=$1 AND shared_with_user_id=$2", [characterId, viewer.id]);
      await expect(readCharacterBuild(viewer, { characterId }, config)).rejects.toBeInstanceOf(CharacterContextUnavailable);
      await database.update(schema.capabilities).set({ isPublic: false }).where(eq(schema.capabilities.id, capabilityId));
      expect((await attached()).slots.some(slot => slot.pin === fork.versionId)).toBe(false);
      await database.update(schema.capabilities).set({ isPublic: true }).where(eq(schema.capabilities.id, capabilityId));
      await database.update(schema.characterCapabilities).set({ slotTab: "LINEAGE" }).where(eq(schema.characterCapabilities.characterId, characterId));
      expect((await attached()).slots.some(slot => slot.pin === fork.versionId)).toBe(false);
      await database.delete(schema.characterCapabilities).where(eq(schema.characterCapabilities.characterId, characterId));
      expect(await grants()).toEqual([]);
      await database.insert(schema.characterCapabilities).values({ characterId, capabilityId: fork.capabilityId, versionId: fork.versionId });
      expect((await attached()).slots.some(slot => slot.pin === fork.versionId)).toBe(false);
    } finally { vi.unstubAllEnvs(); }
  });

  it("undoes a native pinned membership command only against its recorded result", async () => {
    const { executeWorkspaceCommand, WorkspaceConflict } = await import("@/lib/character/workspace/commands");
    const { readWorkspace } = await import("@/lib/character/workspace/read");
    const characterId = randomUUID();
    const { capabilityId, versionId, members } = await seedExactCapabilityAttachment(12);
    authFixture.protect.mockResolvedValue({ userId: suggester.clerkId });
    await database.insert(schema.characters).values({ id: characterId, userId: suggester.clerkId,
      name: "Pinned undo", mode: "BUILD", attrPhysical: 4, attrMental: 3, attrMagical: 3 });
    await database.insert(schema.characterCapabilities).values({ characterId, capabilityId, versionId });
    const original = await readWorkspace(characterId);
    const root = original.edges.find(edge => edge.parent === null && edge.child === `capability:${capabilityId}`)!;
    const member = original.edges.find(edge => edge.parent === root.child && edge.child === `primitive:${members[0]!.primitiveId}`)!;
    const commandId = randomUUID();
    const edited = await executeWorkspaceCommand(characterId, suggester.clerkId, {
      commandId, operation: "remove-reference", target: root.child, path: [root.id],
      expectedRevision: original.revision, expectedHash: null, edgeId: member.id,
    });
    const changed = await readWorkspace(characterId);
    const target = changed.nodes.find(node => node.id === edited["id"])!;
    const slot = changed.edges.find(edge => edge.parent === null && edge.child === target.key)!;
    expect(target.data["contentHash"]).toBeUndefined();
    expect(target.versionId).toBeTruthy();
    expect(edited).toMatchObject({ afterHash: null, afterVersionId: target.versionId });
    const undo = { commandId: randomUUID(), operation: "undo", undoCommandId: commandId,
      expectedRevision: changed.revision, expectedHash: null, target: target.key, path: [slot.id] };
    const { afterVersionId: _pin, ...legacy } = edited;
    for (const incompatible of [legacy, { ...edited, afterVersionId: randomUUID() }, { ...edited, afterHash: "different" }]) {
      const previousId = randomUUID();
      await database.insert(schema.characterWorkspaceCommands).values({ characterId, commandId: previousId,
        kind: "remove-reference", requestHash: "fixture", result: incompatible });
      await expect(executeWorkspaceCommand(characterId, suggester.clerkId, { ...undo, undoCommandId: previousId }))
        .rejects.toBeInstanceOf(WorkspaceConflict);
    }
    const restored = await executeWorkspaceCommand(characterId, suggester.clerkId, undo);
    expect(restored["revision"]).toBe(changed.revision + 1);
    expect((await readWorkspace(characterId)).edges.some(edge =>
      edge.parent === `capability:${restored["id"]}` && edge.child === member.child)).toBe(true);
    expect((await executeWorkspaceCommand(characterId, suggester.clerkId, undo))["revision"]).toBe(restored["revision"]);
  });

  it("moves an exact member between capabilities privately and leaves the original definitions intact", async () => {
    stagingEnvironment();
    try {
      const actor = { ...owner, scopes: ["swordweave:read", "swordweave:edit"] };
      const sheet = "20000000-0000-4000-8000-000000000010";
      const source = "b1000000-0000-4000-8000-000000000001";
      const destination = "b1000000-0000-4000-8000-000000000002";
      const sourcePin = "b2000000-0000-4000-8000-000000000001";
      const destinationPin = "b2000000-0000-4000-8000-000000000002";
      const primitivePin = "b3000000-0000-4000-8000-000000000001";
      const definition = { name: "Steady hands", category: "DOMAIN" as const, buCost: 4, mechanicalOutputText: "", hardModifiers: [] };
      const member = { primitiveId: 612, role: "DOMAIN" as const, quantity: 2 };
      const from = { id: source, name: "Mending", type: "ACTIVE" as const, sourceType: "PHYSICAL" as const };
      const to = { ...from, id: destination, name: "Steady work" };
      await database.insert(schema.characters).values({ id: sheet, userId: owner.clerkId, name: "Toolmaker", attrPhysical: 4, attrMental: 3, attrMagical: 3 });
      await database.insert(schema.primitives).values({ id: member.primitiveId, userId: editor.clerkId, isPublic: true, ...definition });
      await database.insert(schema.primitiveVersions).values({ id: primitivePin, primitiveId: member.primitiveId, versionNumber: 1,
        isLatest: true, deltaKind: "FULL", snapshot: definition });
      await database.insert(schema.capabilities).values([from, to].map(row => ({ ...row, userId: editor.clerkId, isPublic: true })));
      await database.insert(schema.capabilityPrimitives).values({ capabilityId: source, ...member });
      await database.insert(schema.capabilityVersions).values([
        { id: sourcePin, capabilityId: source, snapshot: { name: from.name, type: from.type, sourceType: from.sourceType,
          dependencyPins: [{ kind: "primitive", id: member.primitiveId, versionId: primitivePin, data: member }] } },
        { id: destinationPin, capabilityId: destination, snapshot: { name: to.name, type: to.type, sourceType: to.sourceType, dependencyPins: [] } },
      ].map(pin => ({ ...pin, versionNumber: 1, isLatest: true, deltaKind: "FULL" as const })));
      await database.insert(schema.characterCapabilities).values([
        { characterId: sheet, capabilityId: source, versionId: sourcePin },
        { characterId: sheet, capabilityId: destination, versionId: destinationPin },
      ]);

      const build = await readCharacterBuild(actor, { characterId: sheet }, config);
      const memberPath = build.slots.find(slot => slot.name === definition.name)?.path;
      const destinationPath = build.slots.find(slot => slot.name === to.name)?.path;
      expect(memberPath).toHaveLength(2);
      expect(destinationPath).toHaveLength(1);
      const input = { characterId: sheet, expectedRevision: build.revision, intent: "apply" as const, changes: [
        { kind: "move_reference" as const, path: memberPath!, destinationPath: destinationPath! },
      ] };
      const preview = await previewCharacterEdit(actor, input, config);
      expect(preview.blockers).toEqual([]);
      expect((await pg.query("select id from capabilities where user_id = $1", [owner.clerkId])).rows).toEqual([]);
      const operation = await prepareCharacterEdit(actor, input);
      await approve(actor, operation.operationId);
      const applied = await applyCharacterEdit(actor, { operationId: operation.operationId });
      expect(applied.state).toBe("completed");
      expect((await applyCharacterEdit(actor, { operationId: operation.operationId })).receipt).toEqual(applied.receipt);
      expect((await pg.query("select is_public from capabilities where user_id = $1", [owner.clerkId])).rows).toEqual([{ is_public: false }, { is_public: false }]);
      expect((await pg.query("select primitive_id, role, quantity from capability_primitives where capability_id = $1", [source])).rows)
        .toEqual([{ primitive_id: member.primitiveId, role: member.role, quantity: member.quantity }]);
      expect((await pg.query("select * from forks where source_target_id = $1 or source_target_id = $2", [source, destination])).rows).toEqual([]);
    } finally { vi.unstubAllEnvs(); }
  });

  it("records and resolves owner consequences through native receipts while leaving runtime storage for reconciliation", async () => {
    stagingEnvironment();
    try {
      const actor = { ...owner, scopes };
      const input = { characterId: plain, action: { kind: "record_consequence" as const,
        title: "Sprained ankle", description: "  **Short description**\r\n\r\n- Recovery  ", durationTier: "manual" as const } };
      await expect(previewPlayAction(editor, { ...input, characterId: id }, config))
        .rejects.toBeInstanceOf(CharacterContextUnavailable);
      const runtime = (await pg.query("SELECT * FROM play_states WHERE subject_id=$1", [plain])).rows;
      const preview = await previewPlayAction(actor, input, config);
      expect(preview.after).toMatchObject({ description: "**Short description**\n\n- Recovery", status: "active" });
      const prepared = await preparePlayAction(actor, input);
      expect((await pg.query("SELECT * FROM character_consequences WHERE character_id=$1", [plain])).rows).toEqual([]);
      await approve(actor, prepared.operationId);
      const committed = await applyPlayAction(actor, { operationId: prepared.operationId });
      expect(committed).toMatchObject({ state: "completed", receipt: { characterId: plain, occurrenceRevision: 1 } });
      const occurrenceId = committed.receipt && "occurrenceId" in committed.receipt ? committed.receipt.occurrenceId : null;
      if (typeof occurrenceId !== "string") throw new Error("The applied occurrence was missing.");
      expect((await applyPlayAction(actor, { operationId: prepared.operationId })).receipt).toEqual(committed.receipt);
      expect((await readCharacterPlayState(actor, { characterId: plain }, config)).consequences)
        .toMatchObject([{ occurrenceId, revision: 1 }]);
      const resolve = { characterId: plain, action: { kind: "resolve_consequence" as const, occurrenceId, expectedRevision: 1 } };
      const stale = await preparePlayAction(actor, resolve);
      await approve(actor, stale.operationId);
      await pg.query("UPDATE character_consequences SET revision=2 WHERE character_id=$1 AND occurrence_id=$2", [plain, occurrenceId]);
      expect(await applyPlayAction(actor, { operationId: stale.operationId })).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      const current = await preparePlayAction(actor, { ...resolve, action: { ...resolve.action, expectedRevision: 2 } });
      await approve(actor, current.operationId);
      const resolved = await applyPlayAction(actor, { operationId: current.operationId });
      expect(resolved).toMatchObject({ state: "completed", receipt: { occurrenceId, occurrenceRevision: 3 } });
      expect((await readCharacterPlayState(actor, { characterId: plain }, config)).consequences).toEqual([]);
      expect((await pg.query("SELECT count(*)::int AS count FROM character_workspace_commands WHERE character_id=$1 AND kind='consequence:save'", [plain])).rows[0]?.["count"]).toBe(2);
      expect((await pg.query("SELECT * FROM play_states WHERE subject_id=$1", [plain])).rows).toEqual(runtime);
    } finally { vi.unstubAllEnvs(); }
  });

  it("does not preview an occurrence sourced from a private nested definition", async () => {
    const occurrence = { id: "native-opaque-id", title: "Hidden authored title", description: "Private text",
      status: "active", active: true, durationTier: "manual", tags: [], modifiers: [], source: "sheet",
      sourceEntityType: "primitive", sourceEntityId: "100", createdAt: 100 };
    await pg.query("INSERT INTO character_consequences (character_id, occurrence_id, occurrence) VALUES ($1, $2, $3)",
      [id, occurrence.id, JSON.stringify(occurrence)]);
    const preview = await previewPlayAction(owner, { characterId: id,
      action: { kind: "resolve_consequence", occurrenceId: occurrence.id, expectedRevision: 1 } }, config);
    expect(preview).toMatchObject({ before: null, after: null });
    expect(preview.blockers).toHaveLength(1);
    expect(JSON.stringify(preview)).not.toMatch(/Hidden authored title|Private text/);
  });

  it("commits a complete pinned consequence package through the native command, with an exact replay", async () => {
    const sheet = "20000000-0000-4000-8000-000000000011";
    const capability = "41000000-0000-4000-8000-000000000001";
    const capabilityPin = "42000000-0000-4000-8000-000000000001";
    const primitivePin = "43000000-0000-4000-8000-000000000001";
    const sourceKey = `capability:${capability}` as const;
    const behavior = { timing: "on-use" as const, vitalityDelta: -3, recovery: "Take **a breath**.", restrictions: [] };
    const modifier = { kind: "modify" as const, target: "max_vitality", operation: "add" as const, value: 4 };
    const definition = {
      name: "Tiring effort", category: "VITALITY" as const, buCost: 2, narrativeRule: "Take **strain**.",
      consequenceBehavior: behavior, hardModifiers: [modifier],
    };
    const member = { primitiveId: 714, role: "OTHER" as const, quantity: 1 };
    await database.insert(schema.characters).values({ id: sheet, userId: owner.clerkId, name: "Package user",
      currentVitality: 8, attrPhysical: 4, attrMental: 3, attrMagical: 3 });
    await database.insert(schema.characterShares).values({ characterId: sheet, sharedWithUserId: editor.id, sharedByUserId: owner.clerkId, canEdit: true });
    await database.insert(schema.primitives).values({ id: member.primitiveId, userId: outsider.clerkId, isPublic: true, ...definition });
    await database.insert(schema.primitiveVersions).values({ id: primitivePin, primitiveId: member.primitiveId, versionNumber: 1,
      isLatest: true, deltaKind: "FULL", snapshot: definition });
    const capabilityDefinition = { name: "Push through", type: "ACTIVE" as const, sourceType: "PHYSICAL" as const };
    await database.insert(schema.capabilities).values({ ...capabilityDefinition, id: capability, userId: owner.clerkId, isPublic: false });
    await database.insert(schema.capabilityPrimitives).values({ capabilityId: capability, ...member });
    await database.insert(schema.capabilityVersions).values({ id: capabilityPin, capabilityId: capability, versionNumber: 1,
      isLatest: true, deltaKind: "FULL", snapshot: { ...capabilityDefinition,
        dependencyPins: [{ kind: "primitive", id: member.primitiveId, versionId: primitivePin, data: member }] } });
    await database.insert(schema.characterCapabilities).values({ characterId: sheet, capabilityId: capability, versionId: capabilityPin });
    await database.insert(schema.characterPrimitives).values({ characterId: sheet, primitiveId: member.primitiveId, source: "MANIFEST",
      originCapabilityId: capability, versionId: primitivePin });

    const actor = { ...owner, scopes };
    const input = { characterId: sheet, action: { kind: "apply_consequence_package" as const, sourceKey } };
    await expect(previewPlayAction(editor, input, config)).rejects.toBeInstanceOf(CharacterContextUnavailable);
    await expect(previewPlayAction(actor, { ...input, characterId: plain }, config)).rejects.toBeInstanceOf(CharacterContextUnavailable);
    const options = await readCharacterPlayState(actor, { characterId: sheet }, config);
    expect(options.sourceChoices).toContainEqual({ sourceKey, name: capabilityDefinition.name, versionId: capabilityPin });
    const native = await readCharacterConsequencePackage(sheet, actor.clerkId, sourceKey);
    expect(native).toMatchObject({ previous: 8, next: 5 });
    const reduced = { ...definition, hardModifiers: [{ ...modifier, value: -8 }] };
    await pg.query("UPDATE primitives SET hard_modifiers=$1 WHERE id=$2", [JSON.stringify(reduced.hardModifiers), member.primitiveId]);
    await pg.query("UPDATE primitive_versions SET snapshot=$1 WHERE id=$2", [JSON.stringify(reduced), primitivePin]);
    expect((await previewPlayAction(actor, input, config)).after).toBeNull();
    expect((await pg.query("SELECT occurrence_id FROM character_consequences WHERE character_id=$1", [sheet])).rows).toEqual([]);
    await pg.query("UPDATE primitives SET hard_modifiers=$1 WHERE id=$2", [JSON.stringify(definition.hardModifiers), member.primitiveId]);
    await pg.query("UPDATE primitive_versions SET snapshot=$1 WHERE id=$2", [JSON.stringify(definition), primitivePin]);
    const preview = await previewPlayAction(actor, input, config);
    expect(preview).toMatchObject({
      before: { currentVitality: native.previous, maxVitality: native.max },
      after: { currentVitality: native.next, maxVitality: native.max + 4, appliedVitality: -3, occurrences: [
        { title: definition.name, description: definition.narrativeRule, sourceVersionId: primitivePin, durationTier: "manual",
          vitalityDelta: -3, recovery: behavior.recovery, modifiers: [modifier] },
      ] },
    });

    stagingEnvironment();
    try {
      const stale = await preparePlayAction(actor, input);
      await approve(actor, stale.operationId);
      await pg.query("UPDATE characters SET current_vitality=9 WHERE id=$1", [sheet]);
      expect(await applyPlayAction(actor, { operationId: stale.operationId })).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect((await pg.query("SELECT * FROM character_consequences WHERE character_id=$1", [sheet])).rows).toEqual([]);

      const prepared = await preparePlayAction(actor, input);
      await approve(actor, prepared.operationId);
      const [first, duplicate] = await Promise.all([
        applyPlayAction(actor, { operationId: prepared.operationId }),
        applyPlayAction(actor, { operationId: prepared.operationId }),
      ]);
      expect(first).toMatchObject({ state: "completed", receipt: { applicationId: prepared.operationId, previousVitality: 9, currentVitality: 6, applied: -3 } });
      expect(duplicate.receipt).toEqual(first.receipt);
      expect((await applyPlayAction(actor, { operationId: prepared.operationId })).receipt).toEqual(first.receipt);
      const saved = (await pg.query("SELECT occurrence, revision FROM character_consequences WHERE character_id=$1", [sheet])).rows;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ revision: 1, occurrence: {
        applicationId: prepared.operationId, sourceEntityId: String(member.primitiveId), sourceVersionId: primitivePin,
        applicationSnapshot: { vitalityDelta: -3, modifiers: [modifier], restrictions: [] },
      } });
      expect((await pg.query("SELECT kind FROM character_log WHERE character_id=$1 ORDER BY id", [sheet])).rows)
        .toEqual([{ kind: "vitality_change" }, { kind: "capability_trigger" }]);
      expect((await pg.query("SELECT kind FROM character_workspace_commands WHERE character_id=$1", [sheet])).rows)
        .toEqual([{ kind: "apply-package" }]);
      expect((await pg.query("SELECT * FROM play_states WHERE subject_id=$1", [sheet])).rows).toEqual([]);
      const appliedState = await readCharacterPlayState(actor, { characterId: sheet }, config);
      expect(appliedState).toMatchObject({ currentVitality: 6, maxVitality: native.max + 4 });
      expect(appliedState.consequences).toHaveLength(1);

      const revoked = await preparePlayAction(actor, input);
      await approve(actor, revoked.operationId);
      await pg.query("UPDATE primitives SET is_public=false WHERE id=$1", [member.primitiveId]);
      expect(await applyPlayAction(actor, { operationId: revoked.operationId })).toMatchObject({ state: "blocked", failureCode: "STALE_REVIEW" });
      expect((await pg.query("SELECT occurrence, revision FROM character_consequences WHERE character_id=$1", [sheet])).rows).toEqual(saved);
      const hidden = await previewPlayAction(actor, input, config);
      expect(hidden).toMatchObject({ before: null, after: null });
      expect(JSON.stringify(hidden)).not.toMatch(/Tiring effort|Push through|Take \*\*strain/);
      const hiddenState = await readCharacterPlayState(actor, { characterId: sheet }, config);
      expect(hiddenState.consequences).toEqual([]);
      expect(hiddenState.sourceChoices).toEqual([]);
      expect((await readCharacterHistory(actor, { characterId: sheet }, config)).entries).toEqual([]);

      await pg.query("UPDATE primitives SET is_public=true WHERE id=$1", [member.primitiveId]);
      await pg.query("UPDATE characters SET current_vitality=1 WHERE id=$1", [sheet]);
      const clamped = await preparePlayAction(actor, input);
      await approve(actor, clamped.operationId);
      expect(await applyPlayAction(actor, { operationId: clamped.operationId })).toMatchObject({ state: "completed",
        receipt: { previousVitality: 1, currentVitality: 0, applied: -1 } });
      const written = await pg.query("SELECT payload->'delta' AS delta FROM character_log WHERE payload->>'applicationId'=$1 AND kind='vitality_change'", [clamped.operationId]);
      expect(written.rows).toEqual([{ delta: -1 }]);
      // Legacy rows stored authored deltas even when the native clamp shortened the change.
      await pg.query("UPDATE character_log SET payload=jsonb_set(payload,'{delta}','-3') WHERE payload->>'applicationId'=$1 AND kind='vitality_change'", [clamped.operationId]);
      expect((await readCharacterHistory(actor, { characterId: sheet }, config)).entries).toContainEqual(expect.objectContaining({
        kind: "vitality_change", previous: 1, current: 0, delta: -1,
      }));
      const historical = "43000000-0000-4000-8000-000000000002";
      const replacement = "43000000-0000-4000-8000-000000000003";
      const liveDefinition = { name: "Endurance", category: "VITALITY" as const, buCost: 2,
        hardModifiers: [{ ...modifier, value: 2 }] };
      await database.insert(schema.primitives).values({ id: 715, userId: owner.clerkId, ...liveDefinition });
      await database.insert(schema.primitiveVersions).values([
        { id: historical, versionNumber: 1, isLatest: false, snapshot: { ...liveDefinition, hardModifiers: [{ ...modifier, value: 1 }] } },
        { id: replacement, versionNumber: 2, isLatest: true, snapshot: liveDefinition },
      ].map(version => ({ ...version, primitiveId: 715, deltaKind: "FULL" as const })));
      await database.insert(schema.characterPrimitives).values({ characterId: sheet, primitiveId: 715, source: "MANIFEST",
        versionId: historical });
      expect((await readCharacterPlayState(actor, { characterId: sheet }, config)).maxVitality).toBeNull();
      expect(await previewPlayAction(actor, input, config)).toMatchObject({ before: null, after: null });
    } finally { vi.unstubAllEnvs(); }
  });

});
