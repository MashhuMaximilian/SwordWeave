import { asc } from "drizzle-orm";
import { PrimitiveRegistry } from "@/components/workshops/primitive-registry";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

// NOTE (2026-07-03): Per the new design, sandbox = create + edit, library = browse.
// The list view currently lives in the sandbox sidebar. Moving it to /library is
// scheduled for Tier 3 (Library + Workflow) in SWORDWEAVE-ROADMAP.md.
export default async function PrimitiveSandboxPage() {
  const rows = await db.query.primitives.findMany({
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  return <PrimitiveRegistry initialPrimitives={rows} />;
}