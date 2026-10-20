#!/usr/bin/env node
/** Export the existing navigation mark; no tracing, new artwork or network.
 * Run: node scripts/export-navigation-gradient-logo.mjs
 * Uses Sharp already supplied by Next.js. Adds no project dependency.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [dirname(require.resolve("next/package.json"))] }));
const cssPath = "src/app/public-guide-refinements.css";
const markPath = "public/logo-light.png";
const assetDirectory = resolve(root, "public/press/logos");
const proofDirectory = resolve(root, "output/marketing");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const number = (value) => Number(value.toFixed(12)).toString();
const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const [cssBytes, markBytes] = await Promise.all([
  readFile(resolve(root, cssPath)), readFile(resolve(root, markPath)),
]);
const css = cssBytes.toString().replace(/\/\*[\s\S]*?\*\//g, "");
const markRules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
  .filter((match) => match[1].split(",").map((selector) => selector.trim()).includes(".sw-public-nav__brandmark"));
const base = markRules.find((match) => /\bmask:url\('\/logo-light\.png'\) center\/contain no-repeat/.test(match[2]));
const material = markRules.filter((match) => /background:linear-gradient\(/.test(match[2])).at(-1);
if (!base || !material) throw new Error("Navigation mark source structure changed; review before exporting.");
const width = Number(base[2].match(/\bwidth:([\d.]+)px/)?.[1]);
const height = Number(base[2].match(/\bheight:([\d.]+)px/)?.[1]);
const gradient = material[2].match(/background:(linear-gradient\(([^)]+)\))/);
if (!width || !height || !gradient) throw new Error("Missing source dimensions or gradient.");
const components = gradient[2].split(",").map((value) => value.trim());
const angle = Number(components.shift().match(/^([\d.]+)deg$/)?.[1]);
const stops = components.map((component) => {
  const match = component.match(/^(#[\da-f]{6})\s+([\d.]+)%$/i);
  if (!match) throw new Error(`Unsupported gradient stop: ${component}`);
  return { color: match[1].toLowerCase(), offset: Number(match[2]) };
});
if (angle !== 132 || stops.length !== 13 || stops[0].offset !== 0 || stops.at(-1).offset !== 100) {
  throw new Error("Expected reviewed 132-degree / 13-stop navigation material. Review a changed source explicitly.");
}
const filter = material[2].match(/filter:([^;]+)/)?.[1] ?? "none";

// CSS 0deg points up; positive angles rotate clockwise. CSS's magic-corner
// gradient line must be calculated in the actual 36 x 44 element, not a square.
const radians = angle * Math.PI / 180;
const direction = { x: Math.sin(radians), y: -Math.cos(radians) };
const length = Math.abs(width * direction.x) + Math.abs(height * direction.y);
const endpoints = {
  x1: width / 2 - direction.x * length / 2,
  y1: height / 2 - direction.y * length / 2,
  x2: width / 2 + direction.x * length / 2,
  y2: height / 2 + direction.y * length / 2,
};

const { data: original, info: originalInfo } = await sharp(markBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const sourceAlpha = Buffer.alloc(originalInfo.width * originalInfo.height);
const whiteMask = Buffer.alloc(original.length, 255);
for (let pixel = 0; pixel < sourceAlpha.length; pixel++) {
  sourceAlpha[pixel] = original[pixel * 4 + 3];
  whiteMask[pixel * 4 + 3] = sourceAlpha[pixel];
}
// White RGB makes alpha and luminance-mask SVG renderers agree. The source
// alpha bytes, including every translucent edge pixel, are unchanged.
const maskPng = await sharp(whiteMask, { raw: { width: originalInfo.width, height: originalInfo.height, channels: 4 } })
  .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer();
const maskRaw = await sharp(maskPng).ensureAlpha().raw().toBuffer();
const embeddedAlpha = Buffer.from(sourceAlpha.map((_, pixel) => maskRaw[pixel * 4 + 3]));
if (!embeddedAlpha.equals(sourceAlpha)) throw new Error("Embedded mask alpha differs from original.");

const scale = 40;
const pixelWidth = width * scale;
const pixelHeight = height * scale;
const provenance = {
  sourceMask: markPath, sourceMaskSha256: hash(markBytes),
  sourceMaskAlphaSha256: hash(sourceAlpha), sourceCss: cssPath,
  sourceCssSha256: hash(cssBytes), sourceGradient: gradient[1],
  composition: "Vector gradient with losslessly embedded original raster alpha; no outline tracing.",
  treatment: "Clean mark. Navigation's contextual drop shadows are not baked into this reusable asset.",
};
const defs = `<defs>
    <linearGradient id="navigation-metal" gradientUnits="userSpaceOnUse" x1="${number(endpoints.x1)}" y1="${number(endpoints.y1)}" x2="${number(endpoints.x2)}" y2="${number(endpoints.y2)}" color-interpolation="sRGB">
${stops.map((stop) => `      <stop offset="${stop.offset}%" stop-color="${stop.color}"/>`).join("\n")}
    </linearGradient>
    <mask id="navigation-silhouette" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
      <image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${maskPng.toString("base64")}"/>
    </mask>
  </defs>`;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">SwordWeave navigation mark, gold and teal gradient</title>
  <desc id="description">Source-faithful navigation mark. The original PNG alpha silhouette is embedded; this is not an independently traced vector outline. No background or contextual glow is included.</desc>
  <metadata>${xml(JSON.stringify(provenance))}</metadata>
  ${defs}
  <rect width="${width}" height="${height}" fill="url(#navigation-metal)" mask="url(#navigation-silhouette)"/>
</svg>
`;

await Promise.all([mkdir(assetDirectory, { recursive: true }), mkdir(proofDirectory, { recursive: true })]);
const svgPath = resolve(assetDirectory, "swordweave-mark-gradient.svg");
const pngPath = resolve(assetDirectory, "swordweave-mark-gradient.png");
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer();
await Promise.all([writeFile(svgPath, svg), writeFile(pngPath, png)]);

const { data: pixels, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alphaReferenceSvg = svg.replace('fill="url(#navigation-metal)"', 'fill="#ffffff"');
const reference = await sharp(Buffer.from(alphaReferenceSvg)).ensureAlpha().raw().toBuffer();
let transparent = 0, partial = 0, opaque = 0, maxAlphaDifference = 0;
let left = info.width, top = info.height, right = -1, bottom = -1;
for (let pixel = 0; pixel < info.width * info.height; pixel++) {
  const alpha = pixels[pixel * 4 + 3];
  maxAlphaDifference = Math.max(maxAlphaDifference, Math.abs(alpha - reference[pixel * 4 + 3]));
  if (!alpha) transparent++; else if (alpha === 255) opaque++; else partial++;
  if (alpha) {
    const x = pixel % info.width, y = Math.floor(pixel / info.width);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
}
if (!transparent || !partial || !opaque || maxAlphaDifference) throw new Error("Unexpected export transparency or silhouette.");

const fittedScale = Math.min(width / originalInfo.width, height / originalInfo.height);
const fitted = {
  x: (width - originalInfo.width * fittedScale) / 2,
  y: (height - originalInfo.height * fittedScale) / 2,
  width: originalInfo.width * fittedScale,
  height: originalInfo.height * fittedScale,
};
const proof = {
  ...provenance, angle, stops, sourceFilter: filter,
  sourceMaskPixels: { width: originalInfo.width, height: originalInfo.height },
  embeddedMaskAlphaSha256: hash(embeddedAlpha), alphaPreservedExactly: embeddedAlpha.equals(sourceAlpha),
  navigationBox: { width, height }, fittedMask: fitted,
  direction, gradientLength: length, gradientEndpoints: endpoints,
  png: { width: info.width, height: info.height, channels: info.channels, bounds: [left, top, right + 1, bottom + 1], transparent, partial, opaque, maxAlphaDifference },
  outputs: [
    { file: "public/press/logos/swordweave-mark-gradient.svg", bytes: Buffer.byteLength(svg), sha256: hash(svg) },
    { file: "public/press/logos/swordweave-mark-gradient.png", bytes: png.length, sha256: hash(png) },
  ],
  renderer: sharp.versions,
  limits: ["No new browser screenshot or cross-browser pixel comparison was performed.", "Raster-mask source detail remains 647 x 795; larger exports do not invent vector edge detail.", "Navigation's responsive mask box and contextual drop shadows are not part of this clean mark export.", "The separate navigation wordmark, release badge and branding permission terms are unchanged."],
};
await writeFile(resolve(proofDirectory, "gradient-logo-source-review.json"), JSON.stringify(proof, null, 2) + "\n");

const preview = await sharp(png).resize({ width: 230, height: 282, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const actualSize = await sharp(Buffer.from(svg)).resize(36, 44).png().toBuffer();
const proofBackground = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="650">
  <defs><pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#d9ddda"/><path d="M0 0h12v12H0zM12 12h12v12H12z" fill="#f5f6ee"/></pattern></defs>
  <rect width="1080" height="650" fill="#132126"/>
  <rect x="20" y="85" width="330" height="510" fill="#071116"/>
  <rect x="375" y="85" width="330" height="510" fill="#f0f4ea"/>
  <rect x="730" y="85" width="330" height="510" fill="url(#checker)"/>
  <g font-family="sans-serif" font-size="18" fill="#e8eee4"><text x="24" y="32">Source export: original alpha mask + navigation's 132-degree gradient</text><text x="24" y="61" font-size="14">Clean reusable mark; no baked backdrop, outline tracing, wordmark or contextual glow</text></g>
  <g font-family="sans-serif" font-size="15"><text x="40" y="115" fill="#e8eee4">Dark background</text><text x="395" y="115" fill="#142e31">Light background</text><text x="750" y="115" fill="#142e31">Transparency check</text><text x="40" y="487" fill="#e8eee4">Actual 36 x 44 slot</text><text x="395" y="487" fill="#142e31">Actual 36 x 44 slot</text><text x="750" y="487" fill="#142e31">Actual 36 x 44 slot</text></g>
  <text x="24" y="628" font-family="sans-serif" font-size="14" fill="#bfcec6">647 x 795 source alpha preserved exactly; 1440 x 1760 transparent PNG exported from SVG</text>
</svg>`;
await sharp(Buffer.from(proofBackground)).composite([
  ...[70, 425, 780].map((x) => ({ input: preview, left: x, top: 150 })),
  ...[165, 520, 875].map((x) => ({ input: actualSize, left: x, top: 515 })),
]).png({ compressionLevel: 9 }).toFile(resolve(proofDirectory, "gradient-logo-source-review.png"));
console.log(JSON.stringify({ outputs: proof.outputs, alphaPreservedExactly: true, maxAlphaDifference, proof: "output/marketing/gradient-logo-source-review.png" }, null, 2));
