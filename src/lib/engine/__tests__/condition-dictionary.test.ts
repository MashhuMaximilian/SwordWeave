import { describe, expect, it } from "vitest";
import { hasMeaningfulCondition, humanReadableCondition, humanReadableToken } from "../condition-dictionary";

describe("condition dictionary", () => {
  it("renders actor vitality conditions as table language", () => {
    expect(humanReadableToken("actor:stat|vitality_pct|<|0.5")).toBe(
      "Actor is below 50% vitality",
    );
  });

  it("renders actor proficiency conditions without engine tokens", () => {
    expect(humanReadableToken("actor:proficient_in(prowess)")).toBe(
      "Actor is proficient in Prowess",
    );
  });

  it("renders presets as mechanical descriptions", () => {
    expect(humanReadableCondition({
      kind: "preset",
      presetKey: "actor-below-half-hp",
      customTags: [],
    })).toBe("Actor is below 50% vitality");
  });

  it("omits empty compound conditions", () => {
    const condition = { kind: "compound", tokens: [] } as const;
    expect(hasMeaningfulCondition(condition)).toBe(false);
    expect(humanReadableCondition(condition)).toBe("");
  });
});
