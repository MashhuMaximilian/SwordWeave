import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { Pool } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) { console.error('NO_URL'); process.exit(1); }

const pool = new Pool({ connectionString: url });

async function run() {
  // Test connection
  const ok = await pool.query('SELECT 1 as ok');
  console.log('SELECT ok:', ok.rows);

  const statements = [
    'ALTER TABLE "capabilities" ADD COLUMN IF NOT EXISTS "user_id" text',
    'ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "user_id" text',
    'CREATE INDEX IF NOT EXISTS "capabilities_user_id_idx" ON "capabilities" USING btree ("user_id")',
    'CREATE INDEX IF NOT EXISTS "items_user_id_idx" ON "items" USING btree ("user_id")',
  ];

  for (const s of statements) {
    try {
      await pool.query(s);
      console.log('OK:', s.slice(0, 70));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('FAIL:', s.slice(0, 70), '->', msg);
    }
  }

  const cols = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE (table_name = 'capabilities' OR table_name = 'items')
      AND column_name = 'user_id'
    ORDER BY table_name
  `);
  console.log('VERIFY columns:', cols.rows);

  const idx = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename IN ('capabilities', 'items')
      AND indexname IN ('capabilities_user_id_idx', 'items_user_id_idx')
  `);
  console.log('VERIFY indexes:', idx.rows);

  const cap = await pool.query('SELECT COUNT(*)::int as total, COUNT("user_id")::int as with_user FROM "capabilities"');
  const item = await pool.query('SELECT COUNT(*)::int as total, COUNT("user_id")::int as with_user FROM "items"');
  console.log('capabilities:', cap.rows);
  console.log('items:', item.rows);

  await pool.end();
}

run().catch((e) => { console.error('OUTER ERR:', e.message); process.exit(1); });