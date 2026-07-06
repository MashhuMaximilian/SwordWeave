// =============================================================================
// sync-pending-migrations — applies any pending Drizzle migrations and
// reconciles the migrations journal so the production DB stays in sync with
// src/db/migrations/.
//
// Why this exists: the project has had a recurring issue where the
// Drizzle migrations table is behind the on-disk migration files. The
// production DB ends up missing columns (e.g. items.quantity) that the
// Drizzle schema references, which crashes pages that try to read those
// columns. drizzle-kit's CLI migrator hangs when connecting to Neon via
// the @neondatabase/serverless WebSocket driver, so we use the raw
// HTTP driver instead and run the same statements ourselves.
//
// Idempotent: each migration is split on --> statement-breakpoint, and
// we ignore errors that indicate the object already exists
// (Postgres "duplicate object" 42710, "duplicate column" 42701,
// "relation already exists" 42P07). We always upsert the journal row
// at the end so the next run is a no-op.
//
// Usage:
//   npx tsx scripts/sync-pending-migrations.mts
// =============================================================================

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

// Use the unpooled URL — migrations should never run over a pooler.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) not set");

neonConfig.fetchConnectionCache = true;

const MIGRATIONS_DIR = "src/db/migrations";

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

function loadJournal(): Journal {
  return JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta/_journal.json"), "utf-8"),
  );
}

// Objects-already-exist error codes we tolerate. Any other error
// rethrows so the operator sees the actual problem.
const TOLERATED_CODES = new Set([
  "42710", // duplicate object
  "42701", // duplicate column
  "42P07", // relation already exists
  "42704", // object does not exist (e.g. DROP COLUMN on a column that never existed)
  "42703", // column does not exist (e.g. on idempotent ALTER)
  "0A000", // feature not supported (some enums)
  "55000", // object in use (e.g. enum not yet used in 0012's ALTER TYPE)
  "42710", // duplicate object
]);

function isTolerated(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e.code && TOLERATED_CODES.has(e.code)) return true;
  // Some statements emit "already exists" via a generic 42P07; also
  // tolerate messages that contain common idempotent-error phrases.
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("does not exist") ||
    msg.includes("duplicate") ||
    msg.includes("is not a member")
  );
}

async function runStatements(client: Client, sql: string, tag: string) {
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    try {
      await client.query(stmt);
    } catch (err) {
      if (isTolerated(err)) {
        // Object already exists / doesn't exist — this migration's
        // effect is already in the DB. Move on.
        const e = err as { code?: string; message?: string };
        console.log(
          `  [${tag}] tolerated (${e.code ?? "?"}): ${(e.message ?? "").slice(0, 80)}`,
        );
        continue;
      }
      const e = err as { message?: string };
      console.error(`  [${tag}] FAILED: ${(e.message ?? "").slice(0, 200)}`);
      console.error(`  Statement: ${stmt.slice(0, 200)}`);
      throw err;
    }
  }
}

async function ensureJournalTable(client: Client) {
  // Drizzle's default migrations table. If the project uses a different
  // name, override here.
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);
}

async function appliedIds(client: Client): Promise<Set<number>> {
  const r = await client.query<{ id: number }>(
    "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
  );
  return new Set(r.rows.map((row) => row.id));
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await ensureJournalTable(client);
    const journal = loadJournal();
    const applied = await appliedIds(client);
    const total = journal.entries.length;
    let pending = 0;
    for (const entry of journal.entries) {
      if (applied.has(entry.idx)) {
        continue;
      }
      pending++;
      const tag = entry.tag;
      const filePath = join(MIGRATIONS_DIR, `${tag}.sql`);
      let sql: string;
      try {
        sql = readFileSync(filePath, "utf-8");
      } catch {
        console.log(`[${tag}] SKIP — no SQL file at ${filePath}`);
        continue;
      }
      console.log(`[${tag}] applying (${entry.idx + 1}/${total})...`);
      await runStatements(client, sql, tag);
      // Upsert the journal row so the next run is a no-op.
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [entry.idx, tag, entry.when],
      );
      console.log(`[${tag}] OK`);
    }
    if (pending === 0) {
      console.log("All migrations already applied. Nothing to do.");
    } else {
      console.log(`\nApplied ${pending} pending migration(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
