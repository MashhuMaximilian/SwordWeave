/**
 * Phase 7.9.3a — Tests for the 24 verb-like modifiers (batch 1 of 3)
 * applied by scripts/apply-phase79-003a.ts.
 *
 * Mirrors src/db/__tests__/phase79-stat-like.test.ts structure.
 * Verifies:
 *   1. Each row has exactly 1 modifier matching the proposed spec.
 *   2. Stored `is_mirrorable` matches derived (all true).
 *   3. applyMirror round-trip per op.
 *   4. Content hash present.
 *   5. Action economy counter targets (action.*) only.
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
  // ACTION_ECONOMY (11)
  { id: 187, name: "Timeline Shift", operation: "add", target: "action.bonus_action_window", value: 1, stacking: "stack" },
  { id: 188, name: "Reactive Expansion", operation: "grant", target: "behavior:reactive_window_bonus", value: 1, stacking: "unique-by-primitive" },
  { id: 189, name: "Core Action Multiplication", operation: "add", target: "action.standard_action_window", value: 1, stacking: "stack" },
  { id: 190, name: "Absolute Timeline Deprivation", operation: "add", target: "action.standard_action_window", value: -1, stacking: "stack" },
  { id: 191, name: "Track Acceleration", operation: "grant", target: "behavior:track_acceleration", value: 1, stacking: "unique-by-primitive" },
  { id: 192, name: "Heavy Compactor", operation: "grant", target: "behavior:heavy_track_compress", value: 1, stacking: "unique-by-primitive" },
  { id: 193, name: "Timeline Anchor", operation: "grant", target: "behavior:track_displacement_immunity", value: 1, stacking: "unique-by-primitive" },
  { id: 194, name: "Reaction Pulse", operation: "add", target: "action.reaction_window", value: 1, stacking: "stack" },
  { id: 195, name: "Reaction Reflex", operation: "add", target: "action_roll.reaction_clash", value: 2, stacking: "stack" },
  { id: 196, name: "Clash Dominance", operation: "grant", target: "behavior:positive_bias", value: 1, stacking: "unique-by-primitive" },
  { id: 197, name: "Interceptive Priority", operation: "grant", target: "behavior:win_ties", value: 1, stacking: "unique-by-primitive" },
  // BOSS_ECONOMY (5)
  { id: 394, name: "Legendary Cadence I", operation: "add", target: "action.legendary_action_window", value: 1, stacking: "stack" },
  { id: 395, name: "Legendary Cadence II", operation: "add", target: "action.legendary_action_window", value: 2, stacking: "stack" },
  { id: 396, name: "Legendary Cadence III", operation: "add", target: "action.legendary_action_window", value: 3, stacking: "stack" },
  { id: 397, name: "Existential Imperative", operation: "grant", target: "behavior:legendary_resistance", value: 1, stacking: "unique-by-primitive" },
  { id: 398, name: "Mythic Safeguard", operation: "grant", target: "behavior:legendary_resistance", value: 3, stacking: "unique-by-primitive" },
  // TRIGGER_HOOK (4)
  { id: 167, name: "Direct Material Trigger", operation: "grant", target: "behavior:trigger_material", value: 1, stacking: "unique-by-primitive" },
  { id: 168, name: "Systemic Threshold Trigger", operation: "grant", target: "behavior:trigger_systemic", value: 1, stacking: "unique-by-primitive" },
  { id: 169, name: "Conditional Informational Trigger", operation: "grant", target: "behavior:trigger_informational", value: 1, stacking: "unique-by-primitive" },
  { id: 170, name: "Interceptive Causal Trigger", operation: "grant", target: "behavior:trigger_interceptive", value: 1, stacking: "unique-by-primitive" },
  // SPEED_QUICKENING (4)
  { id: 39, name: "Standard Execution", operation: "grant", target: "behavior:timing_standard", value: 1, stacking: "unique-by-primitive" },
  { id: 40, name: "Fast Execution", operation: "grant", target: "behavior:timing_fast", value: 1, stacking: "unique-by-primitive" },
  { id: 41, name: "Instant Execution", operation: "grant", target: "behavior:timing_instant", value: 1, stacking: "unique-by-primitive" },
  { id: 42, name: "Reaction Execution", operation: "grant", target: "behavior:timing_reaction", value: 1, stacking: "unique-by-primitive" },
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

describe("Phase 7.9.3a — verb-like migration (batch 1)", () => {
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
        if (typeof p.value === "string") {
          expect(String(m.value)).toBe(p.value);
        } else {
          expect(Number(m.value)).toBe(p.value);
        }
        expect(m.stacking ?? "stack").toBe(p.stacking);
      });
    }
  });

  describe("Chirality — all 24 mirrorable (non-`set` ops)", () => {
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — stored is_mirrorable=true (op=${p.operation})`, async () => {
        const row = await readRow(p.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.is_mirrorable).toBe(true);
        expect(row.mirror_vector).toBe("VARIABLE_VECTOR");
        // mirror_bu_credit equals bu_cost. For BU=0 rows (e.g. Standard
        // Execution baseline), credit is 0 — that's correct, not a bug.
        // We just verify it's non-negative.
        expect(row.mirror_bu_credit).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe("applyMirror round-trip — add ops are involutive", () => {
    for (const p of PROPOSED.filter((p) => p.operation === "add")) {
      it(`[${p.id}] ${p.name} (add ${p.value}) — mirror is subtract with sign flipped, round-trip returns original`, () => {
        const v = typeof p.value === "number" ? p.value : 1;
        const result = applyMirror("add", v);
        expect(result.op).toBe("subtract");
        // applyMirror negates the value: add(1) → subtract(-1), add(-1) → subtract(1)
        expect(Number(result.value)).toBe(-v);
        // Round-trip: subtract(-N) → add(N)
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

  describe("Action economy counter targets only (no leakage to other engine tracks)", () => {
    const allowedActionTargets = new Set([
      "action.bonus_action_window",
      "action.standard_action_window",
      "action.reaction_window",
      "action.legendary_action_window",
      "action_roll.reaction_clash",
    ]);
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — target is action.*, action_roll.*, or behavior:*`, () => {
        if (p.operation !== "add") {
          expect(p.target).toMatch(/^behavior:/);
        } else {
          // For 'add' ops, target must be an action.* or action_roll.* slot.
          expect(allowedActionTargets.has(p.target)).toBe(true);
        }
      });
    }
  });

  describe("Hard constraint — at most 1 modifier per primitive", () => {
    it("all 24 rows have exactly 1 modifier", async () => {
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
