/**
 * Check source_origin breakdown for capabilities, effects, items, templates.
 * Run: pnpm exec tsx scripts/_check-source-caps.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function dump(table: string, label: string) {
  const rows = await sql`
    SELECT source_origin, COUNT(*) as n
    FROM ${sql.unsafe(label)}
    WHERE user_id IS NULL
    GROUP BY source_origin
    ORDER BY n DESC
  `;
  console.log(`\n${table} (user_id IS NULL):`);
  if (rows.length === 0) {
    console.log("  (empty)");
    return;
  }
  for (const r of rows) {
    console.log(`  ${String(r["source_origin"] ?? "(NULL)").padEnd(50)} ${r["n"]}`);
  }
}

async function main() {
  await dump("capabilities", "capabilities");
  await dump("effects", "effects");
  await dump("items", "items");
  await dump("templates", "templates");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
