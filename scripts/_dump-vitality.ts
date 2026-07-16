import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  const rows = (await sql`
    SELECT id, name, LEFT(narrative_rule, 250) as narrative, LEFT(mechanical_output_text, 250) as mech
    FROM primitives WHERE id IN (853, 854, 855) ORDER BY id
  `) as Array<{ id: number; name: string; narrative: string; mech: string }>;
  for (const r of rows) {
    console.log(`[${r.id}] ${r.name}`);
    console.log(`  NARRATIVE: ${r.narrative}`);
    console.log(`  MECH: ${r.mech}`);
  }
}
main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
