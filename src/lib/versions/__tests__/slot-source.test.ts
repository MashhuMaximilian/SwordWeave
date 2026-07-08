/**
 * resolveSlotSource — pure function tests.
 *
 * The function is pure (no DB calls) so it's the easy part of Phase 5 to
 * test. The DB-dependent part (resolveLatestVersionId) is exercised by
 * the migration 0025 backfill and the live UI.
 */

import { describe, it, expect } from "vitest";
import { resolveSlotSource } from "@/lib/versions/slot-source";

describe("resolveSlotSource", () => {
  const CALLER = "user_abc";
  const OTHER = "user_xyz";

  it("system content (userId null) is PINNED", () => {
    expect(
      resolveSlotSource({
        entity: { userId: null, sourceOrigin: null },
        callerUserId: CALLER,
      }),
    ).toBe("PINNED");
  });

  it("system content with sourceOrigin is still PINNED", () => {
    expect(
      resolveSlotSource({
        entity: {
          userId: null,
          sourceOrigin: "system:phase5-commit-c-library-seed",
        },
        callerUserId: CALLER,
      }),
    ).toBe("PINNED");
  });

  it("content owned by another user is PINNED", () => {
    expect(
      resolveSlotSource({
        entity: {
          userId: OTHER,
          sourceOrigin: "user:user_xyz",
        },
        callerUserId: CALLER,
      }),
    ).toBe("PINNED");
  });

  it("content owned by caller with no fork marker is OWNED", () => {
    expect(
      resolveSlotSource({
        entity: {
          userId: CALLER,
          sourceOrigin: "user:user_abc",
        },
        callerUserId: CALLER,
      }),
    ).toBe("OWNED");
  });

  it("content owned by caller with null sourceOrigin is OWNED", () => {
    expect(
      resolveSlotSource({
        entity: { userId: CALLER, sourceOrigin: null },
        callerUserId: CALLER,
      }),
    ).toBe("OWNED");
  });

  it("content owned by caller with fork:<id> marker is FORKED", () => {
    expect(
      resolveSlotSource({
        entity: {
          userId: CALLER,
          sourceOrigin: "fork:42",
        },
        callerUserId: CALLER,
      }),
    ).toBe("FORKED");
  });

  it("content owned by caller with fork:<id>:<rest> marker is FORKED", () => {
    expect(
      resolveSlotSource({
        entity: {
          userId: CALLER,
          sourceOrigin: "fork:42:other",
        },
        callerUserId: CALLER,
      }),
    ).toBe("FORKED");
  });
});
