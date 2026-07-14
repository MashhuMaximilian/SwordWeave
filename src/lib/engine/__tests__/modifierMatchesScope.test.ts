import { describe, it, expect } from "vitest";
import { modifierMatchesScope } from "../stats";
import type { HardModifier } from "@/types/swordweave";

describe("modifierMatchesScope — Phase-7-D wire-up", () => {
  it("matches a legacy dotted-target modifier against its dotted criterion", () => {
    const mod: HardModifier = {
      kind: "modify",
      target: "character.attribute.physical",
      operation: "add",
      value: 1,
    };
    expect(
      modifierMatchesScope(mod, {
        legacyTarget: "character.attribute.physical",
        shortAxis: "attribute",
        scopeLayer: "ATTRIBUTE",
        scopeValue: "PHYSICAL",
      }),
    ).toBe(true);
  });

  it("excludes a legacy dotted-target modifier that targets a different attribute", () => {
    const mod: HardModifier = {
      kind: "modify",
      target: "character.attribute.mental",
      operation: "add",
      value: 5,
    };
    expect(
      modifierMatchesScope(mod, {
        legacyTarget: "character.attribute.physical",
        shortAxis: "attribute",
        scopeLayer: "ATTRIBUTE",
        scopeValue: "PHYSICAL",
      }),
    ).toBe(false);
  });

  it("matches a new-format short-axis modifier with metadata.targetScope.values", () => {
    const mod = {
      kind: "modify" as const,
      target: "max_vitality",
      operation: "add" as const,
      value: 5,
      metadata: {
        targetScope: { layer: "METRIC", values: ["HP"] },
      },
    };
    expect(
      modifierMatchesScope(mod as unknown as HardModifier, {
        legacyTarget: "character.maxVitality",
        shortAxis: "max_vitality",
        scopeLayer: "METRIC",
        scopeValue: "HP",
      }),
    ).toBe(true);
  });

  it("matches a new-format modifier with singular value (legacy DB shape normalized)", () => {
    const mod = {
      kind: "modify" as const,
      target: "max_vitality",
      operation: "add" as const,
      value: 5,
      metadata: { targetScope: { layer: "METRIC", value: "HP" } },
    };
    expect(
      modifierMatchesScope(mod as unknown as HardModifier, {
        legacyTarget: "character.maxVitality",
        shortAxis: "max_vitality",
        scopeLayer: "METRIC",
        scopeValue: "HP",
      }),
    ).toBe(true);
  });

  it("returns true on broad match (empty values = any)", () => {
    const mod = {
      kind: "modify" as const,
      target: "max_vitality",
      operation: "add" as const,
      value: 5,
      metadata: { targetScope: { layer: "METRIC", values: [] } },
    };
    expect(
      modifierMatchesScope(mod as unknown as HardModifier, {
        legacyTarget: "character.maxVitality",
        shortAxis: "max_vitality",
        scopeLayer: "METRIC",
        scopeValue: "HP",
      }),
    ).toBe(true);
  });

  it("returns false when modifier target is unrelated", () => {
    const mod: HardModifier = {
      kind: "modify",
      target: "skill_practice_check",
      operation: "add",
      value: 1,
    };
    expect(
      modifierMatchesScope(mod, {
        legacyTarget: "character.attribute.physical",
        shortAxis: "attribute",
        scopeLayer: "ATTRIBUTE",
        scopeValue: "PHYSICAL",
      }),
    ).toBe(false);
  });
});
