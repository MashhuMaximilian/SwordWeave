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
