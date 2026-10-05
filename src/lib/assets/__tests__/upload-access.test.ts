import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { execute: mocks.execute } }));
import { canReadUploadedArtwork } from "../upload-access";
const dialect = new PgDialect();
const query = () => dialect.sqlToQuery(mocks.execute.mock.calls[0]![0]);
beforeEach(() => { vi.clearAllMocks(); mocks.execute.mockResolvedValue({ rows: [] }); });
describe("uploaded artwork visibility", () => {
  it("allows the upload owner to preview drafts without requiring a public entry", async () => {
    expect(await canReadUploadedArtwork("user-uploads/owner/icon.png", "owner")).toBe(true);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not mistake an owner name prefix for upload ownership", async () => {
    expect(await canReadUploadedArtwork("user-uploads/owner-other/icon.png", "owner")).toBe(false);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it("requires a currently public reference for anonymous access and keeps legacy privacy overrides", async () => {
    expect(await canReadUploadedArtwork("user-uploads/author/icon.png", null)).toBe(false);
    const compiled = query();
    expect(compiled.sql).toContain("visibility = 'PUBLIC'"); expect(compiled.sql).toContain("unpublished_at IS NULL");
    expect(compiled.sql).toContain("NOT EXISTS"); expect(compiled.sql).toContain("e.is_public");
    expect(compiled.sql).not.toContain("character_shares"); expect(compiled.sql).not.toContain("JOIN follows");
    expect(compiled.params).toContain("user-uploads/author/icon.png"); expect(compiled.params).toContain("/api/icons/blob/user-uploads/author/icon.png");
    expect(compiled.sql).toContain('"heritage_versions"'); expect(compiled.sql).toContain('v."template_id"=e.id');
    expect(compiled.sql).toContain("v.snapshot"); expect(compiled.params).toContain("iconProposedUrl");
  });
  it("includes current direct character shares and actual author follower checks for signed-in viewers", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ allowed: 1 }] });
    expect(await canReadUploadedArtwork("user-uploads/author/icon.png", "viewer")).toBe(true);
    const compiled = query();
    expect(compiled.sql).toContain("cs.revoked_at IS NULL"); expect(compiled.sql).toContain("character_shares");
    expect(compiled.sql).toContain("f.following_id = author_user.id"); expect(compiled.sql).toContain("f.follower_id = viewer_user.id"); expect(compiled.params).toContain("viewer");
  });
});
