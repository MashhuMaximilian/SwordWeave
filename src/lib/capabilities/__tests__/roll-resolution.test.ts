import {describe,it,expect} from "vitest";
import {EMPTY_RESOLUTION,readRollResolution,writeRollResolution,type RollMode} from "../roll-resolution";
import {DEFAULT_TABLE,readTableGuidance,writeTableGuidance} from "../table-guidance";
import {readFlavorReference,writeFlavorReference} from "../flavor-reference";
describe("authored resolution and flavor",()=>{
 it.each(["action","save","practice","opposed","automatic"] as RollMode[])("round trips %s with DC and outcomes alongside table guidance",mode=>{
  const resolution={mode,check:"Awareness",dc:"My Mental DC",outcome:"On failure the target is revealed."};
  const table=writeTableGuidance(writeRollResolution("A **pulse**.",resolution),DEFAULT_TABLE);
  const split=readTableGuidance(table);expect(split.table).toEqual(DEFAULT_TABLE);
  expect(readRollResolution(split.description)).toEqual({description:"A **pulse**.",resolution});
  expect(writeRollResolution(split.description,EMPTY_RESOLUTION)).toBe("A **pulse**.");
 });
 it("shows flavor without requiring or fabricating a purchased primitive",()=>{
  const domain=writeFlavorReference("My ability.","domain","Ice");
  const both=writeFlavorReference(domain,"verb","Reveal");
  expect(readFlavorReference(both,"domain")).toBe("Ice");expect(readFlavorReference(both,"verb")).toBe("Reveal");
  const changed=writeFlavorReference(both,"domain","Fire");expect(readFlavorReference(changed,"domain")).toBe("Fire");expect(changed).not.toContain("Ice");
 });
});
