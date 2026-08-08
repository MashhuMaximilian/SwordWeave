import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neondatabase/serverless";

const MASHU_USER_ID = "user_3GBKnmCEvgYSjfeFqmAQrzO7cyP";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Find the i2 Test Character
  const charResult = await pool.query(
    `SELECT id FROM characters WHERE user_id = $1 AND name = $2 ORDER BY created_at DESC LIMIT 1`,
    [MASHU_USER_ID, "i2 Test Character"],
  );

  if (charResult.rowCount === 0) {
    console.log("No i2 Test Character found.");
    return;
  }

  const charId = charResult.rows[0].id;
  console.log(`Character: i2 Test Character (${charId})`);

  // Find the 3 test primitives we just created
  const primResult = await pool.query(
    `SELECT id, name FROM primitives WHERE name IN ('Smite Damage', 'Mark of the Hunt', 'Stone Skin')`,
  );

  if (primResult.rowCount === 0) {
    console.log("Test primitives not found. Run seed-i3-test.ts first.");
    return;
  }

  const prims = primResult.rows;
  console.log(`Found ${prims.length} test primitives`);

  // Attach them directly to the character with origin_capability_id
  // to test capability-origin provenance + condition evaluation
  for (const p of prims) {
    // Check if already attached
    const existing = await pool.query(
      `SELECT 1 FROM character_primitives WHERE character_id = $1::uuid AND primitive_id = $2 LIMIT 1`,
      [charId, p.id],
    );

    if (existing.rowCount === 0) {
      await pool.query(
        `INSERT INTO character_primitives (character_id, primitive_id, origin_capability_id, is_mirrored, acquired_at_level)
         VALUES ($1::uuid, $2, NULL, false, 18)`,
        [charId, p.id],
      );
      console.log(`  ✓ Attached ${p.name} to character`);
    } else {
      console.log(`  • ${p.name} already attached`);
    }
  }

  // Add the Smite Damage primitive with a condition (vitality < 50%)
  // We need to update the primitive to include a condition on its hard_modifier
  await pool.query(
    `UPDATE primitives SET hard_modifiers = $1 WHERE name = 'Smite Damage'`,
    [JSON.stringify([
      {
        target: "damage_bonus.radiant",
        operation: "add",
        value: 3,
        condition: {
          kind: "compound",
          tokens: ["self:stat|vitality_pct|<|0.5"],
        },
      },
    ])],
  );
  console.log("  ✓ Added vitality condition to Smite Damage");

  // Add a non-computable condition to Mark of the Hunt
  await pool.query(
    `UPDATE primitives SET hard_modifiers = $1 WHERE name = 'Mark of the Hunt'`,
    [JSON.stringify([
      {
        target: "attribute.physical",
        operation: "add",
        value: 2,
        condition: {
          kind: "compound",
          tokens: ["target:has_status|marked"],
        },
      },
    ])],
  );
  console.log("  ✓ Added target condition to Mark of the Hunt (non-computable)");

  console.log("\n✅ Test character i3 data ready.");
  console.log("Open /characters/" + charId + " to see:");
  console.log("  - Smite Damage: * marker (condition: vitality < 50%)");
  console.log("  - Mark of the Hunt: * marker (non-computable target condition)");
  console.log("  - Stone Skin: no marker (no condition)");

  await pool.end();
}

main().catch(console.error);
