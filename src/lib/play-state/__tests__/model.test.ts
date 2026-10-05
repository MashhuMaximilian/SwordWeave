import { describe, it, expect } from "vitest";
import { applyPlayMutation, emptyPlayState, PlayConflict, playMutationSchema, previewSessionBackup, sessionBackup } from "../model";
const op = (baseRevision: number, field: string, value: unknown) => ({ opId: "11111111-1111-4111-8111-111111111111", baseRevision, changes: [{ field, value }] });
describe("session revision protocol", () => {
  it("does not advance revision for an identical absolute assignment", () => {
    const state = applyPlayMutation(emptyPlayState(), op(0, "currentVitality", 10));
    expect(applyPlayMutation(state, op(1, "currentVitality", 10))).toBe(state);
    expect(applyPlayMutation(emptyPlayState(), op(0, "cap:a", null)).revision).toBe(0);
  });
  it("merges independent fields from two devices", () => {
    const first = applyPlayMutation(emptyPlayState(), op(0, "cap:a", true));
    const second = applyPlayMutation(first, op(0, "eff:b", true));
    expect(second.overrides).toEqual({ "cap:a": true, "eff:b": true });
  });
  it("rejects conflicting edits without partially applying unrelated fields", () => {
    const state = applyPlayMutation(emptyPlayState(), op(0, "currentVitality", 10));
    expect(() => applyPlayMutation(state, { ...op(0, "currentVitality", 20), changes: [{ field: "cap:a", value: true }, { field: "currentVitality", value: 20 }] })).toThrow(PlayConflict);
    expect(state.overrides).toEqual({ currentVitality: 10 });
  });
  it("retains clear revisions, blocking stale retries after receipt expiry", () => {
    const set = applyPlayMutation(emptyPlayState(), op(0, "cap:a", true));
    const clear = applyPlayMutation(set, op(1, "cap:a", null));
    expect(clear.overrides).toEqual({});
    expect(() => applyPlayMutation(clear, op(0, "cap:a", true))).toThrow(PlayConflict);
  });
  it("blocks a retried vitality assignment even if later vitality returned to original value", () => {
    const damaged = applyPlayMutation(emptyPlayState(), op(0, "currentVitality", 10));
    const healed = applyPlayMutation(damaged, op(1, "currentVitality", 20));
    expect(() => applyPlayMutation(healed, op(0, "currentVitality", 10))).toThrow(PlayConflict);
  });
  it("accepts only bounded absolute mutations", () => {
    expect(playMutationSchema.safeParse(op(0, "currentVitality", Infinity)).success).toBe(false);
    expect(playMutationSchema.safeParse(op(0, "name", "Overwritten author")).success).toBe(false);
    expect(playMutationSchema.safeParse(op(0, "cap:a", false)).success).toBe(false);
    expect(playMutationSchema.safeParse({ ...op(0, "cap:a", true), changes: Array.from({ length: 65 }, (_, i) => ({ field: `cap:${i}`, value: true })) }).success).toBe(false);
  });
  it("requires matching identity and build references before restoring", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const state = applyPlayMutation(emptyPlayState(), op(0, "cap:a", true));
    const backup = sessionBackup("CHARACTER", id, ["primitive:a:v2"], state);
    expect(previewSessionBackup(backup, "CHARACTER", id, ["primitive:a:v2"])).toEqual({ "cap:a": true });
    expect(() => previewSessionBackup(backup, "CHARACTER", id, ["primitive:a:v3"])).toThrow(/different sheet or build/);
    expect(() => previewSessionBackup({ ...backup, name: "Authored content" }, "CHARACTER", id, ["primitive:a:v2"])).toThrow();
  });
});
