import sharp from "sharp";
import { get } from "@vercel/blob";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { PUBLIC_ART_ORIGIN } from "@/lib/assets/public-art";
import { canReadUploadedArtwork } from "@/lib/assets/upload-access";
import { lineageArtUrl } from "@/lib/heritage/lineage-art";
import { KNOWN_AUTHORS } from "@/lib/icons/game-icons-known-authors";
import { CharacterPdfRenderError } from "./render";
import { artworkHttpsUrl, isArtworkRaster, readRemoteArtwork } from "./remote-image";
import type { CharacterPdfImage, CharacterPdfMedia, CharacterPdfRecord, CharacterPdfSnapshot } from "./types";

// Retain print-quality portraits alongside entity icons while keeping the
// enriched request comfortably inside the renderer's separate payload bound.
export const CHARACTER_PDF_MEDIA_BUDGET = 900_000; // Serialized base64, including repeated pinned aliases.
export const CHARACTER_PDF_MEDIA_INPUT_LIMIT = 4 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
const MAX_MEDIA_REQUESTS = 160;
const MEDIA_DEADLINE_MS = 14_000;
const record = (value: unknown): CharacterPdfRecord => value && typeof value === "object" && !Array.isArray(value) ? value as CharacterPdfRecord : {};
const string = (value: unknown) => typeof value === "string" ? value.trim() : "";
type Source = { type: "public" | "remote"; url: string } | { type: "upload"; pathname: string } | { type: "game"; author: string; slug: string };
type Candidate = { target: "character" | "heritages" | "icons"; key: string; source: Source | null; size: number };

/** Same-site and canonical Blob URLs use the existing private upload reader.
 * Other HTTPS raster URLs go through the DNS-pinned remote image boundary. */
export function characterPdfArtworkSource(value: unknown): Source | null {
  let path = string(value);
  if (!path || path.includes("\\") || /[\x00-\x20]/.test(path)) return null;
  if (/^https?:/i.test(path)) {
    let url: URL;
    try { url = artworkHttpsUrl(path); } catch { return null; }
    const canonical = [new URL(PUBLIC_ART_ORIGIN).hostname, "www.swordweave.quest", "swordweave.quest"].includes(url.hostname);
    const blob = /^[a-z0-9-]+\.(?:(?:private|public)\.)?blob\.vercel-storage\.com$/i.test(url.hostname);
    if (!canonical && !blob) return { type: "remote", url: url.href };
    if (canonical && (url.search || url.hash)) return null;
    path = url.pathname;
    if (blob) path = path.replace(/^\//, "");
  }
  if (path.includes("..") || /[%?#]/.test(path)) return null;
  if (/^\/images\/(characters|lineages|heritages)\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$/i.test(path)) {
    return { type: "public", url: `${PUBLIC_ART_ORIGIN}${path}` };
  }
  const pathname = path.replace(/^\/api\/icons\/blob\//, "").replace(/^\/(?=user-uploads\/)/, "");
  if (/^user-uploads\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|gif|svg)$/i.test(pathname)) return { type: "upload", pathname };
  return null;
}

function iconSource(entity: CharacterPdfRecord): Source | null {
  if (entity["iconSource"] === "UPLOAD") return characterPdfArtworkSource(entity["iconUrl"]);
  if (!entity["iconSource"]) return characterPdfArtworkSource(entity["imageUrl"] || entity["portraitUrl"] || entity["iconUrl"]);
  if (entity["iconSource"] !== "GAME_ICONS") return null;
  const match = /^([a-z0-9-]+)\/([a-z0-9-]{1,80})$/i.exec(string(entity["iconKey"]));
  if (!match || !KNOWN_AUTHORS.has(match[1]!)) return null;
  return { type: "game", author: match[1]!, slug: match[2]! };
}

/** Rebuild an SVG from inert geometry only. No URLs, CSS, entities, foreign
 * content or resource-bearing elements ever reach librsvg. */
export function characterPdfGeometrySvg(input: Buffer, monochrome = false): Buffer {
  if (input.byteLength > 160_000) throw new Error("SVG is too large");
  const svg = input.toString("utf8").replace(/^\s*<\?xml[^>]*>\s*/i, "");
  if (!/^\s*<svg\b/i.test(svg) || /<!|&|\b(?:href|src|style|on[a-z]+)\s*=|url\s*\(|@import/i.test(svg)) throw new Error("Unsupported SVG resources");
  const allowed = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);
  const geometry = new Set(["d", "points", "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "x2", "y1", "y2", "transform", "viewBox", "fill-rule", "clip-rule", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity"]);
  let end = 0;
  let output = "";
  for (const token of svg.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g)) {
    if (svg.slice(end, token.index).trim()) throw new Error("Unsupported SVG text");
    end = token.index! + token[0].length;
    const name = token[1]!;
    if (!allowed.has(name)) throw new Error("Unsupported SVG element");
    if (token[0].startsWith("</")) { output += `</${name}>`; continue; }
    const raw = token[2]!.replace(/\/\s*$/, "");
    let remaining = raw;
    const attrs: string[] = [];
    for (const attr of raw.matchAll(/([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*(["'])(.*?)\2/gs)) {
      remaining = remaining.replace(attr[0], "");
      const key = attr[1]!, value = attr[3]!;
      if (key === "fill" || key === "stroke") {
        if (!/^(none|transparent|currentColor|#[0-9a-f]{3,8}|[a-z]+|rgba?\([0-9.,% ]+\))$/i.test(value)) throw new Error("Unsupported SVG paint");
        attrs.push(`${key}="${monochrome && !/^(none|transparent)$/i.test(value) ? "#181818" : value}"`);
      } else if (geometry.has(key)) {
        if (!/^[a-zA-Z0-9.,()+\-\s]+$/.test(value)) throw new Error("Unsupported SVG geometry");
        attrs.push(`${key}="${value}"`);
      } else if (key !== "xmlns" && key !== "version" && key !== "id" && key !== "class") throw new Error("Unsupported SVG attribute");
    }
    if (remaining.trim()) throw new Error("Unsupported SVG attributes");
    if (name === "svg") {
      attrs.push('xmlns="http://www.w3.org/2000/svg"');
      if (!attrs.some(attr => attr.startsWith("fill="))) attrs.push('fill="#181818"');
    }
    output += `<${name}${attrs.length ? " " + attrs.join(" ") : ""}${/\/\s*>$/.test(token[0]) ? "/" : ""}>`;
  }
  if (svg.slice(end).trim()) throw new Error("Unsupported SVG tail");
  return Buffer.from(output);
}

async function limitedStream(stream: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new Error("Media cancelled");
    while (true) {
      const result = await reader.read();
      if (signal.aborted) throw new Error("Media cancelled");
      if (result.done) break;
      size += result.value.byteLength;
      if (size > CHARACTER_PDF_MEDIA_INPUT_LIMIT) { await reader.cancel(); throw new Error("Media is too large"); }
      chunks.push(result.value);
    }
    return Buffer.concat(chunks, size);
  } finally { signal.removeEventListener("abort", abort); reader.releaseLock(); }
}

async function sourceBytes(source: Source, viewerId: string | null, signal: AbortSignal): Promise<Buffer> {
  if (source.type === "remote") return await readRemoteArtwork(source.url, { signal });
  if (source.type === "upload") {
    if (!(await canReadUploadedArtwork(source.pathname, viewerId))) throw new Error("Artwork is unavailable");
    if (process.env.NODE_ENV === "development" && !process.env["BLOB_READ_WRITE_TOKEN"]) {
      const root = await realpath(join(process.cwd(), ".local-uploads"));
      const path = await realpath(join(root, source.pathname));
      if (!path.startsWith(root + sep)) throw new Error("Artwork is unavailable");
      const file = await stat(path);
      if (!file.isFile() || file.size > CHARACTER_PDF_MEDIA_INPUT_LIMIT) throw new Error("Artwork is unavailable");
      return await readFile(path, { signal });
    }
    const blob = await get(source.pathname, { access: "private", abortSignal: signal });
    if (!blob || blob.statusCode !== 200 || blob.blob.size > CHARACTER_PDF_MEDIA_INPUT_LIMIT) throw new Error("Artwork is unavailable");
    return await limitedStream(blob.stream, signal);
  }
  const urls = source.type === "game" ? [
    `https://game-icons.net/icons/ffffff/transparent/1x1/${source.author}/${source.slug}.svg`,
  ] : [source.url];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal, redirect: "manual", cache: "no-store", headers: { "Accept": "image/*" } });
      if (!response.ok || !response.body || Number(response.headers.get("content-length")) > CHARACTER_PDF_MEDIA_INPUT_LIMIT) {
        await response.body?.cancel(); continue;
      }
      return await limitedStream(response.body, signal);
    } catch { if (signal.aborted) break; }
  }
  throw new Error("Artwork is unavailable");
}

async function printableImage(source: Source, size: number, viewerId: string | null, signal: AbortSignal, color: boolean, portrait: boolean): Promise<CharacterPdfImage> {
  let bytes = await sourceBytes(source, viewerId, signal);
  const raster = isArtworkRaster(bytes);
  // Unknown bytes must pass the geometry sanitizer before any image decoder.
  // A filename or Content-Type alone is never evidence that input is raster.
  if (!raster) {
    if (source.type === "remote") throw new Error("Remote SVG artwork is unsupported");
    bytes = characterPdfGeometrySvg(bytes, source.type === "game");
  }
  const image = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "error", sequentialRead: true, pages: 1 });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS || (metadata.pages ?? 1) > 1 || !["png", "jpeg", "webp", "gif", "svg"].includes(metadata.format ?? "")) throw new Error("Unsupported artwork");
  const colored = color && source.type !== "game";
  const swap = [5,6,7,8].includes(metadata.orientation ?? 0);
  const width = swap ? metadata.height : metadata.width, height = swap ? metadata.width : metadata.height;
  // A tall saved portrait is cover-cropped in its medallion. Preserve its
  // short-side pixels for the allowed zoom instead of reducing the long side
  // to 512 and throwing useful crop detail away. Never enlarge source pixels.
  const scale = portrait ? Math.min(1, size/Math.min(width,height), 2048/Math.max(width,height)) : Math.min(1,size/Math.max(width,height));
  const resized = image.rotate().resize(Math.max(1,Math.round(width*scale)), Math.max(1,Math.round(height*scale)), { fit: "inside", withoutEnlargement: true });
  const output = await (colored ? resized : resized.greyscale())
    .png({ palette: true, colours: colored ? 128 : 64, compressionLevel: 9, effort: 7 }).timeout({ seconds: 2 }).toBuffer({ resolveWithObject: true });
  if (signal.aborted) throw new Error("Media cancelled");
  const result: CharacterPdfImage = { data: output.data.toString("base64"), mimeType: "image/png", width: output.info.width, height: output.info.height };
  if (source.type === "game") Object.assign(result, { author: source.author, source: "game-icons.net", license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/", credit: `${source.slug} by ${source.author}, game-icons.net, CC BY 3.0; converted to grayscale.` });
  return result;
}

/** Walk only effective projected definitions. A pin-specific occurrence never
 * borrows another pin's icon. Thin legacy rows can use a matching graph node. */
export function characterPdfMediaCandidates(snapshot: CharacterPdfSnapshot): Candidate[] {
  const result: Candidate[] = [];
  // 512 px also preserves 300 dpi for the saved portrait medallion at 3x zoom.
  if (string(snapshot["portraitUrl"])) result.push({ target: "character", key: "", source: characterPdfArtworkSource(snapshot["portraitUrl"]), size: 512 });
  const graph = new Map((snapshot.readOnlyGraph?.nodes ?? []).map(node => [node.key, node]));
  const seen = new Set<string>();
  function visit(kind: string, entity: CharacterPdfRecord, link: CharacterPdfRecord = {}, depth = 0) {
    if (depth > 12) return;
    const id = string(String(entity["id"] ?? link[`${kind}Id`] ?? ""));
    if (!id) return;
    const version = string(link["versionId"]) || string(entity["versionId"]);
    const key = `${kind}:${id}${version ? ":" + version : ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    let data = entity;
    const node = graph.get(`${kind}:${id}` as never);
    if (!["iconSource", "iconKey", "iconUrl"].some(field => Object.hasOwn(entity, field)) && node && !node.data["workspaceVersionIssue"] && (!version || version === node.versionId)) data = { ...node.data, ...entity };
    if (kind === "heritage") {
      const url = lineageArtUrl(data);
      // A 100 pt concept-page portrait needs at least 417 native pixels for
      // 300 dpi. Keep useful source detail, without enlarging smaller art.
      if (url) result.push({ target: "heritages", key: id, source: characterPdfArtworkSource(url), size: 512 });
    }
    if (data["iconSource"] || data["imageUrl"] || data["portraitUrl"] || data["iconUrl"]) result.push({ target: "icons", key, source: iconSource(data), size: 64 });
    for (const childKind of ["primitive", "capability", "effect", "item", "heritage"]) {
      for (const childLink of (Array.isArray(entity[`${childKind}Links`]) ? entity[`${childKind}Links`] : []) as unknown[]) {
        const member = record(childLink);
        visit(childKind, record(member[childKind]), member, depth + 1);
      }
    }
  }
  for (const kind of ["heritage", "primitive", "capability", "effect", "item"]) {
    for (const value of (Array.isArray(snapshot[`${kind}Links`]) ? snapshot[`${kind}Links`] : []) as unknown[]) {
      const link = record(value); visit(kind, record(link[kind]), link);
    }
  }
  return result;
}

/** Invoke only after the snapshot authorization gate. No private URLs, source
 * bytes or failed image diagnostics are logged or returned as error details. */
export async function resolveCharacterPdfMedia(snapshot: CharacterPdfSnapshot, context: { viewerId: string | null; signal?: AbortSignal; color?: boolean }): Promise<CharacterPdfSnapshot> {
  const media: CharacterPdfMedia = { heritages: {}, icons: {}, warnings: [] };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  context.signal?.addEventListener("abort", cancel, { once: true });
  if (context.signal?.aborted) cancel();
  const timeout = setTimeout(cancel, MEDIA_DEADLINE_MS);
  const candidates = characterPdfMediaCandidates(snapshot);
  const selected = candidates.slice(0, MAX_MEDIA_REQUESTS);
  const cache = new Map<string, Promise<CharacterPdfImage>>();
  const results: Array<CharacterPdfImage | null> = [];
  let cursor = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(6, selected.length) }, async () => {
      while (cursor < selected.length) {
        const index = cursor++, candidate = selected[index]!;
        if (!candidate.source || controller.signal.aborted) { results[index] = null; continue; }
        const key = JSON.stringify([candidate.source, candidate.size, context.color === true]);
        let pending = cache.get(key);
        if (!pending) {
          pending = printableImage(candidate.source, candidate.size, context.viewerId, controller.signal, context.color === true, candidate.target === "character");
          cache.set(key, pending);
        }
        try { results[index] = await pending; } catch { results[index] = null; }
      }
    }));
    let used = 0;
    let unavailable = candidates.length - selected.length;
    selected.forEach((candidate, index) => {
      const image = results[index];
      if (!image || used + image.data.length > CHARACTER_PDF_MEDIA_BUDGET) { unavailable++; return; }
      used += image.data.length;
      if (candidate.target === "character") media.character = image;
      else media[candidate.target][candidate.key] = image;
    });
    if (unavailable) media.warnings.push(`${unavailable} artwork or icon entries could not be included because their source was unavailable, unsupported or exceeded the export budget.`);
    if (context.signal?.aborted) throw new CharacterPdfRenderError("CANCELLED", "PDF export was cancelled.", 499);
    return { ...snapshot, pdfMedia: media };
  } finally { clearTimeout(timeout); context.signal?.removeEventListener("abort", cancel); }
}
