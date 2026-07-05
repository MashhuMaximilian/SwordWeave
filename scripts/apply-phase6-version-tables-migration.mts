import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { Pool } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) { console.error('NO_URL'); process.exit(1); }

const pool = new Pool({ connectionString: url });

async function run() {
  const ok = await pool.query('SELECT 1 as ok');
  console.log('SELECT ok:', ok.rows);

  // DDL — Drizzle migration 0014_phase6_effect_item_versions.sql
  const statements = [
    `CREATE TABLE IF NOT EXISTS "effect_versions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "effect_id" uuid NOT NULL,
      "version_number" integer NOT NULL,
      "is_latest" boolean DEFAULT false NOT NULL,
      "delta_kind" "version_delta_kind" NOT NULL,
      "snapshot" jsonb NOT NULL,
      "published_by_user_id" uuid,
      "published_at" timestamp with time zone DEFAULT now() NOT NULL,
      "superseded_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "item_versions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "item_id" uuid NOT NULL,
      "version_number" integer NOT NULL,
      "is_latest" boolean DEFAULT false NOT NULL,
      "delta_kind" "version_delta_kind" NOT NULL,
      "snapshot" jsonb NOT NULL,
      "published_by_user_id" uuid,
      "published_at" timestamp with time zone DEFAULT now() NOT NULL,
      "superseded_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "effect_versions_id_version_unique_idx" ON "effect_versions" USING btree ("effect_id","version_number")`,
    `CREATE INDEX IF NOT EXISTS "effect_versions_effect_id_idx" ON "effect_versions" USING btree ("effect_id")`,
    `CREATE INDEX IF NOT EXISTS "effect_versions_is_latest_idx" ON "effect_versions" USING btree ("is_latest")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "item_versions_id_version_unique_idx" ON "item_versions" USING btree ("item_id","version_number")`,
    `CREATE INDEX IF NOT EXISTS "item_versions_item_id_idx" ON "item_versions" USING btree ("item_id")`,
    `CREATE INDEX IF NOT EXISTS "item_versions_is_latest_idx" ON "item_versions" USING btree ("is_latest")`,
  ];

  for (const s of statements) {
    try {
      await pool.query(s);
      console.log('OK:', s.slice(0, 60));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('FAIL:', s.slice(0, 60), '->', msg);
    }
  }

  // Verify
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('effect_versions', 'item_versions')
    ORDER BY table_name
  `);
  console.log('VERIFY tables:', tables.rows);

  await pool.end();
}

run().catch((e) => { console.error('OUTER ERR:', e.message); process.exit(1); });