import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogueCursorError, findCreations, getCatalogueCursorSecret } from "../catalogue";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { execute } }));

const actor = { id: "viewer-alpha", clerkId: "user_alpha" };
const options = { resource: "https://mcp.example/api/mcp", cursorSecret: "fictional-catalogue-secret-for-tests" };
const input = { kind: "primitive", query: "safe" } as const;
const dialect = new PgDialect();

function row(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id: String(id), name: "Safe Landing", normalizedName: "safe landing",
    rank: 1, publicationType: "PRIMITIVE", buCost: 4, versionId: null,
    ...overrides,
  };
}

function lastQuery() {
  return dialect.sqlToQuery(execute.mock.calls.at(-1)?.[0]);
}

beforeEach(() => execute.mockReset());
afterEach(() => vi.useRealTimers());

describe("bounded MCP catalogue", () => {
  it("requires an explicitly configured secret and an authenticated viewer", async () => {
    expect(getCatalogueCursorSecret({})).toBeNull();
    expect(getCatalogueCursorSecret({ MCP_CURSOR_HMAC_SECRET: "short" })).toBeNull();
    expect(getCatalogueCursorSecret({ MCP_CURSOR_HMAC_SECRET: " ".repeat(32) })).toBeNull();
    await expect(findCreations(input, { ...actor, clerkId: "" }, options)).rejects.toThrow("Catalogue discovery is unavailable.");
    expect(execute).not.toHaveBeenCalled();
  });

  it("uses exact root visibility and limits the database query before version lookup", async () => {
    execute.mockResolvedValue({ rows: [row(1, { versionId: "2cb8e62b-c150-44d2-b9cf-b41bcb3297f0" })] });
    const result = await findCreations({ ...input, query: "  Safe   LANDING " }, actor, options);
    const query = lastQuery();
    expect(query.sql).toContain('FROM "primitives"');
    expect(query.sql).toContain("visibility = 'PUBLIC'");
    expect(query.sql).toContain("visibility = 'FOLLOWERS_ONLY'");
    expect(query.sql).toContain("unpublished_at IS NULL");
    expect(query.sql).toContain('"primitives"."is_public"');
    expect(query.sql).toContain('FROM visible WHERE strpos("normalizedName"');
    expect(query.sql).toContain('ORDER BY rank, "normalizedName" COLLATE "C", id COLLATE "C" LIMIT');
    expect(query.sql).toContain('FROM "primitive_versions"');
    expect(query.params).toEqual(expect.arrayContaining(["user_alpha", "safe landing", 40]));
    expect(result).toEqual({
      coverage: "EXHAUSTED", nextCursor: null,
      items: [{
        name: "Safe Landing", id: "1", kind: "primitive",
        buCost: 4, matchReason: "Name starts with the query", source: "https://mcp.example/library/item/PRIMITIVE:1",
        pin: { kind: "primitive", id: "1", versionId: "2cb8e62b-c150-44d2-b9cf-b41bcb3297f0" }, versionStatus: "PINNED",
      }],
    });
  });

  it("continues after the eighth examined match rather than the end of the retrieved batch", async () => {
    execute.mockResolvedValueOnce({ rows: Array.from({ length: 20 }, (_, index) => row(index + 10)) });
    const first = await findCreations(input, actor, options);
    expect(first.items.map(item => item.id)).toEqual(["10", "11", "12", "13", "14", "15", "16", "17"]);
    expect(first.coverage).toBe("MORE");
    execute.mockResolvedValueOnce({ rows: [row(18), row(19)] });
    const second = await findCreations({ ...input, cursor: first.nextCursor! }, actor, options);
    expect(lastQuery().params).toEqual(expect.arrayContaining([1, "safe landing", "17"]));
    expect(lastQuery().params).not.toContain("29");
    expect(second.items.map(item => item.id)).toEqual(["18", "19"]);
    expect(second.coverage).toBe("EXHAUSTED");
  });

  it("continues after a whole scan with unknown or out-of-range BU", async () => {
    execute.mockResolvedValueOnce({
      rows: Array.from({ length: 40 }, (_, index) => row(index + 10, { buCost: index % 2 === 0 ? null : 99 })),
    });
    const first = await findCreations({ ...input, maxBu: 8 }, actor, options);
    expect(first).toEqual({ items: [], coverage: "MORE", nextCursor: expect.any(String) });
    execute.mockResolvedValueOnce({ rows: [row(50)] });
    const second = await findCreations({ ...input, maxBu: 8, cursor: first.nextCursor! }, actor, options);
    expect(lastQuery().params).toContain("49");
    expect(second.items.map(item => item.id)).toEqual(["50"]);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects malformed, altered, cross-viewer, cross-resource, expired and cross-query cursors before SQL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T09:00:00Z"));
    execute.mockResolvedValue({ rows: Array.from({ length: 8 }, (_, index) => row(index + 1)) });
    const first = await findCreations(input, actor, options);
    execute.mockClear();
    const cursor = first.nextCursor!;
    const changed = (cursor[0] === "A" ? "B" : "A") + cursor.slice(1);
    await expect(findCreations({ ...input, cursor: changed }, actor, options)).rejects.toBeInstanceOf(CatalogueCursorError);
    await expect(findCreations({ ...input, cursor: "wrong" }, actor, options)).rejects.toBeInstanceOf(CatalogueCursorError);
    await expect(findCreations({ ...input, cursor }, { ...actor, id: "viewer-beta" }, options)).rejects.toBeInstanceOf(CatalogueCursorError);
    await expect(findCreations({ ...input, cursor }, actor, { ...options, resource: "https://second.example/api/mcp" })).rejects.toBeInstanceOf(CatalogueCursorError);
    await expect(findCreations({ ...input, cursor, maxBu: 6 }, actor, options)).rejects.toBeInstanceOf(CatalogueCursorError);
    vi.setSystemTime(new Date("2026-11-25T09:10:00Z"));
    await expect(findCreations({ ...input, cursor }, actor, options)).rejects.toBeInstanceOf(CatalogueCursorError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns a root summary without unverified nested mechanics, costs or version pins", async () => {
    execute.mockResolvedValue({ rows: [row(1, {
      publicationType: "LINEAGE_TEMPLATE", buCost: null, rank: 2, description: "Unproven nested text",
      versionSnapshot: { nestedContent: "Private component" },
    })] });
    const result = await findCreations({ kind: "heritage", query: "" }, actor, options);
    expect(lastQuery().sql).toContain('"heritage"."kind"::text');
    expect(lastQuery().sql).not.toContain("primitive_versions");
    expect(result.items[0]).toEqual({
      name: "Safe Landing", kind: "heritage", id: "1", source: "https://mcp.example/library/item/LINEAGE_TEMPLATE:1",
      matchReason: "Visible catalogue entry", versionStatus: "UNAVAILABLE",
    });
    expect(JSON.stringify(result)).not.toContain("Private component");
  });
});
