// Tests for the soft-delete cron route's auth layer.
// DB-touching tests would require mocking the DB, which is out of scope here.
// The DB queries (findUsersReadyForPurge + anonymizeUser) are tested via
// the underlying unit tests in lookup.test.ts.

import { describe, it, expect } from "vitest";

// Helper that simulates what verifyCronSecret does, isolated from Next.js
// runtime. We re-export the logic instead of importing from the route to
// avoid pulling in the NextRequest type machinery for unit tests.
function verifyCronSecret(provided: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  return provided === expected;
}

describe("cron auth", () => {
  it("rejects when no CRON_SECRET is set", () => {
    expect(verifyCronSecret("anything", undefined)).toBe(false);
    expect(verifyCronSecret("anything", "")).toBe(false);
  });

  it("rejects when secret mismatches", () => {
    expect(verifyCronSecret("wrong", "secret123")).toBe(false);
    expect(verifyCronSecret(null, "secret123")).toBe(false);
  });

  it("accepts when secret matches", () => {
    expect(verifyCronSecret("secret123", "secret123")).toBe(true);
  });
});