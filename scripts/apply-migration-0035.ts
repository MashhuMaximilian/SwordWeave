/**
 * Apply migration 0035 — users.is_admin column.
 * (Bypasses drizzle-kit's serverless driver incompatibility.)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  console.log("Applying 0035_serious_vargas.sql...");

  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS "users_is_admin_idx" ON "users" USING btree ("is_admin")`;

  // Verify
  const r = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_admin'
  `;
  console.log("Column verified:", r);

  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'users_is_admin_idx'
  `;
  console.log("Index verified:", idx);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});