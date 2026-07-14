import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const s = neon(process.env["DATABASE_URL"]!);

async function main() {
  const total = await s`SELECT COUNT(*)::int AS n FROM primitives WHERE user_id IS NULL`;
  console.log(`Total canonical primitives: ${total[0]?.["n"] ?? 0}`);

  const withScope = await s`
    SELECT category::text AS cat, COUNT(*)::int AS n
    FROM primitives WHERE user_id IS NULL AND target_scope IS NOT NULL
    GROUP BY category ORDER BY category
  `;
  console.log(`\nRows with target_scope (${withScope.reduce((a, r) => a + r["n"], 0)}):`);
  for (const r of withScope) {
    console.log(`  [${r["cat"]}] ${r["n"]}`);
  }

  const scopeBreakdown = await s`
    SELECT target_scope, COUNT(*)::int AS n
    FROM primitives WHERE user_id IS NULL AND target_scope IS NOT NULL
    GROUP BY target_scope ORDER BY target_scope
  `;
  console.log(`\ntarget_scope value breakdown:`);
  for (const r of scopeBreakdown) {
    console.log(`  ${r["target_scope"]}: ${r["n"]}`);
  }

  const srcSample = await s`
    SELECT source_origin, COUNT(*)::int AS n
    FROM primitives WHERE user_id IS NULL
    GROUP BY source_origin ORDER BY source_origin
  `;
  console.log(`\nsource_origin breakdown:`);
  for (const r of srcSample) {
    console.log(`  ${r["source_origin"]}: ${r["n"]}`);
  }

  // Spot-check scope of a few specific rows
  console.log(`\nSpot checks:`);
  const checks = [
    "Positive Bias I — Narrative Focus",
    "Causal Override (Fate Replacement)",
    "Vitality Core Augment III",
    "Kinetic Hardening (DEFENSIVE)",
    "Reaction Reflex",
    "Stride Extension",
  ];
  for (const name of checks) {
    const r = await s`SELECT name, target_scope FROM primitives WHERE name = ${name}`;
    console.log(`  ${name.padEnd(40)} → scope=${r[0]?.["target_scope"] ?? "NULL"}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
