import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dns: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.dns }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { artworkHttpsUrl, isPublicArtworkAddress, pinnedArtworkLookup, readRemoteArtwork, REMOTE_IMAGE_MAX_BYTES } from "../remote-image";

const png = Buffer.from([137,80,78,71,13,10,26,10]);
type Reply = { status?: number; headers?: Record<string, string>; chunks?: Buffer[]; hold?: boolean };
let replies: Reply[];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.dns.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  replies = [{}];
  mocks.request.mockImplementation((_url, _options, callback) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: ReturnType<typeof vi.fn>; setTimeout: ReturnType<typeof vi.fn> };
    request.destroy = vi.fn(() => { request.emit("error", new Error("transport stopped")); });
    request.setTimeout = vi.fn(() => request);
    request.end = () => queueMicrotask(() => {
      const reply = replies.shift() ?? {};
      const response = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> };
      response.statusCode = reply.status ?? 200;
      response.headers = reply.headers ?? { "content-type": "image/png" };
      callback(response);
      if (!reply.hold && !response.destroyed) { for (const chunk of reply.chunks ?? [png]) response.write(chunk); response.end(); }
    });
    return request;
  });
});
afterEach(() => vi.useRealTimers());

describe("public artwork destination policy", () => {
  it.each(["0.0.0.0","10.1.2.3","100.64.1.2","127.0.0.1","169.254.169.254","172.16.0.1","172.31.255.255","192.0.0.1","192.0.2.1","192.88.99.1","192.168.5.1","198.18.0.1","198.51.100.10","203.0.113.9","224.1.2.3","240.0.0.1","255.255.255.255","::","::1","::ffff:127.0.0.1","::ffff:8.8.8.8","64:ff9b::a00:1","fc00::1","fe80::1","ff02::1","2001:db8::1","2001::1","2002:7f00:1::","3fff:100::1"])("rejects private, reserved or embedded addresses: %s", address => {
    expect(isPublicArtworkAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8","93.184.216.34","151.101.1.69","2606:4700:4700::1111","2001:4860:4860::8888"])("accepts public unicast: %s", address => expect(isPublicArtworkAddress(address)).toBe(true));
  it.each(["http://images.example.com/a.png","https://127.0.0.1/a.png","https://2130706433/a.png","https://0x7f000001/a.png","https://[::1]/a.png","https://user:secret@images.example.com/a.png","https://images.example.com:8443/a.png","https://metadata.google.internal/a.png","https://localhost./a.png","https://images.example.com\\@127.0.0.1/a.png"])("rejects unsafe URL forms: %s", value => expect(() => artworkHttpsUrl(value)).toThrow());
  it("allows ordinary HTTPS query-based image URLs without disclosing them", () => {
    expect(artworkHttpsUrl("https://images.example.com/photo?id=123&size=small").hostname).toBe("images.example.com");
  });
});

describe("DNS-pinned remote artwork", () => {
  it("pins the approved DNS result into HTTPS and sends no caller credentials", async () => {
    expect(await readRemoteArtwork("https://images.example.com/photo.png")).toEqual(png);
    expect(mocks.dns).toHaveBeenCalledOnce();
    const [url, options] = mocks.request.mock.calls[0]!;
    expect(url.hostname).toBe("images.example.com");
    expect(options).toMatchObject({ method: "GET", agent: false, rejectUnauthorized: true });
    expect(Object.keys(options.headers).sort()).toEqual(["Accept", "User-Agent"]);
    const callback = vi.fn(); options.lookup("images.example.com", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
    // A later resolver result cannot change the already-pinned connection.
    mocks.dns.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    options.lookup("images.example.com", {}, callback);
    expect(callback).toHaveBeenLastCalledWith(null, "93.184.216.34", 4);
    expect(mocks.dns).toHaveBeenCalledOnce();
  });
  it("rejects a hostname with any private answer before opening a connection", async () => {
    mocks.dns.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(readRemoteArtwork("https://images.example.com/a.png")).rejects.toThrow("unavailable");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rechecks and pins DNS at every redirect", async () => {
    replies = [{ status: 302, headers: { location: "https://cdn.example.com/photo.png" } }, {}];
    await expect(readRemoteArtwork("https://images.example.com/photo.png")).resolves.toEqual(png);
    expect(mocks.dns.mock.calls.map(call => call[0])).toEqual(["images.example.com", "cdn.example.com"]);
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it("stops a redirect into a private DNS answer before requesting that host", async () => {
    replies = [{ status: 302, headers: { location: "https://metadata.attacker.com/secret.png" } }];
    mocks.dns.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]).mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    await expect(readRemoteArtwork("https://images.example.com/a.png")).rejects.toThrow();
    expect(mocks.request).toHaveBeenCalledOnce();
  });
  it.each(["http://cdn.example.com/a.png","https://127.0.0.1/a.png","https://user:password@cdn.example.com/a.png"])("rejects an unsafe redirect: %s", location => {
    replies = [{ status: 302, headers: { location } }];
    return expect(readRemoteArtwork("https://images.example.com/a.png")).rejects.toThrow();
  });
  it("bounds redirect chains", async () => {
    replies = Array.from({ length: 4 }, () => ({ status: 302, headers: { location: "/next.png" } }));
    await expect(readRemoteArtwork("https://images.example.com/a.png")).rejects.toThrow();
    expect(mocks.request).toHaveBeenCalledTimes(4);
  });
  it("rejects announced and streamed oversized responses", async () => {
    replies = [{ headers: { "content-type": "image/png", "content-length": String(REMOTE_IMAGE_MAX_BYTES+1) } }];
    await expect(readRemoteArtwork("https://images.example.com/a.png")).rejects.toThrow();
    replies = [{ chunks: [png, Buffer.alloc(REMOTE_IMAGE_MAX_BYTES)] }];
    await expect(readRemoteArtwork("https://images.example.com/a.png")).rejects.toThrow();
  });
  it.each([
    { headers: { "content-type": "image/svg+xml" }, chunks: [Buffer.from('<svg><image href="http://localhost/"/></svg>')] },
    { headers: { "content-type": "application/octet-stream" }, chunks: [Buffer.from('<svg/>')] },
    { headers: { "content-type": "image/png", "content-encoding": "gzip" }, chunks: [png] },
    { headers: { "content-type": "image/png" }, chunks: [Buffer.from('<html>private document</html>')] },
  ])("rejects SVG, encoded or non-image response bodies", async reply => {
    replies = [reply]; await expect(readRemoteArtwork("https://images.example.com/a.png")).rejects.toThrow();
  });
  it("ends an unresolved DNS lookup when cancelled", async () => {
    mocks.dns.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = readRemoteArtwork("https://images.example.com/a.png", { signal: controller.signal });
    controller.abort(); await expect(pending).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("bounds the entire DNS/redirect/body operation", async () => {
    vi.useFakeTimers(); replies = [{ hold: true }];
    const pending = readRemoteArtwork("https://images.example.com/a.png");
    const rejection = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(8_000); await rejection;
  });
  it("honors requested address families without a fresh lookup", () => {
    const callback = vi.fn();
    pinnedArtworkLookup([{ address: "93.184.216.34", family: 4 }])("images.example.com", { family: 6 }, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error), []); expect(mocks.dns).not.toHaveBeenCalled();
  });
});
