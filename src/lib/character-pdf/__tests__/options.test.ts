import { describe, expect, it } from "vitest";
import { readCharacterSheetPdfOptions } from "@/lib/mcp/character-sheet-pdf";
import { CHARACTER_PDF_STYLES, DEFAULT_CHARACTER_PDF_OPTIONS, characterPdfFilename, characterPdfOptionsSchema } from "../options";

describe("character PDF options", () => {
  it("accepts all twelve styles and both formats/densities", () => {
    expect(CHARACTER_PDF_STYLES).toHaveLength(12);
    for (const style of CHARACTER_PDF_STYLES) for (const orientation of ["portrait", "landscape"]) {
      expect(characterPdfOptionsSchema.parse({ style: style.id, orientation, density: "compact", workbench: true })).toMatchObject({ style: style.id, orientation });
    }
    expect(characterPdfOptionsSchema.parse({})).toEqual(DEFAULT_CHARACTER_PDF_OPTIONS);
  });
  it("rejects unknown fields, path-like styles and coerced booleans", () => {
    for (const value of [{ style: "../file" }, { density: "tiny" }, { workbench: "true" }, { color: "false" }, { command: "python" }, null, []]) {
      expect(characterPdfOptionsSchema.safeParse(value).success).toBe(false);
    }
  });
  it("keeps monochrome as the default and gives color downloads distinct names", () => {
    expect(DEFAULT_CHARACTER_PDF_OPTIONS.color).toBe(false);
    expect(characterPdfFilename("Orren", { ...DEFAULT_CHARACTER_PDF_OPTIONS, color: true })).toBe("swordweave-orren-aegis-portrait-color.pdf");
  });
  it("accepts the source parameter added to ChatGPT links and still rejects other unknown options", () => {
    const options = (query: string) => readCharacterSheetPdfOptions(new URLSearchParams(query));
    expect(options("utm_source=chatgpt.com&orientation=landscape")).toEqual({
      ...DEFAULT_CHARACTER_PDF_OPTIONS, orientation: "landscape",
    });
    expect(options("utm_source=chatgpt.com&utm_source=chatgpt.com")).toBeNull();
    expect(options("utm_source=chatgpt.com&unknown=1")).toBeNull();
  });
  it("builds bounded attachment filenames without control characters or paths", () => {
    const filename = characterPdfFilename('Éowyn / "Hero"\r\nX-Header: nope', DEFAULT_CHARACTER_PDF_OPTIONS);
    expect(filename).toBe("swordweave-eowyn-hero-x-header-nope-aegis-portrait.pdf");
    expect(filename).not.toMatch(/[\r\n"/\\]/);
    expect(characterPdfFilename("🐉", DEFAULT_CHARACTER_PDF_OPTIONS)).toContain("character-aegis");
    expect(characterPdfFilename("a".repeat(1000), DEFAULT_CHARACTER_PDF_OPTIONS).length).toBeLessThan(150);
  });
});
