import { describe, expect, it } from "vitest";
import { MODIFIER_RULE_FORMATS, modifierRuleFormatPatch, identifyModifierRuleFormat } from "../rule-formats";
import { validateModifierDraft } from "../modifier-validator";
describe("direct rule formats", () => {
  it("provides valid scope/operation combinations, including advantage and feature removal", () => {
    for (const format of MODIFIER_RULE_FORMATS) {
      const draft = modifierRuleFormatPatch(format.key);
      expect(identifyModifierRuleFormat(draft)).toBe(format.key);
      expect(validateModifierDraft(draft)).toBeNull();
    }
    expect(modifierRuleFormatPatch("revoke").operation).toBe("revoke");
    expect(modifierRuleFormatPatch("advantage").tokens).toEqual([{ kind: "keyword", text: "advantage" }]);
    expect(modifierRuleFormatPatch("resistance").tokens).toEqual([{ kind: "number", value: 0.5 }]);
  });
});
