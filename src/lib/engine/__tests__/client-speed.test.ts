import { describe, expect, it } from "vitest";
import { buildClientSpeedByType } from "../client-speed";

const contribution = (overrides: Partial<{
  op: string; value: number; inhibited: boolean; conditionActive: boolean; primitiveCategory: string;
}> = {}) => ({
  op: "add", value: 10, inhibited: false, conditionActive: true,
  primitiveCategory: "MOBILITY_LOCOMOTION", ...overrides,
});

describe("client speed reconciliation", () => {
  it("does not count a published walking primitive twice", () => {
    const speed = buildClientSpeedByType(
      { WALKING_SPEED: 60, SWIMMING_SPEED: 25 },
      { byTarget: { "speed.walking_speed": [contribution()] } },
    );
    expect(speed).toEqual({ WALKING_SPEED: 60, SWIMMING_SPEED: 25 });
  });

  it("adds local runtime speed and removes an inhibited published source", () => {
    const speed = buildClientSpeedByType(
      { WALKING_SPEED: 60 },
      { byTarget: { "speed.walking_speed": [
        contribution({ inhibited: true }),
        contribution({ value: 5, primitiveCategory: "RUNTIME_CONDITION" }),
      ] } },
    );
    expect(speed["WALKING_SPEED"]).toBe(55);
  });
});
