import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  setSourceCollection: vi.fn(),
  where: vi.fn(),
  insert: vi.fn(),
  auth: vi.fn(),
  transactionResult: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({
  db: {
    execute: mocks.execute,
    select: () => ({ from: () => ({ where: mocks.where }) }),
    insert: mocks.insert,
  },
  withDatabaseTransaction: async (work: () => Promise<unknown>) => {
    try { const result = await work(); mocks.transactionResult("commit"); return result; } catch (error) { mocks.transactionResult("rollback"); throw error; }
  },
}));
vi.mock("../service", async () => {
  const schema = await import("@/db/schema/collections");
  return {
    collections: schema.collections,
    collectionEntries: schema.collectionEntries,
    setSourceCollection: mocks.setSourceCollection,
    collectionTargetTables: { PRIMITIVE: "primitives", EFFECT: "effects" },
  };
});
import { withSourceCollection } from "../source-save";
const request = (data: unknown) =>
  new Request("https://swordweave.test/api/primitives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.where.mockResolvedValue([{ ownerId: "owner", systemKind: null }]);
  mocks.execute.mockResolvedValue({ rows: [{ id: 12, user_id: "owner" }] });
});
describe("source collection save transaction", () => {
  it("does not alter source associations when the field is omitted", async () => {
    await withSourceCollection(
      request({ name: "Rule" }),
      "PRIMITIVE",
      async () => response({ primitive: { id: 12 } }),
    );
    expect(mocks.setSourceCollection).not.toHaveBeenCalled();
  });
  it("saves the source membership using the returned new fork ID", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    await withSourceCollection(
      request({ sourceCollectionId: id, sourceId: 12 }),
      "PRIMITIVE",
      async () =>
        response({
          primitive: { id: 13 },
          dispatchOutcome: { kind: "forked" },
        }),
    );
    expect(mocks.setSourceCollection).toHaveBeenCalledWith(
      "owner",
      "PRIMITIVE",
      "13",
      id,
    );
  });
  it("clears an owned source association even when the content dispatcher reports no-op", async () => {
    await withSourceCollection(
      request({ sourceCollectionId: null, sourceId: 12 }),
      "PRIMITIVE",
      async () =>
        response({ primitive: null, dispatchOutcome: { kind: "no-op" } }),
    );
    expect(mocks.setSourceCollection).toHaveBeenCalledWith(
      "owner",
      "PRIMITIVE",
      "12",
      null,
    );
  });
  it("does not change an association when saving the entry fails", async () => {
    await withSourceCollection(
      request({ sourceCollectionId: null, sourceId: 12 }),
      "PRIMITIVE",
      async () => response({ error: "Rejected" }, 400),
    );
    expect(mocks.setSourceCollection).not.toHaveBeenCalled();
  });
  it("cannot clear the original author's source on an unchanged borrowed entry", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ id: 12, user_id: "another-author" }],
    });
    await withSourceCollection(
      request({ sourceCollectionId: null, sourceId: 12 }),
      "PRIMITIVE",
      async () =>
        response({ primitive: null, dispatchOutcome: { kind: "no-op" } }),
    );
    expect(mocks.setSourceCollection).not.toHaveBeenCalled();
  });
  it("rejects a private collection owned by another author before saving", async () => {
    mocks.where.mockResolvedValue([]);
    const work = vi.fn(async () => response({ primitive: { id: 13 } }));
    const r = await withSourceCollection(
      request({ sourceCollectionId: "11111111-1111-4111-8111-111111111111" }),
      "PRIMITIVE",
      work,
    );
    expect(r.status).toBe(400);
    expect(work).not.toHaveBeenCalled();
  });
  it("rolls back the content transaction when the dispatcher returns a rejected response", async () => {
    const rejected = response({ error: "Content rejected after a write" }, 400);
    const result = await withSourceCollection(request({ sourceCollectionId: null }), "PRIMITIVE", async () => rejected);
    expect(result).toBe(rejected);
    expect(mocks.transactionResult).toHaveBeenCalledWith("rollback");
    expect(mocks.transactionResult).not.toHaveBeenCalledWith("commit");
    expect(mocks.setSourceCollection).not.toHaveBeenCalled();
  });
  it("rolls back content and membership together if source association creation fails", async () => {
    mocks.setSourceCollection.mockRejectedValueOnce(new Error("Source association failed"));
    await expect(withSourceCollection(request({ sourceCollectionId: null }), "PRIMITIVE", async () => response({ primitive: { id: 13 } }))).rejects.toThrow("Source association failed");
    expect(mocks.transactionResult).toHaveBeenCalledWith("rollback");
    expect(mocks.transactionResult).not.toHaveBeenCalledWith("commit");
  });
});
