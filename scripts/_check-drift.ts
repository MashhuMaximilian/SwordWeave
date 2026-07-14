/**
 * Drift check — compare BU Market seed (data/bu-market-primitives.ts) against
 * current DB state. We want to know BEFORE running migrate-bu-market whether
 * the migration would overwrite correct DB values with stale seed values.
 *
 * Run: pnpm exec tsx scripts/_check-drift.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

import { BU_MARKET_PRIMITIVES } from "../data/bu-market-primitives";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  // Neon returns rows as Record<string, any>[]
  const dbRows = await sql`
    SELECT name, category::text as category, bu_cost
    FROM primitives WHERE user_id IS NULL
  `;

  const seedMap = new Map<string, number>();
  for (const p of BU_MARKET_PRIMITIVES) {
    seedMap.set(`${p.name}|${p.category}`, p.buCost);
  }

  let driftCost = 0;
  const driftExamples: string[] = [];

  for (const row of dbRows) {
    const seedCost = seedMap.get(`${row["name"]}|${row["category"]}`);
    if (seedCost !== undefined && seedCost !== row["bu_cost"]) {
      driftCost++;
      if (driftExamples.length < 15) {
        driftExamples.push(
          `  ${row["name"]} (${row["category"]}): DB=${row["bu_cost"]} seed=${seedCost}`
        );
      }
    }
  }

  const onlyInDb = dbRows.filter(
    (r) => !seedMap.has(`${r["name"]}|${r["category"]}`)
  ).length;

  const dbNames = new Set(
    dbRows.map((r) => `${r["name"]}|${r["category"]}`)
  );
  const onlyInSeed = BU_MARKET_PRIMITIVES.filter(
    (p) => !dbNames.has(`${p.name}|${p.category}`)
  ).length;

  console.log("=".repeat(70));
  console.log("BU Market Drift Report");
  console.log("=".repeat(70));
  console.log(`Rows in DB (user_id IS NULL):       ${dbRows.length}`);
  console.log(`Rows in seed (bu-market-primitives): ${BU_MARKET_PRIMITIVES.length}`);
  console.log(`Only in DB (would not be touched):    ${onlyInDb}`);
  console.log(`Only in seed (would INSERT):         ${onlyInSeed}`);
  console.log(`Cost-drifted (DB != seed):           ${driftCost}`);
  if (driftExamples.length) {
    console.log("");
    console.log("First drift examples:");
    driftExamples.forEach((d) => console.log(d));
  }
  console.log("=".repeat(70));

  // Also: count existing target_scope fill status
  const scopeRows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE target_scope IS NOT NULL) as has_scope,
      COUNT(*) FILTER (WHERE target_scope IS NULL) as no_scope
    FROM primitives WHERE user_id IS NULL
  `;
  const r = scopeRows[0];
  if (r) {
    console.log("");
    console.log("Current target_scope fill (before migration):");
    console.log(`  With scope:    ${r["has_scope"]}`);
    console.log(`  Without scope: ${r["no_scope"]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
