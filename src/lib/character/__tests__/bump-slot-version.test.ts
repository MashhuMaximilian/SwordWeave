import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { bumpSlotVersion } from "../bump-slot-version";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(), where: vi.fn(), updateWhere: vi.fn(), update: vi.fn(),
  latest: vi.fn(), recompute: vi.fn(), returning: vi.fn(), set: vi.fn(),
}));
vi.mock("@/db/client", () => ({ db: {
  select: () => ({ from: () => ({ where: mocks.where }) }),
  update: mocks.update,
} }));
vi.mock("@/lib/versions/slot-source", () => ({ resolveLatestVersionId: mocks.latest }));
vi.mock("@/lib/engine/recompute-bu-spent", () => ({ recomputeBuSpentAndBustCache: mocks.recompute }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.where.mockImplementation(() => ({ limit: mocks.rows }));
  mocks.rows.mockResolvedValue([{ id: 42 }]);
  mocks.latest.mockResolvedValue("latest-version");
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.updateWhere });
  mocks.updateWhere.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ versionId: "latest-version" }]);
});

const args = { characterId: "character", entityId: "instance-uuid", kind: "primitive" as const };
const params = (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(condition).params;

describe("advance a character slot version", () => {
  it("resolves latest using the integer primitive ID and updates only this occurrence", async () => {
    await expect(bumpSlotVersion(args)).resolves.toEqual({ newVersionId: "latest-version" });
    expect(mocks.latest).toHaveBeenCalledWith("primitive", 42);
    expect(params(mocks.where.mock.calls[0]![0])).toEqual(["character", "instance-uuid"]);
    expect(params(mocks.updateWhere.mock.calls[0]![0])).toEqual(["character", "instance-uuid"]);
    expect(mocks.recompute).toHaveBeenCalledWith("character");
  });
  it("does not resolve or mutate a missing occurrence in this character", async () => {
    mocks.rows.mockResolvedValueOnce([]);
    await expect(bumpSlotVersion(args)).rejects.toThrow("Primitive slot not found");
    expect(mocks.latest).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recompute).not.toHaveBeenCalled();
  });
  it("rejects an explicit version from another primitive before writing", async () => {
    mocks.rows.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([]);
    await expect(bumpSlotVersion({ ...args, toVersionId: "foreign-version" })).rejects.toThrow("does not belong");
    expect(params(mocks.where.mock.calls[1]![0])).toEqual(["foreign-version", 42]);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recompute).not.toHaveBeenCalled();
  });
  it("accepts an older explicit version belonging to the same primitive", async () => {
    mocks.rows.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([{ id: "older-version" }]);
    await expect(bumpSlotVersion({ ...args, toVersionId: "older-version" })).resolves.toEqual({ newVersionId: "older-version" });
    expect(mocks.latest).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith({ versionId: "older-version" });
  });
  it("does not write when no published version exists", async () => {
    mocks.latest.mockResolvedValue(null);
    await expect(bumpSlotVersion(args)).rejects.toThrow("No version found");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["capability", "item"] as const)("keeps the %s identity and rejects a missing slot", async kind => {
    mocks.returning.mockResolvedValue([]);
    await expect(bumpSlotVersion({ ...args, kind, entityId: "entity-uuid" })).rejects.toThrow("Character slot not found");
    expect(mocks.latest).toHaveBeenCalledWith(kind, "entity-uuid");
    expect(mocks.recompute).not.toHaveBeenCalled();
  });
});
