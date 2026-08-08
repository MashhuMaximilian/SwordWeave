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
  console.log(`Character: i2 Test Character (${charId})`);

  // Check schema
  const cols = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_name IN ('capabilities', 'capability_versions', 'character_capabilities')
    ORDER BY table_name, ordinal_position
  `);
  for (const row of cols.rows) {
    console.log(`  ${row.table_name}.${row.column_name} (${row.data_type})`);
  }

  // Delete existing test primitive links + capabilities
  await pool.query(`
    DELETE FROM character_primitives
    WHERE character_id = $1::uuid
      AND primitive_id IN (
        SELECT id FROM primitives
        WHERE name IN ('Smite Damage', 'Mark of the Hunt', 'Stone Skin')
      )
  `, [charId]);
  console.log("\nCleared old test primitive links");

  // Delete old test capabilities
  await pool.query(`
    DELETE FROM character_capabilities WHERE character_id = $1::uuid
  `, [charId]);
  console.log("Cleared old character_capabilities links");

  await pool.query(`
    DELETE FROM capability_versions WHERE capability_id IN (
      SELECT id FROM capabilities WHERE user_id = $1 AND name IN ('Divine Smite', 'Hunter''s Mark', 'Stone''s Endurance')
    )
  `, [MASHU_USER_ID]);
  console.log("Cleared old capability_versions");

  await pool.query(`
    DELETE FROM capabilities WHERE user_id = $1 AND name IN ('Divine Smite', 'Hunter''s Mark', 'Stone''s Endurance')
  `, [MASHU_USER_ID]);
  console.log("Cleared old capabilities");

  // Find the primitive IDs
  const primResult = await pool.query(
    `SELECT id, name FROM primitives WHERE name IN ('Smite Damage', 'Mark of the Hunt', 'Stone Skin')`,
  );
  const prims: Record<string, number> = {};
  for (const row of primResult.rows) {
    prims[row.name] = row.id;
  }
  console.log("\nPrimitive IDs:", prims);

  // Create 3 capabilities
  const caps = [
    {
      name: "Divine Smite",
      type: "ACTIVE",
      sourceType: "MAGICAL",
      desc: "Channel divine energy for extra radiant damage when your health is low.",
      tags: ["combat", "divine"],
      prims: ["Smite Damage"],
    },
    {
      name: "Hunter's Mark",
      type: "ACTIVE",
      sourceType: "PHYSICAL",
      desc: "+2 to hit when you have marked a target. Requires table-side resolution.",
      tags: ["combat", "ranged"],
      prims: ["Mark of the Hunt"],
    },
    {
      name: "Stone's Endurance",
      type: "PASSIVE",
      sourceType: "PHYSICAL",
      desc: "+2 physical defense (always on).",
      tags: ["defense"],
      prims: ["Stone Skin"],
    },
  ];

  for (const cap of caps) {
    // Create capability with minimal columns
    const capResult = await pool.query(`
      INSERT INTO capabilities (user_id, name, type, source_type, verbose_description, tags, is_public)
      VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING id
    `, [MASHU_USER_ID, cap.name, cap.type, cap.sourceType, cap.desc, cap.tags]);
    const capId = capResult.rows[0].id;
    console.log(`  ✓ Capability: ${cap.name} (${capId})`);

    // Create version — store name/desc in snapshot JSONB
    const verResult = await pool.query(
      `INSERT INTO capability_versions
        (capability_id, version_number, is_latest, delta_kind, snapshot)
      VALUES ($1, 1, true, 'FULL', $2::jsonb)
      RETURNING id`,
      [capId, JSON.stringify({ name: cap.name, description: cap.desc })]
    );
    const verId = verResult.rows[0].id;
    console.log(`  ✓ Version (${verId})`);

    // Link primitives via character_primitives.origin_capability_id
    for (const primName of cap.prims) {
      const primId = prims[primName];
      if (!primId) {
        console.log(`    ⚠ Primitive ${primName} not found, skipping`);
        continue;
      }
      await pool.query(`
        INSERT INTO character_primitives
          (character_id, primitive_id, origin_capability_id, is_mirrored, acquired_at_level)
        VALUES ($1::uuid, $2, $3, false, 18)
      `, [charId, primId, capId]);
      console.log(`    ✓ Attached ${primName} via capability ${cap.name}`);
    }

    // Link capability to character (capability_id column, not capability_version_id)
    await pool.query(`
      INSERT INTO character_capabilities (character_id, capability_id, version_id, acquired_at_level)
      VALUES ($1::uuid, $2, $3, 18)
    `, [charId, capId, verId]);
    console.log(`  ✓ Linked to character`);
  }

  console.log("\n✅ i3 test capabilities created and linked!");

  await pool.end();
}

main().catch(console.error);
