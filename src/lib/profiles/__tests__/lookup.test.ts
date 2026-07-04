import { describe, it, expect } from "vitest";
import { anonymizeUserId, validateUsername } from "../username";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "../username";

describe("username validation edge cases (lookup integration)", () => {
  // Tests the validation rules that the lookup library depends on.

  it("rejects username with hyphens (caught by INVALID_CHARACTERS)", () => {
    const r = validateUsername("hello-world");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("INVALID_CHARACTERS");
  });

  it("rejects username with periods (caught by INVALID_CHARACTERS)", () => {
    const r = validateUsername("hello.world");
    expect(r.valid).toBe(false);
  });

  it("rejects username with spaces (caught by INVALID_CHARACTERS)", () => {
    const r = validateUsername("hello world");
    expect(r.valid).toBe(false);
  });

  it("accepts boundary lengths", () => {
    expect(validateUsername("a".repeat(USERNAME_MIN_LENGTH)).valid).toBe(true);
    expect(validateUsername("a".repeat(USERNAME_MAX_LENGTH)).valid).toBe(true);
  });

  it("rejects one char too few / too many", () => {
    expect(
      validateUsername("a".repeat(USERNAME_MIN_LENGTH - 1)).valid,
    ).toBe(false);
    expect(
      validateUsername("a".repeat(USERNAME_MAX_LENGTH + 1)).valid,
    ).toBe(false);
  });
});

describe("anonymizeUserId deterministic + reversible-safe", () => {
  it("produces identical output for the same input", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const a = await anonymizeUserId(id);
    const b = await anonymizeUserId(id);
    expect(a).toBe(b);
  });

  it("produces different output for different inputs", async () => {
    const a = await anonymizeUserId("id-a");
    const b = await anonymizeUserId("id-b");
    expect(a).not.toBe(b);
  });

  it("output starts with deleted_user_", async () => {
    const a = await anonymizeUserId("any-id");
    expect(a.startsWith("deleted_user_")).toBe(true);
  });

  it("output length is fixed (deleted_user_ + 8 hex)", () => {
    return anonymizeUserId("any-id").then((a) => {
      expect(a.length).toBe("deleted_user_".length + 8);
    });
  });

  it("anonymized output passes validateUsername", async () => {
    const anon = await anonymizeUserId("any-id");
    const r = validateUsername(anon);
    expect(r.valid).toBe(true);
  });

  it("anonymized output is NOT reserved", async () => {
    const anon = await anonymizeUserId("any-id");
    // deleted is reserved but deleted_user_<hex> is not — confirm collision
    // resistance holds in practice
    expect(anon).not.toBe("deleted");
    expect(anon).not.toBe("admin");
    expect(anon).not.toBe("root");
  });
});

describe("username rename validation flow", () => {
  // The lookup.renameUsername function delegates to validateUsername first
  // and surfaces its error. We test that the upstream validation catches
  // everything renameUsername would reject.

  it("rejects empty", () => {
    const r = validateUsername("");
    expect(r.valid).toBe(false);
  });

  it("rejects too short", () => {
    const r = validateUsername("ab");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("TOO_SHORT");
  });

  it("rejects too long", () => {
    const r = validateUsername("a".repeat(65));
    expect(r.valid).toBe(false);
    expect(r.error).toBe("TOO_LONG");
  });

  it("rejects reserved names", () => {
    for (const reserved of ["admin", "root", "system", "support"]) {
      expect(validateUsername(reserved).valid, `${reserved} should be reserved`).toBe(false);
    }
  });

  it("accepts valid rename candidates", () => {
    for (const candidate of ["mashu_42", "alice", "xander_2000"]) {
      const r = validateUsername(candidate);
      expect(r.valid, `${candidate} should be valid`).toBe(true);
      expect(r.normalized).toBe(candidate);
    }
  });
});