import { describe, expect, it } from "vitest";
import {
  canonicalLibraryCategory,
  groupLibraryEntries,
  libraryAuthorLabel,
  libraryOrigin,
  libraryTier,
  primitiveGroupKey,
} from "../library-classification";

describe("V12 corpus classification", () => {
  it("keeps system attribution despite legacy user ownership", () => {
    expect(libraryOrigin({ authorId:"user_1", authorIsAdmin:false, sourceOrigin:"system" })).toBe("system");
    expect(libraryOrigin({ authorId:"user_1", authorIsAdmin:false, sourceOrigin:"fork:4" })).toBe("community");
  });
  it("masks admin attribution everywhere in the library", () => {
    expect(libraryAuthorLabel({
      authorId: "user_1",
      authorIsAdmin: true,
      authorDisplayName: "Mashu",
      authorUsername: "mashu",
      sourceOrigin: "fork:4",
    })).toBe("System");
  });
  it("merges character-sheet augments into the sheet family", () => {
    expect(canonicalLibraryCategory("CHARACTER_SHEET_AUGMENT")).toBe("SHEET_AUGMENT");
  });
  it("normalizes raw primitive categories to the market-family rail key", () => {
    // Atelier receives raw primitive categories (DOMAIN/RANGE), while its
    // left rail is keyed by the classified BU Market family.
    expect(canonicalLibraryCategory("DOMAIN")).toBe("DOMAIN_ACCESS");
    expect(canonicalLibraryCategory("RANGE")).toBe("RANGE_SCALING");
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
  it("groups by mechanical scope and marks ambiguous legacy records for review", () => {
    expect(primitiveGroupKey("DOMAIN", [{metadata:{targetScope:{values:["metal"]}}}])).toBe("metal");
    expect(primitiveGroupKey("DOMAIN", [{metadata:{domain_key:"storm"}}])).toBe("storm");
    expect(primitiveGroupKey("DOMAIN", [null])).toBe("Needs classification");
  });

  it("groups domain expressions by their stable domain name", () => {
    expect(primitiveGroupKey("DOMAIN", [], "Domain of Metal", "fork:1")).toBe("Metal");
    expect(primitiveGroupKey("DOMAIN", [], "Domain od Space", "user:1")).toBe("Space");
    expect(primitiveGroupKey("DOMAIN", [], "Domain Access Tier I", "system")).toBe("Domain Access");
  });
});
