import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ select: vi.fn(), visibility: vi.fn(), auth: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/publishing/visibility", () => ({ checkVisibility: mocks.visibility }));
import { GET } from "../route";
function selectResult(rows: unknown[]) {
  const query = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  query.from.mockReturnValue(query); query.where.mockReturnValue(query); query.orderBy.mockReturnValue(query);
  mocks.select.mockReturnValueOnce(query); return query;
}
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "viewer" }); });
describe("graph version metadata", () => {
  it("rejects invalid identifiers before reading records", async () => {
    const response = await GET(new NextRequest("http://localhost/api/versions/list?targetType=PRIMITIVE&targetId=no"));
    expect(response.status).toBe(400); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("does not query version history when visibility denies access", async () => {
    selectResult([{ userId: "owner", isPublic: false }]); mocks.visibility.mockResolvedValue({ allowed: false });
    const response = await GET(new NextRequest("http://localhost/api/versions/list?targetType=PRIMITIVE&targetId=1"));
    expect(response.status).toBe(404); expect(mocks.select).toHaveBeenCalledTimes(1);
  });
  it("returns twenty headers with the next cursor and no snapshot selection", async () => {
    selectResult([{ userId: "owner", isPublic: true }]); mocks.visibility.mockResolvedValue({ allowed: true });
    const versions = selectResult(Array.from({ length: 21 }, (_, i) => ({ id: String(i), versionNumber: 30-i, publishedAt: new Date(0) })));
    const response = await GET(new NextRequest("http://localhost/api/versions/list?targetType=PRIMITIVE&targetId=1&before=31"));
    const data = await response.json(); expect(data.versions).toHaveLength(20); expect(data.nextBefore).toBe(11);
    expect(versions.limit).toHaveBeenCalledWith(21); expect(Object.keys(mocks.select.mock.calls[1]![0])).toEqual(["id", "versionNumber", "publishedAt"]);
  });
});
