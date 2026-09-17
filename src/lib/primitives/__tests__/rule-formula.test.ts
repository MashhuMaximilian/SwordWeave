import { describe, expect, it } from "vitest";
import { parseRuleFormula } from "../rule-formula";
import { renderEquation } from "@/types/modifier";

describe("parseRuleFormula", () => {
  it("parses grouped sheet values, dice scaling, and tags", () => {
    const parsed = parseRuleFormula(
      "(5 + PB) / Awareness + 2d8 + PBd10 [fire]",
    );
    expect(parsed.error).toBeNull();
    expect(renderEquation(parsed.operands)).toBe(
      "(5 + PB) ÷ awareness + 2d8 + (PB × 1d10) [fire]",
    );
  });

  it("keeps arbitrary runtime values open ended", () => {
    const parsed = parseRuleFormula("/tracking_bonus/ + PB/2");
    expect(parsed.error).toBeNull();
    expect(parsed.operands[0]?.value).toEqual({
      kind: "runtime",
      name: "tracking_bonus",
      hint: "number",
    });
  });

  it("reports malformed formulas without producing partial output", () => {
    expect(parseRuleFormula("PB + )").error).toMatch(/closing parenthesis/i);
    expect(parseRuleFormula("(PB + 2").error).toMatch(/close/i);
  });
});
