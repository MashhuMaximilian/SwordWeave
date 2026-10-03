import { describe, expect, it } from "vitest";
import { isPublicCharacterPreview } from "../public-preview-policy";

describe("public character preview access", () => {
  it("opens published characters even when the legacy flag is false", () => {
    expect(isPublicCharacterPreview(false, { visibility: "PUBLIC", unpublishedAt: null })).toBe(true);
  });
  it("keeps an explicitly private publication private despite a stale public flag", () => {
    expect(isPublicCharacterPreview(true, { visibility: "PRIVATE", unpublishedAt: null })).toBe(false);
  });
  it("does not expose followers-only characters to anonymous viewers", () => {
    expect(isPublicCharacterPreview(true, { visibility: "FOLLOWERS_ONLY", unpublishedAt: null })).toBe(false);
  });
  it("does not expose an unpublished character despite a stale public flag", () => {
    expect(isPublicCharacterPreview(true, { visibility: "PUBLIC", unpublishedAt: new Date() })).toBe(false);
  });
  it("supports legacy public characters without a publication record", () => {
    expect(isPublicCharacterPreview(true, null)).toBe(true);
  });
  it("keeps legacy private characters private without a publication record", () => {
    expect(isPublicCharacterPreview(false, null)).toBe(false);
  });
});

import { characterSheetPermission } from "../public-preview-policy";
describe("normal character sheet viewing mode", () => {
  it("allows a stranger to read a public sheet", () => {
    expect(characterSheetPermission(null, true, false)).toBe("VIEWER");
  });
  it("does not let a viewing URL expose a private character", () => {
    expect(characterSheetPermission(null, false, true)).toBeNull();
  });
  it("keeps normal owner and editor access", () => {
    expect(characterSheetPermission("OWNER", false, false)).toBe("OWNER");
    expect(characterSheetPermission("EDITOR", false, false)).toBe("EDITOR");
  });
  it("makes a library view read-only even for the owner", () => {
    expect(characterSheetPermission("OWNER", true, true)).toBe("VIEWER");
    expect(characterSheetPermission("EDITOR", true, true)).toBe("VIEWER");
  });
  it("retains a shared viewer's read-only grant", () => {
    expect(characterSheetPermission("VIEWER", false, false)).toBe("VIEWER");
  });
});
