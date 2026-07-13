// =============================================================================
// GET /api/icons/game/[author]/[slug]?color=#rrggbb
//
// Server-side recolor proxy for game-icons.net SVGs. The official site's
// icons ship as white-on-transparent SVGs. This route fetches the SVG,
// swaps the white fill for the entity's iconColor, and returns the
// recolored SVG bytes.
//
// Caching: keyed by (author, slug, color). We use the Vercel edge cache
// with Cache-Control: public, max-age=31536000, immutable. Two request
// for the same color = one upstream fetch. The icon color is the entity
// row's `icon_color` column, so any color change requires a row update
// (which changes the URL anyway — the cache key is fresh).
//
// Upstream: jsDelivr's mirror of game-icons-net/game-icons on GitHub.
// Primary CDN (raw.githubusercontent.com) can be slow; jsDelivr adds
// edge caching. Fallback: official game-icons.net/icons/.../1x1/...
// (no edge caching, slower).
//
// Author validation: we allow only the 36 known authors from the
// zip's license.txt — this is defense in depth against request
// forgery, since the parameter is interpolated into a URL.
// =============================================================================

import { type NextRequest, NextResponse } from "next/server";
import { KNOWN_AUTHORS } from "@/lib/icons/game-icons-known-authors";

const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/game-icons-net/game-icons@master/";
const OFFICIAL_BASE = "https://game-icons.net/icons/ffffff/transparent/1x1/";

// Render at runtime — these are static at build time so the route file
// itself is fully static. The dynamic params ([author], [slug]) make the
// route dynamic per-request.
export const dynamic = "force-dynamic";

// Validate + normalize hex color. Accepts #rgb, #rrggbb, #rrggbbaa.
// Returns null on invalid input (which the route handler maps to 400).
function normalizeHex(input: string | null): string | null {
  if (!input) return "#ffffff";
  const s = input.trim().toLowerCase();
  // Accept shorthand #abc → #aabbcc
  let h = s.startsWith("#") ? s.slice(1) : s;
  if (!/^[0-9a-f]+$/.test(h)) return null;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 4) h = h.split("").map((c) => c + c).join(""); // #rgba → #rrggbb
  if (h.length !== 6 && h.length !== 8) return null;
  return `#${h}`;
}

// Recolor a single SVG document, replacing every white fill (in any of
// the shapes the official pack uses) with the supplied color. Returns
// the modified SVG text.
//
// The official pack uses these patterns to express white:
//   fill="#fff"            (the most common)
//   fill="#ffffff"         (long form)
//   fill="white"           (rare)
//   style="fill:#fff"      (CSS-in-attribute form)
//   stroke="#fff"          (very rare — outline icons)
//   style="stroke:#fff"    (CSS outline form)
//
// We only replace fills, not strokes, because the recolor is meant to
// recolor the icon's solid mass, not thin outlines. The icon CSS file
// itself uses currentColor in a few places — we leave those alone so
// authors can still style icons via parent CSS when needed.
function recolorSvg(svg: string, color: string): string {
  // Pre-lowercase so matches are case-insensitive (the official pack is
  // all-lowercase but be safe).
  const lower = svg.toLowerCase();
  const variants = ["#fff", "#ffffff", "white"];
  // Use a single replace pass over a fixed set of patterns. We split
  // the work by attribute style so the patterns don't collide.
  let out = svg;
  for (const v of variants) {
    // fill="white" / fill="#fff" etc.
    const fillRe = new RegExp(`(fill=["'])${v.replace("#", "\\#")}(["'])`, "gi");
    out = out.replace(fillRe, `$1${color}$2`);
    // style="fill:white" / style="fill:#fff"
    const styleRe = new RegExp(`(style=["'][^"']*fill:\\s*)${v.replace("#", "\\#")}([^"']*["'])`, "gi");
    out = out.replace(styleRe, `$1${color}$2`);
  }
  // Also handle a stray 'currentColor' that the upstream pack sometimes
  // uses for fill (Lorc icons occasionally do this). Replace with the
  // requested color so the icon actually renders in the chosen color.
  out = out.replace(/fill=["']currentColor["']/gi, `fill="${color}"`);
  return out;
}

async function fetchUpstream(author: string, slug: string): Promise<string | null> {
  const path = `${author}/${slug}.svg`;
  const urls = [`${CDN_BASE}${path}`, `${OFFICIAL_BASE}${path}`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        // 5s upstream budget; jsDelivr is usually <300ms.
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "SwordWeave/1.0 (icon proxy)" },
      });
      if (res.ok) {
        const body = await res.text();
        if (body.includes("<svg")) return body;
      }
    } catch {
      // try the next mirror
    }
  }
  return null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ author: string; slug: string }> },
) {
  const { author, slug } = await ctx.params;

  // 1. Defense-in-depth: reject requests for authors we don't ship.
  // The picker UI only ever references the 36 known authors; anything
  // else is malformed/forged. Return 404 so the cache doesn't fill with
  // junk variants.
  if (!KNOWN_AUTHORS.has(author)) {
    return new NextResponse("Unknown author", { status: 404 });
  }

  // 2. Validate slug — kebab-case, max 80 chars, no path-traversal.
  // We don't need an allowlist for slugs because the upstream lookup
  // returns 404 on its own for missing icons; we just defend against
  // "../" type tricks before they reach the URL.
  if (!/^[a-z0-9-]{1,80}$/i.test(slug)) {
    return new NextResponse("Invalid slug", { status: 400 });
  }

  // 3. Normalize color. Default is #ffffff which is a no-op recolor
  // (we still go through recolorSvg so the output is canonical).
  const colorParam = req.nextUrl.searchParams.get("color");
  const color = normalizeHex(colorParam);
  if (!color) {
    return new NextResponse("Invalid color", { status: 400 });
  }

  // 4. Fetch + recolor. The result is cached at the edge by Vercel for
  // 1 year (immutable) keyed by full URL including the color query param.
  const upstream = await fetchUpstream(author, slug);
  if (!upstream) {
    return new NextResponse("Not found upstream", { status: 404 });
  }

  const recolored = recolorSvg(upstream, color);

  return new NextResponse(recolored, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // 1 year immutable. If the entity's icon_color changes, the URL
      // changes, the cache is fresh. If the icon itself is replaced
      // upstream, we rely on jsDelivr's purge or a manual cache bust.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Slight perf hint: SVGs are tiny, allow sharding.
      "Vary": "Accept-Encoding",
      // Attribution requirement per CC BY 3.0. Browsers don't surface
      // this to end users but it's preserved for compliance audits.
      "X-Icon-Source": "game-icons.net",
      "X-Icon-Author": author,
      "X-Content-Type-Options": "nosniff",
    },
  });
}