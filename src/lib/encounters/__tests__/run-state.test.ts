import { describe, it, expect } from "vitest";
import { runMutationSchema } from "../model";
import {
  nextCouncilChanges,
  adjustVitality,
  validateRunReferences,
  validateRunLimits,
  validDiceExpression,
} from "../run-state";
import { applyPlayMutation, emptyPlayState } from "@/lib/play-state/model";
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const mutation = (field: string, value: unknown) =>
  runMutationSchema.safeParse({
    opId: id,
    baseRevision: 0,
    changes: [{ field, value }],
  });
describe("live encounter state", () => {
  it("starts Council without changing vitality, scene progress, notes or persistent reminders", () => {
    const state = {
      round: 2,
      phase: "Heavy",
      [`actor:${id}`]: {
        intent: "Pin the gate",
        track: "Heavy",
        resolved: true,
        presence: "withdrawn",
        target: "Gate",
        reminder: "Recover after resting",
      },
      [`party:${other}`]: { intent: "Hold", track: "Fast", resolved: true },
      [`guest:${other}`]: {
        name: "Scout",
        intent: "Leave",
        track: "Measured",
        resolved: true,
      },
      [`objective:${id}`]: { text: "Get through", done: true },
      [`clock:${id}`]: { label: "Ritual", value: 2, maximum: 4 },
      notes: "Bridge is broken",
      currentVitality: 17,
    };
    const changes = nextCouncilChanges(state, 2, [id], [other]);
    expect(changes.map((c) => c.field)).toEqual([
      "round",
      "phase",
      `actor:${id}`,
      `party:${other}`,
      `guest:${other}`,
    ]);
    const parsed = runMutationSchema.parse({
      opId: id,
      baseRevision: 0,
      changes,
    });
    const next = applyPlayMutation(
      { ...emptyPlayState(), overrides: state },
      parsed,
    );
    expect(next.overrides[`actor:${id}`]).toMatchObject({
      intent: "",
      track: "Unassigned",
      resolved: false,
      presence: "withdrawn",
      target: "",
      reminder: "Recover after resting",
    });
    expect(next.overrides[`guest:${other}`]).toMatchObject({
      name: "Scout",
      intent: "",
      resolved: false,
    });
    expect(next.overrides).toMatchObject({
      round: 3,
      phase: "Council",
      notes: "Bridge is broken",
      currentVitality: 17,
      [`clock:${id}`]: { value: 2 },
      [`objective:${id}`]: { done: true },
    });
  });
  it("validates owned creature and prepared party membership independently of marker content", () => {
    expect(() =>
      validateRunReferences([`actor:${id}`, `party:${other}`], [id], [other]),
    ).not.toThrow();
    expect(() =>
      validateRunReferences([`actor:${other}`], [id], [other]),
    ).toThrow("Creature");
    expect(() => validateRunReferences([`party:${id}`], [id], [other])).toThrow(
      "Character",
    );
  });
  it("accepts bounded scene tools and existing markers; rejects arbitrary gameplay writes", () => {
    expect(
      mutation(`actor:${id}`, {
        intent: "Wait",
        track: "Fast",
        resolved: false,
      }).success,
    ).toBe(true);
    expect(
      mutation(`guest:${id}`, {
        name: "Ally",
        intent: "Wait",
        track: "Fast",
        resolved: false,
      }).success,
    ).toBe(true);
    expect(
      mutation(`objective:${id}`, { text: "Escape", done: false }).success,
    ).toBe(true);
    expect(
      mutation(`clock:${id}`, { label: "Flood", value: 2, maximum: 4 }).success,
    ).toBe(true);
    expect(
      mutation(`log:${id}`, {
        text: "Gate opened",
        round: 1,
        phase: "Council",
        at: 123,
      }).success,
    ).toBe(true);
    for (const [field, value] of [
      ["notes", "a".repeat(10001)],
      ["currentVitality", 10],
      [`clock:${id}`, { label: "Flood", value: 5, maximum: 4 }],
      [`guest:${id}`, { intent: "Wait", track: "Fast", resolved: false }],
      [
        `actor:${id}`,
        { intent: "Wait", track: "Fast", resolved: false, initiative: 20 },
      ],
    ] as const)
      expect(mutation(field, value).success).toBe(false);
  });
  it("bounds roster and journal growth without deleting prior state", () => {
    const state = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`log:${i}`, { text: "Event" }]),
    );
    expect(() => validateRunLimits(state)).not.toThrow();
    expect(() =>
      validateRunLimits({ ...state, "log:new": { text: "Extra" } }),
    ).toThrow("200");
    expect(Object.keys(state)).toHaveLength(200);
  });
  it("keeps independent scene entries mergeable while conflicting on the same entry", () => {
    const a = runMutationSchema.parse({
      opId: id,
      baseRevision: 0,
      changes: [
        {
          field: `clock:${id}`,
          value: { label: "Ritual", value: 1, maximum: 4 },
        },
      ],
    });
    const b = runMutationSchema.parse({
      opId: other,
      baseRevision: 0,
      changes: [
        {
          field: `objective:${other}`,
          value: { text: "Protect scout", done: true },
        },
      ],
    });
    const next = applyPlayMutation(applyPlayMutation(emptyPlayState(), a), b);
    expect(next.revision).toBe(2);
    expect(() =>
      applyPlayMutation(next, {
        ...a,
        changes: [
          {
            field: `clock:${id}`,
            value: { label: "Ritual", value: 2, maximum: 4 },
          },
        ],
      }),
    ).toThrow("Session fields changed");
  });
});
describe("manual quick controls", () => {
  it("clamps damage and healing and rejects invalid input", () => {
    expect(adjustVitality(10, 30, 20, "damage")).toBe(0);
    expect(adjustVitality(10, 30, 25, "heal")).toBe(30);
    for (const n of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => adjustVitality(10, 30, n, "damage")).toThrow();
  });
  it("bounds dice workloads and rejects partial expressions", () => {
    for (const expression of ["1d20", "2d6+3", "20d100-99"])
      expect(validDiceExpression(expression)).toBe(true);
    for (const expression of [
      "0d6",
      "21d20",
      "10000d6",
      "1d0",
      "1d20 garbage",
      "1d6+2d8",
    ])
      expect(validDiceExpression(expression)).toBe(false);
  });
});
