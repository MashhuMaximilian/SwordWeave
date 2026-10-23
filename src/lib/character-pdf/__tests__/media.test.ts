import sharp from "sharp";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { CharacterPdfSnapshot } from "../types";
const mocks = vi.hoisted(() => ({ access: vi.fn(), blob: vi.fn(), remote: vi.fn() }));
vi.mock("@/lib/assets/upload-access", () => ({ canReadUploadedArtwork: mocks.access }));
vi.mock("@vercel/blob", () => ({ get: mocks.blob }));
vi.mock("../remote-image", async original => ({ ...(await original<typeof import("../remote-image")>()), readRemoteArtwork: mocks.remote }));
import { CHARACTER_PDF_MEDIA_BUDGET, characterPdfArtworkSource, characterPdfGeometrySvg, characterPdfMediaCandidates, resolveCharacterPdfMedia } from "../media";

const basic = (changes: Record<string, unknown> = {}) => ({ id: "test", name: "Media witness", primitiveLinks: [], capabilityLinks: [], effectLinks: [], itemLinks: [], heritageLinks: [], readOnlyGraph: { nodes: [], edges: [] }, ...changes }) as unknown as CharacterPdfSnapshot;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#fff" d="M 20 20 H 492 V 492 H 20 Z"/></svg>';
let raster: Buffer;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  mocks.access.mockResolvedValue(false);
  raster = await sharp({ create: { width: 100, height: 80, channels: 4, background: { r: 180, g: 40, b: 90, alpha: .7 } } }).png().toBuffer();
  mocks.remote.mockResolvedValue(raster);
  fetchMock = vi.fn(async () => new Response(new Uint8Array(raster), { headers: { "Content-Type": "image/png" } }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("character PDF media trust boundaries", () => {
  it.each(["http://127.0.0.1/private.png", "https://169.254.169.254/secret.webp", "https://evil.example/image.png", "file:///etc/passwd", "//evil.example/x.png", "/images/characters/../private.png", "/images/characters/%2e%2e/private.png", "https://swordweave-public-art.ionmariusc97.workers.dev.evil.example/images/characters/a.png", "https://user:password@swordweave.quest/images/characters/a.png"])("refuses an unsafe source: %s", source => {
    expect(characterPdfArtworkSource(source)).toBeNull();
  });
  it("maps approved assets to the fixed CDN and canonical upload paths to direct private reads", () => {
    expect(characterPdfArtworkSource("https://www.swordweave.quest/images/characters/orren.webp")).toEqual({ type: "public", url: "https://swordweave-public-art.ionmariusc97.workers.dev/images/characters/orren.webp" });
    expect(characterPdfArtworkSource("/api/icons/blob/user-uploads/user_1/example.png")).toEqual({ type: "upload", pathname: "user-uploads/user_1/example.png" });
    expect(characterPdfArtworkSource("https://store.private.blob.vercel-storage.com/user-uploads/user_1/example.png?signature=unused")).toEqual({ type: "upload", pathname: "user-uploads/user_1/example.png" });
  });
  it("routes general HTTPS artwork through the pinned reader and preserves custom RGB when chosen", async () => {
    const result = await resolveCharacterPdfMedia(basic({ portraitUrl: "https://images.example.com/portrait.jpg?size=large" }), { viewerId: null, color: true });
    expect(mocks.remote).toHaveBeenCalledWith("https://images.example.com/portrait.jpg?size=large", { signal: expect.any(AbortSignal) });
    const pixel = await sharp(Buffer.from(result.pdfMedia!.character!.data, "base64")).removeAlpha().toColourspace("srgb").raw().toBuffer();
    expect(pixel[0]).not.toBe(pixel[1]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("retains useful portrait crop pixels without enlarging a tall original", async () => {
    mocks.remote.mockResolvedValue(await sharp({ create: { width: 450, height: 900, channels: 3, background: "orange" } }).png().toBuffer());
    const result = await resolveCharacterPdfMedia(basic({ portraitUrl: "https://images.example.com/portrait.jpg" }), { viewerId: null, color: true });
    expect([result.pdfMedia?.character?.width,result.pdfMedia?.character?.height]).toEqual([450,900]);
  });
  it("keeps official game glyphs dark and readable in color output", async () => {
    fetchMock.mockResolvedValue(new Response(SVG));
    const result = await resolveCharacterPdfMedia(basic({ primitiveLinks: [{ primitiveId: 1, primitive: { id: 1, iconSource: "GAME_ICONS", iconKey: "lorc/metal-hand" } }] }), { viewerId: null, color: true });
    const pixels = await sharp(Buffer.from(result.pdfMedia!.icons["primitive:1"]!.data,"base64")).ensureAlpha().toColourspace("srgb").raw().toBuffer();
    const offset = (32*64+32)*4;
    expect(pixels[offset]).toBeLessThan(50); expect(pixels[offset]).toBe(pixels[offset+1]); expect(pixels[offset]).toBe(pixels[offset+2]);
  });
  it("resolves uploaded heritage art and URL-based item/capability icons under their effective keys", async () => {
    mocks.access.mockResolvedValue(true);
    mocks.blob.mockImplementation(async () => ({ statusCode: 200, blob: { size: raster.length }, stream: new Response(new Uint8Array(raster)).body }));
    const result = await resolveCharacterPdfMedia(basic({
      heritageLinks: [{ heritageId: "own", heritage: { id: "own", imageUrl: "user-uploads/user_1/heritage.png" } }],
      itemLinks: [{ itemId: "item", versionId: "v1", item: { id: "item", iconSource: "UPLOAD", iconUrl: "https://images.example.com/item.jpg" } }],
      capabilityLinks: [{ capabilityId: "cap", versionId: "v2", capability: { id: "cap", imageUrl: "https://images.example.com/capability.png" } }],
    }), { viewerId: "viewer", color: true });
    expect(result.pdfMedia?.heritages["own"]).toBeDefined();
    expect([result.pdfMedia?.heritages["own"]?.width, result.pdfMedia?.heritages["own"]?.height]).toEqual([100, 80]);
    expect(result.pdfMedia?.icons["item:item:v1"]).toBeDefined();
    expect(result.pdfMedia?.icons["capability:cap:v2"]).toBeDefined();
    expect(result.pdfMedia?.icons["item:item"]).toBeUndefined();
    expect(mocks.access).toHaveBeenCalledWith("user-uploads/user_1/heritage.png", "viewer");
  });
  it("does not replace an authoritative missing icon with unrelated image fields", () => {
    const candidates = characterPdfMediaCandidates(basic({ itemLinks: [{ itemId: "item", versionId: "old", item: { id: "item", iconSource: "GAME_ICONS", iconKey: null, imageUrl: "https://images.example.com/new.png" } }] }));
    expect(candidates).toEqual([expect.objectContaining({ key: "item:item:old", source: null })]);
  });
  it("does not follow a catalog redirect to another host", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
    const result = await resolveCharacterPdfMedia(basic({ portraitUrl: "/images/characters/hero.webp" }), { viewerId: null });
    expect(result.pdfMedia?.character).toBeUndefined(); expect(result.pdfMedia?.warnings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: "manual", cache: "no-store" });
  });
  it("checks private upload visibility before reading Blob and never forwards cookies", async () => {
    const source = basic({ portraitUrl: "/api/icons/blob/user-uploads/user_1/photo.png" });
    const denied = await resolveCharacterPdfMedia(source, { viewerId: "viewer" });
    expect(denied.pdfMedia?.character).toBeUndefined(); expect(mocks.blob).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
    mocks.access.mockResolvedValue(true);
    mocks.blob.mockImplementation(async () => ({ statusCode: 200, blob: { size: raster.length }, stream: new Response(new Uint8Array(raster)).body }));
    const allowed = await resolveCharacterPdfMedia(source, { viewerId: "viewer" });
    expect(allowed.pdfMedia?.character?.mimeType).toBe("image/png");
    expect(mocks.access).toHaveBeenLastCalledWith("user-uploads/user_1/photo.png", "viewer");
    expect(mocks.blob).toHaveBeenCalledWith("user-uploads/user_1/photo.png", { access: "private", abortSignal: expect.any(AbortSignal) });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("converts a real colored image into bounded grayscale PNG", async () => {
    const result = await resolveCharacterPdfMedia(basic({ portraitUrl: "/images/characters/hero.webp" }), { viewerId: null });
    const image = result.pdfMedia!.character!;
    expect(image.width).toBeLessThanOrEqual(512); expect(image.height).toBeLessThanOrEqual(512);
    const { data, info } = await sharp(Buffer.from(image.data, "base64")).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    for (let index = 0; index < data.length; index += 3) expect([data[index], data[index+1], data[index+2]]).toEqual([data[index], data[index], data[index]]);
  });
  it("uses actual curated heritage artwork separately from the entity icon", async () => {
    fetchMock.mockImplementation(async url => new Response(String(url).endsWith(".svg") ? SVG : new Uint8Array(raster)));
    const result = await resolveCharacterPdfMedia(basic({ heritageLinks: [{ heritageId: "iron", heritage: { id: "iron", name: "Ironborn", kind: "LINEAGE", sourceOrigin: "SRD", iconSource: "GAME_ICONS", iconKey: "lorc/metal-hand" } }] }), { viewerId: null });
    expect(result.pdfMedia?.heritages["iron"]).toBeDefined();
    expect(result.pdfMedia?.icons["heritage:iron"]?.author).toBe("lorc");
    expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual(expect.arrayContaining([
      "https://swordweave-public-art.ionmariusc97.workers.dev/images/lineages/ironborn-graphic-v1.webp",
      "https://game-icons.net/icons/ffffff/transparent/1x1/lorc/metal-hand.svg",
    ]));
  });
  it.each([false, true])("keeps heritage art sharp at a 100 pt print width without enlarging it (color=%s)", async color => {
    raster = await sharp({ create: { width: 1200, height: 1200, channels: 4,
      background: { r: 180, g: 40, b: 90, alpha: .7 } } }).png().toBuffer();
    fetchMock.mockImplementation(async () => new Response(new Uint8Array(raster)));
    const source = basic({ heritageLinks: [{ heritageId: "large", heritage: { id: "large", imageUrl: "/images/heritages/large.png" } }] });
    expect(characterPdfMediaCandidates(source)).toContainEqual(expect.objectContaining({ target: "heritages", key: "large", size: 512 }));
    const result = await resolveCharacterPdfMedia(source, { viewerId: null, color });
    const image = result.pdfMedia!.heritages["large"]!;
    expect([image.width, image.height]).toEqual([512, 512]);
    expect(image.width/100*72).toBeGreaterThanOrEqual(300);
    const pixel = await sharp(Buffer.from(image.data, "base64")).removeAlpha().toColourspace("srgb").raw().toBuffer();
    if (color) expect(pixel[0]).not.toBe(pixel[1]);
    else expect([pixel[0], pixel[1], pixel[2]]).toEqual([pixel[0], pixel[0], pixel[0]]);
    expect(result.pdfMedia?.warnings).toEqual([]);
  });
  it("keeps two pins' icons distinct and does not borrow an unrelated live icon", () => {
    const candidates = characterPdfMediaCandidates(basic({ primitiveLinks: [
      { primitiveId: 7, versionId: "v1", primitive: { id: 7, iconSource: "GAME_ICONS", iconKey: "lorc/metal-hand" } },
      { primitiveId: 7, versionId: "v2", primitive: { id: 7, iconSource: "GAME_ICONS", iconKey: "lorc/star-cycle" } },
      { primitiveId: 9, versionId: "historic", primitive: { id: 9 } },
    ], readOnlyGraph: { nodes: [{ key: "primitive:9", versionId: "live", data: { iconSource: "GAME_ICONS", iconKey: "lorc/metal-hand" } }], edges: [] } }));
    expect(candidates.map(candidate => candidate.key)).toEqual(["primitive:7:v1", "primitive:7:v2"]);
  });
  it("deduplicates actual icon downloads while retaining all entity references", async () => {
    fetchMock.mockResolvedValue(new Response(SVG));
    const result = await resolveCharacterPdfMedia(basic({ primitiveLinks: [1,2,3].map(id => ({ primitiveId: id, primitive: { id, iconSource: "GAME_ICONS", iconKey: "lorc/metal-hand" } })) }), { viewerId: null });
    expect(Object.keys(result.pdfMedia!.icons)).toHaveLength(3); expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.pdfMedia!.icons["primitive:1"]?.license).toBe("CC BY 3.0");
  });
  it("bounds decoded pixels and streamed input bytes", async () => {
    fetchMock.mockResolvedValue(new Response('<svg width="5000" height="5000"><path d="M 0 0 H 5000 V 5000 Z"/></svg>'));
    const oversized = await resolveCharacterPdfMedia(basic({ portraitUrl: "/images/characters/hero.webp" }), { viewerId: null });
    expect(oversized.pdfMedia?.character).toBeUndefined();
    fetchMock.mockResolvedValue(new Response(new Uint8Array(4*1024*1024+1)));
    const streamed = await resolveCharacterPdfMedia(basic({ portraitUrl: "/images/characters/hero.webp" }), { viewerId: null });
    expect(streamed.pdfMedia?.character).toBeUndefined(); expect(streamed.pdfMedia?.warnings).toHaveLength(1);
  });
  it("enforces the serialized media budget without partial image data", async () => {
    let seed = 12345;
    const pixels = Buffer.alloc(512*512*3);
    for (let index = 0; index < pixels.length; index++) { seed = (Math.imul(seed,1664525)+1013904223)>>>0; pixels[index] = seed>>>24; }
    const noise = await sharp(pixels, { raw: { width: 512, height: 512, channels: 3 } }).png().toBuffer();
    fetchMock.mockImplementation(async () => new Response(new Uint8Array(noise)));
    const result = await resolveCharacterPdfMedia(basic({ heritageLinks: Array.from({ length: 16 }, (_, index) => ({ heritageId: String(index), heritage: { id: index, imageUrl: `/images/heritages/test-${index}.png` } })) }), { viewerId: null });
    const retained = [...Object.values(result.pdfMedia!.heritages), ...Object.values(result.pdfMedia!.icons)];
    expect(retained.reduce((sum, image) => sum+image.data.length,0)).toBeLessThanOrEqual(CHARACTER_PDF_MEDIA_BUDGET);
    for (const image of Object.values(result.pdfMedia!.heritages)) {
      const metadata = await sharp(Buffer.from(image.data, "base64")).metadata();
      expect([metadata.width, metadata.height]).toEqual([512, 512]);
    }
    expect(Object.keys(result.pdfMedia!.heritages).length).toBeLessThan(16); expect(result.pdfMedia?.warnings).toHaveLength(1);
  });
  it("cancels before fetching when the export request has already ended", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(resolveCharacterPdfMedia(basic({ portraitUrl: "/images/characters/hero.webp" }), { viewerId: null, signal: controller.signal })).rejects.toMatchObject({ code: "CANCELLED", status: 499 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("inert SVG geometry", () => {
  it.each([
    '<svg><image href="http://127.0.0.1/private"/></svg>', '<svg><script>alert(1)</script></svg>',
    '<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///etc/passwd">]><svg>&secret;</svg>',
    '<svg><path style="fill:url(http://evil.example)" d="M0 0Z"/></svg>',
    '<svg><foreignObject/></svg>', '<svg><path onload="alert(1)" d="M0 0Z"/></svg>',
  ])("rejects executable or external-resource SVG: %s", svg => {
    expect(() => characterPdfGeometrySvg(Buffer.from(svg))).toThrow();
  });
  it("rebuilds a white Game Icon with visible dark paths and no external resources", () => {
    const output = characterPdfGeometrySvg(Buffer.from(SVG), true).toString();
    expect(output).toContain('fill="#181818"'); expect(output).not.toContain('#fff');
    expect(output).toContain('d="M 20 20 H 492 V 492 H 20 Z"');
  });
});
