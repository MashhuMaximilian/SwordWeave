import { expect, it } from "vitest";
import { describePrimitiveDraft } from "../describe-draft";
it("derives the mechanical description from the same tokens and condition chain that will be saved", () => {
  const text = describePrimitiveDraft({target:"attribute",operation:"add",targetValues:["PHYSICAL"],freeTextNarrowFocus:"",valueKind:"number",value:"99",tokens:[{kind:"number",value:2}],operands:[],v1Condition:{categories:["self"],pills:[{category:"self",label:"Self is wounded"},{category:"scene",label:"Scene is dark"}],operators:["OR"],narrative:"while holding a shield",includeTags:false}});
  expect(text).toContain("2 PHYSICAL");
  expect(text).not.toContain("99");
  expect(text).toContain("Self is wounded OR Scene is dark; while holding a shield");
});
