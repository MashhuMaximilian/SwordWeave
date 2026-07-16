/**
 * Phase 7.9.3b — Tests for the 14 spatial modifiers applied by
 * scripts/apply-phase79-003b.ts.
 *
 *   TACTICAL (4) — cover tier primitives
 *   TARGETING_AOE (10) — area effect primitives
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
  // TACTICAL (4)
  { id: 849, name: "Minor Obstruction (Cover Tier I)", operation: "add", target: "action.roll", value: -2, stacking: "stack" },
  { id: 850, name: "Half Cover (Cover Tier II)", operation: "add", target: "action.roll", value: -4, stacking: "stack" },
  { id: 851, name: "Total Cover (Cover Tier III)", operation: "grant", target: "behavior:cover_total", value: 1, stacking: "unique-by-primitive" },
  { id: 852, name: "Spatial Anchor Cover (Cover Tier IV)", operation: "grant", target: "behavior:cover_spatial_anchor", value: 1, stacking: "unique-by-primitive" },
  // TARGETING_AOE (10)
  { id: 224, name: "Bouncing Vector", operation: "grant", target: "behavior:bouncing_vector", value: 1, stacking: "unique-by-primitive" },
  { id: 225, name: "Collateral Buffer", operation: "grant", target: "behavior:collateral_filter", value: 1, stacking: "unique-by-primitive" },
  { id: 226, name: "Selective Focus", operation: "grant", target: "behavior:selective_focus", value: 1, stacking: "unique-by-primitive" },
  { id: 227, name: "Linear / Conical Vector", operation: "grant", target: "behavior:shape_linear_conical", value: 1, stacking: "unique-by-primitive" },
  { id: 228, name: "Kinetic Sphere", operation: "grant", target: "behavior:shape_sphere_burst", value: 1, stacking: "unique-by-primitive" },
  { id: 229, name: "Stationary Zone", operation: "grant", target: "behavior:zone_stationary", value: 1, stacking: "unique-by-primitive" },
  { id: 230, name: "Mobile Aura", operation: "grant", target: "behavior:zone_mobile", value: 1, stacking: "unique-by-primitive" },
  { id: 231, name: "Structural Wall", operation: "grant", target: "behavior:shape_wall", value: 1, stacking: "unique-by-primitive" },
  { id: 232, name: "Volume Scaling I", operation: "add", target: "action.areaSize", value: 1, stacking: "stack" },
  { id: 233, name: "Global Field", operation: "grant", target: "behavior:field_global", value: 1, stacking: "unique-by-primitive" },
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

describe("Phase 7.9.3b — spatial migration", () => {
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

  describe("Chirality — all 14 mirrorable (non-`set` ops)", () => {
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

  describe("applyMirror round-trip — add ops are involutive", () => {
    for (const p of PROPOSED.filter((p) => p.operation === "add")) {
      it(`[${p.id}] ${p.name} (add ${p.value}) — mirror subtracts, round-trip returns original`, () => {
        const v = Number(p.value);
        const result = applyMirror("add", v);
        expect(result.op).toBe("subtract");
        expect(Number(result.value)).toBe(-v);
        // Round-trip
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

  describe("Cover-tier mirror semantics — penalty vs exposed", () => {
    it("Cover I mirror flips -2 to +2 (EXPOSED, Vulnerability Inverse)", () => {
      const once = applyMirror("add", -2);
      expect(once).toEqual({ op: "subtract", value: 2 });
    });
    it("Cover II mirror flips -4 to +4 (EXPOSED, Vulnerability Inverse)", () => {
      const once = applyMirror("add", -4);
      expect(once).toEqual({ op: "subtract", value: 4 });
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

  describe("Target slot constraints — spatial primitives", () => {
    // Cover I/II and Volume Scaling I use action.* slots.
    // All others use behavior:*.
    const actionSlotTargets = new Set(["action.roll", "action.areaSize"]);
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — target is action.* or behavior:*`, () => {
        if (p.operation === "add") {
          expect(actionSlotTargets.has(p.target)).toBe(true);
        } else {
          expect(p.target).toMatch(/^behavior:/);
        }
      });
    }
  });

  describe("Hard constraint — at most 1 modifier per primitive", () => {
    it("all 14 rows have exactly 1 modifier", async () => {
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
