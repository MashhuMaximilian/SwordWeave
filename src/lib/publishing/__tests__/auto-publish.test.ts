// =============================================================================
// auto-publish integration test (round 8)
//
// Verifies the fix for: "saves it as private regardless of what visibility
// I chose". The library visibility filter is publications-table-driven, but
// the entity save API only wrote the isPublic boolean. This test ensures
// autoPublishOnCreate inserts a publications row when isPublic=true.
//
// We mock the DB with an in-memory implementation since the unit
// boundary is the helper itself, not Drizzle.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted module mocks so the helper's imports resolve before the test runs.
// vitest hoists vi.mock above imports, so we use vi.hoisted for the mock
// object that the factory closures reference.
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    query: { publications: { findFirst: vi.fn() } },
  },
}));

vi.mock("@/db/client", () => ({ db: mockDb }));
vi.mock("@/db/schema/engagement", () => ({
  publications: {
    id: "id",
    targetType: "target_type",
    targetId: "target_id",
    versionId: "version_id",
    versionNumber: "version_number",
    authorId: "author_id",
    visibility: "visibility",
    unpublishedAt: "unpublished_at",
  },
  publishTargetTypeEnum: {
    enumValues: [
      "PRIMITIVE",
      "EFFECT",
      "CAPABILITY",
      "ITEM",
      "LINEAGE_TEMPLATE",
      "UPBRINGING_TEMPLATE",
      "MANIFEST_TEMPLATE",
      "BUILD_TEMPLATE",
    ],
  },
}));
vi.mock("@/lib/engagement/version-helpers", () => ({
  resolveVirtualVersionId: (_t: string, id: string) => {
    // Strip non-hex chars and pad to 32 chars for a valid UUID format.
    const hex = id.replace(/[^0-9a-f]/gi, "").padStart(32, "0").slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  },
  isUuid: (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
}));

import { autoPublishOnCreate } from "@/lib/publishing/auto-publish";

function resetMocks() {
  mockDb.select.mockReset();
  mockDb.insert.mockReset();
  mockDb.update.mockReset();
  mockDb.query.publications.findFirst.mockReset();
}

describe("autoPublishOnCreate", () => {
  beforeEach(resetMocks);

  it("inserts a publications row when isPublic=true and none exists", async () => {
    // First call: existing row check returns empty.
    mockDb.select.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    // Second call: insert returns a new row id.
    mockDb.insert.mockReturnValueOnce({
      values: () => ({
        returning: () =>
          Promise.resolve([{ id: "pub-123" }]),
      }),
    });

    const result = await autoPublishOnCreate({
      targetType: "PRIMITIVE",
      targetId: "42",
      authorId: "user-uuid",
      isPublic: true,
    });

    expect(result.publicationId).toBe("pub-123");
    expect(result.created).toBe(true);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when isPublic=false (private save)", async () => {
    const result = await autoPublishOnCreate({
      targetType: "PRIMITIVE",
      targetId: "42",
      authorId: "user-uuid",
      isPublic: false,
    });

    expect(result.publicationId).toBeNull();
    expect(result.created).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("updates existing publication instead of duplicating", async () => {
    // existing row check returns one row
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([{ id: "existing-pub-id" }]),
        }),
      }),
    });
    // update returns void
    mockDb.update.mockReturnValueOnce({
      set: () => ({ where: () => Promise.resolve() }),
    });

    const result = await autoPublishOnCreate({
      targetType: "EFFECT",
      targetId: "eff99",
      authorId: "user-uuid",
      isPublic: true,
    });

    expect(result).toEqual({ publicationId: "existing-pub-id", created: false });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("uses correct targetType for heritage templates", async () => {
    mockDb.select.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    let capturedValues: Record<string, unknown> | undefined;
    mockDb.insert.mockImplementationOnce(() => ({
      values: (v: Record<string, unknown>) => {
        capturedValues = v;
        return { returning: () => Promise.resolve([{ id: "pub-456" }]) };
      },
    }));

    await autoPublishOnCreate({
      targetType: "LINEAGE_TEMPLATE",
      targetId: "tpl-1",
      authorId: "user-uuid",
      isPublic: true,
    });

    expect(capturedValues?.["targetType"]).toBe("LINEAGE_TEMPLATE");
    expect(capturedValues?.["visibility"]).toBe("PUBLIC");
    expect(capturedValues?.["authorId"]).toBe("user-uuid");
  });
});
