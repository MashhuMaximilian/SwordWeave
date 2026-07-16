/**
 * Phase 7.9 audit — for every canonical primitive, report:
 *   - id, name, category, cost_tier, bu_cost
 *   - is_mirrorable, mirror_vector, mirror_bu_credit
 *   - hard_modifiers: count + first one's op/target/value/condition
 *   - what KIND of primitive it is (a guess based on name + category)
 *
 * Goal: produce a worklist showing which primitives need modifier
 * definitions authored (the 7.9 rewrite). The Notion source-of-truth
 * page is the catalog — the DB is the gap.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

interface PrimitiveRow {
  id: number;
  name: string;
  category: string;
  cost_tier: string;
  bu_cost: number;
  is_mirrorable: boolean;
  mirror_vector: string;
  mirror_bu_credit: number;
  mechanical_output_text: string;
  hard_modifiers: unknown;
}

async function main() {
  const rows = (await sql`
    SELECT
      id, name,
      category::text as category,
      cost_tier, bu_cost,
      is_mirrorable,
      mirror_vector::text as mirror_vector,
      mirror_bu_credit,
      mechanical_output_text,
      hard_modifiers
    FROM primitives
    WHERE user_id IS NULL
    ORDER BY category, name
  `) as PrimitiveRow[];

  // Summary by category
  const byCat = new Map<string, PrimitiveRow[]>();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }

  // Modifier coverage
  let withMods = 0;
  let withoutMods = 0;
  let mirrorableButNoMods = 0;
  const worklist: Array<{
    id: number;
    name: string;
    category: string;
    tier: string;
    bu: number;
    isMirrorable: boolean;
    mirrorVector: string;
    modCount: number;
    firstModOp: string;
    firstModTarget: string;
    firstModValue: string;
    output: string;
  }> = [];

  for (const r of rows) {
    const mods = Array.isArray(r.hard_modifiers)
      ? (r.hard_modifiers as unknown[])
      : [];
    const hasMods = mods.length > 0;
    if (hasMods) withMods++;
    else withoutMods++;
    if (r.is_mirrorable && !hasMods) mirrorableButNoMods++;

    const firstMod = mods[0] as
      | {
          operation?: string;
          target?: string;
          value?: unknown;
        }
      | undefined;

    worklist.push({
      id: r.id,
      name: r.name,
      category: r.category,
      tier: r.cost_tier,
      bu: r.bu_cost,
      isMirrorable: r.is_mirrorable,
      mirrorVector: r.mirror_vector,
      modCount: mods.length,
      firstModOp: firstMod?.operation ?? "",
      firstModTarget: firstMod?.target ?? "",
      firstModValue:
        firstMod?.value !== undefined ? String(firstMod.value) : "",
      output: (r.mechanical_output_text ?? "").slice(0, 100),
    });
  }

  console.log("=".repeat(80));
  console.log(`PHASE 7.9 AUDIT — Canonical Primitives`);
  console.log("=".repeat(80));
  console.log(`Total: ${rows.length}`);
  console.log(`With modifiers: ${withMods}`);
  console.log(`Without modifiers: ${withoutMods}`);
  console.log(`Mirrorable but no modifiers: ${mirrorableButNoMods}`);
  console.log("");

  console.log("BY CATEGORY:");
  for (const [cat, rs] of byCat.entries()) {
    const withModCount = rs.filter((r) => Array.isArray(r.hard_modifiers) && (r.hard_modifiers as unknown[]).length > 0).length;
    console.log(`  ${cat.padEnd(30)} ${rs.length} total, ${withModCount} with mods`);
  }
  console.log("");

  // The "no mods" worklist — primitives that need authoring
  console.log("=".repeat(80));
  console.log(`WORKLIST — primitives with NO modifier definitions (${withoutMods} rows)`);
  console.log("=".repeat(80));
  console.log(
    [
      "ID",
      "Category",
      "Name",
      "Tier",
      "BU",
      "Mirror?",
      "MirrorVec",
      "Output",
    ].join(" | "),
  );
  console.log("-".repeat(120));
  for (const w of worklist.filter((w) => w.modCount === 0)) {
    console.log(
      [
        w.id,
        w.category,
        w.name.slice(0, 50),
        w.tier.replace(/^Tier \d+ — /, "T"),
        w.bu,
        w.isMirrorable ? "YES" : "no",
        w.mirrorVector.replace("STANDARD_ONLY", "STD").replace("MIRRORABLE_ALWAYS", "MIR"),
        w.output.replace(/\n/g, " ").slice(0, 60),
      ].join(" | "),
    );
  }

  console.log("");
  console.log("=".repeat(80));
  console.log(`EXISTING MODIFIERS — what the ${withMods} currently-with-mods look like`);
  console.log("=".repeat(80));
  for (const w of worklist.filter((w) => w.modCount > 0)) {
    console.log(
      `  [${w.id}] ${w.name} (${w.category}, ${w.tier}, ${w.bu} BU)`,
    );
    console.log(
      `        mod[0]: op=${w.firstModOp} target=${w.firstModTarget} value=${w.firstModValue}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
