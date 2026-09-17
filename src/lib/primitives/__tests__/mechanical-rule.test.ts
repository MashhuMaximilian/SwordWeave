import { describe, expect, it } from "vitest";
import { mechanicalDescriptionFromModifiers, parseAuthorableCompositionRule, renderMechanicalRule } from "../mechanical-rule";
import { CANONICAL_EXPRESSIONS } from "../canonical-market";

describe("canonical mechanical sentences", () => {
  it("renders domain templates and expressions", () => {
    expect(renderMechanicalRule({family:"DOMAIN_ACCESS",bindings:{}})).toBe("Grant [domain] domain access.");
    expect(renderMechanicalRule({family:"DOMAIN_ACCESS",bindings:{domain:"fire"}})).toBe("Grant [fire] domain access.");
  });
  it("renders bound and unbound character progression", () => {
    expect(renderMechanicalRule({family:"ATTRIBUTE_INCREMENT",value:1,bindings:{}})).toBe("Add +1 to [Core Attribute].");
    expect(renderMechanicalRule({family:"ATTRIBUTE_INCREMENT",value:1,bindings:{attribute:"PHYSICAL"}})).toBe("Add +1 to Physical.");
    expect(renderMechanicalRule({family:"DEFENSIVE_SAVE",bindings:{attribute:"MAGICAL"}})).toBe("Grant saving throw proficiency in Magical.");
    expect(renderMechanicalRule({family:"PRACTICE_PROFICIENCY",bindings:{practice:"AWARENESS"}})).toBe("Grant proficiency in Awareness.");
  });
  it("appends conditions", () => {
    expect(renderMechanicalRule({family:"UNIVERSAL_MODIFIER",operation:"add",target:"Attack Roll",value:2,conditionText:"the target is exposed"})).toBe("Add +2 to Attack Roll when the target is exposed.");
  });
  it("preserves dice, keywords, runtime values, and equations", () => {
    expect(renderMechanicalRule({family:"GENERIC",operation:"add",target:"Damage",value:{kind:"dice",expression:"2d6+3"}})).toBe("Add +2D6+3 to Damage.");
    expect(renderMechanicalRule({family:"GENERIC",operation:"grant",target:"Behavior",value:{kind:"keyword",text:"flying"}})).toBe("Grant [flying] to Behavior.");
    expect(renderMechanicalRule({family:"GENERIC",operation:"set",target:"Awareness",value:{kind:"runtime",name:"proficiency_bonus",hint:"number"}})).toBe("Set Awareness to exactly /proficiency_bonus/.");
    expect(renderMechanicalRule({family:"GENERIC",operation:"add",target:"Defense",value:[{op:"+",value:{kind:"number",value:2}},{op:"+",value:{kind:"runtime",name:"PB",hint:"number"}}]})).toBe("Add 2 + /PB/ to Defense.");
  });
  it("renders grants, revocations, bounds, and explicit recipients", () => {
    expect(renderMechanicalRule({family:"GENERIC",operation:"grant",target:"Permission",value:"flight",recipient:"TARGET"})).toBe("Grant flight to Permission for Target.");
    expect(renderMechanicalRule({family:"GENERIC",operation:"revoke",target:"Reaction",value:"counter",recipient:"SCENE"})).toBe("Revoke counter from Reaction for Scene.");
    expect(renderMechanicalRule({family:"GENERIC",operation:"min",target:"Movement",value:10})).toBe("Set Movement to minimum 10.");
    expect(renderMechanicalRule({family:"GENERIC",operation:"max",target:"Movement",value:30})).toBe("Set Movement to maximum 30.");
  });
  it("preserves an authoritative documented market rule as structured source", () => {
    expect(renderMechanicalRule({family:"DOCUMENTED",text:"Straight-line displacement up to 10 feet"})).toBe("Straight-line displacement up to 10 feet.");
    expect(renderMechanicalRule({family:"DOCUMENTED",text:"Set range to [range].",bindings:{range:"Very Far"}})).toBe("Set range to Very Far.");
  });
  it("renders no mechanic for a descriptive-only primitive", () => {
    expect(renderMechanicalRule({family:"DESCRIPTIVE"})).toBe("");
  });
  it("renders typed composition rules without author-entered output text", () => {
    expect(renderMechanicalRule({family:"STRUCTURE",bindings:{structure:"single-point structure"}})).toBe("Apply through a [single-point structure].");
    expect(renderMechanicalRule({family:"RANGE",bindings:{range:"Near (30 ft)"}})).toBe("Set maximum range to Near (30 ft).");
    expect(renderMechanicalRule({family:"DICE",bindings:{dice:"1d8"}})).toBe("Unlock [1d8] damage or healing output.");
    expect(renderMechanicalRule({family:"DOMAIN_ACCESS",operation:"revoke",recipient:"TARGET",bindings:{domain:"fire"}})).toBe("Revoke [fire] domain access from target.");
    expect(renderMechanicalRule({family:"DOMAIN_ACCESS",operation:"grant",recipient:"SELF",bindings:{domain:"metal",tier:"Tier III"}})).toBe("Grant [metal] domain access at Tier III.");
  });
  it("accepts only authorable typed composition shapes", () => {
    expect(parseAuthorableCompositionRule({family:"VERB_ACCESS",operation:"grant",recipient:"SELF",bindings:{tier:"Tier II"}})).toEqual({family:"VERB_ACCESS",operation:"grant",recipient:"SELF",bindings:{tier:"Tier II"}});
    expect(parseAuthorableCompositionRule({family:"DOMAIN_ACCESS",operation:"grant",recipient:"SELF",bindings:{domain:"metal",tier:"Tier III"}})).toEqual({family:"DOMAIN_ACCESS",operation:"grant",recipient:"SELF",bindings:{domain:"metal",tier:"Tier III"}});
    expect(parseAuthorableCompositionRule({family:"DOCUMENTED",text:"Arbitrary display text"})).toBeNull();
  });
});

describe("mechanicalDescriptionFromModifiers", () => {
  it("renders keyword grants across a scoped Practice list", () => {
    expect(mechanicalDescriptionFromModifiers([{
      kind:"modify", operation:"grant", target:"skill_practice_check",
      value:{kind:"keyword",text:"advantage"},
      metadata:{targetScope:{layer:"PRACTICE",values:["PROWESS","FINESSE","FIELDCRAFT"]}},
    }])).toBe("Grant advantage to Prowess, Finesse, and Fieldcraft.");
  });

  it("renders numeric subtraction and a target condition", () => {
    expect(mechanicalDescriptionFromModifiers([{
      kind:"modify", operation:"subtract", target:"save_dc", value:{kind:"number",value:1},
      condition:{kind:"tags",customTags:["target:exposed"]},
    }])).toBe("Subtract 1 from Save DC when the target is exposed.");
  });

  it("renders tracked and declared triggers in beginner-facing language", () => {
    expect(mechanicalDescriptionFromModifiers([{
      kind:"modify", operation:"add", target:"skill_practice_check",
      value:[{op:"+",value:{kind:"derived",which:"pb_half"}},{op:"+",value:{kind:"attribute",attribute:"physical"}}],
      condition:{kind:"compound",tokens:["self:stat|vitality_pct|<|0.3128436","OR","self:manual:tracking_enemies"]},
    }])).toBe("Add PB/2 + physical to Practice checks when self vitality % is lower than 31.28436% or tracking enemies.");
  });
});

describe("verb access composition rules", () => {
  it("keeps the tier grant structured and the player explanation verbose", () => {
    const verbTiers = CANONICAL_EXPRESSIONS.filter((entry) => entry.familyKey === "VERB_ACCESS");
    expect(verbTiers).toHaveLength(4);
    expect(verbTiers.every((entry) => entry.rule?.family === "VERB_ACCESS")).toBe(true);
    expect(verbTiers.every((entry) => entry.mechanicalText.startsWith("Grant [Tier"))).toBe(true);
    expect(verbTiers.every((entry) => entry.verboseDescription.length > 80)).toBe(true);
  });
});
