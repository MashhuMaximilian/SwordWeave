// Tests for the shared admin auth helper.
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("admin auth", () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env["CRON_SECRET"];
    delete process.env["ADMIN_API_SECRET"];
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  // Lazy import so module-level env reads happen after beforeEach.
  // (The helper reads env at call-time, not at module-load time, so this
  // would work either way, but lazy import makes the test resilient if
  // that changes.)
  async function load() {
    return await import("../admin-auth");
  }

  function mockReq(opts: {
    authHeader?: string | null;
    adminHeader?: string | null;
  }) {
    const headers = new Map<string, string>();
    if (opts.authHeader != null) headers.set("authorization", opts.authHeader);
    if (opts.adminHeader != null) headers.set("x-admin-secret", opts.adminHeader);
    return {
      headers: {
        get: (k: string) => headers.get(k.toLowerCase()) ?? null,
      },
    } as unknown as import("next/server").NextRequest;
  }

  it("rejects when no secrets are set", async () => {
    const { checkAdminAuth } = await load();
    const r = checkAdminAuth(mockReq({ authHeader: "Bearer anything" }));
    expect(r.isAdmin).toBe(false);
  });

  it("rejects when ADMIN_API_SECRET mismatches", async () => {
    process.env["ADMIN_API_SECRET"] = "right";
    const { checkAdminAuth } = await load();
    const r = checkAdminAuth(mockReq({ adminHeader: "wrong" }));
    expect(r.isAdmin).toBe(false);
  });

  it("accepts when ADMIN_API_SECRET matches", async () => {
    process.env["ADMIN_API_SECRET"] = "right";
    const { checkAdminAuth } = await load();
    const r = checkAdminAuth(mockReq({ adminHeader: "right" }));
    expect(r.isAdmin).toBe(true);
  });

  it("accepts when CRON_SECRET matches via Bearer", async () => {
    process.env["CRON_SECRET"] = "cron123";
    const { checkAdminAuth } = await load();
    const r = checkAdminAuth(mockReq({ authHeader: "Bearer cron123" }));
    expect(r.isAdmin).toBe(true);
  });

  it("rejects when CRON_SECRET is wrong", async () => {
    process.env["CRON_SECRET"] = "cron123";
    const { checkAdminAuth } = await load();
    const r = checkAdminAuth(mockReq({ authHeader: "Bearer wrong" }));
    expect(r.isAdmin).toBe(false);
  });

  it("rejects when CRON_SECRET is set but no auth header", async () => {
    process.env["CRON_SECRET"] = "cron123";
    const { checkAdminAuth } = await load();
    const r = checkAdminAuth(mockReq({}));
    expect(r.isAdmin).toBe(false);
  });

  it("accepts either CRON_SECRET or ADMIN_API_SECRET", async () => {
    process.env["CRON_SECRET"] = "cron123";
    process.env["ADMIN_API_SECRET"] = "admin123";
    const { checkAdminAuth } = await load();
    const r1 = checkAdminAuth(mockReq({ authHeader: "Bearer cron123" }));
    const r2 = checkAdminAuth(mockReq({ adminHeader: "admin123" }));
    expect(r1.isAdmin).toBe(true);
    expect(r2.isAdmin).toBe(true);
  });
});
