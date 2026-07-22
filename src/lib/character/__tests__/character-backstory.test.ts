/**
 * character-backstory.test.ts — Phase 8.2 batch 3
 *
 * Tests parseBackstory edge cases (null, missing fields, wrong
 * types) and sanitizeBackstory length clamping.
 */

import { describe, it, expect } from "vitest";
import {
  isBackstoryEmpty,
  parseBackstory,
  sanitizeBackstory,
} from "../character-backstory";

describe("parseBackstory", () => {
  it("returns all-empty on null", () => {
    expect(parseBackstory(null)).toEqual({
      origin: "",
      motivation: "",
      ties: "",
      flaw: "",
    });
  });

  it("returns all-empty on undefined", () => {
    expect(parseBackstory(undefined)).toEqual({
      origin: "",
      motivation: "",
      ties: "",
      flaw: "",
    });
  });

  it("returns all-empty on non-object (number)", () => {
    expect(parseBackstory(42)).toEqual({
      origin: "",
      motivation: "",
      ties: "",
      flaw: "",
    });
  });

  it("preserves valid string fields", () => {
    expect(
      parseBackstory({
        origin: "Born in the ashes",
        motivation: "Find the truth",
        ties: "Bromir the Smith",
        flaw: "Distrusts authority",
      }),
    ).toEqual({
      origin: "Born in the ashes",
      motivation: "Find the truth",
      ties: "Bromir the Smith",
      flaw: "Distrusts authority",
    });
  });

  it("replaces non-string values with empty strings", () => {
    expect(
      parseBackstory({
        origin: 42,
        motivation: null,
        ties: ["a", "b"],
        flaw: { nested: true },
      }),
    ).toEqual({
      origin: "",
      motivation: "",
      ties: '["a","b"]',
      flaw: '{"nested":true}',
    });
  });

  it("ignores unknown keys (forward-compat)", () => {
    expect(
      parseBackstory({
        origin: "valid",
        futureField: "ignored",
        anotherFuture: 123,
      }),
    ).toEqual({
      origin: "valid",
      motivation: "",
      ties: "",
      flaw: "",
    });
  });

  it("treats empty string as empty (not 'undefined')", () => {
    expect(
      parseBackstory({
        origin: "",
        motivation: "",
        ties: "",
        flaw: "",
      }),
    ).toEqual({
      origin: "",
      motivation: "",
      ties: "",
      flaw: "",
    });
  });
});

describe("sanitizeBackstory", () => {
  it("trims whitespace from each field", () => {
    const out = sanitizeBackstory({
      origin: "  hello  ",
      motivation: "\nworld\n",
      ties: "",
      flaw: "",
    });
    expect(out.origin).toBe("hello");
    expect(out.motivation).toBe("world");
  });

  it("clamps fields over 4000 chars", () => {
    const huge = "x".repeat(5000);
    const out = sanitizeBackstory({
      origin: huge,
      motivation: "",
      ties: "",
      flaw: "",
    });
    expect(out.origin.length).toBe(4000);
  });

  it("handles nullish fields as empty string", () => {
    const out = sanitizeBackstory({
      origin: "" as string,
      motivation: "" as string,
      ties: "" as string,
      flaw: "" as string,
    });
    expect(out.origin).toBe("");
  });

  it("preserves short strings untouched", () => {
    const out = sanitizeBackstory({
      origin: "Born under a star",
      motivation: "Seeking redemption",
      ties: "Brother Calden",
      flaw: "Quick to anger",
    });
    expect(out).toEqual({
      origin: "Born under a star",
      motivation: "Seeking redemption",
      ties: "Brother Calden",
      flaw: "Quick to anger",
    });
  });
});

describe("isBackstoryEmpty", () => {
  it("returns true on empty backstory", () => {
    expect(
      isBackstoryEmpty({
        origin: "",
        motivation: "",
        ties: "",
        flaw: "",
      }),
    ).toBe(true);
  });

  it("returns false if any field has content", () => {
    expect(
      isBackstoryEmpty({
        origin: "",
        motivation: "Has a goal",
        ties: "",
        flaw: "",
      }),
    ).toBe(false);
  });

  it("treats whitespace-only as empty", () => {
    expect(
      isBackstoryEmpty({
        origin: "   ",
        motivation: "\n\n",
        ties: "",
        flaw: "",
      }),
    ).toBe(true);
  });
});