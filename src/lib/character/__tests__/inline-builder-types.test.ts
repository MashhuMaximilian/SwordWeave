import { describe, expect, it } from "vitest";
import {
  ALLOWED_PRIMITIVE_SOURCES,
  isAccordionKind,
  isPrimitiveSource,
  KIND_TO_COLUMN,
  KIND_TO_SNAPSHOT,
  KIND_TO_SOURCE,
} from "@/lib/character/inline-builder-types";

describe("Phase 9.1 inline character-builder shared types", () => {
  describe("isAccordionKind (heritage formalize kind guard)", () => {
    it("accepts LINEAGE / UPBRINGING / MANIFEST", () => {
      expect(isAccordionKind("LINEAGE")).toBe(true);
      expect(isAccordionKind("UPBRINGING")).toBe(true);
      expect(isAccordionKind("MANIFEST")).toBe(true);
    });
    it("rejects other strings, including PERSONAL (which is for items)", () => {
      expect(isAccordionKind("PERSONAL")).toBe(false);
      expect(isAccordionKind("personal")).toBe(false);
      expect(isAccordionKind("")).toBe(false);
      expect(isAccordionKind("lineage")).toBe(false);
    });
    it("rejects non-strings", () => {
      expect(isAccordionKind(null)).toBe(false);
      expect(isAccordionKind(undefined)).toBe(false);
      expect(isAccordionKind(42)).toBe(false);
      expect(isAccordionKind({})).toBe(false);
      expect(isAccordionKind(["LINEAGE"])).toBe(false);
    });
  });

  describe("isPrimitiveSource (primitive slot-source guard)", () => {
    it("accepts the four slot sources", () => {
      expect(isPrimitiveSource("LINEAGE")).toBe(true);
      expect(isPrimitiveSource("UPBRINGING")).toBe(true);
      expect(isPrimitiveSource("MANIFEST")).toBe(true);
      expect(isPrimitiveSource("PERSONAL")).toBe(true);
    });
    it("rejects unknown sources", () => {
      expect(isPrimitiveSource("HERITAGE")).toBe(false);
      expect(isPrimitiveSource("")).toBe(false);
      expect(isPrimitiveSource(null)).toBe(false);
      expect(isPrimitiveSource(123)).toBe(false);
    });
    it("ALLOWED_PRIMITIVE_SOURCES is in sync", () => {
      expect(ALLOWED_PRIMITIVE_SOURCES).toEqual([
        "LINEAGE",
        "UPBRINGING",
        "MANIFEST",
        "PERSONAL",
      ]);
    });
  });

  describe("kind-to-column / kind-to-snapshot maps", () => {
    it("LINEAGE -> lineageId / lineageName", () => {
      expect(KIND_TO_COLUMN.LINEAGE).toBe("lineageId");
      expect(KIND_TO_SNAPSHOT.LINEAGE).toBe("lineageName");
      expect(KIND_TO_SOURCE.LINEAGE).toBe("LINEAGE");
    });
    it("UPBRINGING -> upbringingId / upbringingName", () => {
      expect(KIND_TO_COLUMN.UPBRINGING).toBe("upbringingId");
      expect(KIND_TO_SNAPSHOT.UPBRINGING).toBe("upbringingName");
    });
    it("MANIFEST -> manifestId / manifestName", () => {
      expect(KIND_TO_COLUMN.MANIFEST).toBe("manifestId");
      expect(KIND_TO_SNAPSHOT.MANIFEST).toBe("manifestName");
    });
  });
});
