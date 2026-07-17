/**
 * Phase 7.10.4 — Backfill: mark existing admin users.
 *
 * For now, just marks `xeun` as admin since they're the system owner.
 * In the future, this can be expanded to read a config of admin usernames.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  console.log("Phase 7.10.4 — Backfill is_admin\n");

  // First show current state
  console.log("Before:");
  const before = await sql`
    SELECT username, display_name, is_admin
    FROM users
    ORDER BY created_at
  ` as Array<{ username: string; display_name: string | null; is_admin: boolean }>;
  for (const u of before) {
    console.log(`  ${u["username"]} (${u["display_name"] ?? "—"}) — is_admin=${u["is_admin"]}`);
  }

  // Mark xeun as admin if user exists
  const result = await sql`
    UPDATE users
    SET is_admin = true
    WHERE LOWER(username) = 'xeun' OR LOWER(display_name) ILIKE '%xeun%'
    RETURNING username, display_name
  ` as Array<{ username: string; display_name: string | null }>;

  console.log("\nUpdated:");
  for (const r of result) console.log(`  ${r["username"]} (${r["display_name"]}) — now admin`);

  // Show final state
  console.log("\nAfter:");
  const after = await sql`
    SELECT username, display_name, is_admin
    FROM users
    ORDER BY created_at
  ` as Array<{ username: string; display_name: string | null; is_admin: boolean }>;
  for (const u of after) {
    console.log(`  ${u["username"]} (${u["display_name"] ?? "—"}) — is_admin=${u["is_admin"]}`);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});