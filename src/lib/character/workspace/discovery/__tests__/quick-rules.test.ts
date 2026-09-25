import { describe, expect, it } from "vitest";
import { CANONICAL_EXPRESSIONS, MARKET_TEMPLATES } from "@/lib/primitives/canonical-market";
import { parseAuthorableCompositionRule, renderMechanicalRule } from "@/lib/primitives/mechanical-rule";
import { quickRuleOptions, QUICK_RULE_FAMILIES } from "../quick-rules";

describe("guided priced rules", () => {
  it("uses the canonical cost and compiled description for each concrete expression", () => {
    for (const family of QUICK_RULE_FAMILIES.filter(item => !["DOMAIN_ACCESS", "PRACTICE_PROGRESSION"].includes(item.key))) {
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
