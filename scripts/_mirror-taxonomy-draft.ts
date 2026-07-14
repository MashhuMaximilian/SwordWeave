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

/** Bucket rules. First matching rule wins.
 *
 * Phase-7-Q-M canonical alignment:
 *   - Variable Vector (mirrorable): numerical metrics, vitality
 *     blocks, probability bias tracks, structural defensive faults,
 *     kinematic metrics (movement speed), strain/cost buffers.
 *   - Permission Vector (NOT mirrorable): verbs, domains,
 *     intensity dice, spatial/targeting, durations, system
 *     bypasses (senses, mobility types, extra reaction slots),
 *     trigger hooks, semantic state tags.
 */
const rules: Array<{
  predicate: (name: string, category: string) => boolean;
  isMirrorable: boolean;
  mirrorVector: "STANDARD_ONLY" | "VARIABLE_VECTOR" | "STRUCTURAL_FAULT" | "COST_INSTABILITY" | null;
  reason: string;
}> = [
  // ---- NOT MIRRORABLE: Permission-Vector categories ----
  // Quickest wins first so Variable-Vector rows aren't shadowed.
  {
    predicate: (_n, c) =>
      [
        "VERB_TIER",
        "DOMAIN",
        "INTENSITY_DICE",
        "TARGETING",
        "TARGETING_AOE",
        "RANGE",
        "SIZING",
        "CONDITION",
        "TRIGGER_HOOK",
        "KINETIC_CONTROL",
        "AGENCY_OVERRIDE",
        "METAMORPHOSIS",
        "SPEED_QUICKENING",
        "SENSORY_ARRAY",
        "BOSS_ECONOMY",
        "TACTICAL", // cover is a passive spatial unlock per canonical
        "MOBILITY_LOCOMOTION_LAND", // not used; MOBILITY row level guard
      ].includes(c) &&
      c !== "MOBILITY_LOCOMOTION" /* stride extension exception */,
    isMirrorable: false,
    mirrorVector: null,
    reason: "permission-vector category (not mirrorable per canonical)",
  },
  // ---- VARIABLE_VECTOR (mirrorable) ----
  {
    predicate: (n) => /\bnumerical?\b/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "bias/numerical primitive",
  },
  {
    predicate: (n) => /^vitality core augment/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "Vitality block (explicit canonical example)",
  },
  {
    predicate: (n, c) => c === "SHEET_AUGMENT" && /(attribute increment|focused presence|precise vector|defensive save upgrade)/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "Sheet baseline metric",
  },
  {
    predicate: (n, c) => c === "PRACTICE_PROGRESSION_AUGMENT" &&
      /(practice proficiency|reliable practice|expertise upgrade|broad familiarity)/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "Practice modifier (broad vector)",
  },
  // Focused Edge is a NARROW permit ("gain advantage on a
  // narrative focus"), not a numerical modifier on the practice
  // itself. Permission-Vector. NOT mirrorable.
  {
    predicate: (n) => /^focused edge/i.test(n),
    isMirrorable: false,
    mirrorVector: null,
    reason: "Focused Edge is a narrow advantage permit, not a metric",
  },
  {
    predicate: (n, c) => c === "PROBABILITY_BIAS" && !/causal override/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "Probability bias / narrative ±",
  },
  // Causal Override (Tier IV Probability) — user said NO mirror.
  {
    predicate: (n) => /causal override/i.test(n),
    isMirrorable: false,
    mirrorVector: null,
    reason: "Causal Override is exempt from mirror per user override",
  },
  {
    predicate: (n, c) => c === "ACTION_ECONOMY" && /(reaction reflex|reaction pulse|clash dominance|interceptive priority)/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "Reaction slot numbers / clash roll (numerical vectors)",
  },
  // Reaction Slot raw expansions (e.g. a "+1 Reaction Slot"
  // primitive): those are Permission Vector system bypasses.
  // We have no row currently named exactly that, but if a new
  // row matches we leave it unmirrored.
  {
    predicate: (n) => /(^|\s)\+1\s+reaction\s+slot/i.test(n),
    isMirrorable: false,
    mirrorVector: null,
    reason: "Reaction slot is a system bypass (permission vector)",
  },
  {
    predicate: (n, c) => c === "MOBILITY_LOCOMOTION" && /stride extension/i.test(n),
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    reason: "Stride Extension (movement speed metric, explicit canonical)",
  },
  // ---- STRUCTURAL_FAULT (mirrorable: structural defensive) ----
  {
    predicate: (n, c) => c === "DEFENSIVE" && /(hardening|firewall|shield|aegis|insulation|bulwark|warding)/i.test(n),
    isMirrorable: true,
    mirrorVector: "STRUCTURAL_FAULT",
    reason: "defensive row -> its corresponding vulnerability twin",
  },
  // Some defensive rows in the seed are explicitly named as
  // "Domain Resistance" / "Domain Immunity" — also mirrorable.
  {
    predicate: (n, c) => c === "DEFENSIVE" && /(resistance|immunity)/i.test(n),
    isMirrorable: true,
    mirrorVector: "STRUCTURAL_FAULT",
    reason: "Damage resistance / immunity -> vulnerability twin",
  },
  // ---- COST_INSTABILITY (mirrorable: strain/cost buffers) ----
  {
    predicate: (n, c) => c === "EVALUATION_STRAIN" &&
      /(heuristic buffer|vitality shielding|systemic sink|condition insulation|hazard transmutation|narrative pivot|cv matrix trap|volatile vent|domain lock shield)/i.test(n),
    isMirrorable: true,
    mirrorVector: "COST_INSTABILITY",
    reason: "Strain / cost buffer mirrors into unstable form",
  },
  // Eval rows that aren't in the canonical mirror list
  // (e.g. stress transducers, environment hazard creators) —
  // leave alone by default.
  // ---- VITALITY (Stabilize/Last Breath/Tether) — NOT mirrorable ----
  {
    predicate: (_n, c) => c === "VITALITY",
    isMirrorable: false,
    mirrorVector: null,
    reason: "VITALITY primitives are different primitives, not mirrors (user override)",
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
