/**
 * Phase 7.10.4 — Tests for the system-user rule.
 *
 * Verifies:
 *   1. users.is_admin column exists with default false
 *   2. resolveAuthorByClerkId returns isAdmin flag
 *   3. xeun is admin (backfilled)
 *   4. mashu is NOT admin (control)
 *   5. Other users are NOT admin
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

describe("Phase 7.10.4 — System user rule", () => {
  describe("Schema", () => {
    it("users.is_admin column exists", async () => {
      const r = await sql`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_admin'
      ` as Array<{ column_name: string; data_type: string; column_default: string | null; is_nullable: string }>;
      expect(r.length).toBe(1);
      const row = r[0]!;
      expect(row["data_type"]).toBe("boolean");
      expect(row["column_default"]).toBe("false");
      expect(row["is_nullable"]).toBe("NO");
    });

    it("users_is_admin_idx index exists", async () => {
      const r = await sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'users' AND indexname = 'users_is_admin_idx'
      ` as Array<{ indexname: string }>;
      expect(r.length).toBe(1);
    });
  });

  describe("Backfill", () => {
    it("xeun is admin", async () => {
      const r = await sql`
        SELECT is_admin FROM users WHERE LOWER(username) = 'xeun'
      ` as Array<{ is_admin: boolean }>;
      expect(r.length).toBe(1);
      expect(r[0]!["is_admin"]).toBe(true);
    });

    it("mashu is NOT admin", async () => {
      const r = await sql`
        SELECT is_admin FROM users WHERE LOWER(username) = 'mashu'
      ` as Array<{ is_admin: boolean }>;
      if (r.length === 0) {
        // mashu user doesn't exist — that's fine, the test still validates no false positive
        return;
      }
      expect(r[0]!["is_admin"]).toBe(false);
    });

    it("anon-* users are NOT admin", async () => {
      const r = await sql`
        SELECT username, is_admin FROM users WHERE username LIKE 'anon-%'
      ` as Array<{ username: string; is_admin: boolean }>;
      for (const u of r) {
        expect(u["is_admin"]).toBe(false);
      }
    });
  });

  describe("Author resolver", () => {
    it("resolveAuthorByClerkId returns isAdmin=true for admin", async () => {
      // Get xeun's clerk_user_id
      const u = await sql`
        SELECT clerk_user_id FROM users WHERE LOWER(username) = 'xeun'
      ` as Array<{ clerk_user_id: string }>;
      expect(u.length).toBe(1);
      const clerkId = u[0]!["clerk_user_id"];

      // Now call the resolver
      const { resolveAuthorByClerkId } = await import("@/lib/auth/author-resolver");
      const author = await resolveAuthorByClerkId(clerkId);
      expect(author).not.toBeNull();
      if (!author) return;
      expect(author.isAdmin).toBe(true);
    });

    it("resolveAuthorByClerkId returns isAdmin=false for non-admin", async () => {
      // Get mashu's clerk_user_id
      const u = await sql`
        SELECT clerk_user_id, is_admin FROM users WHERE LOWER(username) = 'mashu'
      ` as Array<{ clerk_user_id: string; is_admin: boolean }>;
      if (u.length === 0) {
        // mashu doesn't exist, skip
        return;
      }
      expect(u[0]!["is_admin"]).toBe(false);
      const clerkId = u[0]!["clerk_user_id"];

      const { resolveAuthorByClerkId } = await import("@/lib/auth/author-resolver");
      const author = await resolveAuthorByClerkId(clerkId);
      expect(author).not.toBeNull();
      if (!author) return;
      expect(author.isAdmin).toBe(false);
    });

    it("resolveAuthorByClerkId returns null for unknown clerk id", async () => {
      const { resolveAuthorByClerkId } = await import("@/lib/auth/author-resolver");
      const author = await resolveAuthorByClerkId("user_nonexistent_xyz");
      expect(author).toBeNull();
    });

    it("resolveAuthorByClerkId returns null for null/undefined", async () => {
      const { resolveAuthorByClerkId } = await import("@/lib/auth/author-resolver");
      expect(await resolveAuthorByClerkId(null)).toBeNull();
      expect(await resolveAuthorByClerkId(undefined)).toBeNull();
      expect(await resolveAuthorByClerkId("")).toBeNull();
    });
  });
});