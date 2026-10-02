/** Read-only end-to-end check from the published primitive rows to sheet values. */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { primitives } from "@/db/schema";
import { aggregateCharacterSheet, type CharacterSheetInput } from "@/lib/engine/sheet";

config({ path: ".env.local", quiet: true });
type Row = typeof primitives.$inferSelect;
function input(level: number, links: CharacterSheetInput["primitiveLinks"] = []): CharacterSheetInput {
  return { level, attrPhysical: 3, attrMental: 4, attrMagical: 3, attrProficient: "PHYSICAL",
    practiceSlices: {}, startingBu: 25, buSpent: 0, dmBonusBu: 0, currentVitality: 12,
    size: "MEDIUM", primitiveLinks: links, capabilityLinks: [], itemLinks: [] };
}
function link(row: Row, mirrored = false): CharacterSheetInput["primitiveLinks"][number] {
  return { primitiveId: row.id, source: "PERSONAL", acquiredAtLevel: 1, isMirrored: mirrored,
    primitive: { id: row.id, name: row.name, category: row.category, buCost: row.buCost,
      isMirrorable: row.isMirrorable, mirrorBuCredit: row.mirrorBuCredit,
      mirrorVector: row.mirrorVector, hardModifiers: row.hardModifiers } };
}
function assertDelta(name: string, normal: number, mirrored: number, baseline: number, delta: number): void {
  if (normal !== baseline + delta || mirrored !== baseline - delta)
    throw new Error(`${name}: expected ${baseline} ± ${delta}, got ${normal} / ${mirrored}`);
  console.log(`sheet verified ${name}: ${baseline} → ${normal} / ${mirrored}`);
}
async function row(name: string): Promise<Row> {
  const [found] = await db.select().from(primitives).where(eq(primitives.name, name)).limit(1);
  if (!found?.isPublic) throw new Error(`Missing public primitive: ${name}`);
  return found;
}
async function main(): Promise<void> {
  for (const level of [5, 20]) {
    const base = aggregateCharacterSheet(input(level));
    const pb = base.proficiencyBonus;
    for (const [name, practice] of [["Awareness Check +PB", "AWARENESS"], ["Fieldcraft Check +PB", "FIELDCRAFT"]] as const) {
      const r = await row(name);
      const current = aggregateCharacterSheet(input(level, [link(r)]));
      const mirrored = aggregateCharacterSheet(input(level, [link(r, true)]));
      const value = (sheet: typeof base) => sheet.practices.find(p => p.practice.toUpperCase() === practice)?.total ?? NaN;
      assertDelta(`${name} L${level}`, value(current), value(mirrored), value(base), pb);
    }
    const saveRow = await row("Physical Saving Throw +PB");
    const normalSave = aggregateCharacterSheet(input(level, [link(saveRow)]));
    const mirroredSave = aggregateCharacterSheet(input(level, [link(saveRow, true)]));
    const save = (sheet: typeof base) => sheet.savingThrows.find(s => s.attribute === "PHYSICAL")?.bonus ?? NaN;
    assertDelta(`Physical Saving Throw +PB L${level}`, save(normalSave), save(mirroredSave), save(base), pb);
    if (normalSave.dc !== base.dc || mirroredSave.dc !== base.dc) throw new Error("Save fork changed DC");
  }
  const base = aggregateCharacterSheet(input(5));
  for (const [name, metric, amount] of [["Climbing Speed +10", "CLIMBING_SPEED", 10],
    ["Flying Speed +30", "FLYING_SPEED", 30], ["Burrowing Speed +15", "BURROWING_SPEED", 15]] as const) {
    const r = await row(name);
    const normal = aggregateCharacterSheet(input(5, [link(r)]));
    const mirrored = aggregateCharacterSheet(input(5, [link(r, true)]));
    const expectedMirror = Math.max(0, (base.speedByType[metric] ?? 0) - amount);
    if (normal.speedByType[metric] !== (base.speedByType[metric] ?? 0) + amount || mirrored.speedByType[metric] !== expectedMirror)
      throw new Error(`Sheet speed mismatch: ${name}`);
    console.log(`sheet verified ${name}: ${base.speedByType[metric]} → ${normal.speedByType[metric]} / ${mirrored.speedByType[metric]}`);
  }
  const slotRow = await row("Equipment Slot Augment +2");
  const available = aggregateCharacterSheet(input(5, [link(slotRow)])).encumbrance.equipSlotsAvailable;
  if (available !== base.encumbrance.equipSlotsAvailable + 2) throw new Error(`Slot fork failed: ${available}`);
  console.log(`sheet verified Equipment Slot Augment +2: ${base.encumbrance.equipSlotsAvailable} → ${available}`);
  for (const [name, field, amount] of [["Vitality Core Augment +5", "vitality", 5],
    ["Carry Capacity Augment +100", "carry", 100], ["Equipment Slot Augment +1", "slots", 1]] as const) {
    const r = await row(name);
    const normal = aggregateCharacterSheet(input(5, [link(r)]));
    const mirrored = aggregateCharacterSheet(input(5, [link(r, true)]));
    const read = (sheet: typeof base) => field === "vitality" ? sheet.vitality.max
      : field === "carry" ? sheet.carryCapacity : sheet.encumbrance.equipSlotsAvailable;
    if (field === "carry") {
      if (read(normal) !== read(base) + amount || read(mirrored) !== Math.max(0, read(base) - amount))
        throw new Error(`${name}: carry capacity did not respect its zero floor`);
      console.log(`sheet verified ${name}: ${read(base)} → ${read(normal)} / ${read(mirrored)}`);
    } else {
      assertDelta(name, read(normal), read(mirrored), read(base), amount);
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
