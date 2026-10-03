import { describe, expect, it } from "vitest";
import { sortLibraryItems } from "../sort-library-items";
import { primitiveMechanicFacets } from "../primitive-discovery-facets";
import { parseSort } from "@/lib/library-url-params";
import type { LibraryItem } from "../library-query";
const item = (id: string, buCost: number | null) => ({ id, name: "Same", buCost, likesCount: 0, forkCount: 0, publishedAt: "2026-10-01T00:00:00Z" } as unknown as LibraryItem);
describe("stable discovery ordering", () => {
  it("orders both BU directions with unknown costs last and stable identity ties", () => {
    const values = [item("z", 2), item("unknown", null), item("a", 2), item("free", 0)];
    expect(sortLibraryItems(values, "BU").map(row => row.id)).toEqual(["free", "a", "z", "unknown"]);
    expect(sortLibraryItems(values, "BU_DESC").map(row => row.id)).toEqual(["a", "z", "free", "unknown"]);
    expect(values[0]?.id).toBe("z");
  });
  it("accepts serialized dates and stabilizes equal engagement across chunks", () => {
    const values = [item("z", 1), item("a", 1)];
    for (const sort of ["RECENT", "ENGAGEMENT", "LIKES", "FORKS"] as const) expect(sortLibraryItems(values, sort).map(row => row.id)).toEqual(["a", "z"]);
  });
  it("parses every cost and alphabet direction from URLs", () => {
    for (const sort of ["BU", "BU_DESC", "ALPHABETICAL_DESC"] as const) expect(parseSort(sort)).toBe(sort);
  });
  it("derives facets from authored fields, without guessing narrative conditions", () => {
    expect(primitiveMechanicFacets([
      { target: "attribute.physical", operation: "add", value: {kind: "number", value: 3}, metadata: {recipient: "TARGET"}, condition: {kind: "event", event: "tracking"}},
      { target: "speed.climbing", operation: "add", value: 10 },
    ])).toEqual({ mechanicTargets: ["attribute.physical", "speed.climbing"], recipients: ["TARGET", "SELF"], conditional: true, magnitudes: [3,10] });
    expect(primitiveMechanicFacets([{target:"output.damage",operation:"add",value:-5}]).magnitudes).toEqual([-5]);
    expect(primitiveMechanicFacets([{target:"attribute", operation:"add", value:{kind:"number",value:3},metadata:{targetScope:{layer:"ATTRIBUTE",values:["PHYSICAL"]}}}]).mechanicTargets).toEqual(["attribute","attribute.PHYSICAL"]);
    expect(primitiveMechanicFacets([{target:"behavior", operation:"grant", value:1,metadata:{behaviorName:"flight"}}]).mechanicTargets).toEqual(["behavior","flight"]);
    expect(primitiveMechanicFacets(null)).toEqual({ mechanicTargets: [], recipients: [], conditional: false, magnitudes: [] });
  });
});
