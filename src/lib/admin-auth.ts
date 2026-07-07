// =============================================================================
// Shared admin auth helper for /api/admin/* endpoints.
//
// Two methods:
// 1. CRON_SECRET via Authorization: Bearer <secret> header
//    (used by Vercel cron invocations)
// 2. ADMIN_API_SECRET via X-Admin-Secret header
//    (used by manual invocation from the operator)
//
// Both must be configured as env vars. We don't gate on Clerk roles yet —
// admin tooling is intentionally minimal until Phase 6 (admin UI) lands.
// =============================================================================
import { type NextRequest } from "next/server";

export interface AdminAuthResult {
  isAdmin: boolean;
  reason: string;
}

export function verifyCronSecret(req: NextRequest): boolean {
  const expected = process.env["CRON_SECRET"];
  if (!expected) return false;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return provided === expected;
}

export function checkAdminAuth(req: NextRequest): AdminAuthResult {
  if (verifyCronSecret(req)) return { isAdmin: true, reason: "" };
  const adminSecret = process.env["ADMIN_API_SECRET"];
  const provided = req.headers.get("x-admin-secret");
  if (adminSecret && provided === adminSecret) {
    return { isAdmin: true, reason: "" };
  }
  return { isAdmin: false, reason: "missing or invalid admin credentials" };
}
