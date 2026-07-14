/**
 * Audit script: compare seed-bu-market.ts name list against DB rows.
 * Run: pnpm exec tsx scripts/_seed-vs-db.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readFileSync } from "fs";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  // Parse name list from seed file
  const seedFile = readFileSync("scripts/seed-bu-market.ts", "utf8");
  const nameRegex = /name: "([^"]+)"/g;
  const seedNames: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = nameRegex.exec(seedFile)) !== null) {
    const match = m[1];
    if (match && !seen.has(match)) {
      seedNames.push(match);
      seen.add(match);
    }
  }

  const dbRows = await sql`
    SELECT name, category::text as category
    FROM primitives WHERE user_id IS NULL
  `;
  const dbList = dbRows.map((r) => ({
    name: String(r["name"]),
    category: String(r["category"]),
  }));
  const dbNames = new Set(dbList.map((r) => r.name));
  const seedSet = new Set(seedNames);

  const onlyInDb = dbList
    .filter((r) => !seedSet.has(r.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const onlyInSeed = seedNames.filter((n) => !dbNames.has(n)).sort();

  console.log("=".repeat(70));
  console.log("Seed (scripts/seed-bu-market.ts) ↔ DB canonical comparison");
  console.log("=".repeat(70));
  console.log(`Seed rows: ${seedNames.length}`);
  console.log(`DB rows:   ${dbList.length}`);
  console.log(`In both:   ${seedNames.length - onlyInSeed.length}`);
  console.log("");

  if (onlyInDb.length) {
    console.log(`In DB but NOT in seed (${onlyInDb.length}):`);
    for (const r of onlyInDb) {
      console.log(`  [${r.category.padEnd(28)}] ${r.name}`);
    }
    console.log("");
  }

  if (onlyInSeed.length) {
    console.log(`In seed but NOT in DB (${onlyInSeed.length}):`);
    for (const n of onlyInSeed) console.log(`  ${n}`);
    console.log("");
  }

  if (!onlyInDb.length && !onlyInSeed.length) {
    console.log("✓ Aligned.");
  }
  console.log("=".repeat(70));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
