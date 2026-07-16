/**
 * Phase 7.10 prep — Dump the 8 effects and 25 capabilities with their
 * full data so I can plan the audit/rewrite.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  console.log("=".repeat(80));
  console.log("CANONICAL EFFECTS (8)");
  console.log("=".repeat(80));
  const effects = (await sql`
    SELECT e.id, e.name, e.narrative_description,
           COALESCE(json_agg(json_build_object(
             'primitive_id', ep.primitive_id,
             'primitive_name', p.name,
             'quantity', ep.quantity,
             'sort_order', ep.sort_order,
             'notes', ep.notes
           ) ORDER BY ep.sort_order) FILTER (WHERE ep.primitive_id IS NOT NULL), '[]') as primitives
    FROM effects e
    LEFT JOIN effect_primitives ep ON ep.effect_id = e.id
    LEFT JOIN primitives p ON p.id = ep.primitive_id
    WHERE e.user_id IS NULL
    GROUP BY e.id, e.name, e.narrative_description
    ORDER BY e.name
  `) as Array<{
    id: string;
    name: string;
    narrative_description: string;
    primitives: Array<{
      primitive_id: number;
      primitive_name: string;
      quantity: number;
      sort_order: number;
      notes: string | null;
    }>;
  }>;

  for (const e of effects) {
    console.log(`\n[${e.id.slice(0, 8)}] ${e.name}`);
    console.log(`  NARRATIVE: ${e.narrative_description}`);
    console.log(`  PRIMITIVES (${e.primitives.length}):`);
    for (const p of e.primitives) {
      console.log(
        `    [${p.primitive_id}] ${p.primitive_name} x${p.quantity} ${p.notes ? `(${p.notes})` : ""}`,
      );
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("CANONICAL CAPABILITIES (25)");
  console.log("=".repeat(80));
  const caps = (await sql`
    SELECT c.id, c.name, c.type, c.verbose_description,
           COALESCE(json_agg(json_build_object(
             'primitive_id', cp.primitive_id,
             'primitive_name', p.name,
             'quantity', cp.quantity,
             'sort_order', cp.sort_order,
             'notes', cp.notes
           ) ORDER BY cp.sort_order) FILTER (WHERE cp.primitive_id IS NOT NULL), '[]') as primitives
    FROM capabilities c
    LEFT JOIN capability_primitives cp ON cp.capability_id = c.id
    LEFT JOIN primitives p ON p.id = cp.primitive_id
    WHERE c.user_id IS NULL
    GROUP BY c.id, c.name, c.type, c.verbose_description
    ORDER BY c.type, c.name
  `) as Array<{
    id: string;
    name: string;
    type: string;
    verbose_description: string;
    primitives: Array<{
      primitive_id: number;
      primitive_name: string;
      quantity: number;
      sort_order: number;
      notes: string | null;
    }>;
  }>;

  for (const c of caps) {
    console.log(`\n[${c.id.slice(0, 8)}] ${c.name} (${c.type})`);
    console.log(`  DESC: ${c.verbose_description}`);
    console.log(`  PRIMITIVES (${c.primitives.length}):`);
    for (const p of c.primitives) {
      console.log(
        `    [${p.primitive_id}] ${p.primitive_name} x${p.quantity} ${p.notes ? `(${p.notes})` : ""}`,
      );
    }
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
