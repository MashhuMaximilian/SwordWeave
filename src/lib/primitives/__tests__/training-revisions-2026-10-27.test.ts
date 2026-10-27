import { describe, expect, it } from 'vitest';
import { revisedPrimitive, type PrimitiveRow } from '../../../../scripts/lib/training-revisions-2026-10-27';
import { resolveModifiers, type ResolvedPrimitiveSlot } from '@/lib/engine/resolve-modifiers';
import type { HardModifier } from '@/types/swordweave';

function row(id: number, name: string, practice: string, condition?: HardModifier['condition']): PrimitiveRow {
  return { id, name, buCost: 1, isPublic: false, category: 'SHEET_AUGMENT',
    hardModifiers: [{ target: 'skill_practice_check', operation: 'add', value: { kind: 'derived', which: 'pb' },
      metadata: { targetScope: { layer: 'PRACTICE', values: [practice] } }, ...(condition ? { condition } : {}) }],
  } as unknown as PrimitiveRow;
}
const proficiency = row(14065, 'Proficient Fieldcraft', 'FIELDCRAFT');
const expertise = row(14066, 'Expertise Fieldcraft', 'FIELDCRAFT');
function slot(p: PrimitiveRow): ResolvedPrimitiveSlot {
  return { primitiveId: p.id, name: p.name, category: p.category, isMirrored: false, isMirrorable: false,
    mirrorVector: null, originCapabilityId: null, originEffectId: null, originHeritageId: null, hardModifiers: p.hardModifiers };
}
function resolve(rows: PrimitiveRow[], proficientAttribute: 'physical' | 'mental' | null = 'physical') {
  const practiceNames = ['prowess', 'finesse', 'fieldcraft', 'awareness', 'reason', 'knowledge', 'influence', 'mysticism', 'communion', 'intuition'];
  const trained = proficientAttribute === 'physical' ? practiceNames.slice(0, 3)
    : proficientAttribute === 'mental' ? practiceNames.slice(3, 7) : [];
  return resolveModifiers({ characterId: 'test', level: 18, pb: 6,
    attributes: { physical: 15, mental: 8, magical: 5 }, proficientAttribute, slots: rows.map(slot),
    conditionContext: { character: { vitality: 100, vitalityMax: 100, saveDc: 26, blockValue: 0,
      attributes: { physical: 15, mental: 8, magical: 5 },
      practices: Object.fromEntries(practiceNames.map(p=>[p,0])) as never,
      proficiencies: new Set([...trained, ...(proficientAttribute ? [proficientAttribute] : [])]),
      flags: new Set(), custom: { proficiency_bonus: 6 },
    } },
  });
}

describe('reviewed training definition revisions', () => {
  it('corrects the audited 33 modifier to 27 through grants without changing PB or attributes', () => {
    const before = resolve([proficiency, expertise]);
    const after = resolve([revisedPrimitive(proficiency), revisedPrimitive(expertise)]);
    expect(15 + 6 + before.totals['skill_practice_check.fieldcraft']!).toBe(33);
    expect(15 + 6 + after.totals['skill_practice_check.fieldcraft']!).toBe(27);
  });
  it('supplies the first and second PB when the attribute is not proficient', () => {
    const r = resolve([revisedPrimitive(proficiency), revisedPrimitive(expertise)], null);
    expect(r.totals['skill_practice_check.fieldcraft']).toBe(12);
    expect(resolve([revisedPrimitive(expertise)], null).totals['skill_practice_check.fieldcraft'] ?? 0).toBe(0);
  });
  it('keeps explicit independent PB bonuses and other targets unchanged', () => {
    const bonus = row(999, 'Fieldcraft Check +PB', 'FIELDCRAFT');
    expect(revisedPrimitive(bonus)).toBe(bonus);
    const r = resolve([revisedPrimitive(proficiency), revisedPrimitive(expertise), bonus]);
    expect(r.totals['skill_practice_check.fieldcraft']).toBe(12);
    expect(r.totals['skill_practice_check.prowess'] ?? 0).toBe(0);
  });
  it('retains conditional Expertise eligibility and clears obsolete equation metadata', () => {
    const condition = { kind: 'tags', customTags: ['actor:proficient_in(prowess)'] } as const;
    const p = row(11328, 'Expertise Upgrade Prowess (fork)', 'PROWESS', condition);
    p.hardModifiers = [{ ...p.hardModifiers[0]!, metadata: { ...p.hardModifiers[0]!.metadata,
      operands: [{ op: '+', value: { kind: 'derived', which: 'pb' } }], valueKind: 'equation' } }];
    const changed = revisedPrimitive(p);
    expect(changed.hardModifiers[0]!.condition).toEqual(condition);
    expect(changed.hardModifiers[0]!.metadata).not.toHaveProperty('operands');
    expect(changed.buCost).toBe(p.buCost);
  });
  it('grants Physical save proficiency only once, including when it is already in the base', () => {
    const p = revisedPrimitive({ ...proficiency, id: 15517, name: 'Proficient Save' });
    expect(resolve([p]).totals['physical_saving_throw']).toBe(21);
    expect(resolve([p], 'mental').totals['physical_saving_throw']).toBe(21);
    expect(resolve([p, { ...p, id: 999 }], 'mental').totals['physical_saving_throw']).toBe(21);
    expect(resolve([p], 'mental').totals['mental_saving_throw']).toBe(14);
  });
  it('keeps narrow and broad grant scopes authored rather than restricting training to a practice list', () => {
    const p = revisedPrimitive(proficiency);
    const broad = { ...p, hardModifiers: [{ ...p.hardModifiers[0]!, metadata: { targetScope: {
      layer: 'PRACTICE', values: ['FIELDCRAFT', 'MYSTICISM', 'COMMUNION'],
    } } }] };
    const r = resolve([broad]);
    expect(r.totals['skill_practice_check.fieldcraft'] ?? 0).toBe(0);
    expect(r.totals['skill_practice_check.mysticism']).toBe(6);
    expect(r.totals['skill_practice_check.communion']).toBe(6);
  });
  it('leaves Futoshi weapon expertise and venom as table-resolved text with no accidental self modifiers', () => {
    const combatant = revisedPrimitive({ ...proficiency, id: 58, name: 'Corenered Combatant', buCost: 6 });
    const venom = revisedPrimitive({ ...proficiency, id: 21353, name: 'Enfeebling Envenom' });
    expect(combatant.narrativeRule).toContain('including ranged gunshots');
    expect(combatant.hardModifiers).toEqual([]);
    expect(venom.narrativeRule).toContain("victim's DC");
    expect(venom.narrativeRule).toContain('including any saving throw');
    expect(venom.hardModifiers).toEqual([]);
    expect(combatant.buCost).toBe(6);
    expect(combatant.mechanicalOutputText).toBe('');
  });
});
