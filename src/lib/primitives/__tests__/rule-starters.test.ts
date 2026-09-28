import { describe, expect, it } from "vitest";
import { RULE_STARTERS, ruleStarterPatch } from "../rule-starters";
import { scopeForSelection } from "../modifier-scope";
import { validateModifierDraft } from "../modifier-validator";
import { mechanicalDescriptionFromModifiers } from "../mechanical-rule";
import type { HardModifier } from "@/types/swordweave";

function stored(id: string): HardModifier {
  const starter = RULE_STARTERS.find((entry) => entry.id === id)!;
  const patch = ruleStarterPatch(starter);
  const scope = scopeForSelection({ ...patch, granularity: null });
  return { kind: "modify", target: patch.target, operation: patch.operation, value: starter.token, metadata: { targetScope: { layer: scope.metadata.targetScope.layer, values: [...scope.metadata.targetScope.values] }, recipient: "SELF", ...(patch.freeTextNarrowFocus ? { scopeName: patch.freeTextNarrowFocus, behaviorName: patch.freeTextNarrowFocus } : {}) } };
}

describe("shared mechanical rule starters", () => {
  it("uses complete, persistable targets for every example", () => {
    for (const starter of RULE_STARTERS) expect(validateModifierDraft(ruleStarterPatch(starter)), starter.id).toBeNull();
  });
  it("separates feature permission from movement distance", () => {
    expect(mechanicalDescriptionFromModifiers([stored("flight")])).toBe("Grant flight to self.");
    expect(mechanicalDescriptionFromModifiers([stored("flight-speed")])).toBe("Set Flying Speed to exactly 120 ft.");
    expect(mechanicalDescriptionFromModifiers([{ ...stored("flight"), operation: "revoke" }])).toBe("Revoke flight from self.");
  });
  it("keeps bias scoped to the chosen roll rather than changing its numeric score", () => {
    expect(mechanicalDescriptionFromModifiers([stored("advantage")])).toBe("Grant advantage on Awareness to self.");
    expect(mechanicalDescriptionFromModifiers([stored("disadvantage")])).toBe("Grant disadvantage on Attack Roll to self.");
    expect(mechanicalDescriptionFromModifiers([{ ...stored("advantage"), value: { kind: "keyword", value: "advantage" } }])).toBe("Grant advantage on Awareness to self.");
  });
  it("preserves exact fractional damage multipliers and their named type", () => {
    expect(mechanicalDescriptionFromModifiers([stored("resistance")])).toBe("Take half fire damage.");
    expect(mechanicalDescriptionFromModifiers([stored("immunity")])).toBe("Take no fire damage.");
    expect(mechanicalDescriptionFromModifiers([stored("vulnerability")])).toBe("Take double fire damage.");
  });
  it("retains custom resource names in generated sentences", () => {
    expect(mechanicalDescriptionFromModifiers([stored("resource")])).toBe("Set Focus Points to exactly 3.");
  });
});
