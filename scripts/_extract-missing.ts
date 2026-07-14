/**
 * Dump all DB primitives in a TS-SeedRow format ready to paste into
 * scripts/seed-bu-market.ts. Outputs to stdout. We can pipe to a file
 * for review.
 *
 * Run: pnpm exec tsx scripts/_extract-missing.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env["DATABASE_URL"]!);

async function main() {
  const rows = await sql`
    SELECT
      name,
      category::text as category,
      cost_tier,
      bu_cost,
      mechanical_output_text,
      narrative_rule,
      is_mirrorable,
      mirror_bu_credit,
      mirror_eligibility_notes
    FROM primitives
    WHERE user_id IS NULL
    ORDER BY category, name
  `;

  // Group by category
  const byCat = new Map<string, typeof rows>();
  for (const r of rows) {
    const c = String(r["category"]);
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(r);
  }

  for (const [cat, list] of byCat.entries()) {
    console.log(`\n// ============================================================================`);
    console.log(`// ${cat} (${list.length} rows)`);
    console.log(`// ============================================================================`);
    for (const r of list) {
      const m = r["mechanical_output_text"] ? String(r["mechanical_output_text"]) : "";
      const n = r["narrative_rule"] ? String(r["narrative_rule"]) : "";
      const mirror = r["is_mirrorable"]
        ? `, isMirrorable: true, mirrorBuCredit: ${r["mirror_bu_credit"]}, mirrorEligibilityNotes: ${JSON.stringify(String(r["mirror_eligibility_notes"] || ""))}`
        : "";
      console.log(`  { name: ${JSON.stringify(String(r["name"]))}, category: ${JSON.stringify(cat)}, buCost: ${r["bu_cost"]},`);
      console.log(`    costTier: ${JSON.stringify(String(r["cost_tier"]))},`);
      console.log(`    mechanicalOutputText: ${JSON.stringify(m)},`);
      console.log(`    narrativeRule: ${JSON.stringify(n)}${mirror} },`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
