// Schema dump — outputs live Postgres schema as a Markdown doc.
// Uses Neon serverless driver since that's what's installed.

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

const tables = await query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`);

const md = [];
md.push("# SwordWeave Live Schema (Postgres)");
md.push("");
md.push(`> Dumped: ${new Date().toISOString()}`);
md.push(`> Database: Neon Postgres (eu-central-1)`);
md.push("");
md.push(`## Tables (${tables.length})`);
md.push("");
md.push("| Table | Rows |");
md.push("|---|---|");

for (const t of tables) {
  const c = await query(`SELECT COUNT(*)::int AS n FROM "${t.table_name}"`);
  md.push(`| \`${t.table_name}\` | ${c[0].n} |`);
}
md.push("");

for (const t of tables) {
  md.push(`## \`${t.table_name}\``);
  md.push("");

  const cols = await query(`
    SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [t.table_name]);

  md.push("| Column | Type | Null | Default |");
  md.push("|---|---|---|---|");
  for (const col of cols) {
    let type = col.data_type;
    if (col.character_maximum_length) type += `(${col.character_maximum_length})`;
    md.push(`| \`${col.column_name}\` | ${type} | ${col.is_nullable} | ${col.column_default ?? "—"} |`);
  }
  md.push("");

  const idx = await query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
    ORDER BY indexname
  `, [t.table_name]);
  if (idx.length > 0) {
    md.push("**Indexes:**");
    md.push("");
    for (const i of idx) {
      md.push(`- \`${i.indexname}\` — ${i.indexdef}`);
    }
    md.push("");
  }

  const fks = await query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
  `, [t.table_name]);
  if (fks.length > 0) {
    md.push("**Foreign keys:**");
    md.push("");
    for (const fk of fks) {
      md.push(`- \`${fk.column_name}\` → \`${fk.foreign_table}.${fk.foreign_column}\` (ON DELETE ${fk.delete_rule})`);
    }
    md.push("");
  }

  const pks = await query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE contype = 'p' AND conrelid = $1::regclass
  `, [t.table_name]);
  if (pks.length > 0) {
    md.push("**Primary keys:**");
    md.push("");
    for (const pk of pks) {
      md.push(`- \`${pk.conname}\`: ${pk.def}`);
    }
    md.push("");
  }
}

console.log(md.join("\n"));
await pool.end();
