import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const charId = "94e3bdf9-8fa3-480d-b9a2-fbc0240e85aa";

  const existing = await db.execute(
    sql`SELECT id, name FROM characters WHERE id = ${charId}::uuid`
  );

  if (existing.length === 0) {
    console.log(`Character ${charId} not found.`);
    return;
  }

  console.log(`Character: ${existing[0].name}`);

  const testChars = await db.execute(sql`
    SELECT c.id, c.name, cp.primitive_id, p.name as prim_name, cp.origin_kind, cp.origin_capability_id, cp.origin_effect_id
    FROM characters c
    JOIN character_primitives cp ON cp.character_id = c.id
    JOIN primitives p ON p.id = cp.primitive_id
    WHERE c.id = ${charId}::uuid
    ORDER BY cp.id
  `);

  console.log(`\nCurrent character_primitives (${testChars.length} rows):`);
  testChars.forEach((row: any) => {
    console.log(`  ${row.prim_name} (kind=${row.origin_kind}, cap=${row.origin_capability_id})` );
  });
}

main().catch(console.error);
