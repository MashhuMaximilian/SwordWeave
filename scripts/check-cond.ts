import { Pool } from "@neondatabase/serverless";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Check the actual condition stored for Expertise Fieldcraft
  const r = await pool.query(`
    SELECT p.name, p.hard_modifiers
    FROM character_primitives cp
    JOIN primitives p ON cp.primitive_id = p.id
    WHERE cp.character_id = '462f9048-b0da-4185-98db-d18027132c82'
    AND p.name = 'Expertise Fieldcraft'
  `);
  
  console.log("Expertise Fieldcraft hard_modifiers:");
  console.log(JSON.stringify(r.rows, null, 2));
  
  await pool.end();
}

main().catch(console.error);
