import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { execute: mocks.execute } }));
import { directoryFilters, publicCollectionDirectory } from "../public-directory";
const dialect = new PgDialect();
beforeEach(() => vi.clearAllMocks());

describe("public collection directory", () => {
  it("discovers public custom collections without ownership or saved-membership gates", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });
    await publicCollectionDirectory();
    const query = dialect.sqlToQuery(mocks.execute.mock.calls[0]![0]).sql;
    expect(query).toContain("c.visibility = 'PUBLIC'");
    expect(query).toContain("c.system_kind IS NULL");
    expect(query).toContain("u.is_public = true");
    expect(query).not.toContain("collection_follows");
    expect(query).not.toContain("collection_entries");
    expect(query).not.toContain("parent_id");
  });
  it("uses a bounded literal search and parameterized pagination", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });
    await publicCollectionDirectory({ q: "  50%_arcane  ", origin: "community", page: "2", sort: "name" });
    const query = dialect.sqlToQuery(mocks.execute.mock.calls[0]![0]);
    expect(query.sql).toContain("strpos(lower(c.name)");
    expect(query.sql).toContain("NOT");
    expect(query.sql).toContain("ORDER BY lower(c.name) ASC, c.id ASC");
    expect(query.params).toContain("50%_arcane");
    expect(query.params).toContain(25);
    expect(query.params).toContain(24);
  });
  it("uses a lookahead row for pagination without returning it", async () => {
    mocks.execute.mockResolvedValue({ rows: Array.from({ length: 25 }, (_, id) => ({ id: String(id), name: "Collection" })) });
    const result = await publicCollectionDirectory({ origin: "system" });
    expect(result.collections).toHaveLength(24);
    expect(result.hasMore).toBe(true);
  });
  it("normalizes malformed and oversized filters", () => {
    expect(directoryFilters({ page: "-3", origin: "PRIVATE", sort: "anything" })).toMatchObject({ page: 1, origin: "all", sort: "recent" });
    expect(directoryFilters({ page: "1.5" }).page).toBe(1);
    expect(directoryFilters({ page: "Infinity" }).page).toBe(1);
    expect(directoryFilters({ q: "a".repeat(200) }).q).toHaveLength(100);
  });
});
