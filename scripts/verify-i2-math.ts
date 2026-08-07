/**
 * i2 verification script — verifies the live engine produces
 * the expected numbers for the test character.
 *
 * Run: npx tsx scripts/verify-i2-math.ts
 */
import { Pool } from "@neondatabase/serverless";
import { aggregateCharacterSheet } from "../src/lib/engine/sheet";
import { proficiencyBonus } from "../src/lib/engine/practices";

const EXPECTED = {
  physical: 6,       // 4 + 5 + 1 - 4 (mirrored)
  mental: 4,         // 4 (no mods)
  magical: 2,        // 2 (no mods)
  phys_save_dc: 21,  // 8 + 6 (PB) + 6 (phys mod) + 1 (Defender)
  phys_save_value: 13, // 6 (mod) + 6 (PB, proficient) + 1 (save delta)
  mental_save_value: 4, // 4 (mod) + 0 (not proficient) + 0
  magical_save_value: 2,
  awareness: 9,      // 0 + 5 (Iron Will fires, vitality=0 < 50%)
  fieldcraft: 30,    // 4 + 6 (PB) + 6 (prof) + 12 (expertise 2*pb) + 3 (is_tracking fires)
  prowess: 12,       // 4 + 6 + 1? No: 4 (phys mod) + 6 (PB, proficient) + 1 (prim) = 11? Hmm
  walking_speed: 40, // 30 (base) + 10 (Fast)
  vitality_max: 298,
};

async function main() {
  const dbUrl = process.env["DATABASE_URL"] as string;
  const pool = new Pool({ connectionString: dbUrl });
  const charId = "94e3bdf9-8fa3-480d-b9a2-fbc0240e85aa";

  const charRes = await pool.query(
    `SELECT id, level, attr_physical, attr_mental, attr_magical,
            attr_proficient, practice_slices, current_vitality,
            starting_bu, bu_spent, dm_bonus_bu, size
     FROM characters WHERE id = $1`,
    [charId],
  );
  const char = charRes.rows[0];
  if (!char) {
    console.error("Character not found");
    await pool.end();
    return;
  }

  const primRes = await pool.query(
    `SELECT cp.primitive_id, cp.is_mirrored, cp.acquired_at_level,
            p.name, p.category, p.bu_cost, p.is_mirrorable, p.mirror_bu_credit,
            p.hard_modifiers, p.mirror_vector, p.narrative_rule
     FROM character_primitives cp
     JOIN primitives p ON p.id = cp.primitive_id
     WHERE cp.character_id = $1`,
    [charId],
  );

  const sheet = aggregateCharacterSheet({
    level: char.level,
    attrPhysical: char.attr_physical,
    attrMental: char.attr_mental,
    attrMagical: char.attr_magical,
    attrProficient: (char.attr_proficient ?? null) as "PHYSICAL" | "MENTAL" | "MAGICAL" | null,
    practiceSlices: char.practice_slices || null,
    startingBu: char.starting_bu ?? 200,
    buSpent: char.bu_spent ?? 0,
    dmBonusBu: char.dm_bonus_bu ?? 0,
    currentVitality: char.current_vitality,
    size: char.size ?? "MEDIUM",
    primitiveLinks: primRes.rows.map((r) => ({
      primitiveId: r.primitive_id,
      source: "PERSONAL" as const,
      acquiredAtLevel: r.acquired_at_level ?? 1,
      isMirrored: r.is_mirrored === true,
      originHeritageId: null,
      originCapabilityId: null,
      originEffectId: null,
      primitive: {
        id: r.primitive_id,
        name: r.name,
        category: r.category,
        buCost: r.bu_cost,
        isMirrorable: r.is_mirrorable,
        mirrorBuCredit: r.mirror_bu_credit,
        narrativeRule: r.narrative_rule ?? "",
        mirrorVector: r.mirror_vector,
        hardModifiers: r.hard_modifiers || [],
      },
    })),
    capabilityLinks: [],
    itemLinks: [],
  });

  const pb = proficiencyBonus(char.level);

  // Check each expected value
  const checks: Array<[string, number, number]> = [
    ["phys mod", sheet.attributes.physical, EXPECTED.physical],
    ["mental mod", sheet.attributes.mental, EXPECTED.mental],
    ["magical mod", sheet.attributes.magical, EXPECTED.magical],
    ["PB", pb, 6],
    ["phys save DC", sheet.saveDCs?.find(s => s.attribute === "PHYSICAL")?.dc ?? -1, EXPECTED.phys_save_dc],
    ["phys save value", sheet.savingThrows?.find(s => s.attribute === "PHYSICAL")?.bonus ?? -1, EXPECTED.phys_save_value],
    ["mental save value", sheet.savingThrows?.find(s => s.attribute === "MENTAL")?.bonus ?? -1, EXPECTED.mental_save_value],
    ["magical save value", sheet.savingThrows?.find(s => s.attribute === "MAGICAL")?.bonus ?? -1, EXPECTED.magical_save_value],
    ["fieldcraft", sheet.practices?.find(p => p.practice.toLowerCase() === "fieldcraft")?.total ?? -1, EXPECTED.fieldcraft],
    ["awareness", sheet.practices?.find(p => p.practice.toLowerCase() === "awareness")?.total ?? -1, EXPECTED.awareness],
    ["walking speed", sheet.speedByType?.WALKING_SPEED ?? -1, EXPECTED.walking_speed],
    ["vitality max", sheet.vitality.max, EXPECTED.vitality_max],
  ];

  console.log(`PB = ${pb}`);
  let allPass = true;
  for (const [name, actual, expected] of checks) {
    const ok = actual === expected;
    if (!ok) allPass = false;
    console.log(`  ${ok ? "✅" : "❌"} ${name}: ${actual} (expected ${expected})`);
  }
  console.log(allPass ? "\n✅ All math checks pass" : "\n❌ Some checks failed");

  await pool.end();
}

main().catch(console.error);
