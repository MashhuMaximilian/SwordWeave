# Performance delivery review · 21 October 2026

Scope: public discovery pages on desktop and phone, preserving the existing
homepage hero, materials, typography, FAB, tools, readers and consent behavior.
Video work is deferred at the founder's request.

## Implemented candidate

`src/app/root-styles.css` is a single root entry containing the existing 45 CSS
imports in exactly their previous order. `layout.tsx` imports that entry. Original
stylesheets remain canonical; none was deleted, purged, scoped differently or
moved behind a runtime loader. The CookieConsent package and local overrides
remain in their original positions. Component/route CSS imports are unchanged.

This consolidates blocking requests; it **does not remove unused tool CSS**.
The much larger stylesheet-boundary refactor still needs explicit route and
overlay ownership. Moving forge/workshop/quickbuild styles independently would
be unsafe: source inspection found 246 later override lines affecting their
selector families. A conservative same-selector duplicate scan found only
about 42 KB source declarations, insufficient as the main improvement.

## Production-build comparison

Before: the existing `.next` production build, captured before this experiment.
After: `npx --yes pnpm@10 build` with the consolidated root entry. Next.js 16.2.10
completed compilation, TypeScript and static generation successfully. These
are local build measurements, not observed network transfers or field Web Vitals.

| Initial homepage CSS | Before | Consolidated candidate | Change |
| --- | ---: | ---: | ---: |
| Stylesheet chunks | 13 | 4 | −9 |
| Uncompressed bytes | 1,466,592 | 1,645,162 | +178,570 / +12.2% |
| Sum of per-file gzip bytes | 217,585 | 223,141 | +5,556 / +2.6% |
| Sum of per-file Brotli bytes | 173,701 | 163,364 | −10,337 / −6.0% |
| Root-layout chunks | 11 | 2 | −9 |

Consolidation lets the compiler process one larger CSS unit. It emits additional
color fallbacks and folds selectors, explaining the larger uncompressed result.
Fewer requests and smaller Brotli output are measurable; an improved loading
score or LCP has not yet been established by this experiment. Gzip is slightly
larger. Do not present this as a reduction in unused CSS.

All 45 source imports were parsed and compared in order; the only path changes
are equivalent component aliases made relative to the new entry. Compiled CSS
is not byte-identical. A diagnostic comparison that treats the compiler's
`color-mix` feature wrappers as supported and omits internal polyfill variables
found zero changed final values for existing identical selector/property keys;
remaining added/removed keys include merged selectors and overridden shadows.
That is useful evidence, not a substitute for actual cascade and theme checks.

## Lossless logo masks

Three CSS masks fetched full-color PNGs even though their colors are discarded
by alpha masking. New indexed white PNGs preserve **every alpha byte and the
original dimensions**. Each palette entry retains one original alpha level;
there is no resizing, quantization of opacity or redesign. PNG keeps the same
format support as the original implementation. No `mask-mode`/`mask-type`
override exists, so these raster image masks use their alpha channel.

| Consumer | Original PNG | Mask PNG | Bytes saved |
| --- | ---: | ---: | ---: |
| Public navigation, 647 × 795 | 198,510 | 59,003 | 139,507 |
| FAB Home mark, 647 × 795 | 321,088 | 66,010 | 255,078 |
| Homepage forge, 1000 × 1000 | 73,206 | 58,518 | 14,688 |

Only the three CSS image URLs changed, each appearing twice: standard `mask`
and `-webkit-mask`. They are in `public-guide-refinements.css`, `fab-metal.css`
and `public-site.css`. Original logos, full-color image consumers and creator-kit
assets remain unchanged. Savings are per distinct resource actually requested;
the table must not be interpreted as the measured homepage network reduction.

Reproduce a mask using Pillow: extract source RGBA alpha, create a P-mode image
from the unchanged alpha bytes, set all 256 palette colors to white, assign the
transparency table `bytes(range(256))`, then save an optimized PNG. Reopen and
compare dimensions and alpha bytes to the original.

## Evidence and release gate

Local evidence (excluded from Git) is saved under `output/marketing/`:

- `performance-css-before-2026-10-21.json`
- `performance-css-after-2026-10-21.json`
- `performance-mask-alpha-2026-10-21.json`

The build log is `/tmp/swordweave-css-consolidation-build.log`. CSS snapshot and
declaration diagnostic files use `/tmp/swordweave-css-*`. Before/after CSS paths,
counts and compressed sizes come from the homepage client-reference manifest's
`entryCSSFiles`, deduplicated per entry, and the actual emitted bytes. Compression
uses Node `zlib.gzipSync` and `zlib.brotliCompressSync` with default settings.

The successful experiment build **preceded the three final mask URL changes**.
A final build is required to include those URLs and other parallel release work.
No development or production server was started by this task.

### Parent release verification

The parent subsequently completed a fresh production build including all three
mask URLs and GM download changes: compilation, TypeScript and static generation
passed (`/tmp/swordweave-discovery-final-build.log`). Two later copy-only changes
clarify the Rules reference status and derive the press update date from its
manifest; the deployment build must include those too. Final scoped lint passes,
as do 44 application tests and 8 public-asset worker tests.

The pre-release production homepage baseline on 21 October was measured once in
PageSpeed report `lggrdi3ruv` (13:05 Bucharest, Lighthouse 13.5.0):

| Laboratory metric | Mobile / Slow 4G | Desktop |
| --- | ---: | ---: |
| Performance score | 61 | 62 |
| First Contentful Paint | 4.0 s | 0.8 s |
| Largest Contentful Paint | 8.8 s | 1.4 s |
| Total Blocking Time | 80 ms | 980 ms |
| Cumulative Layout Shift | 0 | 0 |
| Speed Index | 6.4 s | 2.5 s |

Both scored accessibility 100, best practices 100 and SEO 92. Lighthouse's one
SEO finding was the generic signup link text “Start”; its source now says
“Sign up” on desktop and phone. The report had no CrUX field data. Do not infer
a field improvement or an after-release score from build bytes.

The parent ran the production candidate locally on port 3010 for bounded visual
QA. Homepage dark/light materials, navigation and FAB were inspected at desktop
1280 px and phone 390 px. Selected computed font/color/background/border/padding
values matched the old live homepage exactly in desktop dark and phone light
states; phone width and scroll width were both 390 px. Phone navigation retained
the three public Library destinations. The phone Rules disclosure opened with
its text, topics and preparation table intact; phone Books cards retained their
layout. Screenshot inspections were performed in the browser. No full
authenticated authoring-workspace smoke check is claimed.

The browser connection subsequently closed, so final live visual checks and a
comparable post-release PageSpeed run remain to be established. Early computed
snapshots in `css-computed-qa-2026-10-21.json` include a transitional theme sample
and a viewport override that had not yet applied; they are diagnostic data,
not proof that every sampled state passed. The override was reset and applied
again before the actual 390 px checks. The local server was stopped before
the final build; no development server is left running.

Bounded browser verification should compare production baseline and candidate
at 1280 px and 390 px, in light and dark themes:

1. Homepage hero, nav gradient mark, open Create/Library menus and FAB Home /
   Discord / support hover and focus treatments. Check width versus scroll width.
2. Rules reader: topic navigation, a native disclosure, search and a table.
3. Books and creator-kit route CSS, including current PDF previews.
4. A public character sheet: bottom navigation, nested preview and FAB play guide.
5. Atelier: initial authoring controls, mechanical-rule selected gold contrast,
   character workshop open/close, then a direct-entry and client-navigation path.

Watch especially for shadow/color fallback differences, route CSS precedence,
phone density/sticky controls and selected gold text. Do not create or modify
character/library records merely for this visual smoke check. After the accepted
release, run one comparable mobile and desktop PageSpeed measurement; record
laboratory results separately from field data and avoid rerunning for a preferred
score.

## Reconnected follow-up · 13:48 Bucharest

After the founder reopened the browser, one fresh PageSpeed analysis completed
for both devices in report
[`zdo2aw7uqc`](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/zdo2aw7uqc?form_factor=mobile).
This supersedes the earlier inability to obtain post-release scores; the API's
429 result remains historical evidence of that failed route.

| Laboratory metric | Mobile before → after | Desktop before → after |
| --- | ---: | ---: |
| Performance | 61 → **63** | 62 → **97** |
| FCP | 4.0 → 4.1 s | 0.8 → 0.7 s |
| LCP | 8.8 → 7.8 s | 1.4 → 1.1 s |
| TBT | 80 → 40 ms | 980 → 50 ms |
| CLS | 0 → 0 | 0 → 0 |
| Speed Index | 6.4 → 5.6 s | 2.5 → 1.1 s |
| Accessibility / Best practices | 100 / 100 → 100 / 100 | 100 / 100 → 100 / 100 |
| Lighthouse SEO | 92 → **100** | 92 → **100** |

Both runs use Lighthouse 13.5.0 and Chrome 153.0.8010.36; mobile uses the same
emulated Moto G Power / Slow 4G profile. These are one before/after lab pair,
not repeated medians or field performance. The large desktop TBT change is not
isolated causal proof of the stylesheet change. No extra run was made to obtain
a preferred score. Mobile LCP remains poor despite the approximately one-second
reduction; public/editor CSS separation remains the main follow-up. CrUX still
has insufficient field data.

Actual report screenshots are saved as
`output/marketing/psi-{mobile,desktop}-after-2026-10-21.png`; their short `.txt`
files contain AX diffs rather than complete reports. The full figures above
were read from visible metric cards and score-calculator links. The measurement
predates the separate SRD publication, which does not change global styles or
the JavaScript architecture.

The current production press page reloaded with the new GM status/date and
correct analytics script/consent. The browser failed again while inspecting
GA parameters, before full post-release desktop/mobile authoring smoke checks.
Those checks remain open; a successful lab run does not complete interactive QA.
