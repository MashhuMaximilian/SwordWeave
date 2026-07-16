/**
 * Phase 7.9.3d — Tests for the 8 heavy modifiers (Metamorphosis + Agency Override)
 * applied by scripts/apply-phase79-003d.ts.
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
  // METAMORPHOSIS (4)
  { id: 183, name: "Composition Tuning", operation: "grant", target: "behavior:composition_tuning", value: 1, stacking: "unique-by-primitive" },
  { id: 184, name: "Volumetric Scale Shift", operation: "grant", target: "behavior:volumetric_scale_shift", value: 1, stacking: "unique-by-primitive" },
  { id: 185, name: "State Transmutation", operation: "grant", target: "behavior:state_transmutation", value: 1, stacking: "unique-by-primitive" },
  { id: 186, name: "Polymorphic Template Overwrite", operation: "grant", target: "behavior:template_overwrite", value: 1, stacking: "unique-by-primitive" },
  // AGENCY_OVERRIDE (4)
  { id: 179, name: "Impulse Nudge / Point Transmission", operation: "grant", target: "behavior:impulse_injection", value: 1, stacking: "unique-by-primitive" },
  { id: 180, name: "Behavioral Directive / Data Trace Masking", operation: "grant", target: "behavior:behavioral_directive", value: 1, stacking: "unique-by-primitive" },
  { id: 181, name: "Direct Executive Override / Matrix Redaction", operation: "grant", target: "behavior:executive_override", value: 1, stacking: "unique-by-primitive" },
  { id: 182, name: "Existential Allegiance Bind / Informational Absolutism", operation: "grant", target: "behavior:allegiance_bind", value: 1, stacking: "unique-by-primitive" },
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

describe("Phase 7.9.3d — heavy migration (metamorphosis + agency override)", () => {
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

  describe("Chirality — all 8 mirrorable (non-`set` ops)", () => {
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

  describe("applyMirror round-trip — grant ops → revoke", () => {
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} (grant) — mirror is revoke (Vulnerability Inverse: capability removed)`, () => {
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

  describe("Target slot constraints — all behavior:* (capability flags)", () => {
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — target is behavior:*`, () => {
        expect(p.target).toMatch(/^behavior:/);
      });
    }
  });

  describe("Hard constraint — at most 1 modifier per primitive", () => {
    it("all 8 rows have exactly 1 modifier", async () => {
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
