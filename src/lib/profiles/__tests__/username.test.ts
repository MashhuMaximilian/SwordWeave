import { describe, it, expect } from "vitest";
import {
  validateUsername,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  anonymizeUserId,
} from "../username";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  HelloWorld  ")).toBe("helloworld");
  });

  it("returns null for empty/whitespace", () => {
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername("   ")).toBeNull();
  });
});

describe("validateUsername", () => {
  it("accepts a valid lowercase username", () => {
    const r = validateUsername("mashu_42");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("mashu_42");
  });

  it("accepts minimum length (3 chars)", () => {
    const r = validateUsername("abc");
    expect(r.valid).toBe(true);
  });

  it("accepts maximum length (64 chars)", () => {
    const r = validateUsername("a".repeat(USERNAME_MAX_LENGTH));
    expect(r.valid).toBe(true);
  });

  it("rejects empty", () => {
    const r = validateUsername("");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("EMPTY");
  });

  it("rejects too short (< 3 chars)", () => {
    const r = validateUsername("ab");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("TOO_SHORT");
  });

  it("rejects too long (> 64 chars)", () => {
    const r = validateUsername("a".repeat(USERNAME_MAX_LENGTH + 1));
    expect(r.valid).toBe(false);
    expect(r.error).toBe("TOO_LONG");
  });

  it("normalizes uppercase input to lowercase (then accepts)", () => {
    // Validation lowercases input first — uppercase is allowed as long as the
    // lowercased form passes. This matches typical "username field" UX.
    const r = validateUsername("Hello");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("hello");
  });

  it("rejects special characters", () => {
    expect(validateUsername("hello-world").valid).toBe(false);
    expect(validateUsername("hello.world").valid).toBe(false);
    expect(validateUsername("hello world").valid).toBe(false);
    expect(validateUsername("hello!").valid).toBe(false);
  });

  it("rejects leading underscore", () => {
    const r = validateUsername("_hello");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("LEADING_OR_TRAILING_UNDERSCORE");
  });

  it("rejects trailing underscore", () => {
    const r = validateUsername("hello_");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("LEADING_OR_TRAILING_UNDERSCORE");
  });

  it("rejects consecutive underscores", () => {
    const r = validateUsername("he__llo");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("CONSECUTIVE_UNDERSCORES");
  });

  it("rejects reserved usernames (case-insensitive)", () => {
    expect(validateUsername("admin").valid).toBe(false);
    expect(validateUsername("ADMIN").valid).toBe(false);
    expect(validateUsername("Admin").valid).toBe(false);
    expect(validateUsername("Admin").error).toBe("RESERVED");
  });

  it("rejects all canonical reserved names from the list", () => {
    const reserved = [
      "root", "system", "support", "staff", "mod", "swordweave",
      "official", "null", "undefined", "deleted",
      "anonymous", "anon", "api", "info", "news", "blog", "shop",
      "store", "user", "users",
    ];
    for (const u of reserved) {
      const r = validateUsername(u);
      expect(r.valid, `${u} should be reserved`).toBe(false);
      expect(r.error, `${u} should fail with RESERVED`).toBe("RESERVED");
    }
  });

  it("error messages are populated for each failure case", () => {
    expect(validateUsername("").errorMessage).toBeTruthy();
    expect(validateUsername("a").errorMessage).toBeTruthy();
    expect(validateUsername("a".repeat(100)).errorMessage).toBeTruthy();
    expect(validateUsername("hello-world").errorMessage).toBeTruthy();
    expect(validateUsername("_hi").errorMessage).toBeTruthy();
    expect(validateUsername("he__llo").errorMessage).toBeTruthy();
    expect(validateUsername("admin").errorMessage).toBeTruthy();
  });
});

describe("anonymizeUserId", () => {
  it("returns a deterministic anonymized username", async () => {
    const a = await anonymizeUserId("user-uuid-123");
    const b = await anonymizeUserId("user-uuid-123");
    expect(a).toBe(b);
  });

  it("uses the deleted_user_ prefix", async () => {
    const a = await anonymizeUserId("any-id");
    expect(a.startsWith("deleted_user_")).toBe(true);
  });

  it("produces different anonymized usernames for different ids", async () => {
    const a = await anonymizeUserId("id-1");
    const b = await anonymizeUserId("id-2");
    expect(a).not.toBe(b);
  });

  it("anonymized username passes validateUsername (length 4-64, valid chars)", async () => {
    const anon = await anonymizeUserId("abc-def-ghi");
    const r = validateUsername(anon);
    expect(r.valid).toBe(true);
  });
});