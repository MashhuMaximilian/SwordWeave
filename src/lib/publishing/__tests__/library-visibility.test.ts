import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
const captured = vi.hoisted(() => ({ conditions: [] as unknown[], limits: [] as number[] }));
vi.mock("@/db/client", () => ({ db: { select: () => {
  const chain = { from: () => chain, leftJoin: () => chain, where: (condition: unknown) => { captured.conditions.push(condition); return chain; }, limit: async (count: number) => { captured.limits.push(count); return []; }, then: Promise.resolve([]).then.bind(Promise.resolve([])) };
  return chain;
} } }));
vi.mock("@/lib/engagement/engagement-aggregates", () => ({ resolveEngagementMap: async () => new Map() }));
import { queryCompleteLibrary, queryLibrary, visibilityCondition } from "../library-query";
const dialect = new PgDialect();
describe("Library and Add share the canonical visibility gate", () => {
  it("never truncates the authorized corpus before filters and ordering", async () => {
    captured.limits = [];
    await queryCompleteLibrary({ targetType: "PRIMITIVE", viewerClerkId: "viewer" });
    expect(captured.limits).toEqual([]);
    await queryLibrary({ targetType: "PRIMITIVE", viewerClerkId: "viewer" });
    expect(captured.limits).toEqual([]);
  });
  it("uses publication precedence and explicit legacy-public compatibility", async () => {
    captured.conditions = [];
    await queryCompleteLibrary({ targetType: "PRIMITIVE", viewerClerkId: "viewer" });
    const where = dialect.sqlToQuery(captured.conditions[0] as SQL);
    expect(where.sql).toContain("FROM publications");
    expect(where.sql).toContain("visibility = 'PUBLIC'");
    expect(where.sql).toContain("unpublished_at IS NULL");
    expect(where.sql).toContain('"is_public"');
    expect(where.sql).toContain("NOT EXISTS");
    expect(where.params).toContain("viewer");
  });
  it("keeps owned drafts and followers available while publications override legacy flags", () => {
    const gate = dialect.sqlToQuery(visibilityCondition("PRIMITIVE", sql`123`, sql`'owner'`, "owner"));
    expect(gate.params).toContain("owner");
    expect(gate.sql).toContain("FOLLOWERS_ONLY");
    expect(gate.sql).toContain("FROM follows");
    expect(gate.sql).toContain("legacy_entity.is_public = true");
    expect(gate.sql).toContain("NOT EXISTS");
    expect(gate.sql).not.toContain("user_id IS NULL");
  });
});
