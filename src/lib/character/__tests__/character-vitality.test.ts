/**
 * character-vitality.test.ts — Phase 8.2 batch 2
 *
 * Tests the pure helper functions in character-vitality.ts. The
 * loadCharacterMaxVitality() function requires a DB + Clerk auth so
 * it's not tested here (covered by integration tests).
 *
 * What we cover:
 *   - clampVitality: boundary cases (negative, zero, max, beyond max,
 *     fractional input, NaN, Infinity)
 */

import { describe, it, expect } from "vitest";
import { clampVitality } from "../character-vitality";

describe("clampVitality", () => {
  it("clamps negative to 0", () => {
    expect(clampVitality(-5, 30)).toBe(0);
  });

  it("returns 0 when next is exactly 0", () => {
    expect(clampVitality(0, 30)).toBe(0);
  });

  it("returns the value when within range", () => {
    expect(clampVitality(15, 30)).toBe(15);
  });

  it("clamps to max when value equals max", () => {
    expect(clampVitality(30, 30)).toBe(30);
  });

  it("clamps above max down to max", () => {
    expect(clampVitality(45, 30)).toBe(30);
  });

  it("floors fractional values", () => {
    expect(clampVitality(15.7, 30)).toBe(15);
    expect(clampVitality(15.99, 30)).toBe(15);
  });

  it("returns 0 for NaN", () => {
    expect(clampVitality(Number.NaN, 30)).toBe(0);
  });

  it("returns 0 for +Infinity (non-finite treated as invalid)", () => {
    expect(clampVitality(Number.POSITIVE_INFINITY, 30)).toBe(0);
  });

  it("clamps -Infinity to 0", () => {
    expect(clampVitality(Number.NEGATIVE_INFINITY, 30)).toBe(0);
  });

  it("works at max = 0 (e.g. zero-vitality corner case)", () => {
    expect(clampVitality(10, 0)).toBe(0);
    expect(clampVitality(-5, 0)).toBe(0);
  });
});