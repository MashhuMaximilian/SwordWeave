// =============================================================================
// POST /api/admin/seed-phase5-effects — Phase 5 Commit C library seed
//
// Idempotent. Re-running is safe — existing rows are reused, primitive_links
// are re-inserted cleanly, and the nesting link is only created once.
//
// For now: gated behind a simple shared-secret header (`x-seed-key`) so we
// don't expose it publicly. Replace with Clerk admin-role gate in Phase 6.
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { runPhase5LibrarySeed } from "@/lib/library/seed-phase5-effects";

export async function POST(req: NextRequest) {
  // Simple guard for now — production env has SEED_KEY set
  const seedKey = process.env["SEED_KEY"];
  const providedKey = req.headers.get("x-seed-key");
  if (seedKey && providedKey !== seedKey) {
    return NextResponse.json(
      { error: "Invalid seed key" },
      { status: 401 },
    );
  }

  try {
    const result = await runPhase5LibrarySeed();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[seed] error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    info: "POST to seed Phase 5 library effects + Abyssal Despair capability. Idempotent.",
  });
}