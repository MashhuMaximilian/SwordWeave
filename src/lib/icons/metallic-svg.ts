export const DEFAULT_ICON_COLOR = "#d8ad54";
export const ICON_FINISH_VERSION = "metallic-v2-diagonal";

function mix(hex: string, other: [number, number, number], amount: number): string {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  return `#${rgb.map((part, i) => Math.round(part * (1 - amount) + other[i]! * amount).toString(16).padStart(2, "0")).join("")}`;
}

/** Apply the selected hue as a multi-band metal finish to the official white silhouette. */
export function metallicSvg(svg: string, color: string, outline = false): string {
  const base = color.slice(0, 7);
  const alpha = color.length === 9 ? (parseInt(color.slice(7), 16) / 255).toFixed(3) : "1";
  const stops: Array<[number, string]> = [
    [0, mix(base, [255, 255, 255], 0.62)],
    [12, mix(base, [255, 255, 255], 0.29)],
    [28, mix(base, [0, 0, 0], 0.38)],
    [42, mix(base, [255, 255, 255], 0.82)],
    [49, mix(base, [255, 255, 255], 0.44)],
    [62, base],
    [83, mix(base, [0, 0, 0], 0.49)],
    [100, mix(base, [255, 255, 255], 0.23)],
  ];
  // Square game icons use a 55-degree light direction (atan(1 / 0.7)).
  const gradient = `<defs><linearGradient id="sw-metal" x1="0" y1="0" x2="0.7" y2="1">${stops.map(([offset, stop]) => `<stop offset="${offset}%" stop-color="${stop}" stop-opacity="${alpha}"/>`).join("")}</linearGradient></defs>`;
  let out = svg.replace(/<svg\b([^>]*)>/i, `<svg$1>${gradient}`);
  const metal = "url(#sw-metal)";
  out = out.replace(/(fill=["'])(?:#fff(?:fff)?|white|currentColor)(["'])/gi, `$1${metal}$2`);
  out = out.replace(/(\bfill\s*:\s*)(?:#fff(?:fff)?|white|currentColor)(?=\s*[;"'])/gi, `$1${metal}`);
  if (outline) {
    out = out.replace(/fill=["'][^"']*["']/gi, 'fill="none"');
    out = out.replace(/stroke=["'][^"']*["']/gi, `stroke="${metal}"`);
    out = out.replace(/<svg([^>]*)>/i, `<svg$1 stroke="${metal}" stroke-width="2" fill="none">`);
  }
  return out;
}
