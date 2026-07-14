/**
 * Dump every primitive in DB with its full scope-relevant fields.
 * Used to understand what canonical DB looks like vs the seed file
 * and the Notion BU Market page.
 *
 * Run: pnpm exec tsx scripts/_dump-canonical.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");

const sql = neon(url);

async function main() {
  // All user_id IS NULL (canonical core library) primitives
  const rows = await sql`
    SELECT
      name,
      category::text as category,
      cost_tier,
      bu_cost,
      target_scope,
      mechanical_output_text,
      narrative_rule,
      is_mirrorable,
      mirror_vector::text as mirror_vector
    FROM primitives
    WHERE user_id IS NULL
    ORDER BY category, name
  `;

  console.log(`Total canonical primitives in DB: ${rows.length}\n`);

  // Group by category
  const byCat = new Map<string, typeof rows>();
  for (const r of rows) {
    const cat = String(r["category"]);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(r);
  }

  for (const [cat, rs] of byCat.entries()) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`${cat} (${rs.length} rows)`);
    console.log("=".repeat(70));
    for (const r of rs) {
      console.log(`\n  • ${r["name"]}`);
      console.log(`    Tier: ${r["cost_tier"]} | BU: ${r["bu_cost"]}`);
      console.log(`    Mirror: ${r["is_mirrorable"] ? "YES" : "no"} (${r["mirror_vector"]})`);
      console.log(`    Target scope: ${r["target_scope"] || "(none)"}`);
      if (r["mechanical_output_text"]) {
        console.log(`    Output: ${String(r["mechanical_output_text"]).slice(0, 80)}${String(r["mechanical_output_text"]).length > 80 ? "..." : ""}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
