import { describe, expect, it } from 'vitest';
import { aggregateCharacterSheet, type CharacterSheetInput } from '@/lib/engine/sheet';
import { computeBUBalance } from '@/lib/engine/bu-balance';
import type { ConditionContext } from '@/lib/engine/condition-evaluator';
import { validateAttributes } from '@/lib/engine/practices';
import { searchTopics } from '../guide-search';
import {
  NERIS_ACQUISITIONS, NERIS_EXAMPLE, NERIS_GUIDE, NERIS_ITEMS,
  NERIS_LEDGER_STAGES, NERIS_REASSURANCE_MODIFIER, NERIS_TREATMENT,
} from '../neris-example';

describe('checked Neris acquisition accounting', () => {
  it('retains the nineteen distinct saved purchases and their version pins', () => {
    expect(NERIS_ACQUISITIONS).toHaveLength(19);
    expect(new Set(NERIS_ACQUISITIONS.map(row => row.id)).size).toBe(19);
    expect(NERIS_ACQUISITIONS.reduce((sum, row) => sum + row.bu, 0)).toBe(86);
    expect(NERIS_ACQUISITIONS.every(row => row.version > 0 && /^[a-f0-9-]{36}$/.test(row.versionId))).toBe(true);
    expect(NERIS_ACQUISITIONS.find(row => row.id === 19)?.bu).toBe(0);
    expect(NERIS_ACQUISITIONS.find(row => row.id === 32)?.bu).toBe(0);
  });

  it('counts shared origin/recipe references once without collapsing distinct rules', () => {
    expect(NERIS_LEDGER_STAGES.map(stage => stage.addedBu)).toEqual([12, 18, 18, 4, 4, 30]);
    expect(NERIS_LEDGER_STAGES.map(stage => stage.runningBu)).toEqual([12, 30, 48, 52, 56, 86]);
    const charged = NERIS_LEDGER_STAGES.flatMap(stage => stage.newIds);
    expect([...charged].sort((a, b) => a - b)).toEqual(NERIS_ACQUISITIONS.map(row => row.id).sort((a, b) => a - b));
    expect(NERIS_LEDGER_STAGES[2]?.reusedIds).toEqual(expect.arrayContaining([23199, 23176, 19]));
    expect(charged).toContain(23183);
    expect(charged).toContain(23184);
    expect(NERIS_LEDGER_STAGES[4]?.newIds).toEqual([23394]);
  });

  it('keeps the explicit DM adjustment and item ledger separate from progression', () => {
    const account = { startingBu: 25, level: 8, buSpent: 86, dmBonusBu: 1, itemBuSpent: 14 };
    const actual = computeBUBalance(account);
    expect(actual.progressionPool).toBe(100);
    expect(actual.progressionRemaining).toBe(14);
    expect(computeBUBalance({ ...account, dmBonusBu: 0 }).progressionPool).toBe(99);
    expect(NERIS_EXAMPLE.progressionBu).toBe(99);
    expect(NERIS_EXAMPLE.spentBu).toBe(actual.progressionSpent);
    expect(NERIS_EXAMPLE.remainingBu).toBe(actual.progressionRemaining);
    expect(NERIS_ITEMS.reduce((sum, item) => sum + item.itemBu, 0)).toBe(14);
    expect(NERIS_EXAMPLE.itemBu).toBe(14);
    expect(NERIS_EXAMPLE.spentBu).not.toBe(100);
  });
});

function scopedTreatmentSheet(declared: boolean) {
  const condition = NERIS_REASSURANCE_MODIFIER.condition;
  if (!condition || !('kind' in condition) || condition.kind !== 'tags') throw new Error('The checked reassurance condition changed.');
  const flag = condition.customTags[0]!.replace(/^actor:/, '');
  const context: ConditionContext = {
    character: {
      vitality: 104, vitalityMax: 104, saveDc: 13, blockValue: 0,
      attributes: NERIS_EXAMPLE.attributes,
      practices: { prowess: 3, finesse: 11, fieldcraft: 3, awareness: 8, reason: 8, knowledge: 13, influence: 8, mysticism: 2, communion: 2, intuition: 2 },
      proficiencies: new Set(['mental', 'awareness', 'reason', 'knowledge', 'influence']),
      flags: new Set(declared ? [flag] : []), custom: {},
    },
  };
  const input: CharacterSheetInput = {
    characterId: 'source-review-numerics', level: 8,
    attrPhysical: 3, attrMental: 5, attrMagical: 2, attrProficient: 'MENTAL',
    practiceSlices: null, startingBu: 25, buSpent: 4, dmBonusBu: 1,
    currentVitality: 104, size: 'MEDIUM', capabilityLinks: [], itemLinks: [], conditionContext: context,
    // Isolate the actual scoped modifier. Other saved Neris rules do not modify Influence.
    primitiveLinks: [{ primitiveId: 23394, source: 'PERSONAL', acquiredAtLevel: 1, isMirrored: false, primitive: {
      id: 23394, name: 'Patient Reassurance Influence +2', category: 'PRACTICE_PROGRESSION_AUGMENT',
      buCost: 4, isMirrorable: true, mirrorBuCredit: 4, mirrorVector: 'VARIABLE_VECTOR',
      hardModifiers: [NERIS_REASSURANCE_MODIFIER],
    } }],
  };
  return aggregateCharacterSheet(input);
}

describe('bounded treatment with the real sheet engine', () => {
  it('uses the actual attribute training and only the declared scoped contribution', () => {
    expect(validateAttributes(NERIS_EXAMPLE.attributes).valid).toBe(true);
    const ordinary = scopedTreatmentSheet(false);
    const treatment = scopedTreatmentSheet(true);
    expect(ordinary.practices.find(row => row.practice === 'influence')?.total).toBe(8);
    expect(treatment.practices.find(row => row.practice === 'influence')?.total).toBe(10);
    expect(treatment.practices.find(row => row.practice === 'awareness')?.total).toBe(8);
    expect(treatment.proficiencyBonus).toBe(3);
    expect(treatment.dc).toBe(13);
    expect(treatment.vitality.max).toBe(104);
    expect(NERIS_EXAMPLE.treatmentInfluence).toBe(treatment.practices.find(row => row.practice === 'influence')?.total);
  });

  it('carries the check, output and manual changes through consistently', () => {
    const sample = NERIS_TREATMENT;
    expect(sample.d20 + sample.checkBonus).toBe(17);
    expect(sample.checkTotal).toBeGreaterThanOrEqual(sample.difficulty);
    expect(sample.rolledHealing).toBeGreaterThanOrEqual(1);
    expect(sample.rolledHealing).toBeLessThanOrEqual(4);
    expect(Math.min(sample.patientMaximum, sample.patientBefore + sample.rolledHealing)).toBe(sample.patientAfter);
    expect(sample.patientAfter).toBe(9);
    expect(sample.dressingAfter).toBe(sample.dressingBefore - 1);
    expect(sample.nerisAfter).toBe(sample.nerisBefore);
    const outcome = NERIS_GUIDE.find(topic => topic.id === 'neris-at-table')?.blocks.find(block => block.table)?.table;
    expect(outcome?.rows).toContainEqual(['Patient current / maximum Vitality', '6 / 12', '9 / 12']);
    expect(outcome?.rows).toContainEqual(['Character acquisitions / BU remaining', '19 / 14', '19 / 14']);
  });
});

describe('complete reusable Neris teaching source', () => {
  it('retains the whole seven-chapter trail and advanced/foundation qualifications', () => {
    expect(NERIS_GUIDE.map(topic => topic.id)).toEqual(['neris-concept', 'neris-foundation', 'neris-origins', 'neris-ledger', 'neris-treatment', 'neris-at-table', 'neris-your-build']);
    expect(searchTopics(NERIS_GUIDE, 'Domain-category acquisition').map(topic => topic.id)).toEqual(['neris-your-build']);
    expect(searchTopics(NERIS_GUIDE, 'Orren').map(topic => topic.id)).toContain('neris-your-build');
    expect(searchTopics(NERIS_GUIDE, 'nineteen saved').map(topic => topic.id)).toEqual(['neris-ledger']);
    expect(searchTopics(NERIS_GUIDE, 'patient Amount Heal').map(topic => topic.id)).toContain('neris-at-table');
  });
});
