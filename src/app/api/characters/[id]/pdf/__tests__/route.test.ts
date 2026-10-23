import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), snapshot: vi.fn(), media: vi.fn(), render: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/character-pdf/snapshot", () => ({ loadCharacterPdfSnapshot: mocks.snapshot }));
vi.mock("@/lib/character-pdf/media", () => ({ resolveCharacterPdfMedia: mocks.media }));
vi.mock("@/lib/character-pdf/render", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/character-pdf/render")>()), renderCharacterPdf: mocks.render }));
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { CharacterPdfRenderError } from "@/lib/character-pdf/render";
import { POST } from "../route";
const id = "1da4e351-da76-4822-bf1f-632d2e657145";
const params = { params: Promise.resolve({ id }) };
const request = (body: unknown = {}) => new Request(`http://localhost/api/characters/${id}/pdf`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "clerk-user" });
  mocks.snapshot.mockResolvedValue({ id, name: 'Éowyn "Hero"\r\nBad: header' });
  mocks.media.mockImplementation(async snapshot => ({ ...snapshot, pdfMedia: { heritages: {}, icons: {}, warnings: [] } }));
  mocks.render.mockResolvedValue(Buffer.from("%PDF-1.7\ncharacter"));
});
describe("character PDF POST", () => {
  it("returns the authorized binary PDF with safe filename and private headers", async () => {
    const result = await POST(request({ style: "vesper", density: "auto", orientation: "landscape", workbench: true }), params);
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("application/pdf");
    expect(result.headers.get("x-swordweave-pdf-artwork-warnings")).toBe("0");
    expect(result.headers.get("cache-control")).toContain("private, no-store");
    expect(result.headers.get("content-disposition")).toBe('attachment; filename="swordweave-eowyn-hero-bad-header-vesper-landscape.pdf"');
    expect((await result.text()).startsWith("%PDF-")).toBe(true);
    expect(mocks.snapshot).toHaveBeenCalledWith(id, "clerk-user");
    expect(mocks.media).toHaveBeenCalledWith(expect.objectContaining({ id }), expect.objectContaining({ viewerId: "clerk-user", signal: expect.any(AbortSignal) }));
    expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ id }), { style: "vesper", density: "auto", orientation: "landscape", workbench: true, color: false }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it("reports unavailable artwork as a count without exposing source diagnostics", async () => {
    mocks.media.mockImplementation(async snapshot => ({ ...snapshot, pdfMedia: { heritages: {}, icons: {}, warnings: ["private artwork source unavailable"] } }));
    const result = await POST(request(), params);
    expect(result.status).toBe(200);
    expect(result.headers.get("x-swordweave-pdf-artwork-warnings")).toBe("1");
    expect([...result.headers.values()].join(" ")).not.toContain("private artwork source");
  });
  it("passes anonymous readers to the same snapshot permission gate", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await POST(request(), params)).status).toBe(200);
    expect(mocks.snapshot).toHaveBeenCalledWith(id, null);
  });
  it("never spawns rendering after access denial", async () => {
    mocks.snapshot.mockRejectedValue(new CharacterAccessDenied(id));
    const result = await POST(request(), params);
    expect(result.status).toBe(403); expect(mocks.media).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled();
    expect(await result.text()).not.toContain(id);
  });
  it("rejects invalid IDs/options and oversized bodies before loading character data", async () => {
    expect((await POST(request(), { params: Promise.resolve({ id: "../secret" }) })).status).toBe(400);
    expect((await POST(request({ style: "shell-command" }), params)).status).toBe(400);
    expect((await POST(request({ junk: "x".repeat(5000) }), params)).status).toBe(413);
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.snapshot).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled();
  });
  it("returns clear busy/unavailable errors without caching or private diagnostics", async () => {
    mocks.render.mockRejectedValue(new CharacterPdfRenderError("BUSY", "Two character PDFs are already being prepared.", 429));
    const busy = await POST(request(), params);
    expect(busy.status).toBe(429); expect(busy.headers.get("retry-after")).toBe("2");
    expect(busy.headers.get("cache-control")).toContain("no-store");
    mocks.render.mockRejectedValue(new Error("private authored text"));
    const unavailable = await POST(request(), params);
    expect(unavailable.status).toBe(503); expect(await unavailable.text()).not.toContain("private authored text");
  });
});
