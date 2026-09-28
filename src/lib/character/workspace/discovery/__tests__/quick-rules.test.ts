import { selectionForModifier } from "@/lib/primitives/modifier-scope";
import { validateModifierDraft } from "@/lib/primitives/modifier-validator";
import { parseCondition } from "@/lib/primitives/condition";
import { describe, expect, it } from "vitest";
import { CANONICAL_EXPRESSIONS, MARKET_TEMPLATES } from "@/lib/primitives/canonical-market";
import { parseAuthorableCompositionRule, renderMechanicalRule } from "@/lib/primitives/mechanical-rule";
import { quickRuleOptions, QUICK_RULE_FAMILIES, quickRuleFromLibrary, quickRuleMatchesFamily, withQuickRuleCondition, drawQuickRule } from "../quick-rules";

describe("guided priced rules", () => {
  it("uses the canonical cost and compiled description for each concrete expression", () => {
    for (const family of QUICK_RULE_FAMILIES.filter(item => !["DOMAIN_ACCESS", "PRACTICE_PROGRESSION", "PRACTICES", "SAVING_THROWS"].includes(item.key))) {
      for (const option of quickRuleOptions(family.key)) {
        const canonical = CANONICAL_EXPRESSIONS.find(item => item.key === option.key)!;
        expect(canonical).toBeDefined();
        expect(option.buCost).toBe(canonical.buCost);
        expect(option.hardModifiers).toEqual(canonical.modifier ? [canonical.modifier] : []);
        if (option.mechanicalRule) expect(option.mechanicalOutputText).toBe(renderMechanicalRule(option.mechanicalRule));
      }
    }
  });
  it("fully binds every domain without inventing a price or offering unbound subjects", () => {
    const options = quickRuleOptions("DOMAIN_ACCESS");
    expect(options.length).toBeGreaterThan(80);
    for (const option of options) {
      const template = MARKET_TEMPLATES.find(item => option.key.startsWith(`${item.key}:`))!;
      expect(option.buCost).toBe(template.buCost);
      expect(option.mechanicalRule?.bindings?.["domain"]).toBeTruthy();
      expect(option.mechanicalOutputText).not.toContain("[domain]");
      expect(parseAuthorableCompositionRule(option.mechanicalRule)).toBeTruthy();
    }
  });
  it("uses the attribute Market price for exactly one scoped attribute point", () => {
    const template = MARKET_TEMPLATES.find(item => item.key === "attribute-increment")!;
    const options = quickRuleOptions("PRACTICE_PROGRESSION");
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.buCost).toBe(template.buCost);
      expect(option.hardModifiers).toEqual([{ kind: "modify", target: "attribute", operation: "add", value: {kind: "number", value: 1}, stacking: "stack", metadata: { recipient: "SELF", targetScope: { layer: "ATTRIBUTE", values: [option.mechanicalRule?.bindings?.["attribute"]] } } }]);
    }
  });
  it("has no free-form numeric scaling or invented attribute and vitality amounts", () => {
    const options = QUICK_RULE_FAMILIES.flatMap(family => quickRuleOptions(family.key));
    expect(options.every(option => Number.isFinite(option.buCost) && option.buCost >= 0)).toBe(true);
    expect(options.some(option => /\+30/.test(option.mechanicalOutputText))).toBe(false);
    expect(options.map(option => option.key).length).toBe(new Set(options.map(option => option.key)).size);
  });
});


describe("broader priced seeds", () => {
  it("uses PB with an explicit practice or saving-throw scope and the Market price", () => {
    for (const [family, templateKey, count] of [["PRACTICES", "practice-proficiency", 10], ["SAVING_THROWS", "defensive-save-upgrade", 3]] as const) {
      const template = MARKET_TEMPLATES.find(item => item.key === templateKey)!;
      const seeds = quickRuleOptions(family);
      expect(seeds).toHaveLength(count);
      seeds.forEach(seed => {
        expect(seed.buCost).toBe(template.buCost);
        expect(seed.hardModifiers[0]?.["value"]).toEqual({kind: "derived", which: "pb"});
        const selection = selectionForModifier(seed.hardModifiers[0]!);
        expect(validateModifierDraft({ ...selection, freeTextNarrowFocus: selection.freeTextNarrowFocus ?? "" })).toBeNull();
        expect(seed.hardModifiers[0]?.["metadata"]).toMatchObject({targetScope: {values: [expect.any(String)]}});
      });
    }
  });
  const row = { id: 42, name: "A practiced climber", category: "MOBILITY_LOCOMOTION", familyKey: "MOBILITY", buCost: 6, costTier: "Tier 2", mechanicalOutputText: "Add +5 to climbing speed.", narrativeRule: "Climb more quickly.", mechanicalRule: null, hardModifiers: [{kind: "modify", target: "speed", operation: "add", value: 5, metadata: {targetScope: {layer: "METRIC", values: ["CLIMBING_SPEED"]}}}] };
  it("preserves the actual Library price and complete rule, with no inferred numeric scaling", () => {
    const seed = quickRuleFromLibrary(row)!;
    expect(seed.buCost).toBe(6);
    expect(seed.hardModifiers).toEqual(row.hardModifiers);
    expect(quickRuleMatchesFamily(seed, "MOBILITY")).toBe(true);
    expect(quickRuleFromLibrary({...row, buCost: NaN})).toBeNull();
    expect(quickRuleFromLibrary({...row, hardModifiers: [...row.hardModifiers, {bad: true}]})).toBeNull();
    expect(quickRuleFromLibrary({...row, hardModifiers: [], mechanicalRule: null})).toBeNull();
  });
  it("adds an optional supported condition without discounting or modifying the source", () => {
    const seed = quickRuleFromLibrary(row)!;
    const variant = withQuickRuleCondition(seed, "scene-has-obstacles");
    expect(variant.buCost).toBe(seed.buCost);
    expect(variant.hardModifiers[0]?.["condition"]).toEqual({kind: "preset", presetKey: "scene-has-obstacles", customTags: []});
    expect(parseCondition(variant.hardModifiers[0]?.["condition"])).toEqual(variant.hardModifiers[0]?.["condition"]);
    expect(seed.hardModifiers[0]?.["condition"]).toBeUndefined();
    expect(withQuickRuleCondition(variant, "scene-dim")).toBe(variant);
  });
  it("includes scoped and legacy damage multipliers among defense ideas", () => {
    for (const target of ["damage_modifier", "damage_modifier.fire", "damage_type"]) {
      const seed = quickRuleFromLibrary({ ...row, category: "STRUCTURAL_DEFENSES", familyKey: "MITIGATION", hardModifiers: [{ kind: "modify", target, operation: "multiply", value: 0.5 }] })!;
      expect(quickRuleMatchesFamily(seed, "DEFENSES")).toBe(true);
    }
  });
  it("exhausts unseen candidates before repetition and allows small families to be drawn", () => {
    const a = quickRuleOptions("PRACTICES")[0]!;
    const b = quickRuleOptions("DOMAIN_ACCESS")[0]!;
    const c = quickRuleFromLibrary(row)!;
    expect(drawQuickRule([a,b,c], [a.key,b.key], b.key, () => 0)).toEqual(c);
    expect(drawQuickRule([a,b,c], [], undefined, () => 0.99)).toEqual(c);
    expect(drawQuickRule([], [])).toBeUndefined();
  });
});
