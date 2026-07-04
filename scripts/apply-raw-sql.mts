// One-off script to apply a SQL migration file to the live DB via the
// unpooled Neon serverless WebSocket driver. Use for migrations that need to
// run DDL outside Drizzle's transactional wrapper.
import { readFileSync } from "node:fs";
import { Client, neonConfig } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

// Use HTTP fetch endpoint when available (faster, no WebSocket overhead).
neonConfig.fetchConnectionCache = true;

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED not set");

const filePath = process.argv[2];
if (!filePath) throw new Error("Pass SQL file path as arg");

const sql = readFileSync(filePath, "utf-8");

// Split on --> statement-breakpoint (Drizzle's convention) and execute each
// separately so DDL statements aren't grouped into one transaction.
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const client = new Client({ connectionString: url });

(async () => {
  await client.connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        console.error(`Failed statement (first 200 chars):\n${stmt.slice(0, 200)}...`);
        throw err;
      }
    }
    console.log(`Applied ${filePath} (${statements.length} statements)`);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});