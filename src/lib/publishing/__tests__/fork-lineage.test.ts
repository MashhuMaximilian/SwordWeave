import { describe, expect, it } from "vitest";
import { parseForkSourceOrigin } from "@/lib/publishing/fork-lineage";

describe("parseForkSourceOrigin", () => {
  it("parses modern fork:TYPE:id format", () => {
    expect(parseForkSourceOrigin("fork:PRIMITIVE:425", "PRIMITIVE")).toEqual({
      type: "PRIMITIVE",
      id: "425",
    });
  });

  it("parses modern fork:TYPE:id:rest format (drops rest)", () => {
    expect(
      parseForkSourceOrigin("fork:CAPABILITY:abc-uuid:rest", "CAPABILITY"),
    ).toEqual({
      type: "CAPABILITY",
      id: "abc-uuid",
    });
  });

  it("parses legacy fork:id format using defaultType", () => {
    expect(parseForkSourceOrigin("fork:25", "PRIMITIVE")).toEqual({
      type: "PRIMITIVE",
      id: "25",
    });
  });

  it("parses legacy fork:id when defaultType is a different type", () => {
    // Edge case: legacy format on a non-primitive. We use defaultType.
    expect(parseForkSourceOrigin("fork:25", "CAPABILITY")).toEqual({
      type: "CAPABILITY",
      id: "25",
    });
  });

  it("returns null for non-fork source_origin", () => {
    expect(parseForkSourceOrigin("user:user_abc", "PRIMITIVE")).toBeNull();
    expect(parseForkSourceOrigin("Blueprint Ledger (Notion)", "PRIMITIVE")).toBeNull();
    expect(parseForkSourceOrigin("", "PRIMITIVE")).toBeNull();
  });

  it("returns null for fork: with no payload", () => {
    expect(parseForkSourceOrigin("fork:", "PRIMITIVE")).toBeNull();
  });

  it("parses fork:TYPE with empty id as type-only (edge case, not null)", () => {
    // Modern branch fires because first part is a known type. The id is
    // empty string. Callers should treat empty id as a malformed fork
    // and not render a link. We document the behavior here.
    expect(parseForkSourceOrigin("fork:PRIMITIVE:", "PRIMITIVE")).toEqual({
      type: "PRIMITIVE",
      id: "",
    });
  });

  it("treats unknown type in first position as legacy (uses defaultType)", () => {
    // First part is not a known type, so the modern branch doesn't
    // match. Falls through to legacy which uses defaultType for the
    // type and "UNKNOWN" as the id. Callers should validate the id
    // is numeric/UUID before rendering a link.
    expect(parseForkSourceOrigin("fork:UNKNOWN", "PRIMITIVE")).toEqual({
      type: "PRIMITIVE",
      id: "UNKNOWN",
    });
  });

  it("accepts all known ForkTargetType prefixes", () => {
    const types = [
      "PRIMITIVE",
      "CAPABILITY",
      "EFFECT",
      "ITEM",
      "CHARACTER",
      "LINEAGE_TEMPLATE",
      "UPBRINGING_TEMPLATE",
      "MANIFEST_TEMPLATE",
    ] as const;
    for (const t of types) {
      const result = parseForkSourceOrigin(`fork:${t}:abc`, "PRIMITIVE");
      expect(result).toEqual({ type: t, id: "abc" });
    }
  });
});
