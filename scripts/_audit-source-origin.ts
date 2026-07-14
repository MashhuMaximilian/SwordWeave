/**
 * source_origin audit: lists source_origin breakdown across all canonical
 * tables so we can plan the simplification ("system:phase5-commit-c-library-seed"
 * → "system" for all rows).
 *
 * Run: pnpm exec tsx scripts/_audit-source-origin.ts
 */
import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const tables = [
      "primitives",
      "capabilities",
      "effects",
      "items",
      "templates",
      "conditions",
    ];
    for (const t of tables) {
      const r = await pool.query(
        `SELECT COALESCE(source_origin, '<NULL>') as src, COUNT(*)::int as n
         FROM ${t}
         GROUP BY 1
         ORDER BY n DESC`,
      );
      console.log(`--- ${t} (${r.rows.length} distinct source_origin values) ---`);
      for (const row of r.rows as Array<{ src: string; n: number }>) {
        console.log(`  ${row.src.padEnd(50)} ${row.n}`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
