import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCharacterProposals, readCharacterProposal } from "../character-proposals";

const fixture = vi.hoisted(() => ({ select: vi.fn(), access: vi.fn(), where: vi.fn(), limit: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { select: fixture.select } }));
vi.mock("../context-shared", async importOriginal => ({
  ...await importOriginal<typeof import("../context-shared")>(),
  requireCharacterAccess: fixture.access,
  readOnlyCharacterContext: async (work: () => Promise<unknown>) => work(),
}));

const owner = { id: "0abca085-ca0f-42bb-8866-b24a96bf62ae", clerkId: "user_fixture_owner" };
const suggester = { id: "418ccb16-2c88-49cc-845f-f7da24764786", clerkId: "user_fixture_author" };
const characterId = "274f07d1-0c3e-4e27-bdb1-92bb0d9c7df1";
const otherCharacterId = "7a3970ca-ef60-44a2-a644-47f76faeb8d8";
const config = { resource: "https://swordweave.example/api/mcp", cursorSecret: "fixture-only-character-cursor-secret-33" };
const rawId = "proposal:user_fixture_author:fixture_request_one";
const updatedAt = new Date("2026-11-25T07:00:00Z");
const row = { id: rawId, status: "pending", baseRevision: "5", updatedAt, timestamp: "2026-11-25 07:00:00.123456+00" };
const dialect = new PgDialect();

beforeEach(() => {
  vi.resetAllMocks();
  fixture.select.mockImplementation(() => ({ from: () => ({ where: fixture.where }) }));
  fixture.where.mockImplementation(() => ({ limit: fixture.limit, orderBy: () => ({ limit: fixture.limit }) }));
  fixture.access.mockResolvedValue({ permission: "OWNER" });
  fixture.limit.mockResolvedValue([row]);
});
afterEach(() => vi.useRealTimers());

describe("workspace proposal reads", () => {
  it("selects only bounded metadata and applies both character and author scope for a collaborator", async () => {
    fixture.access.mockResolvedValue({ permission: "SUGGESTER" });
    const result = await listCharacterProposals(suggester, { characterId }, config);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ subtype: "workspace", status: "pending", baseRevision: 5, updatedAt: updatedAt.toISOString() });
    expect(JSON.stringify(result)).not.toContain(rawId);
    const query = dialect.sqlToQuery(fixture.where.mock.calls[0]?.[0]);
    expect(query.sql).toContain("->>'authorId'");
    expect(query.params).toContain(suggester.clerkId);
    expect(query.params).toContain(characterId);
    expect(fixture.limit).toHaveBeenCalledWith(9);
  });

  it("keeps the native key in an opaque cursor bound to actor, character and resource", async () => {
    fixture.limit.mockResolvedValueOnce(Array.from({ length: 9 }, (_, i) => ({ ...row, id: rawId + i })));
    const first = await listCharacterProposals(owner, { characterId }, config);
    expect(first.items).toHaveLength(8);
    expect(first.nextCursor).toBeTruthy();
    const cursor = first.nextCursor!;
    expect(Buffer.from(cursor, "base64url").includes(Buffer.from(rawId))).toBe(false);
    await expect(listCharacterProposals(suggester, { characterId, cursor }, config)).rejects.toThrow("unavailable");
    await expect(listCharacterProposals(owner, { characterId: otherCharacterId, cursor }, config)).rejects.toThrow("unavailable");
    await expect(listCharacterProposals(owner, { characterId, cursor }, { ...config, resource: "https://other.example/api/mcp" })).rejects.toThrow("unavailable");
    await listCharacterProposals(owner, { characterId, cursor }, config);
    expect(dialect.sqlToQuery(fixture.where.mock.calls.at(-1)?.[0]).params).toContain(row.timestamp);
  });

  it("returns only the authorized rationale and a stale revision, with no raw operations or identity", async () => {
    const { items } = await listCharacterProposals(owner, { characterId }, config);
    const proposalRef = items[0]!.proposalRef;
    fixture.limit.mockResolvedValueOnce([{ ...row, description: "**A choice to discuss.**", operations: ["private"], baseHash: "not emitted" }])
      .mockResolvedValueOnce([{ revision: 6 }]);
    const detail = await readCharacterProposal(owner, { characterId, proposalRef }, config);
    expect(detail).toMatchObject({ characterId, description: "**A choice to discuss.**", stale: true });
    expect(JSON.stringify(detail)).not.toMatch(/private|fixture_request_one|not emitted/);
    expect(fixture.access).toHaveBeenLastCalledWith(owner, characterId);
    const query = dialect.sqlToQuery(fixture.where.mock.calls.at(-2)?.[0]);
    expect(query.params).toEqual(expect.arrayContaining([characterId, rawId]));
  });

  it("denies expiring references, foreign references and cursors used as proposal references", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const issuedAt = Date.now();
    fixture.limit.mockResolvedValueOnce(Array.from({ length: 9 }, (_, i) => ({ ...row, id: rawId + i })));
    const { items, nextCursor } = await listCharacterProposals(owner, { characterId }, config);
    const { proposalRef } = items[0]!;
    await expect(readCharacterProposal(suggester, { characterId, proposalRef }, config)).rejects.toThrow("unavailable");
    await expect(readCharacterProposal(owner, { characterId: otherCharacterId, proposalRef }, config)).rejects.toThrow("unavailable");
    await expect(readCharacterProposal(owner, { characterId, proposalRef: nextCursor! }, config)).rejects.toThrow("unavailable");
    vi.setSystemTime(issuedAt + 600_000);
    await expect(readCharacterProposal(owner, { characterId, proposalRef }, config)).rejects.toThrow("unavailable");
    expect(fixture.select).toHaveBeenCalledTimes(1);
  });
});
