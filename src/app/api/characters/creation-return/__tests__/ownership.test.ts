import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({ db: { execute: mocks.execute } }));
vi.mock("@/lib/collections/service", () => ({
  collectionTargetTables: {
    PRIMITIVE: "primitives",
    MANIFEST_TEMPLATE: "heritage",
  },
}));
import { GET } from "../route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.execute.mockResolvedValue({ rows: [] });
});
const req = (type: string, id: string) =>
  new NextRequest(
    `https://swordweave.test/api/characters/creation-return?targetType=${type}&targetId=${id}`,
  );
describe("authoring return ownership", () => {
  it("rejects an inaccessible or other-account saved entry", async () => {
    const response = await GET(req("PRIMITIVE", "12"));
    expect(response.status).toBe(404);
    const compiled = new PgDialect().sqlToQuery(
      mocks.execute.mock.calls[0]![0],
    );
    expect(compiled.sql).toContain("e.user_id=");
    expect(compiled.params).toContain("owner");
  });
  it("verifies the actual heritage kind when resuming a specific heritage field", async () => {
    await GET(req("MANIFEST_TEMPLATE", "id"));
    const compiled = new PgDialect().sqlToQuery(
      mocks.execute.mock.calls[0]![0],
    );
    expect(compiled.sql).toContain("e.kind=");
    expect(compiled.params).toContain("MANIFEST");
  });
  it("requires sign-in even when local return-token metadata was copied", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await GET(req("PRIMITIVE", "12"));
    expect(response.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
