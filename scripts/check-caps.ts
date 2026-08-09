import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neodatabase/serverless";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const caps = await pool.query(
    "SELECT id, name, type, source_type, verbose_description FROM capabilities WHERE name IN ($1, $2, $3)",
    ["Divine Smite", "Hunter's Mark", "Stone's Endurance"]
  );
  console.log("=== Capabilities ===");
  caps.rows.forEach((r: any) => console.log(JSON.stringify(r)));

  const links = await pool.query(
    "SELECT cc.*, c.name as cap_name FROM character_capabilities cc JOIN capabilities c ON cc.capability_id = c.id"
  );
  console.log("\n=== Character Capability Links ===");
  links.rows.forEach((r: any) => console.log(JSON.stringify(r)));

  await pool.end();
}

main().catch(console.error);
