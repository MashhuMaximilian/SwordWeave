import { Pool } from "@neondatabase/serverless";
import { aggregateCharacterSheet } from "../src/lib/engine/sheet";

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
    console.error("Character not found:", charId);
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

  const sheets = aggregateCharacterSheet({
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

  console.log("LEVEL 18, PB = 6");
  console.log("Base attrs: P=4 ME=4 MA=2 (sum=10)");
  console.log("Proficient: PHYSICAL");
  console.log("");

  console.log("== Attribute (walked) ==");
  console.log(`  physical: ${sheets.attributes.physical} (expected: 4 + 5 + 1 - 4 = 6)`);
  console.log(`  mental: ${sheets.attributes.mental} (expected: 4)`);
  console.log(`  magical: ${sheets.attributes.magical} (expected: 2)`);
  console.log("");

  console.log("== Defensive DCs (5 + PB + proficient_mod + prim) ==");
  for (const dc of sheets.defensiveDCs || []) {
    console.log(`  ${dc.attribute}: ${dc.dc} (expected: 5 + 6 + 6 + 1 = 18)`);
  }
  console.log("");

  console.log("== Saving Throws (mod + PB if proficient + delta) ==");
  for (const s of sheets.savingThrows || []) {
    console.log(`  ${s.attribute}: +${s.bonus}`);
  }
  console.log("");

  console.log("== Save DCs (8 + PB + mod + prim) ==");
  for (const s of sheets.saveDCs || []) {
    console.log(`  ${s.attribute}: ${s.dc} (expected: 8 + 6 + 6 + 1 = 21)`);
  }
  console.log("");

  console.log("== Practices ==");
  for (const p of sheets.practices || []) {
    console.log(`  ${p.practice} (${p.attribute}): ${p.total}`);
  }
  console.log("");

  console.log("== Vitality ==");
  console.log(`  max: ${sheets.vitality.max}, current: ${sheets.vitality.current ?? "null"}`);
  console.log("");

  console.log("== Speed ==");
  console.log(`  WALKING_SPEED: ${sheets.speedByType?.WALKING_SPEED} (expected: 0 + 10 = 40)`);
  console.log("");

  console.log("== Carry/Load ==");
  console.log(`  carryCapacity: ${sheets.carryCapacity} (expected: 4*5 + 20 = 40)`);
  console.log(`  load: ${sheets.load} (expected: 0 - 2 = -2)`);
  console.log(`  equipSlotsUsed: ${sheets.equipSlotsUsed} (expected: 0 + 1 = 1)`);
  console.log("");

  console.log("== Resolved size/source_type ==");
  console.log(`  size: ${sheets.resolvedSize}`);
  console.log(`  source_type: ${sheets.resolvedSourceType}`);

  await pool.end();
}

main().catch(console.error);
