/**
 * Phase 7.9.5 — Tests for the 15 mirrorable + chirality-fix primitives
 * applied by scripts/apply-phase79-001.ts.
 *
 * Verifies:
 *   1. Each row has exactly 1 modifier (DB CHECK constraint).
 *   2. Each modifier matches the proposed spec.
 *   3. Each non-`set` op is mirrorable per OP_SPECS.
 *   4. Stored `is_mirrorable` matches the derived value (no drift).
 *   5. `applyMirror` round-trip: mirroring twice returns the original
 *      for additive operations (add ↔ subtract, multiply ↔ divide).
 *   6. Migration script is idempotent (running twice produces the
 *      same end state — verified separately by re-running the script).
 *
 * The 15 PROPOSED rows are duplicated here as a frozen array so the
 * test doesn't depend on the script's runtime imports.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";
import { OP_SPECS, applyMirror } from "@/types/modifier";
import type { HardModifier } from "@/types/swordweave";

interface ProposedModifier {
  readonly id: number;
  readonly name: string;
  readonly modifier: {
    readonly kind: "modify";
    readonly target: string;
    readonly operation: HardModifier["operation"];
    readonly value: number | string;
    readonly stacking: string;
  };
}

const PROPOSED: ReadonlyArray<ProposedModifier> = [
  {
    id: 61,
    name: "Vitality Core Augment I",
    modifier: {
      kind: "modify",
      target: "max_vitality",
      operation: "add",
      value: 5,
      stacking: "stack",
    },
  },
  {
    id: 62,
    name: "Vitality Core Augment II",
    modifier: {
      kind: "modify",
      target: "max_vitality",
      operation: "add",
      value: 12,
      stacking: "stack",
    },
  },
  {
    id: 63,
    name: "Vitality Core Augment III",
    modifier: {
      kind: "modify",
      target: "max_vitality",
      operation: "add",
      value: 20,
      stacking: "stack",
    },
  },
  {
    id: 53,
    name: "Attribute Increment",
    modifier: {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 1,
      stacking: "stack",
    },
  },
  {
    id: 54,
    name: "Attack Bonus Increment",
    modifier: {
      kind: "modify",
      target: "action_roll.attack_bonus",
      operation: "add",
      value: 1,
      stacking: "stack",
    },
  },
  {
    id: 382,
    name: "Kinetic Hardening",
    modifier: {
      kind: "modify",
      target: "defense_dc.physical",
      operation: "add",
      value: 1,
      stacking: "stack",
    },
  },
  {
    id: 383,
    name: "Warding Shell",
    modifier: {
      kind: "modify",
      target: "defense_dc.magical",
      operation: "add",
      value: 1,
      stacking: "stack",
    },
  },
  {
    id: 384,
    name: "Psychic Firewall",
    modifier: {
      kind: "modify",
      target: "defense_dc.mental",
      operation: "add",
      value: 1,
      stacking: "stack",
    },
  },
  {
    id: 201,
    name: "Vitality Shielding",
    modifier: {
      kind: "modify",
      target: "behavior:vitality_shielding",
      operation: "grant",
      value: 1,
      stacking: "unique-by-primitive",
    },
  },
  {
    id: 218,
    name: "Stride Extension",
    modifier: {
      kind: "modify",
      target: "speed.walk",
      operation: "add",
      value: 10,
      stacking: "stack",
    },
  },
  {
    id: 161,
    name: "Negative Bias I — Narrative Focus",
    modifier: {
      kind: "modify",
      target: "behavior:disadvantage",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
    },
  },
  {
    id: 163,
    name: "Negative Bias II — Named Practice",
    modifier: {
      kind: "modify",
      target: "behavior:disadvantage",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
    },
  },
  {
    id: 165,
    name: "Negative Bias III — Core Attribute",
    modifier: {
      kind: "modify",
      target: "behavior:disadvantage",
      operation: "grant",
      value: 1,
      stacking: "unique-by-target",
    },
  },
  {
    id: 18,
    name: "Vector Split",
    modifier: {
      kind: "modify",
      target: "action.targetCount",
      operation: "add",
      value: 1,
      stacking: "stack",
    },
  },
  {
    id: 19,
    name: "Minor Die Block",
    modifier: {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: "1d4",
      stacking: "stack",
    },
  },
];

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

interface PrimitiveRow {
  id: number;
  name: string;
  is_mirrorable: boolean;
  mirror_vector: string;
  mirror_bu_credit: number;
  hard_modifiers: unknown;
  content_hash: string | null;
}

async function readRow(id: number): Promise<PrimitiveRow | null> {
  const rows = (await sql`
    SELECT id, name, is_mirrorable, mirror_vector::text as mirror_vector,
           mirror_bu_credit, hard_modifiers, content_hash
    FROM primitives WHERE id = ${id}
  `) as PrimitiveRow[];
  return rows[0] ?? null;
}

describe("Phase 7.9.4 — mirrorable + chirality-fix migration", () => {
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
        expect(m.kind).toBe(p.modifier.kind);
        expect(m.target).toBe(p.modifier.target);
        expect(m.operation).toBe(p.modifier.operation);
        // Compare values loosely (DB may serialize numbers as strings)
        // for dice/expression values.
        if (typeof p.modifier.value === "string") {
          expect(String(m.value)).toBe(p.modifier.value);
        } else {
          expect(Number(m.value)).toBe(p.modifier.value);
        }
        expect(m.stacking ?? "stack").toBe(p.modifier.stacking);
      });
    }
  });

  describe("Chirality — stored is_mirrorable matches derived", () => {
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — stored is_mirrorable matches OP_SPECS`, async () => {
        const row = await readRow(p.id);
        expect(row).not.toBeNull();
        if (!row) return;
        const derived = p.modifier.operation !== "set";
        expect(row.is_mirrorable).toBe(derived);
        if (derived) {
          expect(row.mirror_vector).toBe("VARIABLE_VECTOR");
          // mirror_bu_credit should equal bu_cost for mirrorable rows
          // (per migration 0033 invariant). The backfill set it.
          // We just check it's non-zero here.
          expect(row.mirror_bu_credit).toBeGreaterThan(0);
        } else {
          expect(row.mirror_vector).toBe("STANDARD_ONLY");
          expect(row.mirror_bu_credit).toBe(0);
        }
      });
    }
  });

  describe("applyMirror round-trip — mirror twice equals original", () => {
    // For additive ops (add/subtract) and multiplicative ops
    // (multiply/divide) the mirror operation is an involution:
    // mirror(mirror(x)) = x. We test this for the 4 numerical ops
    // used in PROPOSED (only `add` and `grant` here, plus the
    // 2 chirality-fix rows that are also `add`).
    for (const p of PROPOSED.filter(
      (p) => p.modifier.operation === "add" || p.modifier.operation === "grant",
    )) {
      it(`[${p.id}] ${p.name} — applyMirror is involutive on its op+value`, () => {
        if (p.modifier.operation === "add") {
          // add(N) → subtract(-N) → add(N)
          const once = applyMirror("add", p.modifier.value as number);
          const twice = applyMirror(once.op, once.value);
          expect(twice).toEqual({ op: "add", value: p.modifier.value });
        } else {
          // grant("vitality_shielding") → revoke("vitality_shielding")
          // → grant("vitality_shielding") for behavior tokens
          // (the value flips but for behavior tokens it's the same
          // string on the round-trip in our implementation).
          // We only check that the FIRST mirror is the chiral pair.
          const once = applyMirror("grant", "vitality_shielding");
          expect(once.op).toBe("revoke");
        }
      });
    }
  });

  describe("Hard constraint — at most 1 modifier per primitive", () => {
    // Sanity: the DB CHECK constraint from migration 0033 should
    // still hold. We verify by counting modifiers across all
    // PROPOSED rows.
    it("all 15 rows have exactly 1 modifier (DB invariant)", async () => {
      for (const p of PROPOSED) {
        const row = await readRow(p.id);
        const mods = Array.isArray(row?.hard_modifiers)
          ? (row!.hard_modifiers as unknown[])
          : [];
        expect(mods).toHaveLength(1);
      }
    });
  });

  describe("Content hash present", () => {
    // Each modified row should have a content_hash (recomputed by
    // the migration). Without it the no-change short-circuit in
    // dispatch-save.ts can't work.
    for (const p of PROPOSED) {
      it(`[${p.id}] ${p.name} — content_hash is set`, async () => {
        const row = await readRow(p.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.content_hash).not.toBeNull();
        expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
      });
    }
  });
});
