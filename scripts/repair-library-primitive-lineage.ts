/**
 * Repair legacy primitive forks whose source row was overwritten in place.
 *
 * The old fork flow could turn a canonical row into its own fork, producing
 * source_origin values such as `fork:24` on primitive 24. The canonical seed
 * now restores the missing system rows under fresh IDs; this script points the
 * affected expressions at those restored roots. It is safe to run repeatedly.
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  cost_tier: string;
  source_origin: string | null;
};

function tierNumber(value: string): number | null {
  const match = value.match(/tier\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function main() {
  const { db } = await import("../src/db/client");
  const result = await db.execute<PrimitiveRow>(sql`
    SELECT id, name, category::text, cost_tier, source_origin
    FROM primitives
    WHERE category IN ('DOMAIN', 'VERB_TIER')
    ORDER BY id
  `);
  const rows = (result as unknown as { rows: PrimitiveRow[] }).rows ?? result;

  const roots = new Map<string, number>();
  for (const row of rows) {
    if (row.source_origin !== "system") continue;
    const tier = tierNumber(row.cost_tier);
    if (tier) roots.set(`${row.category}:${tier}`, row.id);
  }

  const explicitRootByName: Record<string, string> = {
    "Domain of Storm (fork)": "DOMAIN:2",
    "Domain Access Tier III (fork)": "DOMAIN:3",
    "Domain Access Tier III (fork) 2": "DOMAIN:3",
  };

  let repaired = 0;
  for (const row of rows) {
    const isSelfFork = row.source_origin === `fork:${row.id}` ||
      row.source_origin === `fork:PRIMITIVE:${row.id}`;
    const rootKey = explicitRootByName[row.name] ??
      (isSelfFork && tierNumber(row.cost_tier)
        ? `${row.category}:${tierNumber(row.cost_tier)}`
        : null);
    if (!rootKey) continue;
    const rootId = roots.get(rootKey);
    if (!rootId || rootId === row.id) continue;
    const sourceOrigin = `fork:PRIMITIVE:${rootId}`;
    if (row.source_origin === sourceOrigin) continue;
    await db.execute(sql`
      UPDATE primitives
      SET source_origin = ${sourceOrigin}, updated_at = NOW()
      WHERE id = ${row.id}
    `);
    console.log(`${row.name}: ${row.source_origin ?? "null"} -> ${sourceOrigin}`);
    repaired += 1;
  }

  console.log(`Repaired ${repaired} primitive lineage record(s).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
