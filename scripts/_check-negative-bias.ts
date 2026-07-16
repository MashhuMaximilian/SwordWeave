/**
 * Quick check: Negative Bias rows — same or different?
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  const rows = await sql`
    SELECT id, name, category, cost_tier, bu_cost, is_mirrorable,
      mechanical_output_text, hard_modifiers, target_scope
    FROM primitives
    WHERE user_id IS NULL AND name LIKE 'Negative Bias%'
    ORDER BY id
  `;
  for (const r of rows) {
    console.log("ID:", r["id"], "|", r["name"]);
    console.log("  Tier:", r["cost_tier"], "| BU:", r["bu_cost"]);
    console.log("  Output:", String(r["mechanical_output_text"]).slice(0, 300));
    console.log("  Mirror:", r["is_mirrorable"]);
    console.log(
      "  Target scope:",
      r["target_scope"] ? JSON.stringify(r["target_scope"]) : "(none)",
    );
    console.log("  Modifiers:", JSON.stringify(r["hard_modifiers"]));
    console.log("---");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
