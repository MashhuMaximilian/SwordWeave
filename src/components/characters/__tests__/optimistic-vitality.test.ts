import { describe, expect, it } from "vitest";
import { reconcileVitality } from "../optimistic-vitality";

describe("reconcileVitality", () => {
  it("does not flash back to stale canonical vitality during a rest", () => {
    expect(reconcileVitality(100, 150)).toEqual({
      visible: 150,
      optimistic: 150,
    });
  });

  it("releases the optimistic value once the server catches up", () => {
    expect(reconcileVitality(150, 150)).toEqual({
      visible: 150,
      optimistic: null,
    });
  });
});
