// Quick DB recon for Phase 7.5 — refreshed to use operation-driven
// chirality. The "is_mirrorable" column is now derived from the
// modifier's operation per OP_SPECS, not stored independently.
//
// Run with: pnpm tsx scripts/phase-7.5-recon.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { Pool } from "@neondatabase/serverless";

// Mirror of OP_SPECS — keep in sync with src/types/modifier.ts.
// Each op declares its mirrorability. Set is the only
// non-mirrorable op; everything else is mirrorable.
const MIRRORABLE_OPS = new Set([
  "add", "subtract", "multiply", "divide",
  "min", "max", "grant", "revoke",
  "toggle", "bias",
]);

function isMirrorableFromOp(op: string): boolean {
  return MIRRORABLE_OPS.has(op);
}

async function main() {
  const url = process.env["DATABASE_URL"]!;
  const c = new Pool({ connectionString: url });

  console.log("== Primitive count by category ==\n");
  const r = await c.query(`
    SELECT category,
           COUNT(*) AS n,
           COUNT(*) FILTER (WHERE jsonb_array_length(hard_modifiers) > 0) AS with_mods,
           COUNT(*) FILTER (WHERE is_mirrorable) AS mirrorable_col
    FROM primitives
    GROUP BY category
    ORDER BY n DESC;
  `);
  console.log("category".padEnd(20), "total".padStart(6), "+mods".padStart(6), "mirror_col".padStart(11));
  for (const row of r.rows) {
    console.log(
      String(row.category).padEnd(20),
      String(row.n).padStart(6),
      String(row.with_mods).padStart(6),
      String(row.mirrorable_col).padStart(11),
    );
  }

  console.log("\n== Total primitives ==");
  const t = await c.query("SELECT COUNT(*) FROM primitives;");
  console.log(t.rows[0].count);

  console.log("\n== Phase 7.5 chirality derivation (mirrorable from op) ==");
  console.log("Replaces the old 'mirrorable column vs modifier presence' check.\n");
  const chir = await c.query(`
    SELECT
      jsonb_array_length(hard_modifiers) AS mod_count,
      CASE WHEN jsonb_array_length(hard_modifiers) > 0 THEN 'has_mods' ELSE 'no_mods' END AS mod_state,
      COUNT(*) AS n,
      COUNT(*) FILTER (WHERE is_mirrorable) AS mirrorable_col
    FROM primitives
    GROUP BY mod_count, mod_state
    ORDER BY mod_count, mod_state;
  `);
  console.log("mod_count".padStart(10), "mod_state".padEnd(10), "n".padStart(6), "mirrorable_col".padStart(15));
  for (const row of chir.rows) {
    console.log(
      String(row.mod_count).padStart(10),
      String(row.mod_state).padEnd(10),
      String(row.n).padStart(6),
      String(row.mirrorable_col).padStart(15),
    );
  }

  console.log("\n== Primitives that have modifiers — list with op + derived mirrorability ==");
  const mods = await c.query(`
    SELECT name, category, hard_modifiers, is_mirrorable
    FROM primitives
    WHERE jsonb_array_length(hard_modifiers) > 0
    ORDER BY category, name;
  `);
  if (mods.rows.length === 0) {
    console.log("(no primitives with modifiers yet)");
  } else {
    for (const row of mods.rows) {
      const ops = (row.hard_modifiers as Array<{ operation: string }>).map(
        (m) => m.operation,
      );
      const derivedMirrorable = ops.every(isMirrorableFromOp);
      const colMirrorable = row.is_mirrorable;
      const agrees = derivedMirrorable === colMirrorable;
      console.log(
        `  ${String(row.category).padEnd(20)} ${row.name.padEnd(30)} ` +
        `ops=[${ops.join(",")}] derived=${derivedMirrorable ? "Y" : "N"} col=${colMirrorable ? "Y" : "N"} ` +
        `${agrees ? "✓" : "✗ MISMATCH"}`,
      );
    }
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

  console.log("\n== Primitives flagged mirrorable=true but with no modifier ==");
  console.log("(Phase 7.5 reframing: these are NOT violations. They're correctly flagged;");
  console.log(" they need a modifier authored. Once authored, chirality derives from op.)\n");
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

  console.log("\n== Modifier ops currently in use ==");
  const opDist = await c.query(`
    SELECT jsonb_array_elements(hard_modifiers)->>'operation' AS op, COUNT(*) AS n
    FROM primitives
    WHERE jsonb_array_length(hard_modifiers) > 0
    GROUP BY op
    ORDER BY n DESC;
  `);
  if (opDist.rows.length === 0) {
    console.log("(no modifiers yet)");
  } else {
    for (const row of opDist.rows) {
      const mirrorable = isMirrorableFromOp(row.op) ? "✓" : "✗";
      console.log(`  ${String(row.op).padEnd(12)} ${String(row.n).padStart(3)} primitives  ${mirrorable}`);
    }
  }

  console.log("\n== Value shapes currently in use (token vs raw) ==");
  const valDist = await c.query(`
    SELECT jsonb_typeof(jsonb_array_elements(hard_modifiers)->'value') AS val_type, COUNT(*) AS n
    FROM primitives
    WHERE jsonb_array_length(hard_modifiers) > 0
    GROUP BY val_type
    ORDER BY n DESC;
  `);
  if (valDist.rows.length === 0) {
    console.log("(no modifiers yet)");
  } else {
    for (const row of valDist.rows) {
      console.log(`  ${row.val_type}: ${row.n}`);
    }
  }

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });