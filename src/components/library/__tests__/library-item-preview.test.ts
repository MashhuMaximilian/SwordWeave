// =============================================================================
// Unit tests for libraryCompositeId helper.
//
// This lives in a .test.ts (not .tsx) because the function is pure and we
// don't need to render anything. Importing from library-item-preview pulls
// in React only via types — no runtime React needed.
// =============================================================================

import { describe, expect, it } from "vitest";
import { libraryCompositeId } from "../library-item-preview";

describe("libraryCompositeId", () => {
  it("uppercases simple kinds verbatim", () => {
    expect(
      libraryCompositeId({ kind: "primitive", row: { id: 13, name: "Strike" } as never }),
    ).toBe("PRIMITIVE:13");
    expect(
      libraryCompositeId({ kind: "effect", row: { id: "abc" } as never }),
    ).toBe("EFFECT:abc");
    expect(
      libraryCompositeId({ kind: "capability", row: { id: "cap_1" } as never }),
    ).toBe("CAPABILITY:cap_1");
    expect(
      libraryCompositeId({ kind: "item", row: { id: "item_1" } as never }),
    ).toBe("ITEM:item_1");
  });

  it("appends _TEMPLATE suffix for template rows (bug regression)", () => {
    // The original bug was `item.kind.toUpperCase()` producing "TEMPLATE",
    // which made the library URL `/library/item/TEMPLATE:<id>` — a 404.
    expect(
      libraryCompositeId({
        kind: "heritage",
        row: { id: "race_1", kind: "LINEAGE" } as never,
      }),
    ).toBe("LINEAGE_TEMPLATE:race_1");
    expect(
      libraryCompositeId({
        kind: "heritage",
        row: { id: "bg_1", kind: "UPBRINGING" } as never,
      }),
    ).toBe("UPBRINGING_TEMPLATE:bg_1");
    expect(
      libraryCompositeId({
        kind: "heritage",
        row: { id: "arch_1", kind: "MANIFEST" } as never,
      }),
    ).toBe("MANIFEST_TEMPLATE:arch_1");
  });
});
