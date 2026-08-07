/**
 * Phase 8.I i2 verification character seed — Mashu 2026-08-06.
 *
 * Creates a L18 test character for @mashu (Clerk id
 * user_3GBKnmCEvgYSjfeFqmAQrzO7cyP) with 24 audit primitives
 * covering every modifier target axis, every operation,
 * conditions (both computable and non-computable), and
 * mirror inversion.
 *
 * The character lives in the user's character list, so they
 * can open it in /characters/[id] and verify the engine math
 * + drawer UI for every primitive target.
 *
 * Run via:
 *   export $(cat .env.local | grep -v '^#' | xargs)
 *   npx tsx scripts/seed-test-character.ts
 */
import { Pool } from "@neondatabase/serverless";

const MASHU_USER_ID = "user_3GBKnmCEvgYSjfeFqmAQrzO7cyP";

interface HardMod {
  target: string;
  operation: string;
  value: unknown;
  condition?: unknown;
  metadata?: unknown;
}

interface PrimitiveSpec {
  name: string;
  category: string;
  buCost: number;
  isMirrorable: boolean;
  mirrorBuCredit: number;
  hardModifiers: HardMod[];
  description?: string;
}

// 24 primitives — every primitive target axis, every op,
// conditions + mirror inversion.
const PRIMITIVES: PrimitiveSpec[] = [
  {
    name: "Str Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attribute.physical", operation: "add", value: 5 },
    ],
    description: "+5 to physical attribute (i2 finish audit).",
  },
  {
    name: "Str Ring",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attribute.physical", operation: "add", value: 1 },
    ],
    description: "+1 to physical attribute.",
  },
  {
    name: "Defender",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "defense_dc.physical", operation: "add", value: 1 },
    ],
    description: "+1 to physical defense DC.",
  },
  {
    name: "Resilient Phys",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "saving_throw.physical", operation: "add", value: 1 },
    ],
    description: "+1 to physical saving throw.",
  },
  {
    name: "Save DC Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "save_dc.physical", operation: "add", value: 1 },
    ],
    description: "+1 to physical save DC.",
  },
  {
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
    description: "Proficiency in fieldcraft — adds PB to the check.",
  },
  {
    name: "Expertise Fieldcraft",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        // 2 * pb as an Operand[] (i2.7d equation mode storage).
        value: [
          { op: "+", value: { kind: "number", value: 2 } },
          { op: "*", value: { kind: "derived", which: "pb" } },
        ],
        metadata: { targetScope: { layer: "PRACTICE", values: ["FIELDCRAFT"] } },
      },
    ],
    description: "Expertise — adds 2*PB (i.e. +PB on top of prof).",
  },
  {
    name: "Vitality Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "max_vitality", operation: "add", value: 10 }],
    description: "+10 to max vitality.",
  },
  {
    name: "Fast",
    category: "SPEED_QUICKENING",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "speed.walking", operation: "add", value: 10 }],
    description: "+10 ft walking speed.",
  },
  {
    name: "Backpack",
    category: "ITEM_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "carry_capacity", operation: "add", value: 20 },
    ],
    description: "+20 carry capacity.",
  },
  {
    name: "Lighten",
    category: "ITEM_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "load", operation: "subtract", value: 2 }],
    description: "-2 effective load (carried weight).",
  },
  {
    name: "Extra Slot",
    category: "ITEM_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "equip_slot", operation: "add", value: 1 }],
    description: "+1 equip slot.",
  },
  {
    name: "Enlarge",
    category: "METAMORPHOSIS",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "size.large", operation: "set", value: 1 }],
    description: "Set size to LARGE.",
  },
  {
    name: "Force Source",
    category: "VERB_TIER",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "source_type.magical", operation: "set", value: 1 },
    ],
    description: "Set source type to MAGICAL.",
  },
  {
    name: "Complex Cap",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "complexity", operation: "add", value: 3 }],
    description: "+3 complexity (combat placement driver).",
  },
  {
    name: "Initiative",
    category: "TACTICAL",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "combat_action", operation: "grant", value: 1 },
    ],
    description: "Grant combat_action flag (in combat).",
  },
  {
    name: "Maint Cost",
    category: "ACTION_ECONOMY",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "upkeep_cost", operation: "add", value: 2 }],
    description: "+2 upkeep cost (per-capability maintenance).",
  },
  {
    name: "Resist Fire",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "damage_modifier.fire", operation: "multiply", value: 0.5 },
    ],
    description: "Resistance: fire (0.5x incoming fire damage).",
  },
  {
    name: "Vulnerable Cold",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "damage_modifier.cold", operation: "multiply", value: 2 },
    ],
    description: "Vulnerability: cold (2x incoming cold damage).",
  },
  {
    name: "Immune Poison",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "damage_modifier.poison", operation: "multiply", value: 0 },
    ],
    description: "Immunity: poison (no poison damage).",
  },
  {
    name: "Legendary Resistance",
    category: "VERB_TIER",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "behavior.legendary_resistance", operation: "add", value: 1 },
    ],
    description: "+1 legendary resistance charge (drawn in drawer).",
  },
  {
    name: "Iron Will",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: 5,
        // Computable condition: fires when vitality < 50%.
        condition: {
          kind: "compound",
          tokens: ["self:stat|vitality_pct|<|0.5"],
        },
        metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } },
      },
    ],
    description: "+5 awareness when below 50% HP (computable).",
  },
  {
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
        // Non-computable: depends on a narrative flag.
        condition: {
          kind: "compound",
          tokens: ["self:flag|is_tracking"],
        },
        metadata: { targetScope: { layer: "PRACTICE", values: ["REASON"] } },
      },
    ],
    description: "+3 reason when tracking enemies (table play).",
  },
  {
    name: "Mirrored Str Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attribute.physical", operation: "add", value: 4 },
    ],
    description: "Mirrored +4 physical (sign flips to -4).",
  },
];

async function main() {
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is not set. Run with .env.local exported.");
  }
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

  // 1. Delete any existing test character of this name so re-runs are idempotent.
  await pool.query(
    `DELETE FROM characters WHERE user_id = $1 AND name = $2`,
    [MASHU_USER_ID, "i2 Test Character"],
  );

  // 2. Insert the 24 primitives. Use upsert on (name, source_origin)
  // so re-runs don't create duplicates.
  const sourceOrigin = `user:${MASHU_USER_ID}`;
  const primitiveIds: number[] = [];
  for (const p of PRIMITIVES) {
    const result = await pool.query(
      `INSERT INTO primitives
        (name, user_id, is_public, category, bu_cost,
         is_mirrorable, mirror_bu_credit, hard_modifiers,
         mechanical_output_text, source_origin, mirror_vector,
         mirror_eligibility_notes, narrative_rule, cost_tier)
       VALUES ($1, $2, false, $3, $4, $5, $6, $7::jsonb,
               $8, $9, 'STANDARD_ONLY', '', '', 'Tier 1: Minor (4 BU anchor)')
       ON CONFLICT (name, source_origin) DO UPDATE
         SET hard_modifiers = EXCLUDED.hard_modifiers,
             bu_cost = EXCLUDED.bu_cost,
             updated_at = now()
       RETURNING id`,
      [
        p.name,
        MASHU_USER_ID,
        p.category,
        p.buCost,
        p.isMirrorable,
        p.mirrorBuCredit,
        JSON.stringify(p.hardModifiers),
        p.description ?? "",
        sourceOrigin,
      ],
    );
    primitiveIds.push(result.rows[0].id);
  }

  // 3. Insert the character (L18, PHYSICAL proficient, attr sum = 10).
  // The base attrs (4, 4, 2) give plenty of room for the +5 +1 -4
  // phys sum = 6 net (4 + 2).
  const characterResult = await pool.query(
    `INSERT INTO characters
      (user_id, name, level, size, attr_physical, attr_mental, attr_magical,
       attr_proficient, practice_slices, starting_bu, bu_spent, dm_bonus_bu,
       is_mirrored, source_origin, backstory)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
             $10, $11, $12, false, 'manual', '{}'::jsonb)
     RETURNING id`,
    [
      MASHU_USER_ID,
      "i2 Test Character",
      18,
      "MEDIUM",
      4, 4, 2,
      "PHYSICAL",
      JSON.stringify({ FIELDCRAFT: 0, AWARENESS: 0, REASON: 0 }),
      200, 0, 0, // generous BU so the 24 prims fit comfortably
    ],
  );
  const characterId = characterResult.rows[0].id;

  // 4. Insert character_primitives links for all 24 prims.
  // Prim 23 (zero-indexed = Mirrored Str Buff) is mirrored.
  for (let i = 0; i < primitiveIds.length; i++) {
    const isMirrored = i === 23; // Mirrored Str Buff
    await pool.query(
      `INSERT INTO character_primitives
        (character_id, primitive_id, source, acquired_at_level, is_mirrored)
       VALUES ($1, $2, 'PERSONAL', $3, $4)`,
      [characterId, primitiveIds[i], 1, isMirrored],
    );
  }

  // 5. Initialize currentVitality = null so conditions fire on HP math.
  await pool.query(
    `UPDATE characters SET current_vitality = NULL WHERE id = $1`,
    [characterId],
  );

  console.log(`✓ Created character ${characterId}`);
  console.log(`  user: ${MASHU_USER_ID}`);
  console.log(`  name: i2 Test Character (L18, PHYSICAL proficient)`);
  console.log(`  primitives: ${primitiveIds.length} attached`);
  console.log(`  link: /characters/${characterId}`);
  console.log();
  console.log("Expected values per axis:");
  console.log("  physical attr: 4 + 5 + 1 - 4 = 6");
  console.log("  phys DC: 5 + 6 + 6 + 1 = 18");
  console.log("  phys save: 6 + 6 + 1 = +13");
  console.log("  phys save DC: 8 + 6 + 6 + 1 = 21");
  console.log("  fieldcraft: base 8 + PB 6 + 2*PB 12 = 26");
  console.log("  speed walking: 30 + 10 = 40 ft");
  console.log("  carry: 40 + 4*5 + 20 = 80");
  console.log("  load: -2 (no items)");
  console.log("  equip slots: 1 (1 from Extra Slot)");
  console.log("  size: LARGE (Enlarge sets)");
  console.log("  source type: MAGICAL (Force Source sets)");
  console.log("  complexity: 3");
  console.log("  inCombat: true");
  console.log("  upkeepCost: 2");
  console.log("  behavior.legendary_resistance: 1");
  console.log("  damage_modifier.fire: 0.5 (resistance)");
  console.log("  damage_modifier.cold: 2 (vulnerability)");
  console.log("  damage_modifier.poison: 0 (immunity)");
  console.log();
  console.log("Open /characters/" + characterId + " to verify in the drawer.");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
