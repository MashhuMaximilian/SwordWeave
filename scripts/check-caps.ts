import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neodatabase/serverless";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Check primitives for the 3 test capabilities
  const caps = await pool.query(`
    SELECT c.id, c.name, c.type, c.source_type, c.verbose_description,
      json_agg(
        json_build_object(
          'effect_id', ce.effect_id,
          'effect', e
        )
      ) as effects
    FROM capabilities c
    LEFT JOIN capability_effects ce ON ce.capability_id = c.id
    LEFT JOIN effects e ON e.id = ce.effect_id
    WHERE c.name IN ('Divine Smite', 'Hunter''s Mark', 'Stone''s Endurance')
    GROUP BY c.id
  `);

  for (const row of caps.rows) {
    console.log(`\nCapability: ${row.name} (type: ${row.type}, source: ${row.source_type})`);
    console.log(`  Description: ${row.verbose_description}`);

    // Get effect primitives
    if (row.effects && row.effects[0].effect_id) {
      for (const eff of row.effects) {
        const eps = await pool.query(`
          SELECT p.id, p.name, p.narrative_rule
          FROM effect_primitives ep
          JOIN primitives p ON p.id = ep.primitive_id
          WHERE ep.effect_id = $1
        `, [eff.effect_id]);
        for (const ep of eps.rows) {
          console.log(`  Effect ${eff.effect_id} -> Primitive: ${ep.name} (id: ${ep.id})`);
        }
      }
    } else {
      console.log(`  No effects`);
    }
  }

  // Check character_primitives for capability origin
  const primLinks = await pool.query(`
    SELECT cp.primitive_id, cp.origin_capability_id, cp.origin_effect_id, cp.origin_heritage_id,
      p.name as primitive_name, p.hard_modifiers
    FROM character_primitives cp
    JOIN primitives p ON p.id = cp.primitive_id
    WHERE cp.character_id = '462f9048-b0da-4185-98db-d18027132c82'
  `);
  console.log("\n=== Character Primitive Links ===");
  for (const row of primLinks.rows) {
    console.log(`  ${row.primitive_name} (id: ${row.primitive_id}): cap=${row.origin_capability_id}, effect=${row.origin_effect_id}, heritage=${row.origin_heritage_id}`);
  }

  await pool.end();
}

main().catch(console.error);
