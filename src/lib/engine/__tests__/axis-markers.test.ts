import { describe, expect, it } from 'vitest';
import { axisMarkerMap, axisMarkerState } from '../axis-markers';
import type { ModifierContribution } from '../resolve-modifiers';
import { aggregateCharacterSheet, type CharacterSheetInput } from '../sheet';

const contribution = (patch: Partial<ModifierContribution>) => ({
  op: 'add', value: 1, tags: [], inhibited: false, conditionActive: true,
  ...patch,
} as ModifierContribution);

describe('shared app and PDF roll annotations', () => {
  it('nets bias stacks and keeps constraints out of the numeric modifier', () => {
    const target = 'skill_practice_check.intuition';
    const byTarget = {
      [target]: [contribution({op:'min',value:10}), contribution({op:'max',value:20}),
        contribution({op:'grant',tags:['advantage']}), contribution({op:'grant',tags:['disadvantage'],inhibited:true}),
        contribution({hasCondition:true,conditionComputable:false})],
      [`behavior.advantage.${target}`]: [contribution({value:2})],
      [`behavior.disadvantage.${target}`]: [contribution({value:1})],
    };
    expect(axisMarkerState(byTarget,target)).toEqual({netAdvantage:2,floor:10,ceiling:20,conditional:true});
    expect(axisMarkerMap(byTarget)[target]).toEqual(axisMarkerState(byTarget,target));
  });
  it('keeps inactive or inhibited bias and computable false conditions unmarked', () => {
    const target = 'skill_practice_check.prowess';
    expect(axisMarkerState({[target]:[
      contribution({op:'grant',tags:['advantage'],conditionActive:false}),
      contribution({op:'min',value:10,inhibited:true}),
      contribution({hasCondition:true,conditionActive:false,conditionComputable:true}),
    ]},target)).toEqual({netAdvantage:0,floor:null,ceiling:null,conditional:false});
  });
  it('exports practice annotations from the exact resolver already used by the sheet', () => {
    const primitive = {id:1,name:'Intuition floor',category:'CUSTOM',buCost:4,isMirrorable:false,mirrorBuCredit:0,
      hardModifiers:[{kind:'modify',target:'skill_practice_check',operation:'min',value:10,
        metadata:{targetScope:{layer:'PRACTICE',values:['INTUITION']}}}]};
    const source = {characterId:'test',level:1,attrPhysical:3,attrMental:4,attrMagical:3,attrProficient:null,
      startingBu:25,buSpent:4,dmBonusBu:0,currentVitality:null,size:'MEDIUM',practiceSlices:{},capabilityLinks:[],itemLinks:[],
      primitiveLinks:[{primitiveId:1,primitive,source:'MANIFEST',acquiredAtLevel:1,isMirrored:false}]} as CharacterSheetInput;
    const sheet = aggregateCharacterSheet(source);
    expect(sheet.rollMarkers?.['skill_practice_check.intuition']?.floor).toBe(10);
    expect(sheet.practices.find(p=>p.practice==='intuition')?.total).toBe(3);
  });
});
