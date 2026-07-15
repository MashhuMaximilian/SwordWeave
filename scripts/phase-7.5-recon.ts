// Quick DB recon for Phase 7.5 planning
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { Pool } from "@neondatabase/serverless";

async function main() {
  const url = process.env["DATABASE_URL"]!;
  const c = new Pool({ connectionString: url });

  console.log("== Primitive count by category ==");
  const r = await c.query(`
    SELECT category,
           COUNT(*) AS n,
           COUNT(*) FILTER (WHERE jsonb_array_length(hard_modifiers) > 0) AS with_mods,
           COUNT(*) FILTER (WHERE is_mirrorable) AS mirrorable
    FROM primitives
    GROUP BY category
    ORDER BY n DESC;
  `);
  console.log("category".padEnd(20), "total".padStart(6), "+mods".padStart(6), "mirror".padStart(8));
  for (const row of r.rows) {
    console.log(
      String(row.category).padEnd(20),
      String(row.n).padStart(6),
      String(row.with_mods).padStart(6),
      String(row.mirrorable).padStart(8),
    );
  }

  console.log("\n== Total ==");
  const t = await c.query("SELECT COUNT(*) FROM primitives;");
  console.log(t.rows[0].count);

  console.log("\n== Mirrorability vs modifier presence (chiral rule check) ==");
  const m = await c.query(`
    SELECT
      CASE WHEN is_mirrorable THEN 'mirrorable=true' ELSE 'mirrorable=false' END AS mirror_state,
      CASE WHEN jsonb_array_length(hard_modifiers) > 0 THEN 'has_mods' ELSE 'no_mods' END AS mod_state,
      COUNT(*) AS n
    FROM primitives
    GROUP BY mirror_state, mod_state
    ORDER BY mirror_state, mod_state;
  `);
  console.log("mirror_state".padEnd(20), "mod_state".padEnd(10), "n".padStart(6));
  for (const row of m.rows) {
    console.log(
      String(row.mirror_state).padEnd(20),
      String(row.mod_state).padEnd(10),
      String(row.n).padStart(6),
    );
  }

  console.log("\n== Primitives that are mirrorable=true but have no modifier (chirality violation per user rule) ==");
  const v = await c.query(`
    SELECT name, category
    FROM primitives
    WHERE is_mirrorable = true
      AND jsonb_array_length(hard_modifiers) = 0
    ORDER BY category, name;
  `);
  if (v.rows.length === 0) {
    console.log("(none)");
  } else {
    for (const row of v.rows) {
      console.log(`  ${row.category.padEnd(20)} ${row.name}`);
    }
  }

  console.log("\n== Primitives that have modifiers but are NOT marked mirrorable (potential candidates) ==");
  const c2 = await c.query(`
    SELECT category, COUNT(*) AS n
    FROM primitives
    WHERE is_mirrorable = false
      AND jsonb_array_length(hard_modifiers) > 0
    GROUP BY category
    ORDER BY n DESC;
  `);
  for (const row of c2.rows) {
    console.log(`  ${row.category.padEnd(20)} ${row.n}`);
  }

  console.log("\n== Modifier count distribution ==");
  const d = await c.query(`
    SELECT jsonb_array_length(hard_modifiers) AS mod_count, COUNT(*) AS n
    FROM primitives
    GROUP BY mod_count
    ORDER BY mod_count;
  `);
  for (const row of d.rows) {
    console.log(`  ${row.mod_count} modifiers: ${row.n} primitives`);
  }

  console.log("\n== The 2 primitives that DO have modifiers (current state) ==");
  const mod = await c.query(`
    SELECT name, category, hard_modifiers, is_mirrorable
    FROM primitives
    WHERE jsonb_array_length(hard_modifiers) > 0
    ORDER BY category, name;
  `);
  for (const row of mod.rows) {
    console.log(`\n${row.category} / ${row.name} (is_mirrorable=${row.is_mirrorable})`);
    console.log(JSON.stringify(row.hard_modifiers, null, 2));
  }

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });