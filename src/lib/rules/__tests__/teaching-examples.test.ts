import { describe, expect, it } from 'vitest';
import { monsterBaselines } from '@/lib/monsters/model';
import { PLAY_GUIDE } from '../play-guide';
import { CREATING_GUIDE } from '../creating-guide';
import { MIRA_REUSE_LEDGER, REUSE_EXAMPLE_BLOCKS } from '../reuse-example';
import { ROOTED_FORD_HOSTILE as scene } from '../encounter-example';
import { NERIS_SHEET_URL, ORREN_SHEET_URL } from '../neris-example';

describe('source-checked teaching examples', () => {
  it('keeps the PHB acquisition ledger distinct from reused expressions', () => {
    expect(MIRA_REUSE_LEDGER.map(entry => entry.bu)).toEqual([8, 4, 4, 4, 4]);
    expect(MIRA_REUSE_LEDGER.reduce((sum, entry) => sum + entry.bu, 0)).toBe(24);
    expect(MIRA_REUSE_LEDGER.slice(0, 3).reduce((sum, entry) => sum + entry.bu, 0)).toBe(16);
    const uses = REUSE_EXAMPLE_BLOCKS.find(block => block.id === 'expression')!.table!;
    expect(uses.rows).toHaveLength(3);
    expect(new Set(uses.rows.map(row => row[1]))).toEqual(new Set(['Verb II + Water I + Near Range.']));
  });

  it('checks the hostile branch against the source bonuses and state ledger', () => {
    const creatureBase = monsterBaselines(scene.jackal.budget);
    expect(creatureBase.pb).toBe(2);
    expect(scene.jackal.pb).toBe(creatureBase.pb);
    expect(scene.rolls.miraClashDie + scene.mira.physical).toBe(15);
    expect(scene.rolls.jackalClashDie + scene.jackal.physical + creatureBase.pb).toBe(13);
    expect(scene.rolls.catchDie + scene.mira.physical).toBe(11);
    expect(scene.rolls.catchDie + scene.mira.physical).toBeGreaterThanOrEqual(scene.rolls.catchDc);
    expect(scene.rolls.jackalAttackDie + scene.jackal.physical + creatureBase.pb).toBe(14);
    expect(scene.rolls.jackalAttackDie + scene.jackal.physical + creatureBase.pb).toBeGreaterThanOrEqual(scene.mira.dc);
    expect(scene.rolls.biteDamage).toBeGreaterThanOrEqual(1);
    expect(scene.rolls.biteDamage).toBeLessThanOrEqual(4);
    expect(scene.mira.vitalityBefore - scene.rolls.biteDamage).toBe(scene.state.miraVitalityAfter);
    expect(scene.state.reactionSlotsBefore - scene.state.reactionSlotsAfter).toBe(1);
    expect(scene.state.movementSpent + scene.state.movementRemaining).toBe(scene.mira.speed);
    expect(scene.state.carryStrapsSpent).toBe(1);
    expect(scene.state.medicinePouchesLost).toBe(0);
  });

  it('retains all fifteen Rules chapters and gives preparation an early linked entry', () => {
    expect(PLAY_GUIDE.map(topic => topic.id)).toEqual(['start', 'first-character', 'building-blocks', 'heritages', 'budget', 'rolls', 'combat', 'reactions', 'strain', 'upkeep', 'damage', 'vitality', 'equipment', 'creating', 'sheet']);
    const first = PLAY_GUIDE[0]!;
    expect(first.blocks[1]!.id).toBe('first-session-preparation');
    expect(first.blocks[1]!.links?.map(link => link.url)).toContain(`/encounters/${scene.encounterId}`);
    expect(first.blocks[1]!.links?.map(link => link.url)).toContain('/contact');
    expect(first.blocks[1]!.links?.find(link => link.title.startsWith('Neris:'))?.url).toBe(NERIS_SHEET_URL);
    expect(first.blocks[1]!.links?.find(link => link.title.startsWith('Orren:'))?.url).toBe(ORREN_SHEET_URL);
    expect(first.blocks[1]!.links?.map(link => link.url)).toContain('/press/materials/swordweave-first-session-run-sheet.pdf');
    expect(first.blocks[1]!.table?.rows.some(row => row[0] === 'Essential')).toBe(true);
    expect(first.blocks[1]!.table?.rows.some(row => row[0] === 'Optional')).toBe(true);
  });

  it('keeps the focused Creating path complete and its existing chapter anchors usable', () => {
    const ids = CREATING_GUIDE.map(topic => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['idea', 'primitive', 'compose', 'fork', 'edit', 'visibility', 'play', 'reuse', 'expression']) expect(ids).toContain(id);
    for (const example of REUSE_EXAMPLE_BLOCKS) expect(CREATING_GUIDE.some(topic => topic.blocks.includes(example))).toBe(true);
    expect(CREATING_GUIDE.flatMap(topic => topic.blocks)).toHaveLength(PLAY_GUIDE.find(topic => topic.id === 'creating')!.blocks.length);
  });
});
