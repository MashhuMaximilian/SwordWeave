import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neondatabase/serverless";

const MASHU_USER_ID = "user_3GBKnmCEvgYSjfeFqmAQrzO7cyP";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const charResult = await pool.query(
    `SELECT id FROM characters WHERE user_id = $1 AND name = $2 ORDER BY created_at DESC LIMIT 1`,
    [MASHU_USER_ID, "i2 Test Character"],
  );

  if (charResult.rowCount === 0) {
    console.log("No character found.");
    return;
  }

  const charId = charResult.rows[0].id;

  // Delete ALL test primitive links for this character
  await pool.query(
    `DELETE FROM character_primitives
     WHERE character_id = $1::uuid
       AND primitive_id IN (
         SELECT id FROM primitives
         WHERE name IN ('Smite Damage', 'Mark of the Hunt', 'Stone Skin')
       )`,
    [charId],
  );

  console.log("Deleted all test primitive links");

  // Re-attach each primitive exactly once
  const names = ['Smite Damage', 'Mark of the Hunt', 'Stone Skin'];
  for (const name of names) {
    await pool.query(
      `INSERT INTO character_primitives (character_id, primitive_id, is_mirrored, acquired_at_level)
       SELECT $1::uuid, id, false, 18 FROM primitives WHERE name = $2`,
      [charId, name],
    );
    console.log(`  ✓ Attached: ${name}`);
  }

  // Verify
  const check = await pool.query(
    `SELECT p.name, COUNT(*) as cnt
     FROM character_primitives cp
     JOIN primitives p ON p.id = cp.primitive_id
     WHERE cp.character_id = $1::uuid
       AND p.name = ANY($2)
     GROUP BY p.name ORDER BY p.name`,
    [charId, names],
  );

  console.log("\nFinal attachments:");
  check.rows.forEach((r: any) => console.log(`  ${r.name}: ${r.cnt} link(s)`));

  await pool.end();
}

main().catch(console.error);
