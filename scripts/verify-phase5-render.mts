import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_POSTGRES_URL_NON_POOLING!;
if (!url) throw new Error("DATABASE_URL_UNPOOLING not set");
const sql = neon(url);

async function main() {
  // 1. List characters
  const chars = await sql`SELECT id, name, user_id FROM characters ORDER BY name`;
  console.log("=== CHARACTERS ===");
  console.table(chars);

  // 2. For each character, dump the slot data the badge needs
  for (const c of chars) {
    console.log(`\n=== ${c.name} (${c.id}) ===`);

    // Capabilities
    const caps = await sql`
      SELECT cap.name, cc.version_id, cc.slot_source,
        (SELECT id FROM capability_versions WHERE capability_id = cap.id AND is_latest = true LIMIT 1) AS latest_version_id,
        cap.user_id AS owner_clerk_id, cap.source_origin
      FROM character_capabilities cc
      JOIN capabilities cap ON cap.id = cc.capability_id
      WHERE cc.character_id = ${c.id}
    `;
    console.log("  Capabilities:");
    for (const row of caps) {
      const stale = row.latest_version_id && row.version_id !== row.latest_version_id;
      console.log(`    - ${row.name} v=${row.version_id ?? "null"} latest=${row.latest_version_id ?? "null"} ${stale ? "⚠ STALE" : "✓"} source=${row.slot_source} owner=${row.owner_clerk_id?.slice(0, 20) ?? "null"}`);
    }

    // Items
    const items = await sql`
      SELECT it.name, ci.version_id, ci.slot_source,
        (SELECT id FROM item_versions WHERE item_id = it.id AND is_latest = true LIMIT 1) AS latest_version_id,
        it.user_id AS owner_clerk_id, it.source_origin
      FROM character_items ci
      JOIN items it ON it.id = ci.item_id
      WHERE ci.character_id = ${c.id}
    `;
    console.log("  Items:");
    for (const row of items) {
      const stale = row.latest_version_id && row.version_id !== row.latest_version_id;
      console.log(`    - ${row.name} v=${row.version_id ?? "null"} latest=${row.latest_version_id ?? "null"} ${stale ? "⚠ STALE" : "✓"} source=${row.slot_source} owner=${row.owner_clerk_id?.slice(0, 20) ?? "null"}`);
    }

    // Primitives
    const prims = await sql`
      SELECT p.name, cp.version_id, cp.slot_source,
        (SELECT id FROM primitive_versions WHERE primitive_id = p.id AND is_latest = true LIMIT 1) AS latest_version_id,
        p.user_id AS owner_clerk_id, p.source_origin
      FROM character_primitives cp
      JOIN primitives p ON p.id = cp.primitive_id
      WHERE cp.character_id = ${c.id}
    `;
    console.log("  Primitives:");
    for (const row of prims) {
      const stale = row.latest_version_id && row.version_id !== row.latest_version_id;
      console.log(`    - ${row.name} v=${row.version_id ?? "null"} latest=${row.latest_version_id ?? "null"} ${stale ? "⚠ STALE" : "✓"} source=${row.slot_source} owner=${row.owner_clerk_id?.slice(0, 20) ?? "null"}`);
    }
  }
}

main().catch(console.error);
