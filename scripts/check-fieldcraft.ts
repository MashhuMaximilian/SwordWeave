import { Pool } from "@neondatabase/serverless";

async function main() {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] as string });

  const r = await pool.query(
    `SELECT name, hard_modifiers FROM primitives WHERE name IN ('Expertise Fieldcraft', 'Proficient Fieldcraft', 'Iron Will')`,
  );
  for (const row of r.rows) {
    console.log(`\n${row.name}:`);
    console.log(JSON.stringify(row.hard_modifiers, null, 2));
  }

  const r2 = await pool.query(
    `SELECT cp.primitive_id, p.name, cp.is_mirrored, p.hard_modifiers
     FROM character_primitives cp
     JOIN primitives p ON p.id = cp.primitive_id
     WHERE cp.character_id = $1 AND (p.name = 'Expertise Fieldcraft' OR p.name = 'Proficient Fieldcraft')`,
    ["94e3bdf9-8fa3-480d-b9a2-fbc0240e85aa"],
  );
  for (const row of r2.rows) {
    console.log(`\nCharacter slot: ${row.name}, is_mirrored: ${row.is_mirrored}`);
    console.log(JSON.stringify(row.hard_modifiers, null, 2));
  }

  await pool.end();
}

main().catch(console.error);
