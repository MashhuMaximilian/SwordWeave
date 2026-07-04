/**
 * Library seed — Phase 4.5-B.
 *
 * Populates the Sandbox / Library with starter content so the workspace isn't
 * empty when users explore it. Creates:
 *   - 5 races        (templates, kind=RACE, linked to HERITAGE_AUGMENT prims)
 *   - 5 backgrounds  (templates, kind=BACKGROUND, linked to BACKGROUND_AUGMENT)
 *   - 5 archetypes   (templates, kind=ARCHETYPE, linked to CHARACTER_SHEET_AUGMENT)
 *   - 5 items        (items table, linked to ITEM_AUGMENT prims via itemPrimitives)
 *
 * All entries are seeded as system content (user_id=NULL, is_public=true) so
 * they appear in everyone's library.
 *
 * Idempotent: ON CONFLICT skips/updates.
 */
import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

// ===========================================================================
// Definitions
// ===========================================================================

const RACE_IMG = (slug: string) =>
  `https://placehold.co/400x400/2a2a3e/ffffff?text=${encodeURIComponent(slug)}`;

const RACES = [
  {
    name: "Human",
    description: "Adaptable generalists. Humans span every culture and tradition, and their breadth of experience grants them a foothold in every Practice.",
    heritagePrimName: "Versatile Heritage (Broad Training)",
    traits: "**Versatile**: +1 to all 10 Practice slices (broad shallow baseline). No attribute modifier — Humans fit anywhere in the +5 to -1 spectrum.",
  },
  {
    name: "Mountainfolk",
    description: "Stone-boned highlanders from the spine of the world. Dense, stubborn, and built to endure the long cold.",
    heritagePrimName: "Hardy Heritage (Mountain/Sturdy)",
    traits: "**Hardy**: +5 max Vitality, +1 to one Physical Practice. Tough mountain-bred physiology.",
  },
  {
    name: "Star-Touched",
    description: "Descendants of those who walked the comet road. Born with light in their veins and an arcane attunement that manifests as a Cantrip at no cost.",
    heritagePrimName: "Arcane Heritage (Star-Touched)",
    traits: "**Arcane Affinity**: +1 to one Magical Practice, plus the Cantrip capability comes **free** as part of the heritage.",
  },
  {
    name: "Forestkind",
    description: "Born under the green canopy. Their senses extend beyond ordinary sight — they hear the moss and smell the rain a day away.",
    heritagePrimName: "Keen Senses (Forestkind)",
    traits: "**Keen Senses**: Passive perception capability + Environmental Translation (thermal / darkvision-adjacent sensory permission).",
  },
  {
    name: "Ironborn",
    description: "Their bones carry flecks of true iron — a heritage from the deep delvings. Massive HP pool and built-in physical resistance.",
    heritagePrimName: "Ironborn Resilience",
    traits: "**Ironborn**: +10 max Vitality, Resistance to Physical damage (take half).",
  },
];

const BACKGROUNDS = [
  {
    name: "Scholar",
    description: "Years hunched over dusty tomes. The Scholar's mind cuts to the heart of a problem with surgical precision.",
    bgPrimName: "Scholar Background",
    traits: "**Lore-bound**: +2 Reason (Mental), grants Lore capability.",
  },
  {
    name: "Soldier",
    description: "Drilled in formation and march. The Soldier knows the rhythm of a fight before the first blade is drawn.",
    bgPrimName: "Soldier Background",
    traits: "**Drilled**: +2 to one Physical Practice, grants Formation Fighting capability.",
  },
  {
    name: "Wanderer",
    description: "The roads are a home. A Wanderer reads the land the way scholars read books.",
    bgPrimName: "Wanderer Background",
    traits: "**Wayfinder**: +2 Fieldcraft, grants Travel Sense (sub-acoustic vibration mapping).",
  },
  {
    name: "Courtier",
    description: "Maneuvered the gilded cages of noble courts. Reads intent the way a hunter reads tracks.",
    bgPrimName: "Courtier Background",
    traits: "**Silver-tongued**: +2 Influence (Mental), grants Read Person capability.",
  },
  {
    name: "Tinkerer",
    description: "Self-taught engineer. Builds solutions from whatever scrap is at hand.",
    bgPrimName: "Tinkerer Background",
    traits: "**Improvised**: +2 to one Magical Practice, grants Improvise Tool capability.",
  },
];

const ARCHETYPES = [
  {
    name: "Striker",
    description: "Lives by the blade. Striker archetypes are built to put damage on the table — fast and decisive.",
    charSheetPrims: ["Striker Archetype — Offense Slot", "Striker Archetype — Dual Wield Slot"],
    traits: "**Pre-loaded**: Offense capability + Dual Wield capability. Pure DPS scaffold.",
  },
  {
    name: "Guardian",
    description: "Stands between the vulnerable and the blow. The Guardian buys time for everyone else.",
    charSheetPrims: ["Guardian Archetype — Defense Slot", "Guardian Archetype — Shield Wall Slot"],
    traits: "**Pre-loaded**: Defense capability + Shield Wall capability. Tank scaffold.",
  },
  {
    name: "Mystic",
    description: "Channels the threads of magic directly. The Mystic's book is their weapon — and their shield.",
    charSheetPrims: ["Mystic Archetype — Spell Slot", "Mystic Archetype — Cantrip Slot"],
    traits: "**Pre-loaded**: Spell capability + Cantrip capability. Caster scaffold.",
  },
  {
    name: "Skirmisher",
    description: "Never where the strike lands. The Skirmisher wins fights by repositioning faster than the enemy can react.",
    charSheetPrims: ["Skirmisher Archetype — Mobility Slot", "Skirmisher Archetype — Evade Slot"],
    traits: "**Pre-loaded**: Mobility capability + Evade capability. Hit-and-run scaffold.",
  },
  {
    name: "Artificer",
    description: "Part wizard, part engineer. The Artificer enchants and constructs in the field — the battlefield is their workshop.",
    charSheetPrims: ["Artificer Archetype — Craft Slot", "Artificer Archetype — Imbue Item Slot"],
    traits: "**Pre-loaded**: Craft capability + Imbue Item capability. Fabrication scaffold.",
  },
];

const ITEMS = [
  {
    name: "Steel Longsword",
    itemType: "WEAPON",
    rarity: "COMMON",
    slotCost: 1,
    isTwoHanded: false,
    isConsumable: false,
    description: "Standard forged steel longsword. A reliable weapon for any striker.",
    itemPrimName: "Steel Longsword (Offense +1)",
  },
  {
    name: "Oak Shield",
    itemType: "ARMOR",
    rarity: "COMMON",
    slotCost: 1,
    isTwoHanded: false,
    isConsumable: false,
    description: "Sturdy oak-and-iron shield. The Guardian's companion.",
    itemPrimName: "Oak Shield (Defense +1, +2 Block)",
  },
  {
    name: "Healing Tonic",
    itemType: "CONSUMABLE",
    rarity: "COMMON",
    slotCost: 1,
    isTwoHanded: false,
    isConsumable: true,
    description: "Single-use alchemical remedy. Restores 1d6 vitality on use.",
    itemPrimName: "Healing Tonic (Consumable, Restore 1d6 Vitality)",
  },
  {
    name: "Arcane Focus",
    itemType: "TRINKET",
    rarity: "RARE",
    slotCost: 1,
    isTwoHanded: false,
    isConsumable: false,
    description: "Attuned crystal or carved focus. Adds +1 to spell DCs cast through it.",
    itemPrimName: "Arcane Focus (+1 Spell DCs, acts as focus)",
  },
  {
    name: "Traveler's Cloak",
    itemType: "ARMOR",
    rarity: "COMMON",
    slotCost: 1,
    isTwoHanded: false,
    isConsumable: false,
    description: "Heavy waxed traveling cloak. Grants resistance to weather/cold damage when worn.",
    itemPrimName: "Traveler's Cloak (Weather Resistance)",
  },
];

// ===========================================================================
// Helpers
// ===========================================================================

async function getPrimId(name: string, category: string): Promise<number> {
  const r: any = await db.execute(sql`
    SELECT id FROM primitives
    WHERE name = ${name} AND category = ${category}::primitive_category
      AND is_public = true AND user_id IS NULL
    LIMIT 1
  `);
  const id = r.rows?.[0]?.id;
  if (!id) throw new Error(`Primitive not found: ${name} (${category})`);
  return Number(id);
}

async function upsertTemplate(
  kind: "RACE" | "BACKGROUND" | "ARCHETYPE",
  name: string,
  description: string,
  traits: string,
  imageUrl: string,
  primIds: number[],
): Promise<string> {
  // Insert template (or update if exists). user_id NULL = system template.
  const tRes: any = await db.execute(sql`
    INSERT INTO templates (kind, name, description, suggested_traits, image_url, is_public, user_id, source_origin, created_at, updated_at)
    VALUES (${kind}::template_kind, ${name}, ${description}, ${traits}, ${imageUrl}, true, NULL, ${"system:" + kind.toLowerCase()}, NOW(), NOW())
    ON CONFLICT (name, user_id, kind) DO UPDATE SET
      description = EXCLUDED.description,
      suggested_traits = EXCLUDED.suggested_traits,
      image_url = EXCLUDED.image_url,
      updated_at = NOW()
    RETURNING id
  `);
  const templateId = tRes.rows?.[0]?.id as string;
  if (!templateId) throw new Error(`Failed to upsert template ${name}`);

  // Replace primitive links: delete existing, reinsert
  await db.execute(sql`DELETE FROM template_primitives WHERE template_id = ${templateId}::uuid`);
  for (let i = 0; i < primIds.length; i++) {
    await db.execute(sql`
      INSERT INTO template_primitives (template_id, primitive_id, sort_order, created_at, updated_at)
      VALUES (${templateId}::uuid, ${primIds[i]}, ${i}, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  return templateId;
}

async function upsertItem(
  name: string,
  itemType: string,
  rarity: string,
  slotCost: number,
  isTwoHanded: boolean,
  isConsumable: boolean,
  description: string,
  itemPrimId: number,
): Promise<string> {
  // items.name is unique per source_origin (which we set to 'system:item').
  const iRes: any = await db.execute(sql`
    INSERT INTO items (name, item_type, rarity, bu_cost, description, slot_cost, is_two_handed, is_consumable, acts_as_focus, is_public, source_origin, created_at, updated_at)
    VALUES (${name}, ${itemType}::item_type, ${rarity}::item_rarity, 0, ${description}, ${slotCost}, ${isTwoHanded}, ${isConsumable}, true, true, ${"system:item"}, NOW(), NOW())
    ON CONFLICT (name, source_origin) DO UPDATE SET
      description = EXCLUDED.description,
      slot_cost = EXCLUDED.slot_cost,
      is_two_handed = EXCLUDED.is_two_handed,
      is_consumable = EXCLUDED.is_consumable,
      updated_at = NOW()
    RETURNING id
  `);
  const itemId = iRes.rows?.[0]?.id as string;
  if (!itemId) throw new Error(`Failed to upsert item ${name}`);

  // Check if itemPrimitives table exists; if so, link the augment.
  // (May not exist in early schemas — log and skip if so.)
  try {
    await db.execute(sql`
      INSERT INTO item_primitives (item_id, primitive_id, sort_order, created_at, updated_at)
      VALUES (${itemId}::uuid, ${itemPrimId}, 0, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
  } catch (e: any) {
    console.log(`  (item_primitives link skipped: ${e.message?.slice(0, 60)})`);
  }

  return itemId;
}

// ===========================================================================
// Main
// ===========================================================================

async function main() {
  console.log("Seeding library content...\n");

  console.log("RACES:");
  for (const race of RACES) {
    const primId = await getPrimId(race.heritagePrimName, "HERITAGE_AUGMENT");
    await upsertTemplate(
      "RACE",
      race.name,
      race.description,
      race.traits,
      RACE_IMG(race.name),
      [primId],
    );
    console.log(`  ✓ ${race.name} (prim ${primId})`);
  }

  console.log("\nBACKGROUNDS:");
  for (const bg of BACKGROUNDS) {
    const primId = await getPrimId(bg.bgPrimName, "BACKGROUND_AUGMENT");
    await upsertTemplate(
      "BACKGROUND",
      bg.name,
      bg.description,
      bg.traits,
      RACE_IMG(bg.name),
      [primId],
    );
    console.log(`  ✓ ${bg.name} (prim ${primId})`);
  }

  console.log("\nARCHETYPES:");
  for (const arch of ARCHETYPES) {
    const primIds: number[] = [];
    for (const pn of arch.charSheetPrims) {
      primIds.push(await getPrimId(pn, "CHARACTER_SHEET_AUGMENT"));
    }
    await upsertTemplate(
      "ARCHETYPE",
      arch.name,
      arch.description,
      arch.traits,
      RACE_IMG(arch.name),
      primIds,
    );
    console.log(`  ✓ ${arch.name} (prims ${primIds.join(", ")})`);
  }

  console.log("\nITEMS:");
  for (const item of ITEMS) {
    const primId = await getPrimId(item.itemPrimName, "ITEM_AUGMENT");
    await upsertItem(
      item.name,
      item.itemType,
      item.rarity,
      item.slotCost,
      item.isTwoHanded,
      item.isConsumable,
      item.description,
      primId,
    );
    console.log(`  ✓ ${item.name} (prim ${primId})`);
  }

  console.log("\n✓ Library seed complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });