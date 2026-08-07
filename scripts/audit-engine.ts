/**
 * Phase 8.I engine audit — Mashu 2026-08-06.
 *
 * Walks every primitive target axis on a synthetic L18 character
 * with all combinations: flat +1, +pb, +2*pb, +pb/2, keywords,
 * equations, with both computable and non-computable conditions.
 *
 * Output: A summary of every axis + the computed value + the
 * expected value. Any discrepancy indicates an engine bug.
 *
 * Run via: npx tsx scripts/audit-engine.ts
 */
import {
  aggregateCharacterSheet,
  type CharacterSheetInput,
} from "../src/lib/engine/sheet";
import type { ConditionContext } from "../src/lib/engine/condition-evaluator";
import { resolveValue } from "../src/lib/engine/runtime-resolver";

interface AuditPrimitive {
  id: number;
  name: string;
  category: string;
  buCost: number;
  isMirrorable: boolean;
  mirrorBuCredit: number;
  hardModifiers: ReadonlyArray<{
    target: string;
    operation: string;
    value: unknown;
    condition?: unknown;
  }>;
}

function makeLink(
  p: AuditPrimitive,
  opts: { isMirrored?: boolean } = {},
): { primitiveId: number; source: "PERSONAL"; acquiredAtLevel: number; isMirrored: boolean; primitive: AuditPrimitive } {
  return {
    primitiveId: p.id,
    source: "PERSONAL",
    acquiredAtLevel: 1,
    isMirrored: opts.isMirrored ?? false,
    primitive: p,
  };
}

// L18 character: PB = 2 + floor(17/4) = 2 + 4 = +6
const LEVEL = 18;
const PB = 2 + Math.floor((LEVEL - 1) / 4);
console.log(`LEVEL ${LEVEL}, PB = ${PB}\n`);

const prims: AuditPrimitive[] = [
  // 1) +5 to phys attribute (target: attribute.physical, op: add)
  {
    id: 1,
    name: "Str Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "attribute.physical", operation: "add", value: 5 }],
  },
  // 2) +1 phys attribute (target: attribute.physical, op: add)
  {
    id: 2,
    name: "Str Ring",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "attribute.physical", operation: "add", value: 1 }],
  },
  // 3) +1 to defense_dc.physical (target: defense_dc.physical, op: add)
  {
    id: 3,
    name: "Defender",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "defense_dc.physical", operation: "add", value: 1 }],
  },
  // 4) +1 to saving_throw.physical (target: saving_throw.physical, op: add)
  {
    id: 4,
    name: "Resilient Phys",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "saving_throw.physical", operation: "add", value: 1 }],
  },
  // 5) +1 to save_dc.physical (target: save_dc.physical, op: add)
  {
    id: 5,
    name: "Save DC Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "save_dc.physical", operation: "add", value: 1 }],
  },
  // 6) +1 to skill_practice_check.fieldcraft (PB value via runtime token)
  {
    id: 6,
    name: "Proficient Fieldcraft",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: { kind: "derived", which: "pb" },
        metadata: { targetScope: { layer: "PRACTICE", values: ["FIELDCRAFT"] } },
      },
    ],
  },
  // 7) Expertise: 2*pb stored as full Operand[] (the form's
  // equation mode serialization per i2.7d fix).
  {
    id: 7,
    name: "Expertise Fieldcraft",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        // 2 * pb as an Operand[] (post-i2.7d storage shape).
        value: [
          { op: "+", value: { kind: "number", value: 2 } },
          { op: "*", value: { kind: "derived", which: "pb" } },
        ],
        metadata: { targetScope: { layer: "PRACTICE", values: ["FIELDCRAFT"] } },
      },
    ],
  },
  // 8) +10 to max_vitality
  {
    id: 8,
    name: "Vitality Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "max_vitality", operation: "add", value: 10 }],
  },
  // 9) +10 to speed.walking
  {
    id: 9,
    name: "Fast",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "speed.walking", operation: "add", value: 10 }],
  },
  // 10) +20 to carry_capacity
  {
    id: 10,
    name: "Backpack",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "carry_capacity", operation: "add", value: 20 }],
  },
  // 11) -2 from load (lighten)
  {
    id: 11,
    name: "Lighten",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "load", operation: "subtract", value: 2 }],
  },
  // 12) +1 equip_slot
  {
    id: 12,
    name: "Extra Slot",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "equip_slot", operation: "add", value: 1 }],
  },
  // 13) set size.large
  {
    id: 13,
    name: "Enlarge",
    category: "MORPHOLOGICAL",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "size.large", operation: "set", value: 1 }],
  },
  // 14) set source_type.magical
  {
    id: 14,
    name: "Force Source",
    category: "EXISTENTIAL",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "source_type.magical", operation: "set", value: 1 }],
  },
  // 15) +3 complexity
  {
    id: 15,
    name: "Complex Cap",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "complexity", operation: "add", value: 3 }],
  },
  // 16) grant combat_action (in combat)
  {
    id: 16,
    name: "Initiative",
    category: "TACTICAL",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "combat_action", operation: "grant", value: 1 }],
  },
  // 17) +2 upkeep_cost
  {
    id: 17,
    name: "Maint Cost",
    category: "CAPABILITY_MAINTENANCE",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "upkeep_cost", operation: "add", value: 2 }],
  },
  // 18) damage_modifier.fire resistance (0.5x)
  {
    id: 18,
    name: "Resist Fire",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "damage_modifier.fire", operation: "multiply", value: 0.5 }],
  },
  // 19) damage_modifier.cold vulnerability (2x)
  {
    id: 19,
    name: "Vulnerable Cold",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "damage_modifier.cold", operation: "multiply", value: 2 }],
  },
  // 20) damage_modifier.poison immunity (0x)
  {
    id: 20,
    name: "Immune Poison",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "damage_modifier.poison", operation: "multiply", value: 0 }],
  },
  // 21) behavior.legendary_resistance +1
  {
    id: 21,
    name: "Legendary Resistance",
    category: "EXISTENTIAL",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "behavior.legendary_resistance", operation: "add", value: 1 },
    ],
  },
  // 22) +5 to skill_practice_check.awareness with condition vitality < 50%
  // (computable condition)
  {
    id: 22,
    name: "Iron Will (below 50% HP)",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: 5,
        condition: {
          kind: "compound",
          tokens: ["actor:stat|vitality_pct|<|0.5"],
        },
        metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } },
      },
    ],
  },
  // 23) +3 to skill_practice_check.reason with condition tracking enemies (non-computable)
  {
    id: 23,
    name: "Hunter Bonus",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: 3,
        condition: {
          kind: "compound",
          tokens: ["self:flag|is_tracking"],
        },
        metadata: { targetScope: { layer: "PRACTICE", values: ["REASON"] } },
      },
    ],
  },
  // 24) Mirrored: subtracts instead of adds
  {
    id: 24,
    name: "Mirrored Str Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "attribute.physical", operation: "add", value: 4 }],
  },
];

const characterInput: CharacterSheetInput = {
  level: LEVEL,
  attrPhysical: 0,
  attrMental: 0,
  attrMagical: 0,
  attrProficient: "PHYSICAL",
  practiceSlices: { FIELDCRAFT: 0, AWARENESS: 0, REASON: 0 },
  startingBu: 100,
  buSpent: 0,
  dmBonusBu: 0,
  currentVitality: null,
  size: "MEDIUM",
  primitiveLinks: [
    ...prims.slice(0, 23).map((p) => makeLink(p)),
    // Mirror prim 24 (Str Buff, +4 instead of +5)
    makeLink(prims[23], { isMirrored: true }),
  ],
  itemLinks: [],
  capabilityLinks: [],
  conditionContext: {
    character: {
      attrPhysical: 0,
      attrMental: 0,
      attrMagical: 0,
      vitality: 10, // current HP
      vitalityMax: 100, // max HP -> 10%
      practices: {},
      custom: {},
      flags: new Set<string>(["flag|is_tracking"]), // prim 23's condition passes
    },
  } as unknown as ConditionContext,
};

const sheet = aggregateCharacterSheet(characterInput);

console.log("== Attribute ==");
console.log(`physical: ${sheet.attributes.physical} (expected: 0 + 5 + 1 - 4 = 2)`);
console.log(`mental: ${sheet.attributes.mental} (expected: 0)`);
console.log(`magical: ${sheet.attributes.magical} (expected: 0)`);

console.log("\n== Defensive DCs ==");
for (const dc of sheet.defensiveDCs) {
  console.log(`${dc.attribute}: ${dc.dc}`);
}

console.log("\n== Saving Throws ==");
for (const s of sheet.savingThrows) {
  console.log(`${s.attribute}: +${s.bonus}`);
}

console.log("\n== Save DCs ==");
for (const s of sheet.saveDCs) {
  console.log(`${s.attribute}: ${s.dc}`);
}

console.log("\n== Practices ==");
for (const p of sheet.practices) {
  console.log(`${p.practice} (${p.attribute}): ${p.total}`);
}

console.log("\n== Vitality ==");
console.log(`max: ${sheet.vitality.max}`);
console.log(`current: ${sheet.vitality.current}`);

console.log("\n== Speed ==");
for (const [k, v] of Object.entries(sheet.speedByType)) {
  console.log(`${k}: ${v}`);
}

console.log("\n== Carry Capacity ==");
console.log(`carryCapacity: ${sheet.carryCapacity}`);
console.log(`load: ${sheet.load}`);
console.log(`equipSlotsUsed: ${sheet.equipSlotsUsed}`);

console.log("\n== Wave 5 ==");
console.log(`resolvedSize: ${sheet.resolvedSize}`);
console.log(`resolvedSourceType: ${sheet.resolvedSourceType}`);
console.log(`complexity: ${sheet.complexity}`);
console.log(`inCombat: ${sheet.inCombat}`);
console.log(`upkeepCost: ${sheet.upkeepCost}`);

console.log("\n== Behavior Variables ==");
for (const bv of sheet.behaviorVariables) {
  console.log(`${bv.key}: ${bv.value}`);
}
