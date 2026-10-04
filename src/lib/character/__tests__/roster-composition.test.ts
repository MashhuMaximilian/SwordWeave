import { describe, expect, it } from "vitest";
import { rosterComposition } from "../roster-composition";

describe("roster composition", () => {
  it("distinguishes purchased vocabulary, mirrored drawbacks and item-only grants", () => {
    const primitiveLinks = [
      {primitiveId: 1, isMirrored: false, source: "LINEAGE"},
      {primitiveId: 1, isMirrored: false, source: "CAPABILITY"},
      {primitiveId: 1, isMirrored: true, source: "PERSONAL"},
      {primitiveId: 2, isMirrored: false, source: "ITEM"},
      {primitiveId: 3, isMirrored: true, source: "ITEM"},
      {primitiveId: 4, isMirrored: false, source: "ITEM", directSource: "PERSONAL"},
    ];
    expect(rosterComposition({primitiveLinks, capabilityLinks: [
      {capabilityId:"a"},{capabilityId:"a"},{capabilityId:"b"},
    ]})).toEqual({primitives:2,drawbacks:1,capabilities:2});
  });
  it("handles an empty character without inventing purchases", () => {
    expect(rosterComposition({primitiveLinks:[],capabilityLinks:[]}))
      .toEqual({primitives:0,drawbacks:0,capabilities:0});
  });
});
