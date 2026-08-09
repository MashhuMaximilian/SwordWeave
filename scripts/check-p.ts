import { Pool } from "@neodatabase/serverless";
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const r = await pool.query(`
    SELECT p.name, cp.primitive_id, cp.character_id
    FROM primitives p
    LEFT JOIN character_primitives cp ON cp.primitive_id = p.id
    WHERE p.id = 11556
  `);
  console.log("Primitive 11556:", r.rows);
  
  const ep = await pool.query(`SELECT COUNT(*) as cnt FROM effect_primitives WHERE primitive_id = 11556`);
  console.log("effect_primitives:", ep.rows[0].cnt);
  
  const cp2 = await pool.query(`SELECT COUNT(*) as cnt FROM capability_primitives WHERE primitive_id = 11556`);
  console.log("capability_primitives:", cp2.rows[0].cnt);
  
  await pool.end();
}
main().catch(console.error);
