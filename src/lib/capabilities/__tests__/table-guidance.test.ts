import {describe,it,expect} from "vitest";
import {DEFAULT_TABLE,TABLE_AXES,TABLE_HELP,readTableGuidance,writeTableGuidance} from "../table-guidance";
describe("optional play guidance",()=>{
 it("round trips custom declarations and Reaction without adding or pricing rules",()=>{
  const table={...DEFAULT_TABLE,target:"Three allies",shape:"Star",size:"A courtyard",placement:"Around an ally",duration:"Until sunrise",casting:"Reaction"};
  const text=writeTableGuidance("A **bright** pulse.",table);
  expect(readTableGuidance(text)).toEqual({description:"A **bright** pulse.",table});
  expect(writeTableGuidance(text,null)).toBe("A **bright** pulse.");
  expect(writeTableGuidance(text,table)).toBe(text);
 });
 it("offers custom on each declaration axis, reaction, and descriptions for every timing and range preset",()=>{
  for(const axis of Object.values(TABLE_AXES))expect(axis.values).toContain("Custom");
  expect(TABLE_AXES.casting.values).toContain("Reaction");
  for(const key of ["casting","duration"] as const)for(const value of TABLE_AXES[key].values)expect(TABLE_HELP[key]?.[value]).toBeTruthy();
  for(const value of ["Touch","Close","Near","Far","Very Far","Extreme"])expect(TABLE_HELP["range"]?.[value]).toBeTruthy();
 });
});
