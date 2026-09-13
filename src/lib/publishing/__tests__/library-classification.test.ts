import { describe, expect, it } from "vitest";
import { groupLibraryEntries, libraryOrigin, libraryTier, primitiveGroupKey } from "../library-classification";

describe("V12 corpus classification", () => {
  it("keeps system attribution despite legacy user ownership", () => {
    expect(libraryOrigin({ authorId:"user_1", authorIsAdmin:false, sourceOrigin:"system" })).toBe("system");
    expect(libraryOrigin({ authorId:"user_1", authorIsAdmin:false, sourceOrigin:"fork:4" })).toBe("community");
  });
  it("uses the recorded tier instead of guessing it from BU", () => {
    expect(libraryTier({ costTier:"Tier 4: Core Axis (24 BU anchor)" })).toBe(4);
    expect(libraryTier({ costTier:null })).toBeNull();
  });
  it("prefers the normalized domain identity over general scope", () => {
    expect(primitiveGroupKey("DOMAIN", [{metadata:{domain_key:"  METAL  ",targetScope:{values:["self"]}}}])).toBe("metal");
  });
  it("keeps category and tier boundaries while collecting matching expressions", () => {
    const items = [
      { category:"DOMAIN", costTier:"Tier 1", groupKey:"metal" },
      { category:"DOMAIN", costTier:"Tier 2", groupKey:"metal" },
      { category:"DOMAIN", costTier:"Tier 1", groupKey:"metal" },
      { category:"RANGE", costTier:"Tier 1", groupKey:"metal" },
    ];
    const groups = groupLibraryEntries(items);
    expect(groups).toHaveLength(3);
    expect(groups.map(group => group.tier)).toEqual([1, 1, 2]);
    expect(groups[0]?.entries).toEqual([items[0], items[2]]);
  });
  it("groups by mechanical scope, with an explicit unclassified fallback", () => {
    expect(primitiveGroupKey("DOMAIN", [{metadata:{targetScope:{values:["metal"]}}}])).toBe("metal");
    expect(primitiveGroupKey("DOMAIN", [{metadata:{domain_key:"storm"}}])).toBe("storm");
    expect(primitiveGroupKey("DOMAIN", [null])).toBe("Unclassified");
  });
});
