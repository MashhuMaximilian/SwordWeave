/** HTTPS raster reader for authored artwork URLs. DNS is checked once per hop
 * and the validated addresses are pinned into the actual TLS connection.
 * Special address ranges: IANA IPv4/IPv6 Special-Purpose Address Registries.
 * No cookies, caller headers, credentials, proxies or SVG resources are used. */
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { IncomingMessage } from "node:http";

export const REMOTE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DEADLINE_MS = 8_000;
const unavailable = () => new Error("The remote artwork is unavailable or unsupported.");

/** Conservative public-unicast policy. It also rejects IPv4-mapped, NAT64,
 * Teredo and 6to4 forms rather than permitting an embedded private address. */
export function isPublicArtworkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a = -1, b = -1, c = -1] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (family !== 6 || address.includes("%")) return false;
  const [left = "", right] = address.toLowerCase().split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const words = right === undefined ? start : [...start, ...Array(8-start.length-end.length).fill("0"), ...end];
  if (words.length !== 8 || words.some(word => !/^[0-9a-f]{1,4}$/.test(word))) return false;
  const first = parseInt(words[0]!, 16), second = parseInt(words[1]!, 16);
  if ((first & 0xe000) !== 0x2000) return false; // global unicast 2000::/3 only
  if (first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) return false;
  if (first === 0x2002 || (first === 0x3fff && second <= 0x0fff)) return false;
  return true;
}

export function artworkHttpsUrl(value: string): URL {
  if (value.length > 4096 || /[\x00-\x20\\]/.test(value)) throw unavailable();
  let url: URL;
  try { url = new URL(value); } catch { throw unavailable(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) throw unavailable();
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(":") && !host.includes(".") || /(^|\.)(localhost|local|internal|home|lan|test|invalid|example)$/.test(host)) throw unavailable();
  if (isIP(host) && !isPublicArtworkAddress(host)) throw unavailable();
  return url;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(unavailable());
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { signal.removeEventListener("abort", abort); reject(unavailable()); return; }
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function publicAddresses(url: URL, signal: AbortSignal): Promise<LookupAddress[]> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(host);
  const addresses = family ? [{ address: host, family }] : await abortable(dnsLookup(host, { all: true, verbatim: true }), signal);
  if (!addresses.length || addresses.some(entry => !isPublicArtworkAddress(entry.address) || ![4,6].includes(entry.family))) throw unavailable();
  return addresses;
}

/** Exported for a focused pinning regression: this function never resolves DNS. */
export function pinnedArtworkLookup(addresses: readonly LookupAddress[]): LookupFunction {
  return (_host, options, callback) => {
    const family = options.family === "IPv4" ? 4 : options.family === "IPv6" ? 6 : options.family;
    const selected = addresses.filter(entry => !family || entry.family === family);
    if (!selected.length) { callback(unavailable(), []); return; }
    if (options.all) callback(null, [...selected]);
    else callback(null, selected[0]!.address, selected[0]!.family);
  };
}

export function isArtworkRaster(bytes: Buffer): boolean {
  return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
    (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
    /^GIF8[79]a/.test(bytes.subarray(0, 6).toString("ascii")) ||
    (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP");
}

type HopResult = { bytes: Buffer } | { redirect: URL };
function requestHop(url: URL, addresses: LookupAddress[], signal: AbortSignal): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let incoming: IncomingMessage | undefined;
    const finish = (result?: HopResult) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (result) resolve(result); else reject(unavailable());
    };
    const abort = () => { finish(); incoming?.destroy(); request.destroy(); };
    const request = httpsRequest(url, {
      method: "GET", agent: false, lookup: pinnedArtworkLookup(addresses), rejectUnauthorized: true,
      headers: { Accept: "image/png,image/jpeg,image/webp,image/gif", "User-Agent": "SwordWeave PDF artwork" },
    }, response => {
      incoming = response;
      const status = response.statusCode ?? 0;
      if ([301,302,303,307,308].includes(status)) {
        const location = response.headers.location;
        try {
          if (!location) throw unavailable();
          const next = artworkHttpsUrl(new URL(location, url).href);
          finish({ redirect: next });
        } catch { finish(); }
        response.destroy(); return;
      }
      const type = response.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
      const encoding = response.headers["content-encoding"];
      if (status !== 200 || !["image/png","image/jpeg","image/webp","image/gif","application/octet-stream"].includes(type ?? "") ||
        (encoding && encoding !== "identity") || Number(response.headers["content-length"]) > REMOTE_IMAGE_MAX_BYTES) {
        finish(); response.destroy(); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        if (settled) return;
        size += chunk.length;
        if (size > REMOTE_IMAGE_MAX_BYTES) { finish(); response.destroy(); return; }
        chunks.push(chunk);
      });
      response.once("end", () => {
        const bytes = Buffer.concat(chunks, size);
        if (isArtworkRaster(bytes)) finish({ bytes }); else finish();
      });
      response.once("error", () => finish());
      response.once("aborted", () => finish());
    });
    request.once("error", () => finish());
    request.setTimeout(5_000, abort);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort(); else request.end();
  });
}

/** General HTTPS raster support, with validation and address pinning repeated
 * on every redirect. Returned errors deliberately contain no authored URL. */
export async function readRemoteArtwork(value: string, context: { signal?: AbortSignal } = {}): Promise<Buffer> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, DEADLINE_MS);
  context.signal?.addEventListener("abort", abort, { once: true });
  if (context.signal?.aborted) abort();
  try {
    let url = artworkHttpsUrl(value);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      if (controller.signal.aborted) throw unavailable();
      const addresses = await publicAddresses(url, controller.signal);
      const result = await requestHop(url, addresses, controller.signal);
      if ("bytes" in result) return result.bytes;
      url = result.redirect;
    }
    throw unavailable();
  } catch { throw unavailable(); }
  finally { clearTimeout(timeout); context.signal?.removeEventListener("abort", abort); }
}
