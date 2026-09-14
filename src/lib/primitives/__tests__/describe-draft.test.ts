import { expect, it } from "vitest";
import { describePrimitiveDraft } from "../describe-draft";
it("derives the mechanical description from the same tokens and condition chain that will be saved", () => {
  const text = describePrimitiveDraft({target:"attribute",operation:"add",targetValues:["PHYSICAL"],freeTextNarrowFocus:"",valueKind:"number",value:"99",tokens:[{kind:"number",value:2}],operands:[],v1Condition:{categories:["self"],pills:[{category:"self",label:"Self is wounded"},{category:"scene",label:"Scene is dark"}],operators:["OR"],narrative:"while holding a shield",includeTags:false}});
  expect(text).toContain("Add +2 to PHYSICAL");
  expect(text).not.toContain("99");
  expect(text).toContain("Self is wounded OR Scene is dark; while holding a shield");
});

it("shows the full equation rather than stale numeric or token values", () => {
  const draft = {
    target:"attribute", operation:"max", targetValues:["PHYSICAL"], freeTextNarrowFocus:"",
    valueKind:"equation", value:"99", tokens:[{kind:"number" as const,value:88}],
    operands:[{op:"+" as const,value:{kind:"number" as const,value:5}},{op:"*" as const,value:{kind:"paren" as const,operands:[{op:"+" as const,value:{kind:"number" as const,value:2}},{op:"+" as const,value:{kind:"number" as const,value:3}}]}}],
    v1Condition:{categories:[],pills:[],operators:[],narrative:"",includeTags:false},
  };
  const before=JSON.stringify(draft);
  const text=describePrimitiveDraft(draft);
  expect(text).toContain("Set PHYSICAL to maximum 5");
  expect(text).toContain("(2 + 3)");
  expect(text).not.toContain("99"); expect(text).not.toContain("88");
  expect(JSON.stringify(draft)).toBe(before);
});
