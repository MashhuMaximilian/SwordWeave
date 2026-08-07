import { describe, it, expect } from "vitest";
import { resolveDamage } from "../damage-resolver";

interface PrimitiveLinkForDamage {
  readonly primitive: {
    readonly id: number;
    readonly name: string;
    readonly hardModifiers: ReadonlyArray<{
      readonly target: string;
      readonly operation: string;
      readonly value: number;
    }>;
  };
  readonly isMirrored?: boolean;
}

function makeLinks(links: ReadonlyArray<PrimitiveLinkForDamage>): ReadonlyArray<unknown> {
  return links;
}

describe("resolveDamage — Phase 8.I i2 finish (Wave 3)", () => {
  it("resistance (0.5x) halves fire damage", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 1,
            name: "Resist Fire",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 0.5 },
            ],
          },
        },
      ]),
    });
    expect(result.final).toBe(5);
    expect(result.multiplier).toBe(0.5);
  });

  it("vulnerability (2x) doubles fire damage", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 2,
            name: "Vulnerable Fire",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 2 },
            ],
          },
        },
      ]),
    });
    expect(result.final).toBe(20);
  });

  it("immunity (0x) zeros damage", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 3,
            name: "Immune Fire",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 0 },
            ],
          },
        },
      ]),
    });
    expect(result.final).toBe(0);
  });

  it("no modifier -> multiplier = 1.0, final = amount", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: [],
    });
    expect(result.final).toBe(10);
    expect(result.multiplier).toBe(1);
  });

  it("stacking resistance + vulnerability cancel (multiplicative)", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 4,
            name: "Resist Fire",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 0.5 },
            ],
          },
        },
        {
          primitive: {
            id: 5,
            name: "Vulnerable Fire",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 2 },
            ],
          },
        },
      ]),
    });
    // 10 * 0.5 * 2 = 10
    expect(result.final).toBe(10);
  });

  it("stacking two resistances halves twice (multiplicative)", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 6,
            name: "Resist Fire A",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 0.5 },
            ],
          },
        },
        {
          primitive: {
            id: 7,
            name: "Resist Fire B",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 0.5 },
            ],
          },
        },
      ]),
    });
    // 10 * 0.5 * 0.5 = 2.5 -> floor = 2
    expect(result.final).toBe(2);
  });

  it("mirrored resistance (0.5x) inverts to 2x (vulnerability)", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 8,
            name: "Resist Fire (mirrored)",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 0.5 },
            ],
          },
          isMirrored: true,
        },
      ]),
    });
    // 0.5 -> 1/0.5 = 2.0; 10 * 2 = 20
    expect(result.final).toBe(20);
  });

  it("different damage types don't affect each other", () => {
    const result = resolveDamage({
      amount: 10,
      type: "fire",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 9,
            name: "Resist Cold",
            hardModifiers: [
              { target: "damage_modifier.cold", operation: "multiply", value: 0.5 },
            ],
          },
        },
      ]),
    });
    // Cold resistance doesn't affect fire damage.
    expect(result.final).toBe(10);
  });

  it("case-insensitive damage type matching", () => {
    const result = resolveDamage({
      amount: 10,
      type: "FIRE",
      primitiveLinks: makeLinks([
        {
          primitive: {
            id: 10,
            name: "Resist Fire",
            hardModifiers: [
              { target: "damage_modifier.fire", operation: "multiply", value: 0.5 },
            ],
          },
        },
      ]),
    });
    expect(result.final).toBe(5);
  });
});
