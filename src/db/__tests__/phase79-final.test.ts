/**
 * Phase 7.9.3e+f+g — Tests for the 18 final modifiers applied by
 * scripts/apply-phase79-003ef.ts (15 rows) and apply-phase79-003g.ts
 * (3 VITALITY rows). Closes Phase 7.9.
 *
 *   PROBABILITY_BIAS (4) — Positive Bias I/II/III + Causal Override
 *   EVALUATION_STRAIN (8) — strain mitigation
 *   SHEET_AUGMENT (3) — final sheet augments
 *   VITALITY (3) — trigger-based vitality preservation
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";
import { applyMirror } from "@/types/modifier";
import type { HardModifier } from "@/types/swordweave";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

interface Proposed {
  readonly id: number;
  readonly name: string;
  readonly operation: HardModifier["operation"];
  readonly target: string;
  readonly value: number | string;
  readonly stacking: string;
}

const PROPOSED: ReadonlyArray<Proposed> = [
  // PROBABILITY_BIAS (4)
  { id: 160, name: "Positive Bias I — Narrative Focus", operation: "grant", target: "behavior:positive_bias", value: 1, stacking: "unique-by-primitive" },
  { id: 162, name: "Positive Bias II — Named Practice", operation: "grant", target: "behavior:positive_bias", value: 1, stacking: "unique-by-primitive" },
  { id: 164, name: "Positive Bias III — Core Attribute", operation: "grant", target: "behavior:positive_bias", value: 1, stacking: "unique-by-primitive" },
  { id: 166, name: "Causal Override (Fate Replacement)", operation: "grant", target: "behavior:causal_override", value: 1, stacking: "unique-by-primitive" },
  // EVALUATION_STRAIN (8)
  { id: 198, name: "Heuristic Buffer", operation: "add", target: "action.strain", value: -1, stacking: "stack" },
  { id: 199, name: "Systemic Sink", operation: "add", target: "action.strain", value: -2, stacking: "stack" },
  { id: 200, name: "Volatile Vent", operation: "grant", target: "behavior:strain_vent", value: 1, stacking: "unique-by-primitive" },
  { id: 202, name: "Condition Insulation", operation: "grant", target: "behavior:strain_condition_insulation", value: 1, stacking: "unique-by-primitive" },
  { id: 203, name: "Domain Lock Shield", operation: "grant", target: "behavior:strain_domain_lock_shield", value: 1, stacking: "unique-by-primitive" },
  { id: 204, name: "Hazard Transmutation", operation: "grant", target: "behavior:strain_hazard_transmutation", value: 1, stacking: "unique-by-primitive" },
  { id: 205, name: "Narrative Pivot", operation: "grant", target: "behavior:strain_narrative_pivot", value: 1, stacking: "unique-by-primitive" },
  { id: 206, name: "CV Matrix Trap", operation: "grant", target: "behavior:strain_matrix_trap", value: 1, stacking: "unique-by-primitive" },
  // SHEET_AUGMENT (3)
  { id: 55, name: "Defensive Save Upgrade", operation: "grant", target: "behavior:saving_throw_proficiency", value: 1, stacking: "unique-by-primitive" },
  { id: 64, name: "Focused Presence (Global DC Modifier)", operation: "grant", target: "behavior:global_dc_modifier", value: 1, stacking: "unique-by-primitive" },
  { id: 65, name: "Precise Vector Alignment (Global Attack Modifier)", operation: "add", target: "action.roll", value: 1, stacking: "stack" },
  // VITALITY (3) — 7.9.3g coda
  { id: 853, name: "Stabilize (Fieldcraft Aid)", operation: "grant", target: "behavior:stabilize_capable", value: 1, stacking: "unique-by-primitive" },
  { id: 854, name: "Last Breath (Tenacity Trigger)", operation: "grant", target: "behavior:tenacity_trigger_1", value: 1, stacking: "unique-by-primitive" },
  { id: 855, name: "Tether of Being (Sustained Tenacity)", operation: "grant", target: "behavior:tenacity_persistent", value: 1, stacking: "unique-by-primitive" },
];

interface Row {
  id: number;
  name: string;
  is_mirrorable: boolean;
  mirror_vector: string;
  mirror_bu_credit: number;
  hard_modifiers: unknown;
  content_hash: string | null;
}

async function readRow(id: number): Promise<Row | null> {
  const rows = (await sql`
    SELECT id, name, is_mirrorable, mirror_vector::text as mirror_vector,
           mirror_bu_credit, hard_modifiers, content_hash
    FROM primitives WHERE id = ${id}
  `) as Row[];
  return rows[0] ?? null;
}

describe("Phase 7.9.3e+f+g — final migration (closes Phase 7.9)", () => {
  describe("DB shape per row", () => {
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — exactly 1 modifier, matches spec`, async () => {
        const row = await readRow(p.id);
        expect(row).not.toBeNull();
        if (!row) return;
        const mods = Array.isArray(row.hard_modifiers)
          ? (row.hard_modifiers as HardModifier[])
          : [];
        expect(mods).toHaveLength(1);
        const m = mods[0]!;
        expect(m.target).toBe(p.target);
        expect(m.operation).toBe(p.operation);
        expect(Number(m.value)).toBe(Number(p.value));
        expect(m.stacking ?? "stack").toBe(p.stacking);
      });
    }
  });

  describe("Chirality — all 15 mirrorable (non-`set` ops)", () => {
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — stored is_mirrorable=true (op=${p.operation})`, async () => {
        const row = await readRow(p.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.is_mirrorable).toBe(true);
        expect(row.mirror_vector).toBe("VARIABLE_VECTOR");
        expect(row.mirror_bu_credit).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe("applyMirror round-trip", () => {
    for (const p of PROPOSED.filter((p) => p.operation === "add")) {
      it(`[${p.id}] ${p.name} (add ${p.value}) — mirror subtracts, round-trip returns original`, () => {
        const v = Number(p.value);
        const result = applyMirror("add", v);
        expect(result.op).toBe("subtract");
        expect(Number(result.value)).toBe(-v);
        const twice = applyMirror(result.op, result.value);
        expect(twice).toEqual({ op: "add", value: v });
      });
    }
    for (const p of PROPOSED.filter((p) => p.operation === "grant")) {
      it(`[${p.id}] ${p.name} (grant) — mirror is revoke`, () => {
        const result = applyMirror("grant", 1);
        expect(result.op).toBe("revoke");
      });
    }
  });

  describe("Vulnerability Inverse — strain buffers and accuracy", () => {
    it("[198] Heuristic Buffer -1 strain mirror flips to +1 (extra strain)", () => {
      const once = applyMirror("add", -1);
      expect(once).toEqual({ op: "subtract", value: 1 });
    });
    it("[199] Systemic Sink -2 strain mirror flips to +2 (extra strain)", () => {
      const once = applyMirror("add", -2);
      expect(once).toEqual({ op: "subtract", value: 2 });
    });
    it("[65] Precise Vector +1 attack mirror flips to -1 (Inaccuracy)", () => {
      const once = applyMirror("add", 1);
      expect(once).toEqual({ op: "subtract", value: -1 });
    });
  });

  describe("Content hash present", () => {
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — content_hash is 64-char hex`, async () => {
        const row = await readRow(p.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.content_hash).not.toBeNull();
        expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
      });
    }
  });

  describe("Target slot constraints", () => {
    // Add ops target action.strain or action.roll.
    // Grant ops target behavior:*.
    const addTargets = new Set(["action.strain", "action.roll"]);
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — target is action.{strain,roll} or behavior:*`, () => {
        if (p.operation === "add") {
          expect(addTargets.has(p.target)).toBe(true);
        } else {
          expect(p.target).toMatch(/^behavior:/);
        }
      });
    }
  });

  describe("Hard constraint — at most 1 modifier per primitive", () => {
    it("all 18 rows have exactly 1 modifier", async () => {
      for (const p of PROPOSED) {
        const row = await readRow(p.id);
        const mods = Array.isArray(row?.hard_modifiers)
          ? (row!.hard_modifiers as unknown[])
          : [];
        expect(mods).toHaveLength(1);
      }
    });
  });
});
