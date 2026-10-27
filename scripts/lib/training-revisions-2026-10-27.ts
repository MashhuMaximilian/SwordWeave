import type { primitives } from '../../src/db/schema';
import type { HardModifier } from '../../src/types/swordweave';
import { mechanicalDescriptionFromModifiers, mechanicalRuleFromModifier } from '../../src/lib/primitives/mechanical-rule';

export type PrimitiveRow = typeof primitives.$inferSelect;
export const TRAINING_REVISION_IDS = [11328, 14065, 14066, 15517, 16137] as const;
export const FUTOSHI_RULE_IDS = [58, 21348, 21353] as const;
export const REVISION_IDS = [...TRAINING_REVISION_IDS, 58, 21353] as const;

const practiceRevisions: Record<number, { name: string; practice: string; training: 'proficiency' | 'expertise' }> = {
  11328: { name: 'Expertise Upgrade Prowess (fork)', practice: 'PROWESS', training: 'expertise' },
  14065: { name: 'Proficient Fieldcraft', practice: 'FIELDCRAFT', training: 'proficiency' },
  14066: { name: 'Expertise Fieldcraft', practice: 'FIELDCRAFT', training: 'expertise' },
  16137: { name: 'Proficient Mysticism', practice: 'MYSTICISM', training: 'proficiency' },
};

/** Exact reviewed identities only. An arbitrary authored +PB remains arithmetic. */
export function revisedPrimitive(row: PrimitiveRow): PrimitiveRow {
  const practice = practiceRevisions[row.id];
  if (practice) {
    if (row.name !== practice.name || row.hardModifiers.length !== 1) throw new Error(`Unexpected training definition ${row.id}`);
    const old = row.hardModifiers[0]!;
    const scope = old.metadata?.['targetScope'] as { values?: unknown[] } | undefined;
    if (old.target !== 'skill_practice_check' || JSON.stringify(scope?.values) !== JSON.stringify([practice.practice]))
      throw new Error(`Unexpected practice scope ${row.id}`);
    const metadata = { ...old.metadata };
    delete metadata['operands'];
    delete metadata['valueKind'];
    const modifier: HardModifier = { ...old, kind: 'modify', operation: 'grant',
      value: { kind: 'keyword', text: practice.training }, metadata, stacking: 'highest-only' };
    const name = practice.practice[0]! + practice.practice.slice(1).toLowerCase();
    return { ...row, hardModifiers: [modifier],
      mechanicalRule: mechanicalRuleFromModifier(modifier) as unknown as Record<string, unknown>,
      mechanicalOutputText: mechanicalDescriptionFromModifiers([modifier]),
      narrativeRule: practice.training === 'proficiency'
        ? `Gain proficiency in ${name}. Include your full Proficiency Bonus once when this check is not already proficient. Repeated proficiency grants do not add further PB.`
        : `Gain Expertise in ${name} while the check is already proficient or already includes an applicable Proficiency Bonus. Add one further PB, for two PB in total from training. Repeated Expertise grants do not add further PB.`,
    };
  }
  if (row.id === 15517) {
    if (row.name !== 'Proficient Save') throw new Error('Unexpected saving throw definition');
    const modifier: HardModifier = { kind: 'modify', target: 'attribute', operation: 'grant',
      value: { kind: 'keyword', text: 'proficiency' }, stacking: 'highest-only',
      metadata: { recipient: 'SELF', targetScope: { layer: 'ATTRIBUTE', values: ['PHYSICAL'] } },
      condition: { kind: 'tags', customTags: ['actor:not_proficient_in_attribute(physical)'] },
    };
    return { ...row, hardModifiers: [modifier],
      mechanicalRule: { family: 'DEFENSIVE_SAVE', bindings: { attribute: 'PHYSICAL' } },
      mechanicalOutputText: 'Grant saving throw proficiency in Physical.',
      narrativeRule: 'Gain proficiency on Physical saving throws. Add your full Proficiency Bonus only when that save is not already proficient. Multiple grants of this proficiency still add PB just once.',
    };
  }
  if (row.id === 58) {
    if (row.name !== 'Corenered Combatant') throw new Error('Unexpected Cornered Combatant definition');
    return { ...row, mechanicalRule: { family: 'DESCRIPTIVE' }, mechanicalOutputText: '', hardModifiers: [],
      narrativeRule: 'Combat pressure sharpens your fighting instincts. Gain Expertise on attack rolls made with melee weapons or firearms, including ranged gunshots. Expertise adds one further applicable Proficiency Bonus when the attack already includes proficiency; it does not stack with another Expertise grant on the same roll.',
    };
  }
  if (row.id === 21353) {
    if (row.name !== 'Enfeebling Envenom') throw new Error('Unexpected Enfeebling Envenom definition');
    return { ...row, mechanicalRule: { family: 'DESCRIPTIVE' }, mechanicalOutputText: '', hardModifiers: [],
      narrativeRule: "Your bite delivers a powerful neurotoxin that can inflict Exposed, reducing the victim's DC. Before resolution, agree the application procedure, including any saving throw, the DC reduction, duration, and recovery or ending conditions at the table. Exposed has no universal numerical package. This rule does not reduce the attacker's own DC.",
    };
  }
  return row;
}
