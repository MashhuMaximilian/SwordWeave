import { describe, expect, it } from "vitest";
import { matchesDiscoveryDestination } from "../compatibility";

describe("destination-compatible discovery", () => {
  it("only offers the current root's heritage bundles", () => {
    for (const destination of ["LINEAGE", "UPBRINGING", "MANIFEST"] as const) {
      for (const type of ["LINEAGE", "UPBRINGING", "MANIFEST"]) {
        expect(matchesDiscoveryDestination("heritage", type, destination)).toBe(type === destination);
      }
    }
  });
  it("keeps ordinary kinds available and never inserts heritage bundles into Items", () => {
    for (const kind of ["primitive", "effect", "capability", "item"] as const) {
      expect(matchesDiscoveryDestination(kind, undefined, "MANIFEST")).toBe(true);
      expect(matchesDiscoveryDestination(kind, undefined, "ITEM")).toBe(true);
    }
    expect(matchesDiscoveryDestination("heritage", "MANIFEST", "ITEM")).toBe(false);
    expect(matchesDiscoveryDestination("heritage", undefined, "MANIFEST")).toBe(false);
  });
  it("preserves unrestricted discovery callers without a root constraint", () => {
    expect(matchesDiscoveryDestination("heritage", "UPBRINGING")).toBe(true);
  });
});
