/**
 * Phase 8.I i3 verification character seed — Mashu 2026-08-08.
 *
 * Creates a L18 test character for @mashu (Clerk id
 * user_3GBKnmCEvgYSjfeFqmAQrzO7cyP) with audit primitives +
 * capability/effect nesting covering:
 *
 * Primitives (24 audit + 6 new = 30 total):
 *   - Every modifier target axis, every operation
 *   - Conditions (computable + non-computable)
 *   - Mirror inversion
 *   - Advantage / disadvantage
 *   - PB/2 (half proficiency)
 *   - Min roll / max roll (floor/ceiling)
 *
 * Capabilities (3, properly nested):
 *   - "Divine Smite" → Effect("Smite") → Primitives(Smite Damage, Advantage)
 *   - "Hunter's Mark" → Effect("Marked") → Primitives(Mark of the Hunt, Disadvantage)
 *   - "Stone's Endurance" → direct primitive(Stone Skin) + Effect("Endure") → Primitive(PB/2)
 *
 * Distribution across Lineage / Manifest / Upbringing:
 *   - Lineage (10 prims): Str Buff, Str Ring, Str Buff Mirrored, Vitality Buff,
 *     Resilient Phys, Save DC Buff, Defender, Enlarge, Force Source, Complex Cap
 *   - Manifest (12 prims): Proficient FC, Expertise FC, Iron Will,
 *     Hunter Bonus, Fast, Lighten, Resist Fire, Vulnerable Cold,
 *     Immune Poison, Extra Slot, Legendary Resistance, Backpack
 *   - Upbringing (6 prims): Initiative, Maint Cost, Smite Damage,
 *     Mark of the Hunt, Stone Skin, PB/2
 *
 * Run via:
 *   export $(cat .env.local | grep -v '^#' | grep -v '◊' | xargs)
 *   npx tsx scripts/seed-test-character.ts
 */
import { Pool } from "@neondatabase/serverless";

const MASHU_USER_ID = "user_3GBKnmCEvgYSjfeFqmAQrzO7cyP";

// ── Primitive specs ──────────────────────────────────────────────────────
// Full primitive definitions with all metadata needed for the DB.
// Each primitive's `source` determines which accordion it appears under.
// source: "LINEAGE" | "MANIFEST" | "UPBRINGING" | "PERSONAL"
// (Personal = manually added by player, not from heritage)

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
  source: "LINEAGE" | "MANIFEST" | "UPBRINGING" | "PERSONAL";
}

// 30 primitives covering every axis + i3 condition cases
const PRIMITIVES: PrimitiveSpec[] = [
  // ── Lineage primitives (10) ──────────────────────────────────────
  {
    name: "Str Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attribute.physical", operation: "add", value: 5 },
    ],
    description: "+5 to physical attribute.",
    source: "LINEAGE",
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
    source: "LINEAGE",
  },
  {
    name: "Vitality Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "max_vitality", operation: "add", value: 10 }],
    description: "+10 to max vitality.",
    source: "LINEAGE",
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
    source: "LINEAGE",
  },
  {
    name: "Defender",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      // Phase 8.M (Mashu 2026-08-12): unified save_dc.<attr>
      // format. Older primitives used "defense_dc.<attr>" —
      // that path was kept working via fallback in the modal,
      // but new code uses the single-axis save_dc form.
      { target: "save_dc.physical", operation: "add", value: 1 },
    ],
    description: "+1 to physical defense DC.",
    source: "LINEAGE",
  },
  {
    name: "Enlarge",
    category: "METAMORPHOSIS",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "size", operation: "set", value: { kind: "keyword", value: "large" } }],
    description: "Set size to LARGE.",
    source: "LINEAGE",
  },
  {
    name: "Force Source",
    category: "VERB_TIER",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "source_type", operation: "set", value: { kind: "keyword", value: "magical" } },
    ],
    description: "Set source type to MAGICAL.",
    source: "LINEAGE",
  },
  {
    name: "Complex Cap",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "complexity", operation: "add", value: 3 }],
    description: "+3 complexity.",
    source: "LINEAGE",
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
    source: "LINEAGE",
  },

  // ── Manifest primitives (12) ─────────────────────────────────────
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
    source: "MANIFEST",
  },
  {
    name: "Proficient Mysticism",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: { kind: "derived", which: "pb" },
        metadata: { targetScope: { layer: "PRACTICE", values: ["MYSTICISM"] } },
      },
    ],
    description: "Proficiency in mysticism — adds PB to the check.",
    source: "MANIFEST",
  },
  {
    name: "PB Half Intuition",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: { kind: "derived", which: "pb_half" },
        metadata: { targetScope: { layer: "PRACTICE", values: ["INTUITION"] } },
      },
    ],
    description: "Half PB to intuition practice (PB/2). Tests the PB/2 drawing color rule.",
    source: "MANIFEST",
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
        value: { kind: "derived", which: "pb" },
        metadata: { targetScope: { layer: "PRACTICE", values: ["FIELDCRAFT"] } },
        condition: {
          kind: "compound",
          tokens: ["self:proficient_in(fieldcraft)"],
        },
      },
    ],
    description:
      "Expertise — +PB on top of proficiency, gated by proficient_in(fieldcraft).",
    source: "MANIFEST",
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
        condition: {
          kind: "compound",
          tokens: ["self:stat|vitality_pct|<|0.5"],
        },
        metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } },
      },
    ],
    description: "+5 awareness when below 50% HP (computable condition).",
    source: "MANIFEST",
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
        condition: {
          kind: "compound",
          tokens: ["self:is_tracking"],
        },
        metadata: { targetScope: { layer: "PRACTICE", values: ["REASON"] } },
      },
    ],
    description: "+3 reason when tracking enemies (table play condition).",
    source: "MANIFEST",
  },
  {
    name: "Fast",
    category: "SPEED_QUICKENING",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "speed.walking", operation: "add", value: 10 }],
    description: "+10 ft walking speed.",
    source: "MANIFEST",
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
    source: "MANIFEST",
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
    source: "MANIFEST",
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
    source: "MANIFEST",
  },
  {
    name: "Extra Slot",
    category: "ITEM_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      {
        target: "equip_slot",
        operation: "add",
        value: 1,
        metadata: { behaviorName: "extraslot" },
      },
    ],
    description: "+1 equip slot.",
    source: "MANIFEST",
  },
  {
    name: "Legendary Resistance",
    category: "VERB_TIER",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "behavior.legendary_resistance", operation: "grant", value: 1 },
    ],
    description: "+1 legendary resistance charge.",
    source: "MANIFEST",
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
    source: "MANIFEST",
  },

  // ── Upbringing primitives (6) ─────────────────────────────────────
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
    source: "UPBRINGING",
  },
  {
    name: "Maint Cost",
    category: "ACTION_ECONOMY",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [{ target: "upkeep_cost", operation: "add", value: 2 }],
    description: "+2 upkeep cost.",
    source: "UPBRINGING",
  },
  // ── Capability-owned primitives (not directly character-attached) ──
  {
    name: "Smite Damage",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "damage_bonus.radiant", operation: "add", value: 3 },
    ],
    description: "+3 radiant damage on smite (gated by low HP).",
    source: "PERSONAL", // attached via capability, not directly
  },
  {
    name: "Mark of the Hunt",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attack_bonus.physical", operation: "add", value: 2 },
    ],
    description: "+2 to hit when target is marked.",
    source: "PERSONAL",
  },
  {
    // Phase 8.M (Mashu 2026-08-12): magical-attack primitive
    // so the attack_bonus selector has something to choose
    // between (physical vs magical).
    name: "Arcane Bolt",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attack_bonus.magical", operation: "add", value: 3 },
    ],
    description: "+3 to magical attack roll when casting cantrips.",
    source: "PERSONAL",
  },
  {
    // Phase 8.L round 40 (Mashu 2026-08-13): target changed from
    // defense.physical to save_dc.physical. The L28 cleanup
    // collapsed defense.X into save_dc.X (single defense DC per
    // attribute). Stone Skin stayed on the dead target after
    // the cleanup so it stopped contributing to the Save DC
    // total. Now it correctly adds +2 to save_dc.physical.
    name: "Stone Skin",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "save_dc.physical", operation: "add", value: 2 },
    ],
    description: "+2 physical save DC (always on when Stone's Endurance is active).",
    source: "PERSONAL",
  },
  // ── i3 condition case primitives ──────────────────────────────────
  {
    name: "Advantage on Communion",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "skill_practice_check.communion", operation: "grant", value: { kind: "keyword", value: "advantage" } },
    ],
    description: "Roll two d20s, take the higher on Communion checks.",
    source: "PERSONAL",
  },
  {
    name: "Advantage on Communion 2",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "skill_practice_check.communion", operation: "grant", value: { kind: "keyword", value: "advantage" } },
    ],
    description: "Second advantage on Communion (tests stacking). Was once worshipped as a spirit-bond forming between cleric and the divine.",
    source: "PERSONAL",
  },
  {
    name: "Disadvantage on Influence",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "skill_practice_check.influence", operation: "grant", value: { kind: "keyword", value: "disadvantage" } },
    ],
    description: "Roll two d20s, take the lower on Influence checks.",
    source: "PERSONAL",
  },
  {
    name: "Advantage on Fieldcraft",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "skill_practice_check.fieldcraft", operation: "grant", value: { kind: "keyword", value: "advantage" } },
    ],
    description: "Roll two d20s, take the higher on Fieldcraft checks.",
    source: "PERSONAL",
  },
  {
    name: "Disadvantage on Fieldcraft",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "skill_practice_check.fieldcraft", operation: "grant", value: { kind: "keyword", value: "disadvantage" } },
    ],
    description: "Roll two d20s, take the lower on Fieldcraft checks.",
    source: "PERSONAL",
  },
  {
    name: "PB Half",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: { kind: "derived", which: "pb_half" },
        metadata: { targetScope: { layer: "PRACTICE", values: ["REASON"] } },
      },
    ],
    description: "Half PB to reason practice (PB/2).",
    source: "PERSONAL",
  },
  {
    name: "Floor 10",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "skill_practice_check", operation: "min", value: 10 },
    ],
    description: "Minimum roll of 10 on any practice check.",
    source: "PERSONAL",
  },
  {
    name: "Ceiling 18",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "attribute.physical", operation: "max", value: 18 },
    ],
    description: "Physical attribute cannot exceed 18.",
    source: "PERSONAL",
  },

  // ── Phase 8.I POST D1: stress-test coverage primitives ────────────
  {
    name: "Mental Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attribute.mental", operation: "add", value: 3 },
    ],
    description: "+3 to mental attribute. Stress-test coverage.",
    source: "MANIFEST",
  },
  {
    name: "Magical Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: true,
    mirrorBuCredit: 1,
    hardModifiers: [
      { target: "attribute.magical", operation: "add", value: 2 },
    ],
    description: "+2 to magical attribute. Stress-test coverage.",
    source: "MANIFEST",
  },
  {
    // Phase 8.L round 40 (Mashu 2026-08-13): target changed
    // from defense.mental to save_dc.mental. See Stone Skin
    // fix above for rationale.
    name: "Defense Mental Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "save_dc.mental", operation: "add", value: 1 },
    ],
    description: "+1 to mental save DC (defense roll).",
    source: "MANIFEST",
  },
  {
    name: "Defense Magic Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "save_dc.magical", operation: "add", value: 1 },
    ],
    description: "+1 to magical save DC.",
    source: "MANIFEST",
  },
  {
    name: "Speed Swimming",
    category: "SPEED_QUICKENING",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "speed.swimming", operation: "add", value: 5 },
    ],
    description: "+5 to swimming speed.",
    source: "PERSONAL",
  },
  {
    name: "Damage Radiant Buff",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "damage_bonus.radiant", operation: "add", value: 2 },
    ],
    description: "+2 radiant damage bonus.",
    source: "MANIFEST",
  },
  {
    name: "Proficient Save",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "saving_throw.physical", operation: "add", value: { kind: "derived", which: "pb" } },
    ],
    description: "+PB to physical saving throw.",
    source: "MANIFEST",
  },
  {
    name: "Prowess Equation",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: {
          kind: "equation",
          operands: [
            { kind: "derived", which: "pb" },
            { kind: "number", value: 2 },
          ],
          tag: "fire",
        },
        metadata: {
          targetScope: { layer: "PRACTICE", values: ["PROWESS"] },
        },
      },
    ],
    description: "PB + 2 to Prowess, with [fire] tag. Equation value-type test.",
    source: "MANIFEST",
  },
  {
    name: "Reason AND Compound",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: 3,
        condition: {
          kind: "compound",
          tokens: ["self:is_tracking", "OR", "self:not_proficient"],
        },
        metadata: {
          targetScope: { layer: "PRACTICE", values: ["REASON"] },
        },
      },
    ],
    description: "+3 Reason when tracking OR not proficient. OR chain test.",
    source: "PERSONAL",
  },
  {
    name: "Knowledge Mixed",
    category: "PRACTICE_PROGRESSION_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "add",
        value: 2,
        condition: {
          kind: "compound",
          tokens: [
            "self:not_proficient_in(all_practices)",
            "AND",
            "self:actor-prone",
          ],
        },
        metadata: {
          targetScope: { layer: "PRACTICE", values: ["KNOWLEDGE"] },
        },
      },
    ],
    description: "+2 Knowledge when not proficient AND prone. Mixed text+stat.",
    source: "PERSONAL",
  },
  {
    name: "Awareness Floor 11",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      {
        target: "skill_practice_check",
        operation: "min",
        value: 11,
        metadata: {
          targetScope: { layer: "PRACTICE", values: ["AWARENESS"] },
        },
      },
    ],
    description: "Minimum roll of 11 on Awareness checks.",
    source: "PERSONAL",
  },
  // Phase 8.L round 35 (Mashu 2026-08-13): Vitality Floor and
  // Ceiling are now slotted under the Vitality Constitution
  // capability (LINEAGE accordion) so they have a heritage +
  // capability parent. The previous direct PERSONAL slot
  // severed the origin and dropped the breadcrumb.
  //
  // These primitives still get UPSERTed into the library by
  // the loop below (so we have an ID to reference from the
  // capability), but they are NOT attached to the character
  // directly — they come through Vitality Constitution →
  // Vitality Bounds.
  {
    name: "Vitality Floor",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "max_vitality", operation: "min", value: 50 },
    ],
    description: "Max vitality cannot go below 50.",
    source: "LINEAGE",
  },
  {
    name: "Vitality Ceiling",
    category: "CHARACTER_SHEET_AUGMENT",
    buCost: 1,
    isMirrorable: false,
    mirrorBuCredit: 0,
    hardModifiers: [
      { target: "max_vitality", operation: "max", value: 500 },
    ],
    description: "Max vitality cannot exceed 500.",
    source: "LINEAGE",
  },
];

// ── Capability specs: capability → effect(s) → primitives ──────────
// Each capability can have:
//   - directPrims: primitives linked via capability_primitives table (role: AUGMENT)
//   - effects: effects linked via capability_effects table, each with its own primitives
// Primitives NOT in any capability are linked directly to the character via
// character_primitives with source = their `source` field.

interface EffectSpec {
  name: string;
  description: string;
  primitiveNames: string[];
}

interface CapabilitySpec {
  slotTab?: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  name: string;
  type: "ACTIVE" | "PASSIVE";
  sourceType: "PHYSICAL" | "MAGICAL" | "MENTAL";
  description: string;
  tags: string[];
  // Primitives linked directly to capability (role: AUGMENT)
  directPrimNames: string[];
  // Effects nested under capability
  effects: EffectSpec[];
}

// 4 capabilities demonstrating full nesting:
const CAPABILITIES: CapabilitySpec[] = [
  {
    name: "Divine Smite",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    slotTab: "MANIFEST",
    description:
      "Channel divine energy for extra radiant damage when health is low. Grants advantage on the attack roll.",
    tags: ["combat", "divine"],
    directPrimNames: [],
    effects: [
      {
        name: "Smite",
        description: "Radiant damage + advantage on smite attack",
        primitiveNames: ["Smite Damage", "Advantage on Communion"],
      },
    ],
  },
  {
    name: "Hunter's Mark",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    slotTab: "UPBRINGING",
    description:
      "+2 to hit when you have marked a target. The mark imposes disadvantage on the target's stealth.",
    tags: ["combat", "ranged"],
    directPrimNames: [],
    effects: [
      {
        name: "Marked",
        description: "+2 attack vs marked target; target disadvantaged on stealth",
        primitiveNames: ["Mark of the Hunt"],
      },
      {
        name: "Hunted",
        description: "Target has disadvantage on stealth checks",
        primitiveNames: ["Disadvantage on Influence"],
      },
    ],
  },
  {
    name: "Stone's Endurance",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    slotTab: "LINEAGE",
    description:
      "+2 physical defense. Also grants a reaction to reduce incoming damage by PB/2.",
    tags: ["defense"],
    directPrimNames: ["Stone Skin"], // owns Stone Skin (Iron Defender defers)
    effects: [
      {
        name: "Endure",
        description: "Reactive damage reduction (half PB)",
        primitiveNames: ["PB Half"],
      },
      {
        name: "Heart of Stone",
        description:
          "Unwavering focus — Awareness checks cannot roll below 11.",
        primitiveNames: ["Awareness Floor 11"],
      },
    ],
  },
  {
    name: "Iron Defender",
    type: "PASSIVE",
    sourceType: "MAGICAL",
    slotTab: "MANIFEST",
    description:
      "Armor plating grants a minimum of 10 on defense/practice rolls and " +
      "Stone Skin protection (shared with Stone's Endurance).",
    tags: ["defense", "armor"],
    directPrimNames: [], // Stone Skin already owned by Stone's Endurance
    effects: [
      {
        name: "Plating",
        description: "Minimum 10 on defense rolls",
        primitiveNames: ["Floor 10"],
      },
    ],
  },
  {
    name: "Vitality Constitution",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    slotTab: "LINEAGE",
    description:
      "Lineage-derived durability — caps the character's max vitality so it stays within a survivable range.",
    tags: ["vitality", "defense"],
    directPrimNames: [],
    // Phase 8.L round 35 (Mashu 2026-08-13): Vitality Floor and
    // Ceiling were previously seeded as direct PERSONAL
    // primitives, severing the origin and leaving them with no
    // accordion/breadcrumb. Moving them under this capability
    // restores the full inheritance chain.
    effects: [
      {
        name: "Vitality Bounds",
        description: "Floor and ceiling on max vitality",
        primitiveNames: ["Vitality Floor", "Vitality Ceiling"],
      },
    ],
  },
];

// ── Source mapping: which primitives are direct character primitives
//    (not from any capability) and which source/accordion they belong to.
//    Primitives listed in CAPABILITIES are NOT attached directly to the
//    character — they come through their capability/effect.
const CAPABILITY_PRIM_NAMES = new Set(
  CAPABILITIES.flatMap(c => [...c.directPrimNames, ...c.effects.flatMap(e => e.primitiveNames)]),
);

const CHARACTER_PRIM_NAMES = PRIMITIVES.filter(
  p => p.source !== "PERSONAL" || (PRIMITIVES.filter(x => x.name === p.name).length > 0 && !CAPABILITY_PRIM_NAMES.has(p.name)),
).map(p => p.name);

async function main() {
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is not set. Run with .env.local exported.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // 1. Delete any existing test character of this name so re-runs are idempotent.
  const charRes = await pool.query(
    `SELECT id FROM characters WHERE user_id = $1 AND name = $2 ORDER BY created_at DESC LIMIT 1`,
    [MASHU_USER_ID, "i2 Test Character"],
  );
  let characterId: string;
  if ((charRes.rowCount ?? 0) > 0) {
    characterId = charRes.rows[0].id;
    // Clean up old links
    await pool.query(`DELETE FROM character_primitives WHERE character_id = $1::uuid`, [characterId]);
    await pool.query(`DELETE FROM character_capabilities WHERE character_id = $1::uuid`, [characterId]);
    // Also remove any other character_capabilities rows that reference capabilities owned by this user
    await pool.query(`DELETE FROM character_capabilities WHERE capability_id IN (SELECT id FROM capabilities WHERE user_id = $1)`, [MASHU_USER_ID]);
    await pool.query(`DELETE FROM capability_effects WHERE capability_id IN (SELECT id FROM capabilities WHERE user_id = $1)`, [MASHU_USER_ID]);
    await pool.query(`DELETE FROM capability_primitives WHERE capability_id IN (SELECT id FROM capabilities WHERE user_id = $1)`, [MASHU_USER_ID]);
    await pool.query(`DELETE FROM capability_versions WHERE capability_id IN (SELECT id FROM capabilities WHERE user_id = $1)`, [MASHU_USER_ID]);
    // Delete effects that are no longer referenced (orphaned)
    await pool.query(`DELETE FROM effect_primitives WHERE effect_id IN (SELECT id FROM effects WHERE user_id = $1)`, [MASHU_USER_ID]);
    await pool.query(`DELETE FROM effects WHERE user_id = $1`, [MASHU_USER_ID]);
    await pool.query(`DELETE FROM capabilities WHERE user_id = $1`, [MASHU_USER_ID]);
    // Don't delete primitives — they are upserted via ON CONFLICT below.
    // This avoids FK violations from other characters referencing them.
  } else {
    // Insert new character
    const res = await pool.query(
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
        4, 4, 2,         // attr sum = 10
        "PHYSICAL",
        JSON.stringify({ FIELDCRAFT: 0, AWARENESS: 0, REASON: 0 }),
        200, 100, 0,     // starting BU, spent, bonus
      ],
    );
    characterId = res.rows[0].id;
  }
  console.log(`✓ Character: i2 Test Character (${characterId})`);

  // 2. Upsert all 30 primitives
  const sourceOrigin = `user:${MASHU_USER_ID}`;
  const primIds: Record<string, number> = {};
  for (const p of PRIMITIVES) {
    const r = await pool.query(
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
             category = EXCLUDED.category,
             is_mirrorable = EXCLUDED.is_mirrorable,
             mirror_bu_credit = EXCLUDED.mirror_bu_credit,
             updated_at = now()
       RETURNING id`,
      [
        p.name, MASHU_USER_ID, p.category, p.buCost,
        p.isMirrorable, p.mirrorBuCredit, JSON.stringify(p.hardModifiers),
        p.description ?? "", sourceOrigin,
      ],
    );
    primIds[p.name] = r.rows[0].id;
  }
  console.log(`✓ Upserted ${PRIMITIVES.length} primitives`);

  // 3. Attach direct character primitives (not from capabilities)
  //    with proper source for accordion placement.
  const attachedDirect: string[] = [];
  for (const p of PRIMITIVES) {
    if (CAPABILITY_PRIM_NAMES.has(p.name)) continue; // skip capability-owned
    // Check if already linked
    const existing = await pool.query(
      `SELECT 1 FROM character_primitives WHERE character_id = $1::uuid AND primitive_id = $2`,
      [characterId, primIds[p.name]],
    );
    if ((existing.rowCount ?? 0) > 0) {
      attachedDirect.push(p.name);
      continue; // already linked, skip
    }
    await pool.query(
      `INSERT INTO character_primitives
        (character_id, primitive_id, origin_capability_id, is_mirrored,
         acquired_at_level, source)
       VALUES ($1::uuid, $2, null, $3, 1, $4)`,
      [characterId, primIds[p.name], p.name === "Mirrored Str Buff", p.source],
    );
    attachedDirect.push(p.name);
  }
  console.log(`✓ Attached ${attachedDirect.length} direct primitives:`);
  for (const name of attachedDirect) {
    const p = PRIMITIVES.find(x => x.name === name)!;
    console.log(`    [${p.source}] ${p.name}`);
  }

  // 4a. Create heritage rows for the LINEAGE capability bundle.
  //     Stone's Endurance is acquired via the lineage accordion
  //     (slotTab: 'LINEAGE'), so it has a heritage parent. We
  //     create a synthetic "Stone Goliath" heritage that owns
  //     Stone's Endurance, then link it to the character via
  //     character_heritages. The heritageId is then used as
  //     origin_heritage_id on the expanded character_primitives
  //     to power the full inheritance chain in the provenance
  //     breadcrumb.
  const heritageBySlotTab = new Map<string, string>();
  {
    // Find existing heritage by name (no unique constraint on
    // (name, source_origin) so we have to query first).
    let lineageHer = await pool.query(
      `SELECT id FROM heritage WHERE name = $1 AND source_origin = $2 LIMIT 1`,
      ["Stone Goliath", sourceOrigin],
    );
    if (lineageHer.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO heritage (user_id, name, kind, description, is_public, source_origin)
         VALUES ($1, $2, $3, $4, false, $5)
         RETURNING id`,
        [MASHU_USER_ID, "Stone Goliath", "LINEAGE", "A heritage of stone-skinned giants.", sourceOrigin],
      );
      lineageHer = { rows: inserted.rows };
    }
    // NOTE: Per Mashu round 12 — Stone's Endurance is a DIRECT
    // LINEAGE capability, NOT a capability nested within Stone
    // Goliath. The heritage row is still created (so the bundle
    // exists in the data model) but it owns NO capabilities.
    // Stone's Endurance's primitives get origin_heritage_id = NULL
    // via the slotTab=LINEAGE → heritageBySlotTab lookup returning
    // null for that path. Awareness Floor 11's chain becomes:
    // Lineage (accordion) > Stone's Endurance (capability) > Heart
    // of Stone (effect).
    heritageBySlotTab.set("LINEAGE", null);
    // DO NOT insert into heritage_capabilities — Stone's Endurance
    // is a direct LINEAGE-tab capability, not a child of Stone
    // Goliath.
    // DO NOT insert into character_heritages — same reason. The
    // heritage row exists only as a placeholder that ships an
    // empty bundle to /atelier (for testing the UI).
    console.log(`  ✓ Heritage row created (Stone Goliath — empty bundle, no caps slotted)`);
  }

  // 4. Create capabilities with effect nesting
  //    capability_primitives → capability_effects → effect_primitives
  for (const cap of CAPABILITIES) {
    // Create capability
    const capRes = await pool.query(
      `INSERT INTO capabilities
        (user_id, name, type, source_type, verbose_description, tags, is_public, source_origin)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7)
       ON CONFLICT (name, source_origin) DO UPDATE
         SET verbose_description = EXCLUDED.verbose_description,
             tags = EXCLUDED.tags,
             type = EXCLUDED.type,
             source_type = EXCLUDED.source_type
       RETURNING id`,
      [MASHU_USER_ID, cap.name, cap.type, cap.sourceType, cap.description, cap.tags, sourceOrigin],
    );
    const capId = capRes.rows[0].id;
    console.log(`  ✓ Capability: ${cap.name} (${capId})`);

    // Link capability_primitives (direct primitives with role AUGMENT)
    for (const primName of cap.directPrimNames) {
      await pool.query(
        `INSERT INTO capability_primitives
          (capability_id, primitive_id, role, sort_order)
         VALUES ($1, $2, 'AUGMENT', 0)
         ON CONFLICT DO NOTHING`,
        [capId, primIds[primName]],
      );
      console.log(`    ✓ capability_primitives: ${primName} (role: AUGMENT)`);
    }

    // Create nested effects + link via capability_effects + effect_primitives
    for (const eff of cap.effects) {
      const effRes = await pool.query(
        `INSERT INTO effects (user_id, name, narrative_description, is_public, tags, source_origin)
         VALUES ($1, $2, $3, false, '{}', $4)
         ON CONFLICT (name, source_origin) DO UPDATE
           SET narrative_description = EXCLUDED.narrative_description
         RETURNING id`,
        [MASHU_USER_ID, eff.name, eff.description, sourceOrigin],
      );
      const effId = effRes.rows[0].id;
      console.log(`    ✓ Effect: ${eff.name} (${effId})`);

      // Link capability → effect via capability_effects
      await pool.query(
        `INSERT INTO capability_effects (capability_id, effect_id, sort_order)
         VALUES ($1, $2, 0)
         ON CONFLICT DO NOTHING`,
        [capId, effId],
      );

      // Link effect → primitives via effect_primitives
      for (let i = 0; i < eff.primitiveNames.length; i++) {
        const primName = eff.primitiveNames[i];
        await pool.query(
          `INSERT INTO effect_primitives (effect_id, primitive_id, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [effId, primIds[primName], i],
        );
        console.log(`      ✓ effect_primitives: ${primName}`);
      }
    }

    // Link capability to character via character_capabilities
    await pool.query(
      `INSERT INTO character_capabilities
        (character_id, capability_id, acquired_at_level, version_id, slot_tab)
       VALUES ($1::uuid, $2, 18, null, $3::heritage_kind)
       ON CONFLICT (character_id, capability_id) DO UPDATE SET slot_tab = EXCLUDED.slot_tab`,
      [characterId, capId, cap.slotTab ?? "MANIFEST"],
    );
    console.log(`    ✓ Linked to character`);

    // Phase 8.I i3: Expand capability → effect → primitive into
    // character_primitives with origin tracking, so the resolver
    // picks them up via the standard character_primitives query.
    // Direct capability_primitives (role: AUGMENT etc.) → origin_capability_id
    // Effect primitives via capability_effects → effect_primitives → origin_effect_id + origin_capability_id

    // a) Direct capability_primitives → expand into character_primitives
    // Phase 8.L round 12 (Mashu): Stone's Endurance is a DIRECT
    // capability in the LINEAGE accordion — NOT nested within any
    // heritage. So for slotTab=LINEAGE caps, set origin_heritage_id
    // to null. The accordion name is surfaced separately (as the
    // outer frame) when the user inspects the lineage tab.
    const heritageId =
      cap.slotTab === "LINEAGE" || cap.slotTab === "UPBRINGING" || cap.slotTab === "MANIFEST"
        ? null
        : (heritageBySlotTab.get(cap.slotTab ?? "MANIFEST") ?? null);
    for (const primName of cap.directPrimNames) {
      await pool.query(
        `DELETE FROM character_primitives
         WHERE character_id = $1::uuid AND primitive_id = $2`,
        [characterId, primIds[primName]],
      );
      await pool.query(
        `INSERT INTO character_primitives
          (character_id, primitive_id, origin_capability_id, origin_heritage_id,
           is_mirrored, acquired_at_level, source)
         VALUES ($1::uuid, $2, $3, $4, false, 18, 'PERSONAL')`,
        [characterId, primIds[primName], capId, heritageId],
      );
      console.log(`    ✓ Expanded direct primitive: ${primName}`);
    }

    // b) Effect primitives → expand into character_primitives with origin_effect_id
    for (const eff of cap.effects) {
      const effRow = await pool.query(
        `SELECT id FROM effects WHERE name = $1 AND source_origin = $2`,
        [eff.name, sourceOrigin],
      );
      const effId = effRow.rows[0]?.id;
      if (!effId) continue;

      for (const primName of eff.primitiveNames) {
        await pool.query(
          `DELETE FROM character_primitives
           WHERE character_id = $1::uuid AND primitive_id = $2`,
          [characterId, primIds[primName]],
        );
        await pool.query(
          `INSERT INTO character_primitives
            (character_id, primitive_id, origin_capability_id, origin_effect_id,
             origin_heritage_id, is_mirrored, acquired_at_level, source)
           VALUES ($1::uuid, $2, $3, $4, $5, false, 18, 'PERSONAL')`,
          [characterId, primIds[primName], capId, effId, heritageId],
        );
        console.log(`    ✓ Expanded effect primitive: ${primName} (via ${cap.name} → ${eff.name})`);
      }
    }
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`  character: ${characterId}`);
  console.log(`  primitives: ${PRIMITIVES.length} (direct + capability-owned)`);
  console.log(`  capabilities: ${CAPABILITIES.length}`);
  console.log(`  Link: /characters/${characterId}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
