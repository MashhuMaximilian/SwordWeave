# Navigation gradient mark: source and export review

**Reviewed:** 20 October 2026  
**Scope:** Export the existing navigation mark into reusable creator-kit files. No new logo design, outline tracing, wordmark change or branding permission grant. The parent task integrates the approved files into `/press`, its manifest and ZIP.

## Files ready for integration

| File | Format / size | SHA-256 |
| --- | --- | --- |
| `public/press/logos/swordweave-mark-gradient.svg` | Self-contained SVG; 114,100 bytes; logical `viewBox="0 0 36 44"`; preferred display dimensions 1440 × 1760 | `2aa46b389265afe294998b599a51e6ab32f557145663fffc57124d3e0a5ff54a` |
| `public/press/logos/swordweave-mark-gradient.png` | Transparent RGBA PNG; 1440 × 1760; 1,221,334 bytes | `3bdd881fa3ffcb641f953edb5dfea04bc6672bb1e0443d0e562ab6717f33484e` |
| `scripts/export-navigation-gradient-logo.mjs` | Deterministic source exporter using Sharp already supplied by Next.js | Re-run with `node scripts/export-navigation-gradient-logo.mjs` |

The SVG is a **vector gradient with an embedded raster alpha mask**. It preserves the actual source silhouette rather than pretending a traced reconstruction is an original vector master. Its embedded white mask has exactly the same alpha bytes as the original PNG; whitening unused RGB makes alpha and luminance-mask SVG renderers agree. It has no external file, font or network dependency.

## Authoritative source ledger

`PublicNav` renders an empty `.sw-public-nav__brandmark` span before the separate Sword·Weave wordmark and release badge. The mark's base rule masks `/logo-light.png` at `center/contain no-repeat`. The later **Polished metal** rule in `src/app/public-guide-refinements.css` supplies the active 132-degree gradient, overriding the earlier compact 145-degree rule. Exporting that earlier rule would reproduce the wrong material.

| Source | Captured SHA-256 / role |
| --- | --- |
| `public/logo-light.png` | `9a4521f42aa17bf56ccd5fc2167958bd0d197e28c4b82c90ea271bd1155d5244` — original 647 × 795 alpha silhouette |
| Raw source alpha, row-major bytes | `73ae7f016c337085bd8dd36485ecde03b800bfcf6c11e532d7e31fbcbdb31368` — identical to the embedded mask's decoded alpha |
| `src/app/public-guide-refinements.css` | `f7c8312d5a53e86e12bff500beecd1f756fd9206cba1eaa05add909f41c0c713` — base mask, desktop dimensions and final material |
| `src/app/arcane-materials.css` | `270edc54f3b875049a3f49d3f7a905ccd38f7d3fce0db24cf8f5cc5fdb913085` — light theme changes the separate wordmark gradient, not this mark gradient |

The clean export uses the desktop **36 × 44** mark slot. Contain fitting places the 647 × 795 source at approximately `x=0.095597484277, y=0, width=35.808805031447, height=44`. It does not stretch the source into a different shape. The existing mobile navigation uses 29 × 36, with a narrower 26-wide case; those responsive slot differences remain website layout behavior.

## Exact material

```css
linear-gradient(132deg,#8c5d22 0%,#e7b953 15%,#fff5c3 24%,#b8832d 30%,#f8d87e 40%,#fffbea 44%,#d9bc73 48%,#69caba 57%,#e2fff6 63%,#328e89 69%,#83e6d2 82%,#eafff6 87%,#286e73 100%)
```

| Position | Color |
| --- | --- |
| 0% | `#8c5d22` |
| 15% | `#e7b953` |
| 24% | `#fff5c3` |
| 30% | `#b8832d` |
| 40% | `#f8d87e` |
| 44% | `#fffbea` |
| 48% | `#d9bc73` |
| 57% | `#69caba` |
| 63% | `#e2fff6` |
| 69% | `#328e89` |
| 82% | `#83e6d2` |
| 87% | `#eafff6` |
| 100% | `#286e73` |

CSS angles begin upward and rotate clockwise. The exported vector direction is `(sin 132°, -cos 132°) = (0.743144825477, 0.669130606359)`. For the actual rectangular 36 × 44 gradient box, the CSS gradient line has length `56.194960396976`. SVG uses `gradientUnits="userSpaceOnUse"` with endpoints:

```text
x1 = -2.880497018460    y1 =  3.199116037630
x2 = 38.880497018460    y2 = 40.800883962370
```

This follows the rectangular gradient geometry rather than rotating an object-bounding-box gradient as though the slot were square. See the [CSS Images gradient geometry definition](https://drafts.csswg.org/css-images-3/#linear-gradients). The source uses legacy hex colors; SVG explicitly uses sRGB interpolation to retain that behavior. The [CSS interoperability test for legacy-color gradients](https://github.com/web-platform-tests/wpt/blob/master/css/css-images/gradient/legacy-color-gradient.html) documents the corresponding sRGB expectation.

## Render and alpha evidence

The exporter produces local review files:

- `output/marketing/gradient-logo-source-review.png` — the same export on dark, light and checker backgrounds, with a second row at the actual 36 × 44 slot.
- `output/marketing/gradient-logo-source-review.json` — exact stops, endpoints, source/output hashes, fit geometry, transparency counts and renderer versions.

These proof files are internal review artifacts, not creator-kit assets. Visual inspection confirmed the original mark's gold-to-teal material, open interior spaces, transparent backdrop and consistent treatment across all three backgrounds. The light-background proof deliberately retains the existing bright reflections; it does not invent a darker replacement mark.

Checks completed:

- Every decoded embedded-mask alpha byte equals the original source alpha; the alpha SHA-256 values match.
- The PNG has four channels, 1,564,790 fully transparent pixels, 334,639 partial-alpha pixels and 634,971 opaque pixels. No solid rectangular backdrop is baked in.
- Rendered alpha bounds are `[3, 0, 1437, 1760]` using exclusive right/bottom coordinates, consistent with contain fitting inside the 1440 × 1760 canvas.
- Rendering the same mask with an opaque white fill produces **zero maximum alpha difference** from the gradient export. Adding the gradient has not altered the silhouette.
- Repeated export runs produced identical SVG and PNG SHA-256 values under the recorded renderer.
- JavaScript syntax check, scoped ESLint and whitespace checks passed. No browser, server, full application build, dependency install or AI image generation was used.

## Deliberate limits and unchanged originals

The website adds contextual CSS filters: `drop-shadow(0 1px 1px #0009) drop-shadow(0 0 8px #87e5ca38)`. The reusable mark excludes those shadows so the download stays a clean transparent identity asset, rather than baking a navigation-specific glow or dark edge into another creator's layout. Geometry and gradient are source-faithful; this is not a pixel-identical screenshot of the entire navigation treatment. No new browser or cross-browser pixel comparison is claimed.

The source edge detail remains **647 × 795 raster alpha** even inside SVG. The larger PNG makes placement convenient but does not invent vector detail. No independently authored path master exists in the inspected repository. The separate wordmark, typography, release badge, mobile slot treatment and source branding notices remain unchanged.

The three flat originals were left byte-for-byte intact:

| Existing asset | SHA-256 |
| --- | --- |
| `swordweave-mark-mono.png` | `160f13172405534435c850e53b6fb3ea91b135c63a8e573a952d8cf0fc74b7cb` |
| `swordweave-mark-light-background.png` | `9a4521f42aa17bf56ccd5fc2167958bd0d197e28c4b82c90ea271bd1155d5244` |
| `swordweave-mark-dark-background.png` | `f8f046959172e60c796305968d133817a1a8d98d1f1b65f665e001b7a5925cee` |

Existing asset notices apply. This export adds no standalone permission to adapt, sublicense or repurpose the branding. No manifest, page, ZIP or publication file was modified by this asset subtask.
