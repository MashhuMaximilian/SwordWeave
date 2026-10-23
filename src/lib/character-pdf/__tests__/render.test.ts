import { EventEmitter } from "node:events";
import { createHmac } from "node:crypto";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_PDF_OPTIONS } from "../options";
import type { CharacterPdfSnapshot } from "../types";
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), access: vi.fn(), mkdir: vi.fn(), read: vi.fn(), remove: vi.fn(), stat: vi.fn(), oidc: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs/promises", () => ({ access: mocks.access, mkdtemp: mocks.mkdir, readFile: mocks.read, rm: mocks.remove, stat: mocks.stat }));
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: mocks.oidc }));
import { CHARACTER_PDF_HOSTED_MAX_BYTES, CHARACTER_PDF_TIMEOUT_MS, renderCharacterPdf } from "../render";

const snapshot = { id: "character", name: "Private Character", dmNotes: null } as unknown as CharacterPdfSnapshot;
function childProcess() {
  const child = new EventEmitter() as EventEmitter & { stdin: PassThrough; kill: ReturnType<typeof vi.fn> };
  child.stdin = new PassThrough();
  child.kill = vi.fn(() => { queueMicrotask(() => child.emit("close", null)); return true; });
  return child;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("SWORDWEAVE_PDF_PYTHON", "/test/python");
  vi.stubEnv("VERCEL", "0");
  mocks.oidc.mockReset().mockRejectedValue(new Error("Test has no platform identity"));
  mocks.access.mockResolvedValue(undefined); mocks.mkdir.mockResolvedValue("/tmp/pdf-test-unique");
  mocks.read.mockResolvedValue(Buffer.from("%PDF-1.7\nprivate output"));
  mocks.remove.mockResolvedValue(undefined); mocks.stat.mockResolvedValue({ size: 23, isFile: () => true });
  mocks.spawn.mockImplementation(() => childProcess());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function spawned(index = 0) {
  await vi.waitFor(() => expect(mocks.spawn.mock.results.length).toBeGreaterThan(index));
  return mocks.spawn.mock.results[index]!.value as ReturnType<typeof childProcess>;
}

describe("local character PDF process transport", () => {
  it("sends private snapshot only over stdin, disables shell and removes its output directory", async () => {
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    const child = await spawned();
    const payload = child.stdin.read()?.toString();
    expect(JSON.parse(payload)).toEqual({ character: snapshot, options: DEFAULT_CHARACTER_PDF_OPTIONS });
    expect(mocks.spawn).toHaveBeenCalledWith("/test/python", expect.arrayContaining(["--output", "/tmp/pdf-test-unique/sheet.pdf"]),
      expect.objectContaining({ shell: false, stdio: ["pipe", "ignore", "ignore"] }));
    child.emit("close", 0);
    expect((await promise).subarray(0, 5).toString()).toBe("%PDF-");
    expect(mocks.remove).toHaveBeenCalledWith("/tmp/pdf-test-unique", expect.objectContaining({ recursive: true, force: true }));
    expect(mocks.oidc).not.toHaveBeenCalled();
  });
  it("returns unavailable and cleans up when Python fails to start", async () => {
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    const rejection = expect(promise).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });
    (await spawned()).emit("error", new Error("ENOENT"));
    await rejection;
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("kills a cancelled child and cleans up", async () => {
    const controller = new AbortController();
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, { signal: controller.signal });
    const rejection = expect(promise).rejects.toMatchObject({ code: "CANCELLED", status: 499 });
    const child = await spawned(); controller.abort(); await rejection;
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("bounds rendering time and cleans up after killing the child", async () => {
    vi.useFakeTimers();
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    const rejection = expect(promise).rejects.toMatchObject({ code: "TIMEOUT", status: 503 });
    await vi.advanceTimersByTimeAsync(0);
    const child = mocks.spawn.mock.results[0]!.value as ReturnType<typeof childProcess>;
    await vi.advanceTimersByTimeAsync(CHARACTER_PDF_TIMEOUT_MS);
    await rejection;
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("allows two exports and returns busy for a third without creating another child", async () => {
    const first = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    const second = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    await spawned(1);
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "BUSY", status: 429 });
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    (await spawned(0)).emit("close", 0); (await spawned(1)).emit("close", 0);
    await Promise.all([first, second]);
  });
  it("rejects oversized snapshots before creating files or processes", async () => {
    await expect(renderCharacterPdf({ ...snapshot, notes: "x".repeat(16 * 1024 * 1024) }, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "TOO_LARGE", status: 413 });
    expect(mocks.spawn).not.toHaveBeenCalled(); expect(mocks.mkdir).not.toHaveBeenCalled();
  });
  it("rejects oversized or invalid PDF output and still cleans up", async () => {
    mocks.stat.mockResolvedValue({ size: 33 * 1024 * 1024, isFile: () => true });
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    const rejection = expect(promise).rejects.toMatchObject({ code: "TOO_LARGE", status: 413 });
    (await spawned()).emit("close", 0); await rejection;
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalledOnce();
  });
});

describe("hosted character PDF transport", () => {
  const secret = "test-only-render-secret-32-characters-long";
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "sword-weave-test-release.vercel.app");
    vi.stubEnv("SWORDWEAVE_PDF_RENDER_SECRET", secret);
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock = vi.fn(async () => new Response("%PDF-1.7\nprivate output", { headers: { "content-type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  it("signs exact canonical bytes, uses the same deployment and does not follow redirects", async () => {
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "test-only-preview-bypass");
    const bytes = await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://sword-weave-test-release.vercel.app/api/character-pdf-render");
    expect(init).toMatchObject({ method: "POST", redirect: "manual", cache: "no-store" });
    expect(JSON.parse(init.body)).toEqual({ character: snapshot, options: DEFAULT_CHARACTER_PDF_OPTIONS });
    expect(init.headers["X-SwordWeave-PDF-Signature"]).toBe(createHmac("sha256", secret)
      .update(`${init.headers["X-SwordWeave-PDF-Timestamp"]}\n`).update(init.body).digest("hex"));
    expect(init.headers["x-vercel-protection-bypass"]).toBe("test-only-preview-bypass");
    expect(mocks.spawn).not.toHaveBeenCalled(); expect(mocks.mkdir).not.toHaveBeenCalled();
  });
  const previewContext = { requestUrl: "https://sword-weave-test-release.vercel.app/api/characters/character/pdf", cookieHeader: "_vercel_jwt=test.preview.signature" };
  it.each(["preview", "production"])("uses SDK workload identity for same-deployment %s self-access", async environment => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "configured-legacy-secret");
    mocks.oidc.mockResolvedValue("platform.identity.signature");
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, previewContext);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(mocks.oidc).toHaveBeenCalledWith();
    expect(init.headers["x-vercel-trusted-oidc-idp-token"]).toBe("platform.identity.signature");
    expect(init.headers["x-vercel-protection-bypass"]).toBeUndefined();
    expect(init.headers["cookie"]).toBeUndefined();
    expect(init.redirect).toBe("manual");
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://sword-weave-test-release.vercel.app/api/character-pdf-render");
    expect(console.error).not.toHaveBeenCalled();
  });
  it("reads workload identity anew for every export instead of caching a token", async () => {
    mocks.oidc.mockResolvedValueOnce("first.identity.signature").mockResolvedValueOnce("second.identity.signature");
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    expect(mocks.oidc).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![1].headers["x-vercel-trusted-oidc-idp-token"]).toBe("first.identity.signature");
    expect(fetchMock.mock.calls[1]![1].headers["x-vercel-trusted-oidc-idp-token"]).toBe("second.identity.signature");
  });
  it.each(["", "not-a-jwt", "header.payload.signature\r\nX-Other: unsafe", "x".repeat(16_385), 123])("does not forward a malformed SDK identity", async token => {
    mocks.oidc.mockResolvedValue(token);
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, previewContext);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers["x-vercel-trusted-oidc-idp-token"]).toBeUndefined();
    expect(init.headers["cookie"]).toBe("_vercel_jwt=test.preview.signature");
    expect(console.error).not.toHaveBeenCalled();
  });
  it("does not take workload credentials from caller-supplied render context", async () => {
    const context = { requestUrl: previewContext.requestUrl, oidcToken: "caller.supplied.signature", headers: { "x-vercel-oidc-token": "caller.supplied.signature" } };
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, context);
    expect(mocks.oidc).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![1].headers["x-vercel-trusted-oidc-idp-token"]).toBeUndefined();
    expect(JSON.stringify(fetchMock.mock.calls[0]![1].headers)).not.toContain("caller.supplied");
  });
  it("bounds a stalled platform-identity lookup by the same hosted deadline", async () => {
    vi.useFakeTimers();
    mocks.oidc.mockImplementation(() => new Promise(() => {}));
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    const rejection = expect(promise).rejects.toMatchObject({ code: "TIMEOUT", status: 503 });
    await vi.advanceTimersByTimeAsync(CHARACTER_PDF_TIMEOUT_MS);
    await rejection;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
  it("cancels a pending platform-identity lookup without making a request", async () => {
    mocks.oidc.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, { signal: controller.signal });
    const rejection = expect(promise).rejects.toMatchObject({ code: "CANCELLED", status: 499 });
    controller.abort(); await rejection;
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("forwards only the already incoming Vercel protection cookie to the identical preview origin", async () => {
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, { ...previewContext,
      cookieHeader: "__session=private-clerk-session; theme=dark; _vercel_jwt=test.preview.signature; __client=private-clerk-client" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers["cookie"]).toBe("_vercel_jwt=test.preview.signature");
    expect(JSON.stringify(init.headers)).not.toContain("private-clerk");
    expect(init.redirect).toBe("manual");
    expect(JSON.parse(init.body)).toEqual({ character: snapshot, options: DEFAULT_CHARACTER_PDF_OPTIONS });
    expect(console.error).not.toHaveBeenCalled();
  });
  it("prefers existing server automation authorization without forwarding a browser cookie", async () => {
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "test-only-preview-bypass");
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, previewContext);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers["x-vercel-protection-bypass"]).toBe("test-only-preview-bypass");
    expect(init.headers["cookie"]).toBeUndefined();
  });
  it.each(["production", "development", ""])("does not forward protection cookies in %s", async environment => {
    vi.stubEnv("VERCEL_ENV", environment);
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, previewContext);
    expect(fetchMock.mock.calls[0]![1].headers["cookie"]).toBeUndefined();
  });
  it.each([
    "http://sword-weave-test-release.vercel.app/api/characters/character/pdf",
    "https://sword-weave-alias.vercel.app/api/characters/character/pdf",
    "https://www.swordweave.quest/api/characters/character/pdf",
    "https://sword-weave-test-release.vercel.app.evil.example/api/characters/character/pdf",
    "https://user:password@sword-weave-test-release.vercel.app/api/characters/character/pdf",
    "https://sword-weave-test-release.vercel.app:444/api/characters/character/pdf",
    "invalid-url",
  ])("never transfers a preview cookie across origins: %s", async requestUrl => {
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, { ...previewContext, requestUrl });
    expect(fetchMock.mock.calls[0]![1].headers["cookie"]).toBeUndefined();
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://sword-weave-test-release.vercel.app/api/character-pdf-render");
  });
  it.each([
    "_vercel_jwt=first; _vercel_jwt=second", "_vercel_jwt=", "_vercel_jwt=quoted+unsafe",
    '_vercel_jwt="quoted"', "_vercel_jwt=test.preview.signature\r\nX-Other: unsafe",
    "_vercel_jwt=" + "x".repeat(8193), "other=" + "x".repeat(32768) + ";_vercel_jwt=valid",
    "_vercel_jwt_extra=not-the-cookie", "__session=private", "_vercel_jwt =invalid-spacing",
  ])("rejects malformed, duplicate or unbounded protection cookie input", async cookieHeader => {
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, { ...previewContext, cookieHeader });
    expect(fetchMock.mock.calls[0]![1].headers["cookie"]).toBeUndefined();
  });
  it("does not mistake a cookie-name prefix for the Vercel cookie", async () => {
    await renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, { ...previewContext,
      cookieHeader: "_vercel_jwt_extra=unrelated; _vercel_jwt=test.preview.signature" });
    expect(fetchMock.mock.calls[0]![1].headers["cookie"]).toBe("_vercel_jwt=test.preview.signature");
  });
  it("logs only fixed hosted-failure metadata, never authored content or credentials", async () => {
    fetchMock.mockResolvedValue(new Response("private authored failure and cookie test.preview.signature", { status: 401, headers: { "content-type": "text/html" } }));
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, previewContext)).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith("[character-pdf] hosted renderer unavailable", { category: "upstream_response", status: 401, responseType: "html" });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    for (const forbidden of [snapshot.name, secret, "test.preview.signature", "vercel.app", "private authored failure"]) expect(logged).not.toContain(forbidden);
  });
  it.each(["evil.example", "https://sword-weave.vercel.app", "sword.vercel.app@evil.example", "sword.vercel.app/path", "127.0.0.1", "sword.vercel.app:443"])("rejects an unsafe deployment hostname: %s", async host => {
    vi.stubEnv("VERCEL_URL", host);
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires a dedicated signing secret", async () => {
    vi.stubEnv("SWORDWEAVE_PDF_RENDER_SECRET", "");
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a hosted snapshot above the platform budget before sending it", async () => {
    await expect(renderCharacterPdf({ ...snapshot, notes: "x".repeat(CHARACTER_PDF_HOSTED_MAX_BYTES) }, DEFAULT_CHARACTER_PDF_OPTIONS))
      .rejects.toMatchObject({ code: "TOO_LARGE", status: 413 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 302, 500])("does not relay unsafe upstream error text or redirect at %s", async status => {
    fetchMock.mockResolvedValue(new Response("private authored details", { status, headers: { location: "https://evil.example" } }));
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each([[413, "TOO_LARGE"], [429, "BUSY"]])("maps the upstream %s response safely", async (status, code) => {
    fetchMock.mockResolvedValue(new Response("private details", { status: status as number }));
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code, status });
  });
  it("bounds streamed output even when Content-Length is absent", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array(CHARACTER_PDF_HOSTED_MAX_BYTES + 1), { headers: { "content-type": "application/pdf" } }));
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "TOO_LARGE", status: 413 });
  });
  it("rejects invalid PDF bytes and incorrect content types", async () => {
    fetchMock.mockResolvedValue(new Response("not a PDF", { headers: { "content-type": "application/pdf" } }));
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });
    fetchMock.mockResolvedValue(new Response("%PDF-test", { headers: { "content-type": "text/html" } }));
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });
  });
  it("cancels the hosted request without leaving a pending export", async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    const controller = new AbortController();
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS, { signal: controller.signal });
    const rejection = expect(promise).rejects.toMatchObject({ code: "CANCELLED", status: 499 });
    controller.abort(); await rejection;
    fetchMock.mockResolvedValue(new Response("%PDF-test", { headers: { "content-type": "application/pdf" } }));
    await expect(renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS)).resolves.toBeInstanceOf(Buffer);
  });
  it("times out a hung hosted request", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    const promise = renderCharacterPdf(snapshot, DEFAULT_CHARACTER_PDF_OPTIONS);
    const rejection = expect(promise).rejects.toMatchObject({ code: "TIMEOUT", status: 503 });
    await vi.advanceTimersByTimeAsync(CHARACTER_PDF_TIMEOUT_MS); await rejection;
  });
});
