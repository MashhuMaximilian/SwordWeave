import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/lib/publishing/library-query";
import { mergeLibraryItems } from "../use-infinite-library";
import { discoveryFilterParams, EMPTY_DISCOVERY_FILTERS } from "@/components/characters/workspace/library-discovery-filters";

const item = (id: string, name = id) => ({ id, name } as LibraryItem);
describe("incremental library discovery", () => {
  it("deduplicates overlapping pages without rearranging the selected entry", () => {
    const merged = mergeLibraryItems([item("a"), item("b")], [item("b", "Updated title"), item("c")]);
    expect(merged.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(merged[1]?.name).toBe("Updated title");
  });
  it("also deduplicates repeated entries within a single page", () => {
    expect(mergeLibraryItems([], [item("a"), item("a"), item("b")])).toHaveLength(2);
  });
  it("does not send empty constraints, but keeps the zero BU floor and ceiling", () => {
    expect(discoveryFilterParams(EMPTY_DISCOVERY_FILTERS)).toEqual({});
    expect(discoveryFilterParams({ ...EMPTY_DISCOVERY_FILTERS, minBu: "0", maxBu: "0" })).toEqual({ minBu: "0", maxBu: "0" });
  });
  it("preserves authored fixed-number constraints including negative values and zero", () => {
    expect(discoveryFilterParams({ ...EMPTY_DISCOVERY_FILTERS, minMagnitude: "-5", maxMagnitude: "0", conditionMode: "conditional", recipient: "self", mechanicTarget: "attribute.physical" })).toEqual({ minMagnitude: "-5", maxMagnitude: "0", conditionMode: "conditional", recipient: "self", mechanicTarget: "attribute.physical" });
  });
  it("sends authoring layer and mirrored eligibility as discovery constraints only", () => {
    expect(discoveryFilterParams({ ...EMPTY_DISCOVERY_FILTERS, definitionKind: "EXPRESSION", mirrorableOnly: true, tags: "  fire, movement  " })).toEqual({ definitionKind: "EXPRESSION", mirrorableOnly: "1", tags: "fire, movement" });
  });
});
