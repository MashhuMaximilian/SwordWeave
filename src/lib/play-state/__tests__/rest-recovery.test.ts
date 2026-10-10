import { describe, expect, it } from "vitest";
import { applyPlayMutation, emptyPlayState, PlayConflict, playMutationSchema, previewSessionBackup, sessionBackup } from "../model";
import { restRecoveryAllowance, restRecoveryChanges, SHORT_REST_RECOVERY_USED } from "../rest-recovery";

const id = "11111111-1111-4111-8111-111111111111";
const operation = (baseRevision: number, changes: ReturnType<typeof restRecoveryChanges>) => playMutationSchema.parse({ opId: id, baseRevision, source: "short_rest", changes });

describe("agreed rest recovery", () => {
  it("preserves the established rounded-up half-maximum default for older sessions", () => {
    expect(restRecoveryAllowance(13, {})).toEqual({ allowance: 7, used: 0, remaining: 7 });
  });
  it("spends only actual healing and carries unused recovery into later short rests", () => {
    const first = applyPlayMutation(emptyPlayState(), operation(0, restRecoveryChanges("short", 10, 7, {})));
    expect(first.overrides).toEqual({ currentVitality: 10, shortRestRecoveryUsed: 3 });
    const second = restRecoveryChanges("short", 10, 6, first.overrides);
    expect(second).toEqual([{ field: "currentVitality", value: 8 }, { field: SHORT_REST_RECOVERY_USED, value: 5 }]);
    expect(restRecoveryChanges("short", 10, 2, { shortRestRecoveryUsed: 5 })[0]?.value).toBe(2);
  });
  it("does not spend any recovery when already at maximum", () => {
    expect(restRecoveryChanges("short", 13, 13, { shortRestRecoveryUsed: 3 })).toEqual([{ field: "currentVitality", value: 13 }, { field: SHORT_REST_RECOVERY_USED, value: 3 }]);
  });
  it("permits table-agreed partial healing; a long rest resets the allowance", () => {
    expect(restRecoveryChanges("short", 20, 2, {}, 3)).toEqual([{ field: "currentVitality", value: 5 }, { field: SHORT_REST_RECOVERY_USED, value: 3 }]);
    expect(restRecoveryChanges("long", 20, 2, { shortRestRecoveryUsed: 10 }, 12)).toEqual([{ field: "currentVitality", value: 14 }, { field: SHORT_REST_RECOVERY_USED, value: 0 }]);
    expect(restRecoveryChanges("long", 20, 20, { shortRestRecoveryUsed: 10 }, 0)[1]?.value).toBe(0);
  });
  it("rejects negative, fractional and excessive restoration", () => {
    for (const amount of [-1, 1.2, 11, Infinity]) expect(() => restRecoveryChanges("short", 20, 0, {}, amount)).toThrow();
    for (const amount of [-1, 0.5, Infinity, "5"]) expect(playMutationSchema.safeParse({ opId: id, baseRevision: 0, changes: [{ field: SHORT_REST_RECOVERY_USED, value: amount }] }).success).toBe(false);
  });
  it("never creates negative available recovery after the maximum decreases", () => {
    expect(restRecoveryAllowance(6, { shortRestRecoveryUsed: 7 }).remaining).toBe(0);
  });
  it("conflicts on concurrent rests without partially restoring or resetting the allowance", () => {
    const old = emptyPlayState();
    const first = operation(0, restRecoveryChanges("short", 20, 3, old.overrides, 4));
    const second = operation(0, restRecoveryChanges("long", 20, 3, old.overrides));
    const applied = applyPlayMutation(old, first);
    expect(() => applyPlayMutation(applied, second)).toThrow(PlayConflict);
    expect(applied.overrides).toEqual({ currentVitality: 7, shortRestRecoveryUsed: 4 });
    expect(() => applyPlayMutation(applied, first)).toThrow(PlayConflict);
  });
  it("includes remaining recovery in existing character and monster backup formats", () => {
    const state = applyPlayMutation(emptyPlayState(), operation(0, restRecoveryChanges("short", 20, 3, {}, 4)));
    for (const kind of ["CHARACTER", "MONSTER_PLAY_COPY"] as const) {
      expect(previewSessionBackup(sessionBackup(kind, id, ["pin:v1"], state), kind, id, ["pin:v1"])).toEqual({ currentVitality: 7, shortRestRecoveryUsed: 4 });
    }
  });
});
