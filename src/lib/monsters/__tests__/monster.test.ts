import { describe,it,expect } from "vitest";
import { monsterBaselines,monsterDefinitionSchema,clampMonsterVitality,shuffleMonsterAttributes,pinMonsterSnapshot,sameMonsterSnapshot,autoMonsterPractices } from "../model";
import { resolveMonster,monsterCost,type MonsterSlot } from "../resolve";
import { resolveModifiers } from "@/lib/engine/resolve-modifiers";
const definition=monsterDefinitionSchema.parse({name:"Wolf",budget:25,attributes:{physical:3,mental:0,magical:0}});
const slot=(mods:MonsterSlot["hardModifiers"]):MonsterSlot=>({primitiveId:1,name:"Tough",category:"METRIC",hardModifiers:mods,isMirrored:false,isMirrorable:true,mirrorVector:null,originHeritageId:null,originCapabilityId:null,originEffectId:null,buCost:4,quantity:1,dependencyKey:"1",item:false});
describe("budget-driven monsters",()=>{
 it("preserves legacy snapshots and stores only validated portrait references",()=>{
 const legacy=monsterDefinitionSchema.parse(definition);
 expect(Object.hasOwn(legacy,"imageUrl")).toBe(false);
 expect(Object.hasOwn(legacy,"portraitFrame")).toBe(false);
 const portrait=monsterDefinitionSchema.parse({...definition,imageUrl:"https://example.com/wolf.webp",portraitFrame:{x:30,y:60,zoom:1.4}});
 const copy=pinMonsterSnapshot({version:2,definition:portrait,slots:[]});
 expect(copy.definition.imageUrl).toBe(portrait.imageUrl);
 expect(copy.definition.portraitFrame).toEqual(portrait.portraitFrame);
 for(const imageUrl of ["data:image/png;base64,abc","javascript:alert(1)","//example.com/image"])
 expect(monsterDefinitionSchema.safeParse({...definition,imageUrl}).success).toBe(false);
 });
 it("derives exact baselines without level ceilings",()=>{expect(monsterBaselines(1)).toEqual({rank:.2,attributePoints:1,pb:2,vitality:1});expect(monsterBaselines(100)).toEqual({rank:2,attributePoints:6,pb:3,vitality:50});expect(monsterBaselines(250000)).toEqual({rank:100,attributePoints:300,pb:101,vitality:125000});expect(()=>monsterBaselines(0)).toThrow();});
 it("allows all attribute points in one attribute and respects shuffle locks",()=>{expect(monsterDefinitionSchema.safeParse({...definition,budget:100,practiceSlices:{},attributes:{physical:6,mental:0,magical:0}}).success).toBe(true);expect(shuffleMonsterAttributes(25,definition.attributes,["physical"],()=>.4)).toEqual(definition.attributes);});
 it("keeps injury on maximum increases and clamps decreases",()=>{expect(clampMonsterVitality(7,50)).toBe(7);expect(clampMonsterVitality(7,5)).toBe(5);});
 it("applies shared modifier operations to the chosen vitality baseline",()=>{const s=slot([{kind:"modify",target:"max_vitality",operation:"multiply",value:2,stacking:"stack"}]);expect(resolveMonster({...definition,baselineVitality:20},[s],7).maximum).toBe(40);expect(resolveMonster({...definition,baselineVitality:20},[s],7).currentVitality).toBe(7);});
 it("counts shared dependencies once and keeps items and mirrors separate",()=>{const s=slot([]);expect(monsterCost([s,s,{...s,dependencyKey:"item",item:true},{...s,dependencyKey:"mirror",isMirrored:true}])).toEqual({spent:4,itemBu:4,mirrorCredit:4});});
 it("adds weakness debt to spendable BU without raising the foundation",()=>{const weakness={...slot([]),dependencyKey:"weak",isMirrored:true,buCost:8,mirrorBuCredit:6};const sheet=resolveMonster(definition,[weakness,{...slot([]),buCost:30}]);expect(sheet.mirrorCredit).toBe(6);expect(sheet.availableBudget).toBe(31);expect(sheet.debtUsed).toBe(5);expect(sheet.rank).toBe(1);expect(sheet.vitality).toBe(13);});
 it("pins independent copies against template edits",()=>{const template={version:1,definition,slots:[slot([])]};const first=pinMonsterSnapshot(template),second=pinMonsterSnapshot(template);template.definition.name="Changed";first.slots[0]={...first.slots[0]!,name:"Local"};expect(second.definition.name).toBe("Wolf");expect(second.slots[0]!.name).toBe("Tough");expect(first.version).toBe(1);});
 it("treats reordered database JSON as unchanged and preserves manual practice allocation",()=>{expect(sameMonsterSnapshot({a:1,b:{c:2}},{b:{c:2},a:1})).toBe(true);const allocated=monsterDefinitionSchema.parse({...definition,practiceSlices:{prowess:0,finesse:3,fieldcraft:0}});expect(allocated.practiceSlices.finesse).toBe(3);expect(autoMonsterPractices(definition.attributes).prowess).toBe(1);expect(monsterDefinitionSchema.safeParse({...definition,practiceSlices:{prowess:2}}).success).toBe(false);});
 it("leaves player resolver defaults unchanged",()=>{const input={characterId:"player",level:1,pb:2,proficientAttribute:"physical" as const,attributes:{physical:5,mental:3,magical:2},slots:[]};const ordinary=resolveModifiers(input);const additive=resolveModifiers({...input,metricBaselines:{}});expect(additive.totals).toEqual(ordinary.totals);expect(ordinary.totals["attack_bonus"]).toBe(7);});
});
