/**
 * Phase-7-Q-M: Mirror taxonomy draft. One-shot survey that scans the
 * primitives catalog and emits a proposed (category, isMirrorable,
 * mirrorVector) stamp per row based on bucket signals. NOT a
 * migration — purely output, for discussion.
 */
import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

interface PrimitivesRow {
  id: number;
  name: string;
  category: string;
  is_mirrorable: boolean | null;
  mirror_vector: string | null;
  mirror_bu_credit: number | null;
  bu_cost: number;
  cost_tier: string | null;
}

/** Bucket rules. First matching rule wins. */
const rules: Array<{
  predicate: (name: string, category: string) => boolean;
  isMirrorable: boolean;
  mirrorVector: "STANDARD_ONLY" | "VARIABLE_VECTOR" | "STRUCTURAL_FAULT" | "COST_INSTABILITY" | null;
  reason: string;
}> = [
  // ---- VARIABLE_VECTOR (numerical inverts cleanly) ----
  {
    predicate: (n) => /\bnumerical?\b/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "bias/numerical primitive",
  },
  {
    predicate: (n) => /\breaction\s+(slot|pulse|reflex)\b/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "reaction slot — invert the slot count",
  },
  {
    predicate: (n) => /(attack bonus|attackroll|attack roll)/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "attack roll inversion",
  },
  {
    predicate: (n) => /attribute (increment|augment)/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "attribute ±",
  },
  {
    predicate: (n) => /vitality core augment/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "HP ceiling ±",
  },
  {
    predicate: (n) => /expertise upgrade/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "expertise up/down",
  },
  {
    predicate: (n) => /stride extension/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "speed up/slow",
  },
  {
    predicate: (n) => /clash dominance/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "slot advantage/disadvantage",
  },
  {
    predicate: (n) => /interceptive priority/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "reaction priority inversion",
  },
  {
    predicate: (n) => /causal override/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "fate/reroll inversion",
  },
  {
    predicate: (n) => /practice proficiency|reliable practice/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "proficiency up/down",
  },
  {
    predicate: (n) => /\b(bias|narrative focus|narrative)\b/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "narrative +/- bias",
  },
  // ---- STRUCTURAL_FAULT (defense → vulnerability pairs) ----
  {
    predicate: (n, c) => c === "DEFENSIVE" && /(warding|hardening|shield|firewall|aegis|insulation)/i.test(n),
    isMirrorable: true,
    mirrorVector: "STRUCTURAL_FAULT",
    reason: "defensive -> vulnerability",
  },
  // ---- COST_INSTABILITY (protective / healing -> cost mirror) ----
  {
    predicate: (n, c) => c === "VITALITY" && /vitality shielding/i.test(n),
    isMirrorable: true,
    mirrorVector: "COST_INSTABILITY",
    reason: "protect-by-paying cost inversion",
  },
  {
    predicate: (n, c) => c === "VITALITY" && /(stabilize|last breath|tether)/i.test(n),
    isMirrorable: true,
    mirrorVector: "STANDARD_ONLY",
    reason: "vitality narrative flips polarity on casting",
  },
  // ---- TACTICAL primitives (Cover Tiers) ----
  {
    predicate: (n, c) => c === "TACTICAL" && /\bcover\b/i.test(n),
    isMirrorable: true,
    mirrorVector: "STRUCTURAL_FAULT",
    reason: "cover tier -> exposed tier",
  },
  // ---- domain / resistance ----
  {
    predicate: (n, c) => c === "DEFENSIVE" && /(resistance|immunity|domain)/i.test(n),
    isMirrorable: true,
    mirrorVector: "STRUCTURAL_FAULT",
    reason: "resistance -> vulnerability twin",
  },
];

function classify(row: PrimitivesRow): {
  isMirrorable: boolean;
  mirrorVector: string | null;
  reason: string;
} {
  for (const rule of rules) {
    if (rule.predicate(row.name, row.category)) {
      return {
        isMirrorable: rule.isMirrorable,
        mirrorVector: rule.mirrorVector,
        reason: rule.reason,
      };
    }
  }
  return { isMirrorable: false, mirrorVector: null, reason: "(no mirror candidate)" };
}

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const r = await pool.query<PrimitivesRow>(`
      SELECT id, name, category, is_mirrorable, mirror_vector, mirror_bu_credit, bu_cost, cost_tier
      FROM primitives
      ORDER BY category, bu_cost, name
    `);
    const summary: Record<string, { current: number; proposed: number; rows: PrimitivesRow[] }> = {};
    for (const row of r.rows) {
      const cls = classify(row);
      summary[row.category] ??= { current: 0, proposed: 0, rows: [] };
      summary[row.category].rows.push(row);
      if (row.is_mirrorable) summary[row.category].current++;
      if (cls.isMirrorable) summary[row.category].proposed++;
    }
    console.log("Category summary (current → proposed mirror):");
    for (const [cat, s] of Object.entries(summary)) {
      console.log(`  ${cat.padEnd(14)}  ${s.current.toString().padStart(3)} → ${s.proposed.toString().padStart(3)}    (${s.rows.length} rows)`);
    }

    console.log("\nPer-row proposal (only shows changes):");
    for (const row of r.rows) {
      const cls = classify(row);
      const changed =
        cls.isMirrorable !== !!row.is_mirrorable ||
        (cls.mirrorVector ?? null) !== (row.mirror_vector ?? null);
      if (!changed) continue;
      const cur = `${row.is_mirrorable ? "yes/" + (row.mirror_vector ?? "?") : "no"}`;
      const prop = `${cls.isMirrorable ? "yes/" + cls.mirrorVector : "no"}`;
      console.log(
        `  ${row.name.padEnd(46)} ${row.category.padEnd(14)}  ${cur.padEnd(28)} → ${prop.padEnd(28)} (${cls.reason})`,
      );
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
