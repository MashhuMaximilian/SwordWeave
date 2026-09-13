import { describe, expect, it } from "vitest";
import { libraryOrigin, libraryTier, primitiveGroupKey } from "../library-classification";

describe("V12 corpus classification", () => {
  it("keeps system attribution despite legacy user ownership", () => {
    expect(libraryOrigin({ authorId:"user_1", authorIsAdmin:false, sourceOrigin:"system" })).toBe("system");
    expect(libraryOrigin({ authorId:"user_1", authorIsAdmin:false, sourceOrigin:"fork:4" })).toBe("community");
  });
  it("uses the recorded tier instead of guessing it from BU", () => {
    expect(libraryTier({ costTier:"Tier 4: Core Axis (24 BU anchor)" })).toBe(4);
    expect(libraryTier({ costTier:null })).toBeNull();
  });
  it("groups by mechanical scope, with an explicit unclassified fallback", () => {
    expect(primitiveGroupKey("DOMAIN", [{metadata:{targetScope:{values:["metal"]}}}])).toBe("metal");
    expect(primitiveGroupKey("DOMAIN", [{metadata:{domain_key:"storm"}}])).toBe("storm");
    expect(primitiveGroupKey("DOMAIN", [null])).toBe("Unclassified");
  });
});
