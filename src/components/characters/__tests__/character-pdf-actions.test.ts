import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTER_PDF_STYLES, DEFAULT_CHARACTER_PDF_OPTIONS,
  characterPdfFilename, characterPdfStylePreview, nextCharacterPdfStyle,
  observeCharacterPdfChanges, parseCharacterPdfOptions, requestCharacterPdf,
} from "../character-pdf-actions";
import { emitCharacterLogAdded } from "@/lib/character/character-events";

afterEach(() => vi.unstubAllGlobals());

describe("character PDF preferences", () => {
  it("keeps all twelve approved designs and valid orientation/density preferences", () => {
    expect(CHARACTER_PDF_STYLES).toHaveLength(12);
    for (const style of CHARACTER_PDF_STYLES) {
      expect(parseCharacterPdfOptions({ style, density: "compact", orientation: "landscape", workbench: true }))
        .toEqual({ style, density: "compact", orientation: "landscape", workbench: true, color: false });
    }
  });
  it("remembers an explicit color choice and keeps older preferences monochrome", () => {
    expect(parseCharacterPdfOptions({ color: true }).color).toBe(true);
    expect(parseCharacterPdfOptions({ color: "true" }).color).toBe(false);
    expect(characterPdfStylePreview("aegis", { orientation: "portrait", density: "normal", color: true })).toBe("/character-sheet-styles/aegis-portrait-normal-color.webp");
  });
  it("recovers malformed stored fields independently without coercing booleans", () => {
    expect(parseCharacterPdfOptions(null)).toEqual(DEFAULT_CHARACTER_PDF_OPTIONS);
    expect(parseCharacterPdfOptions({ style: "unknown", density: "normal", orientation: "sideways", workbench: "false" }))
      .toEqual({ ...DEFAULT_CHARACTER_PDF_OPTIONS, density: "normal" });
  });
});

describe("character PDF design gallery", () => {
  it("offers a distinct real preview for every style, orientation and density", () => {
    const previews = new Set<string>();
    for (const style of CHARACTER_PDF_STYLES) {
      for (const orientation of ["portrait", "landscape"] as const) {
        for (const density of ["normal", "compact"] as const) {
          const preview = characterPdfStylePreview(style, { orientation, density });
          expect(preview).toBe(`/character-sheet-styles/${style}-${orientation}-${density}.webp`);
          previews.add(preview);
        }
      }
    }
    expect(previews.size).toBe(48);
  });
  it("lets keyboard users traverse every design, wrap, and jump to either end", () => {
    let style: typeof CHARACTER_PDF_STYLES[number] = "aegis";
    const visited = new Set<typeof CHARACTER_PDF_STYLES[number]>([style]);
    for (let index = 0; index < 11; index++) {
      style = nextCharacterPdfStyle(style, "ArrowRight")!;
      visited.add(style);
    }
    expect(visited.size).toBe(12);
    expect(nextCharacterPdfStyle(style, "ArrowDown")).toBe("aegis");
    expect(nextCharacterPdfStyle("aegis", "ArrowLeft")).toBe("solstice");
    expect(nextCharacterPdfStyle("prism", "Home")).toBe("aegis");
    expect(nextCharacterPdfStyle("prism", "End")).toBe("solstice");
    expect(nextCharacterPdfStyle("prism", "Enter")).toBeNull();
  });
});

describe("character PDF transport", () => {
  it("posts the selected portrait/landscape and automatic/forced layout without changing the returned binary", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"orren.pdf\"" } }));
    vi.stubGlobal("fetch", fetcher);
    const options = { ...DEFAULT_CHARACTER_PDF_OPTIONS, orientation: "landscape", density: "compact", workbench: true } as const;
    const signal = new AbortController().signal;
    const output = await requestCharacterPdf("a/b", options, signal);
    expect(fetcher).toHaveBeenCalledWith("/api/characters/a%2Fb/pdf", expect.objectContaining({ method: "POST", body: JSON.stringify(options), signal }));
    expect(new Uint8Array(await output.blob.arrayBuffer())).toEqual(bytes);
    expect(output.filename).toBe("orren.pdf");
    expect(output.artworkWarnings).toBe(0);
  });
  it("reports actual missing artwork without exposing source errors, and rejects malformed warning counts", async () => {
    const response = (count: string) => new Response("%PDF-1.7", { headers: { "Content-Type": "application/pdf", "X-SwordWeave-PDF-Artwork-Warnings": count } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response("2")).mockResolvedValueOnce(response("unsupported-source")).mockResolvedValueOnce(response("-1")));
    expect((await requestCharacterPdf("id", DEFAULT_CHARACTER_PDF_OPTIONS, new AbortController().signal)).artworkWarnings).toBe(2);
    expect((await requestCharacterPdf("id", DEFAULT_CHARACTER_PDF_OPTIONS, new AbortController().signal)).artworkWarnings).toBe(0);
    expect((await requestCharacterPdf("id", DEFAULT_CHARACTER_PDF_OPTIONS, new AbortController().signal)).artworkWarnings).toBe(0);
  });
  it("does not offer HTML error or empty responses as downloadable PDFs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("login", { headers: { "Content-Type": "text/html" } })).mockResolvedValueOnce(new Response("", { headers: { "Content-Type": "application/pdf" } })));
    await expect(requestCharacterPdf("id", DEFAULT_CHARACTER_PDF_OPTIONS, new AbortController().signal)).rejects.toThrow("did not return a PDF");
    await expect(requestCharacterPdf("id", DEFAULT_CHARACTER_PDF_OPTIONS, new AbortController().signal)).rejects.toThrow("empty");
  });
  it("surfaces an access failure with useful recovery text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));
    await expect(requestCharacterPdf("id", DEFAULT_CHARACTER_PDF_OPTIONS, new AbortController().signal)).rejects.toThrow("Refresh the page");
  });
});

describe("PDF filenames", () => {
  it("handles UTF-8 disposition names and removes unsafe path/control characters", () => {
    expect(characterPdfFilename("attachment; filename=\"fallback.pdf\"; filename*=UTF-8''Aster%20Farwake.pdf")).toBe("Aster Farwake.pdf");
    expect(characterPdfFilename("attachment; filename=\"../../orren.pdf\"")).toBe("..-..-orren.pdf");
    expect(characterPdfFilename(null, "Orren\nVaultwright")).toBe("swordweave-Orren-Vaultwright.pdf");
  });
});

describe("PDF freshness", () => {
  it("invalidates on this character’s confirmed changes and return focus, then removes listeners", () => {
    const events = new EventTarget();
    vi.stubGlobal("window", events);
    const invalidated = vi.fn();
    const unsubscribe = observeCharacterPdfChanges("orren", invalidated);
    emitCharacterLogAdded("aster");
    expect(invalidated).not.toHaveBeenCalled();
    emitCharacterLogAdded("orren");
    events.dispatchEvent(new CustomEvent("sw:vitality-changed", { detail: { characterId: "orren", current: 123, max: 252, runtime: {} } }));
    events.dispatchEvent(new CustomEvent("sw:workspace-changed", { detail: { characterId: "aster" } }));
    events.dispatchEvent(new Event("focus"));
    expect(invalidated.mock.calls).toEqual([["change"], ["change"], ["return"]]);
    unsubscribe();
    emitCharacterLogAdded("orren");
    events.dispatchEvent(new Event("sw:toggle-changed"));
    events.dispatchEvent(new Event("focus"));
    expect(invalidated).toHaveBeenCalledTimes(3);
  });
});
