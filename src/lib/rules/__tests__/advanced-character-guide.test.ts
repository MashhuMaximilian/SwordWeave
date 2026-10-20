import { describe, expect, it } from 'vitest';
import { aggregateCharacterSheet, type CharacterSheetInput } from '@/lib/engine/sheet';
import { computeBUBalance } from '@/lib/engine/bu-balance';
import type { ConditionContext } from '@/lib/engine/condition-evaluator';
import { validateAttributes } from '@/lib/engine/practices';
import { PLAY_GUIDE, type GuideBlock } from '../play-guide';
import {
  ADVANCED_CHARACTER_GUIDE, TRACKER_ACQUISITIONS, TRACKER_EXAMPLE, TRACKER_FOCUS_FLAG,
  TRACKER_FOCUS_MODIFIER, TRACKER_RECIPES, TRACKER_SCENE,
} from '../advanced-character-guide';

function trackerSheet(declared: boolean) {
  const context: ConditionContext = {
    character: {
      vitality: 12, vitalityMax: 12, saveDc: 11, blockValue: 0,
      attributes: TRACKER_EXAMPLE.attributes,
      practices: { prowess: 4, finesse: 4, fieldcraft: 4, awareness: 6, reason: 6, knowledge: 6, influence: 6, mysticism: 2, communion: 2, intuition: 2 },
      proficiencies: new Set(['mental', 'awareness', 'reason', 'knowledge', 'influence']),
      flags: new Set(declared ? [TRACKER_FOCUS_FLAG] : []), custom: {},
    },
  };
  const input: CharacterSheetInput = {
    characterId: 'in-memory-tracker-teaching-example', level: TRACKER_EXAMPLE.level,
    attrPhysical: 4, attrMental: 4, attrMagical: 2, attrProficient: 'MENTAL',
    practiceSlices: null, startingBu: 25, buSpent: TRACKER_EXAMPLE.spentBu, dmBonusBu: 0,
    currentVitality: 12, size: 'MEDIUM', capabilityLinks: [], itemLinks: [], conditionContext: context,
    // Only the numerical rule contributes a sheet modifier; the narrative permissions have no invented output.
    primitiveLinks: [{ primitiveId: -1, source: 'PERSONAL', acquiredAtLevel: 1, isMirrored: false, primitive: {
      id: -1, name: 'Illustrative Quarry focus', category: 'PRACTICE_PROGRESSION_AUGMENT',
      buCost: 2, isMirrorable: false, mirrorBuCredit: 0, mirrorVector: 'STANDARD_ONLY',
      hardModifiers: [TRACKER_FOCUS_MODIFIER],
    } }],
  };
  return aggregateCharacterSheet(input);
}

describe('original character proposal with the actual sheet engine', () => {
  it('uses full attributes and the chosen attribute training before the conditional rule', () => {
    expect(validateAttributes(TRACKER_EXAMPLE.attributes).valid).toBe(true);
    const ordinary = trackerSheet(false);
    expect(ordinary.attributes).toMatchObject(TRACKER_EXAMPLE.attributes);
    expect(ordinary.proficiencyBonus).toBe(TRACKER_EXAMPLE.pb);
    expect(ordinary.practices.find(row => row.practice === 'awareness')?.total).toBe(6);
    expect(ordinary.practices.find(row => row.practice === 'fieldcraft')?.total).toBe(4);
    expect(ordinary.dc).toBe(TRACKER_EXAMPLE.dc);
    expect(ordinary.vitality.max).toBe(TRACKER_EXAMPLE.maxVitality);
  });

  it('adds exactly one only to the declared Awareness scope and removes it when that flag ends', () => {
    const ordinary = trackerSheet(false);
    const focused = trackerSheet(true);
    expect(focused.practices.find(row => row.practice === 'awareness')?.total).toBe(TRACKER_EXAMPLE.focusedAwareness);
    expect(focused.practices.find(row => row.practice === 'fieldcraft')?.total).toBe(4);
    expect(focused.practices.filter(row => row.practice !== 'awareness')).toEqual(ordinary.practices.filter(row => row.practice !== 'awareness'));
    expect(focused.attributes).toEqual(ordinary.attributes);
    expect(focused.savingThrows).toEqual(ordinary.savingThrows);
    expect(focused.dc).toBe(ordinary.dc);
    expect(trackerSheet(false).practices.find(row => row.practice === 'awareness')?.total).toBe(6);
  });

  it('resolves the illustrative sensory check with the combined bonus once', () => {
    const actualBonus = trackerSheet(true).practices.find(row => row.practice === 'awareness')!.total;
    expect(TRACKER_SCENE.bonus).toBe(actualBonus);
    expect(TRACKER_SCENE.d20 + actualBonus).toBe(13);
    expect(TRACKER_SCENE.total).toBeGreaterThanOrEqual(TRACKER_SCENE.dc);
    expect(TRACKER_SCENE.vitalityAfter).toBe(TRACKER_SCENE.vitalityBefore);
    expect(TRACKER_SCENE.buAfter).toBe(TRACKER_SCENE.buBefore);
  });
});

function allBlocks(blocks: GuideBlock[]): GuideBlock[] {
  return blocks.flatMap(block => [block, ...allBlocks(block.details ?? [])]);
}

describe('character guide cross-references', () => {
  it('links to actual Rules topics or explicit block/detail anchors', () => {
    const anchors = new Set(PLAY_GUIDE.flatMap(topic => [topic.id, ...allBlocks(topic.blocks).flatMap(block => block.id ? [block.id] : [])]));
    const links = ADVANCED_CHARACTER_GUIDE.flatMap(topic => [
      ...(topic.sources ?? []),
      ...allBlocks(topic.blocks).flatMap(block => block.links ?? []),
    ]).filter(link => link.url.startsWith('/rules#'));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(anchors.has(decodeURIComponent(link.url.split('#')[1]!)), `Unknown Rules destination: ${link.url}`).toBe(true);
    }
  });
});

describe('one owned ledger, several preparations', () => {
  it('keeps the level-one allowance and actual custom agreement arithmetically separate', () => {
    expect(new Set(TRACKER_ACQUISITIONS.map(row => row.key)).size).toBe(TRACKER_ACQUISITIONS.length);
    expect(TRACKER_ACQUISITIONS.reduce((sum, row) => sum + row.bu, 0)).toBe(20);
    const account = computeBUBalance({ level: 1, startingBu: 25, buSpent: 20, dmBonusBu: 0, itemBuSpent: 0 });
    expect(account.progressionPool).toBe(TRACKER_EXAMPLE.budgetBu);
    expect(account.progressionRemaining).toBe(TRACKER_EXAMPLE.remainingBu);
    expect(account.progressionRemaining).toBe(5);
  });

  it('reuses the same ingredients across the two sensory and two copper preparations', () => {
    const referenced = TRACKER_RECIPES.flatMap(recipe => recipe.ingredients);
    const unique = new Set(referenced);
    const price = (key: string) => {
      const acquisition = TRACKER_ACQUISITIONS.find(row => row.key === key);
      if (!acquisition) throw new Error(`Recipe references an unknown acquisition: ${key}`);
      return acquisition.bu;
    };
    expect(referenced.filter(key => key === 'scent')).toHaveLength(2);
    expect(referenced.filter(key => key === 'teeth')).toHaveLength(2);
    expect([...unique].reduce((sum, key) => sum + price(key), 0)).toBe(20);
    expect(referenced.reduce((sum, key) => sum + price(key), 0)).toBe(38);
    // The 38-BU sum of appearances is deliberately not used as the 20-BU acquisition ledger.
    expect(TRACKER_EXAMPLE.spentBu).toBe(20);
  });
});
