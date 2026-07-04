/**
 * Library augmentation primitive seed — Phase 4.5-B.
 *
 * The BU Market seed (seed-bu-market.ts) covers the system-level primitives.
 * This script adds the per-archetype augmentation primitives that library
 * entries (races, backgrounds, items, archetypes) reference when composed.
 *
 * Categories filled:
 *   - HERITAGE_AUGMENT      — racial traits (e.g. "+5 Vitality", "Cantrip License")
 *   - BACKGROUND_AUGMENT    — background skills (e.g. "+2 Mental Practice", "Survivalist")
 *   - CHARACTER_SHEET_AUGMENT — archetype scaffolding (e.g. "Offense Slot", "Defense Slot")
 *   - ITEM_AUGMENT          — item capability grants (e.g. "Offense +1", "Heal Self")
 *
 * Idempotent: ON CONFLICT updates existing rows.
 */
import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

type AugRow = {
  name: string;
  category: "HERITAGE_AUGMENT" | "BACKGROUND_AUGMENT" | "CHARACTER_SHEET_AUGMENT" | "ITEM_AUGMENT";
  buCost: number;
  costTier: string;
  mechanicalOutputText: string;
  narrativeRule: string;
  /** Mirrorable category entries (rare; mostly permissions). */
  isMirrorable?: boolean;
  mirrorBuCredit?: number;
};

const SEED: AugRow[] = [
  // ===========================================================================
  // HERITAGE_AUGMENT — racial traits
  // ===========================================================================
  { name: "Versatile Heritage (Broad Training)", category: "HERITAGE_AUGMENT", buCost: 8,
    costTier: "Tier 3 — Major (8 BU anchor)",
    mechanicalOutputText: "+1 to ALL 10 Practice slices (broad shallow baseline across all attributes).",
    narrativeRule: "Heritage of generalists. Apply +1 to every Practice without spending per-Practice proficiency." },
  { name: "Hardy Heritage (Mountain/Sturdy)", category: "HERITAGE_AUGMENT", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "+5 max Vitality and +1 to one Physical Practice.",
    narrativeRule: "Tough mountain-bred physiology. Bonus HP and physical resilience." },
  { name: "Arcane Heritage (Star-Touched)", category: "HERITAGE_AUGMENT", buCost: 8,
    costTier: "Tier 3 — Major (8 BU anchor)",
    mechanicalOutputText: "+1 to one Magical Practice and grants the Cantrip capability at no additional cost.",
    narrativeRule: "Innate arcane attunement. Cantrip is unlocked as part of the heritage, not bought separately." },
  { name: "Keen Senses (Forestkind)", category: "HERITAGE_AUGMENT", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Grants passive perception capability + Environmental Translation sensory permission.",
    narrativeRule: "Preternatural awareness — sense anomalies others miss, including in low light." },
  { name: "Ironborn Resilience", category: "HERITAGE_AUGMENT", buCost: 8,
    costTier: "Tier 3 — Major (8 BU anchor)",
    mechanicalOutputText: "+10 max Vitality and Resistance to Physical damage (half damage).",
    narrativeRule: "Dense iron-shard-boned heritage. Massive HP pool with built-in physical resistance." },

  // ===========================================================================
  // BACKGROUND_AUGMENT — pre-adventurer skills
  // ===========================================================================
  { name: "Scholar Background", category: "BACKGROUND_AUGMENT", buCost: 5,
    costTier: "Tier 2 — Standard (5 BU anchor)",
    mechanicalOutputText: "+2 to Reason (Mental Practice) and grants the Lore capability.",
    narrativeRule: "Years of study. Strong deductive reasoning and historical knowledge." },
  { name: "Soldier Background", category: "BACKGROUND_AUGMENT", buCost: 5,
    costTier: "Tier 2 — Standard (5 BU anchor)",
    mechanicalOutputText: "+2 to one Physical Practice (Strike or Endure) and grants the Formation Fighting capability.",
    narrativeRule: "Drilled military training. Movement in unit cohesion and weapon discipline." },
  { name: "Wanderer Background", category: "BACKGROUND_AUGMENT", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "+2 to Fieldcraft and grants Travel Sense (sub-acoustic vibration mapping up to 30ft).",
    narrativeRule: "On the road for years. Excellent wayfinding and path-reading." },
  { name: "Courtier Background", category: "BACKGROUND_AUGMENT", buCost: 5,
    costTier: "Tier 2 — Standard (5 BU anchor)",
    mechanicalOutputText: "+2 to Influence (Mental Practice) and grants the Read Person capability.",
    narrativeRule: "Maneuvered noble courts. Reads intent and emotional tells." },
  { name: "Tinkerer Background", category: "BACKGROUND_AUGMENT", buCost: 5,
    costTier: "Tier 2 — Standard (5 BU anchor)",
    mechanicalOutputText: "+2 to one Magical Practice and grants the Improvise Tool capability.",
    narrativeRule: "Self-taught engineer. Builds solutions from available parts on the fly." },

  // ===========================================================================
  // CHARACTER_SHEET_AUGMENT — archetype scaffolding
  // ===========================================================================
  { name: "Striker Archetype — Offense Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Offense capability (gains one standard attack verb).",
    narrativeRule: "Archetype scaffolding — the Striker's core combat action." },
  { name: "Striker Archetype — Dual Wield Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Dual Wield capability (off-hand attack profile).",
    narrativeRule: "Archetype scaffolding — the Striker's signature weapon configuration." },
  { name: "Guardian Archetype — Defense Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Defense capability (raise shield / parry action).",
    narrativeRule: "Archetype scaffolding — the Guardian's core defensive action." },
  { name: "Guardian Archetype — Shield Wall Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Shield Wall capability (ally protection profile).",
    narrativeRule: "Archetype scaffolding — the Guardian's signature defensive formation." },
  { name: "Mystic Archetype — Spell Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Spell capability (cast a known spell).",
    narrativeRule: "Archetype scaffolding — the Mystic's core spellcasting action." },
  { name: "Mystic Archetype — Cantrip Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Cantrip capability (at-will minor spell).",
    narrativeRule: "Archetype scaffolding — the Mystic's at-will utility." },
  { name: "Skirmisher Archetype — Mobility Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Mobility capability (Stride Extension bonus).",
    narrativeRule: "Archetype scaffolding — the Skirmisher's movement profile." },
  { name: "Skirmisher Archetype — Evade Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Evade capability (dodge-and-disengage action).",
    narrativeRule: "Archetype scaffolding — the Skirmisher's signature defensive reposition." },
  { name: "Artificer Archetype — Craft Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Craft capability (create/modify objects).",
    narrativeRule: "Archetype scaffolding — the Artificer's core fabrication action." },
  { name: "Artificer Archetype — Imbue Item Slot", category: "CHARACTER_SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "Pre-loads the Imbue Item capability (transfer enchantment to held object).",
    narrativeRule: "Archetype scaffolding — the Artificer's signature item-enchanting action." },

  // ===========================================================================
  // ITEM_AUGMENT — item capability grants
  // ===========================================================================
  { name: "Steel Longsword (Offense +1)", category: "ITEM_AUGMENT", buCost: 0,
    costTier: "Tier 1 — Minor (0 BU anchor — item)",
    mechanicalOutputText: "Grants Offense +1 capability when wielded. 1H melee weapon.",
    narrativeRule: "Standard forged steel longsword. Item BU does not count toward character progression pool." },
  { name: "Oak Shield (Defense +1, +2 Block)", category: "ITEM_AUGMENT", buCost: 0,
    costTier: "Tier 1 — Minor (0 BU anchor — item)",
    mechanicalOutputText: "Grants Defense capability and +2 Block when equipped. 1H shield.",
    narrativeRule: "Sturdy oak-and-iron shield. Item BU separate from character pool." },
  { name: "Healing Tonic (Consumable, Restore 1d6 Vitality)", category: "ITEM_AUGMENT", buCost: 0,
    costTier: "Tier 1 — Minor (0 BU anchor — item)",
    mechanicalOutputText: "Consumable. On use, grants the Heal Self capability that restores 1d6 vitality.",
    narrativeRule: "Single-use alchemical remedy. Item BU separate from character pool." },
  { name: "Arcane Focus (+1 Spell DCs, acts as focus)", category: "ITEM_AUGMENT", buCost: 0,
    costTier: "Tier 1 — Minor (0 BU anchor — item)",
    mechanicalOutputText: "When held, adds +1 to spell DCs cast through this focus. Counts as focus for casting requirements.",
    narrativeRule: "Attuned crystal or carved focus. Item BU separate from character pool." },
  { name: "Traveler's Cloak (Weather Resistance)", category: "ITEM_AUGMENT", buCost: 0,
    costTier: "Tier 1 — Minor (0 BU anchor — item)",
    mechanicalOutputText: "When worn, grants resistance to weather/cold-based environmental damage.",
    narrativeRule: "Heavy waxed traveling cloak. Item BU separate from character pool." },
];

async function main() {
  console.log(`Seeding ${SEED.length} library augmentation primitives...`);
  let inserted = 0, updated = 0;

  for (const row of SEED) {
    const result = await db.execute(sql`
      INSERT INTO primitives (
        name, category, cost_tier, bu_cost, mechanical_output_text, narrative_rule,
        is_mirrorable, mirror_bu_credit, mirror_eligibility_notes,
        is_public, user_id, created_at, updated_at
      ) VALUES (
        ${row.name},
        ${row.category}::primitive_category,
        ${row.costTier},
        ${row.buCost},
        ${row.mechanicalOutputText},
        ${row.narrativeRule},
        ${row.isMirrorable ?? false},
        ${row.mirrorBuCredit ?? 0},
        ${""},
        true, NULL, NOW(), NOW()
      )
      ON CONFLICT (name, category, user_id) DO UPDATE SET
        cost_tier = EXCLUDED.cost_tier,
        bu_cost = EXCLUDED.bu_cost,
        mechanical_output_text = EXCLUDED.mechanical_output_text,
        narrative_rule = EXCLUDED.narrative_rule,
        updated_at = NOW()
      RETURNING (xmax = 0) AS was_inserted
    `);
    const wasInserted = (result as any).rows?.[0]?.was_inserted;
    if (wasInserted) inserted++;
    else updated++;
  }

  console.log(`✓ inserted: ${inserted}, updated: ${updated}, total: ${SEED.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });