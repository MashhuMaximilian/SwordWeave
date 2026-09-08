import { describe, it, expect } from "vitest";
import { activeRestrictions, type ConsequenceOccurrence } from "../types";
import { parseOccurrence, consequenceBehaviorSchema } from "../validation";
const occurrence: ConsequenceOccurrence = {
  id: "c",
  title: "Sunburn",
  description: "",
  tags: [],
  modifiers: [],
  durationTier: "short_rest",
  active: true,
  createdAt: 1,
  source: "custom",
  restrictions: [
    { kind: "capability", entityId: "sunburst", reason: "Recover first" },
  ],
};
describe("consequence occurrence lifecycle", () => {
  it("preserves narrative-only content and recovery requirements", () => {
    expect(
      parseOccurrence({ ...occurrence, recovery: "Find shade" }).modifiers,
    ).toEqual([]);
    expect(
      parseOccurrence({ ...occurrence, recovery: "Find shade" }).recovery,
    ).toBe("Find shade");
  });
  it("suspends ongoing blockers without discarding their occurrence", () => {
    expect(
      activeRestrictions([{ ...occurrence, manualOverride: false }]),
    ).toEqual([]);
    expect(
      activeRestrictions([
        { ...occurrence, active: false, manualOverride: true },
      ]),
    ).toHaveLength(1);
  });
  it("resolution overrides manual On and leaves overlapping blockers active", () => {
    expect(
      activeRestrictions([
        { ...occurrence, status: "resolved", manualOverride: true },
      ]),
    ).toEqual([]);
    expect(
      activeRestrictions([
        { ...occurrence, status: "resolved" },
        { ...occurrence, id: "second" },
      ]),
    ).toHaveLength(1);
  });
  it("does not treat rest duration as automatic recovery", () => {
    expect(activeRestrictions([occurrence])).toHaveLength(1);
  });
  it("requires explicit on-use timing and finite vitality deltas", () => {
    expect(
      consequenceBehaviorSchema.safeParse({
        timing: "passive",
        vitalityDelta: -10,
        restrictions: [],
        recovery: "",
      }).success,
    ).toBe(false);
    expect(
      consequenceBehaviorSchema.safeParse({
        timing: "on-use",
        vitalityDelta: Infinity,
        restrictions: [],
        recovery: "",
      }).success,
    ).toBe(false);
  });
});
