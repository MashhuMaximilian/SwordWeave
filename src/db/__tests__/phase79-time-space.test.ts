/**
 * Phase 7.9.3c — Tests for the 11 time/space modifiers applied by
 * scripts/apply-phase79-003c.ts.
 *
 *   KINETIC_CONTROL (4) — displacement/lock primitives
 *   TEMPORAL_CHRONOLOGICAL (7) — delay/duration/stasis primitives
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
  // KINETIC_CONTROL (4)
  { id: 175, name: "Minor Linear Displacement", operation: "add", target: "character.movement.land", value: -15, stacking: "stack" },
  { id: 176, name: "Velocity Arrest / Standard Vector", operation: "grant", target: "behavior:velocity_lock", value: 1, stacking: "unique-by-primitive" },
  { id: 177, name: "Advanced Vector Manipulation", operation: "grant", target: "behavior:kinetic_lock_absolute", value: 1, stacking: "unique-by-primitive" },
  { id: 178, name: "Systemic Kinetic Override", operation: "grant", target: "behavior:kinetic_override_capable", value: 1, stacking: "unique-by-primitive" },
  // TEMPORAL_CHRONOLOGICAL (7)
  { id: 207, name: "Chronological Echo", operation: "grant", target: "behavior:delayed_resolution", value: 1, stacking: "unique-by-primitive" },
  { id: 208, name: "Dormant Trigger Hook", operation: "grant", target: "behavior:capability_dormant", value: 1, stacking: "unique-by-primitive" },
  { id: 209, name: "Timeline Tether", operation: "grant", target: "behavior:chronological_immunity", value: 1, stacking: "unique-by-primitive" },
  { id: 210, name: "Duration Anchor", operation: "grant", target: "behavior:duration_freeze", value: 1, stacking: "unique-by-primitive" },
  { id: 211, name: "Perpetual Lock", operation: "grant", target: "behavior:duration_persistent", value: 1, stacking: "unique-by-primitive" },
  { id: 212, name: "Kinetic Stasis", operation: "grant", target: "behavior:kinetic_stasis_object", value: 1, stacking: "unique-by-primitive" },
  { id: 213, name: "Temporal Isolate", operation: "grant", target: "behavior:temporal_stasis_entity", value: 1, stacking: "unique-by-primitive" },
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

describe("Phase 7.9.3c — time/space migration", () => {
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

  describe("Chirality — all 11 mirrorable (non-`set` ops)", () => {
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

  describe("Vulnerability Inverse — Minor Linear Displacement", () => {
    it("[175] -15 speed mirror flips to +15 (Sprint, Vulnerability Inverse)", () => {
      const once = applyMirror("add", -15);
      expect(once).toEqual({ op: "subtract", value: 15 });
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
    // Only Minor Linear Displacement uses an `add` op. All others use
    // behavior:* flags.
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — target is character.movement.land or behavior:*`, () => {
        if (p.operation === "add") {
          expect(p.target).toBe("character.movement.land");
        } else {
          expect(p.target).toMatch(/^behavior:/);
        }
      });
    }
  });

  describe("Hard constraint — at most 1 modifier per primitive", () => {
    it("all 11 rows have exactly 1 modifier", async () => {
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
