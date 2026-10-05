import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {VitalityDisplayCard} from "../vitality-display-card";
import {resolveMonsterPlay,customMonsterConsequence} from "@/lib/monsters/play";
import {monsterDefinitionSchema} from "@/lib/monsters/model";

describe("shared Vitality display with monster resolved totals",()=>{
 it("displays condition-adjusted monster attributes and DC without character recalculation",()=>{
  const definition=monsterDefinitionSchema.parse({name:"Guardian",budget:25,attributes:{physical:3,mental:0,magical:0},proficientAttribute:"physical"});
  const condition=customMonsterConsequence("Weakened","");
  condition.modifiers=[{kind:"modify",target:"attribute.physical",operation:"add",value:-2,stacking:"stack"},{kind:"modify",target:"save_dc",operation:"add",value:-3,stacking:"stack"}];
  const {sheet}=resolveMonsterPlay(definition,[],{[`consequence:${condition.id}`]:condition},7);
  const markup=renderToStaticMarkup(createElement(VitalityDisplayCard,{current:sheet.currentVitality,max:sheet.maximum,pb:sheet.pb,proficientAttribute:"physical",resolver:sheet.resolved,resolverInput:{characterId:"monster",level:sheet.rank,pb:sheet.pb,attributes:definition.attributes,proficientAttribute:"physical",slots:[]},displayTotals:{totals:sheet.resolved.totals,baselinePb:sheet.pb,baselineVitality:sheet.vitality,proficiencyFormula:"Monster proficiency",vitalityFormula:"Monster Vitality"}}));
  expect(markup).toContain(`Show save DC provenance (Physical)`);
  expect(markup).toContain(`Show Physical modifier provenance`);
  expect(markup).toMatch(/aria-label="Show Physical modifier provenance"[^>]*><span[^>]*>\+1<\/span>/);
  expect(sheet.currentVitality).toBe(7);
  expect(sheet.attributes.physical).toBe(1);
  expect(sheet.resolved.totals["save_dc"]).toBe(5);
 });
});
