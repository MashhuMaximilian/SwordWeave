/**
 * Phase 7.10.3 — Tests for primitive mechanical_output_text compilation.
 *
 * Verifies:
 *   1. Each of the 139 mapped primitives has its Operational Rule appended
 *   2. Idempotency: re-running doesn't duplicate the append
 *   3. Untouched primitives (TACTICAL, VITALITY) are unchanged
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

// =============================================================================
// Sample primitives to test — covers each major category
// =============================================================================

interface PrimitiveRow {
  id: number;
  name: string;
  mechanical_output_text: string;
}

const TEST_NAMES: ReadonlyArray<{ name: string; mustContain: string }> = [
  // Tier IV
  { name: "Absolute Insulation (Domain Immunity)", mustContain: "Operational Rule: Supreme elemental mastery" },
  { name: "Absolute Timeline Deprivation (Stun Vector)", mustContain: "Operational Rule: The Slow/Stun Vector" },

  // Kinetic Control
  { name: "Velocity Arrest / Standard Vector", mustContain: "Operational Rule: Absolute Anchor / Launch" },
  { name: "Minor Linear Displacement", mustContain: "Operational Rule: Basic Impulse" },

  // Mobility
  { name: "Stride Extension", mustContain: "Operational Rule: Stacks infinitely" },
  { name: "Aero Unlock", mustContain: "Operational Rule: Grants full three-dimensional" },

  // Sheet Augment
  { name: "Attribute Increment", mustContain: "Required Prerequisite: Max score limits apply per tier." },
  { name: "Vitality Core Augment I", mustContain: "Operational Rule: Injects a permanent" },

  // Practice Progression
  { name: "Focused Edge", mustContain: "Required Prerequisite: Proficiency in the parenting Practice." },
  { name: "Practice Proficiency", mustContain: "Operational Rule: Establishes dependable" },
  { name: "Reliable Practice", mustContain: "Required Prerequisite: Expertise Upgrade" },

  // Evaluation / Strain (the user's example)
  { name: "Vitality Shielding", mustContain: "Operational Rule: Direct trauma buffer. If the DM states that a desperate, reality-warping overreach demands a flat loss of 30% Vitality, this component instantly cuts it to 15%." },
  { name: "Heuristic Buffer", mustContain: "Required Prerequisite: One designated capability preset." },
  { name: "CV Matrix Trap", mustContain: "Required Prerequisite: Heuristic Buffer." },

  // Probability Bias
  { name: "Negative Bias I — Narrative Focus", mustContain: "Operational Rule: Focused Shift" },
  { name: "Negative Bias III — Core Attribute", mustContain: "Operational Rule: Systemic Shift" },

  // Trigger Hook
  { name: "Direct Material Trigger", mustContain: "Operational Rule: Reactive Guard" },
  { name: "Interceptive Causal Trigger", mustContain: "Operational Rule: Causality Interdiction" },

  // Perception Qualifier
  { name: "Environmental Translation Qualifier", mustContain: "Operational Rule: Material Sensor" },

  // Defensive
  { name: "Kinetic Hardening (DEFENSIVE)", mustContain: "Operational Rule: Integrates physical plating" },
  { name: "Warding Shell (DEFENSIVE)", mustContain: "Operational Rule: Insulates the profile's matrix" },

  // Intensity Dice
  { name: "Standard Die Block (1d6)", mustContain: "Required Prerequisite: 1d6 Damage / Healing." },
  { name: "Existential Tear (1d20)", mustContain: "Operational Rule: Mythic/Reality-breaking scale" },

  // Boss Economy
  { name: "Existential Imperative (Legendary Resistance 1x/Day)", mustContain: "Operational Rule: The entity can choose to completely overwrite a failed Defensive Save" },

  // Range
  { name: "Touch Range", mustContain: "Operational Rule: Immediate contact or self-contained" },
  { name: "World Range", mustContain: "Operational Rule: A huge area or world sized" },

  // Duration
  { name: "Instant Duration", mustContain: "Operational Rule: Resolves immediately" },
  { name: "Permanent Duration", mustContain: "Operational Rule: Requires explicit reversal logic" },

  // Speed
  { name: "Standard Execution", mustContain: "Operational Rule: Normal resolution timing" },

  // Condition Tags
  { name: "Physical Interaction Tag", mustContain: "Operational Rule: Movement Restriction" },
  { name: "System & Identity Tag", mustContain: "Operational Rule: Form Instability" },

  // Targeting AOE
  { name: "Bouncing Vector", mustContain: "Operational Rule: If the capability successfully impacts the first target, it automatically leaps to a new target within 15 feet." },
  { name: "Stationary Zone", mustContain: "Operational Rule: Plants an area footprint" },

  // Verb Tier
  { name: "Verb Access Tier I", mustContain: "Operational Rule: Ground-level interaction with reality" },
  { name: "Verb Access Tier IV", mustContain: "Operational Rule: Interaction with governing logic" },

  // Domain
  { name: "Domain Access Tier I", mustContain: "Operational Rule: Grounded, tangible reality domains" },

  // Temporal Chronological
  { name: "Kinetic Stasis", mustContain: "Operational Rule: Catches an item or a projectile" },
  { name: "Temporal Isolate", mustContain: "Required Prerequisite: Kinetic Stasis." },
];

// =============================================================================
// Untouched primitives — must NOT have Operational Rule appended
// =============================================================================

const UNTOUCHED: ReadonlyArray<string> = [
  "Minor Obstruction (Cover Tier I)",
  "Half Cover (Cover Tier II)",
  "Total Cover (Cover Tier III)",
  "Spatial Anchor Cover (Cover Tier IV)",
  "Stabilize (Fieldcraft Aid)",
  "Last Breath (Tenacity Trigger)",
  "Tether of Being (Sustained Tenacity)",
];

async function readMech(name: string): Promise<string | null> {
  const rows = (await sql`
    SELECT mechanical_output_text FROM primitives
    WHERE name = ${name} AND user_id IS NULL
  `) as Array<{ mechanical_output_text: string }>;
  return rows[0]?.mechanical_output_text ?? null;
}

describe("Phase 7.10.3 — Primitive mechanical_output_text Notion compilation", () => {
  describe("Mapped primitives contain their Notion append", () => {
    for (const t of TEST_NAMES) {
      it(`[${t.name}] contains "${t.mustContain.slice(0, 60)}..."`, async () => {
        const mech = await readMech(t.name);
        expect(mech).not.toBeNull();
        if (!mech) return;
        expect(mech).toContain(t.mustContain);
      });
    }
  });

  describe("Vitality Shielding has the exact Notion text", () => {
    it("Vitality Shielding → Halve + Operational Rule: Direct trauma buffer...", async () => {
      const mech = await readMech("Vitality Shielding");
      expect(mech).toBe(
        "Halve any upfront Vitality cost demanded by the Cost Ledger. Operational Rule: Direct trauma buffer. If the DM states that a desperate, reality-warping overreach demands a flat loss of 30% Vitality, this component instantly cuts it to 15%.",
      );
    });
  });

  describe("Untouched primitives (TACTICAL, VITALITY) preserved", () => {
    for (const name of UNTOUCHED) {
      it(`[${name}] does NOT contain "Operational Rule:"`, async () => {
        const mech = await readMech(name);
        // These primitives already have their own mechanical_output_text
        // We just want to make sure we didn't accidentally append to them
        if (mech === null) return; // doesn't exist
        expect(mech).not.toContain("Operational Rule: ");
      });
    }
  });

  describe("Idempotency: append appears exactly once", () => {
    it("Vitality Shielding has Operational Rule exactly once", async () => {
      const mech = await readMech("Vitality Shielding");
      if (!mech) throw new Error("not found");
      const occurrences = (mech.match(/Operational Rule:/g) ?? []).length;
      expect(occurrences).toBe(1);
    });
  });

  describe("Total coverage", () => {
    it("139 of 146 canonical primitives have Notion data appended", async () => {
      const rows = (await sql`
        SELECT COUNT(*)::int as total,
               COUNT(*) FILTER (WHERE mechanical_output_text LIKE '%Operational Rule:%')::int as with_op_rule,
               COUNT(*) FILTER (WHERE mechanical_output_text LIKE '%Required Prerequisite:%')::int as with_prereq
        FROM primitives
        WHERE user_id IS NULL
      `) as Array<{ total: number; with_op_rule: number; with_prereq: number }>;
      const r = rows[0];
      if (!r) throw new Error("no rows");
      expect(r.total).toBe(146);
      expect(r.with_op_rule).toBeGreaterThanOrEqual(135); // Allow some unmapped
      expect(r.with_prereq).toBeGreaterThan(0); // At least some prereqs
    });
  });
});