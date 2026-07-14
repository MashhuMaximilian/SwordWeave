import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const s = neon(process.env["DATABASE_URL"]!);

async function main() {
  const c = await s`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'primitives'::regclass
      AND contype IN ('u','p','x')
    ORDER BY conname
  `;
  console.log("Constraints on primitives:");
  for (const row of c) {
    console.log(`  ${row["conname"]}: ${row["def"]}`);
  }

  const idx = await s`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'primitives'
    ORDER BY indexname
  `;
  console.log("\nIndexes on primitives:");
  for (const row of idx) {
    console.log(`  ${row["indexname"]}: ${row["indexdef"]}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
