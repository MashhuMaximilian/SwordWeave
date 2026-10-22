# Mobile performance trace · 22 October 2026

## Scope and baseline

Keep the current design, content, fonts, native account UI and application
behavior. No deployment settings, auth configuration or tracking policy change.

Canonical production was verified through Vercel metadata as deployment
`dpl_FsyPA7HhoUjaqeZvum1AixACXJWQ`, Git commit
`be19f64f9183822fff5cf53e3ad4b67b3ee83e0f`. This matches the worktree baseline.

The diagnostic uses official Lighthouse CLI **13.5.0** with installed Chrome for
Testing **153**, mobile 412×823, simulated Slow 4G and 4× CPU settings. No UI
automation script or Playwright/CDP interaction was used. Lighthouse saved its
raw trace, network log and report. Browser interaction checks use CUA separately.

Evidence: `output/marketing/mobile-trace-2026-10-22/`. These local profiling
artifacts are not application source and are not part of the release.

## What the trace establishes

Two production CLI observations measured **63 / 65** Performance, simulated
LCP **8.326 / 8.216 s**. The repeated baseline's raw H1 paint was **2.470 s**.
Raw timestamps and Lighthouse's simulated metric are different measurements;
their differences are not presented as a browser render-delay subtraction.

Recomputing Lighthouse's `LanternLargestContentfulPaint` from that exact saved
trace/network log reproduces **8,216.403 ms**, matching its reported LCP exactly.
The optimistic/pessimistic simulations finish at **7,914 / 8,519 ms**:

- Initial fonts finish by **2,624 ms** in both simulated graphs. They are not
  the long tail in this observation.
- Next's automatic link prefetch adds reader stylesheet
  `1r5oiyplhy6hs.css` (79,178 transferred bytes in the first run) and tool
  stylesheet `1eelawu4-yy4r.css` (208,603 bytes), plus RSC requests and auth
  redirects, without a click.
- In the repeated production simulation, the reader sheet finishes at
  **5,949 ms** optimistically. The tool sheet finishes at **7,763 ms**
  optimistically / **8,368 ms** pessimistically. It competes with app/Clerk
  resources for the simulated connection; a final prefetched character request
  completes at **7,914 / 8,519 ms**. Network scheduling contention is part of
  this graph, not only direct parent→child dependency edges.
- Clerk UI delivery is also substantial and remains in the graph. This patch
  does not repeat the rejected headless/`prefetchUI=false` change.

Full node timings and dependency IDs are saved in
`production-lantern-critical-path.json`.

Five fixed forge CSS masks also use `/api/icons/game/*`. Cold requests in the
first production trace take roughly **1.1–2.3 s** after request start. The
proxy's current jsDelivr source URL returns 404, requiring its official-site
fallback. A warm-cache repeat returns those images quickly while retaining
slow simulated LCP: proxy latency is not the sole LCP explanation.

Blocking icons only for diagnosis yields **78 / 5.009 s** simulated LCP and
**0.868 s** raw paint. Blocking RSC requests yields **53 / 6.588 s**, with a
large CPU/layout outlier. These artificial blocking runs change the workload;
neither is presented as the finished site's result.

## Bounded implementation

1. The homepage's own Next links and its PublicNav instance disable automatic
   route prefetch. Other pages keep their existing policy. Links retain normal
   Next client navigation after selection; no custom click handler is added.
2. The five authored homepage icon silhouettes and their five finished variants
   are committed static assets. Their shapes and finished SVG bytes match the
   current live API exactly; the finished variants use the same `metallicSvg`
   function and exact existing hues. Mask gradients, image dimensions, classes,
   alt text and lazy behavior stay the same. User-authored/runtime icon variants
   continue to use the existing proxy. Artist/license attribution is retained.
3. Tailwind excludes only `output/` from automatic class detection, matching
   its existing deployment-input exclusion. Saved Lighthouse HTML had added
   accidental utilities to the local build. The official
   [Tailwind source detection syntax](https://tailwindcss.com/docs/detecting-classes-in-source-files#ignoring-specific-paths)
   supports this negative source. A direct before/after compilation removes
   73 artifact-only rule selectors (9,491 source bytes), with no exact matching
   authored string tokens in `src`. Only related unused Tailwind theme/default
   variables also change. No application source directory is excluded.

`pnpm exec tsx scripts/generate-home-icons.ts --check` verifies generated
finishes; omit `--check` to regenerate after an intentional formatter change.

## Paired local observations and limitations

Both baseline and candidate are production builds on port 3010, measured with
the same CLI settings. This local environment uses a **Clerk development
instance**, so it does not reproduce production's complete auth delivery.

| Build | Performance | Simulated FCP / LCP | TBT | Raw FCP / H1 LCP | Requests / transfer |
| --- | ---: | --- | ---: | --- | --- |
| Unchanged baseline | 73 | 2.774 / 5.882 s | 79 ms | 1.034 / 1.238 s | 82 / 1,278,756 B |
| Static icons only | 73 | 2.768 / 5.970 s | 82 ms | 0.890 / 1.076 s | 82 / 1,270,979 B |
| Icons + no homepage prefetch, repeat | 71 | 2.775 / 5.913 s | 197 ms | 0.624 / 0.981 s | 60 / 952,827 B |

The first no-prefetch observation scored 48 with 1,024 ms TBT: a single raw
Layout task took **658 ms**, versus **47 ms** in the icons-only run. It is
retained in evidence, not silently discarded. The unchanged repeat above is
the confirmation observation. Local Lighthouse **does not establish an LCP
score improvement**; it establishes removal of the speculative sheets and
15 RSC requests, about **326 KB less** automatic transfer, and elimination of
fixed homepage proxy waits. Static masks finish in about 2–3 ms locally.

The remaining local Lantern tail is Clerk's redirected browser bundle at
roughly **5.84–5.99 s**. The two existing logo PNG masks also finish around
**5.5–5.8 s** in that simulation. Those are explicit remaining candidates;
no untested font, logo or auth change is included. Local node timings are in
`lantern-critical-nodes.json`.

## Verification

- Final production build passes compilation, TypeScript and route generation.
- **63 focused tests pass**: CSS ownership/generation/watching, SEO/schema and
  the new icon finish/markup parity tests. The latter compare every non-URL
  image attribute against the former IconDisplay output.
- All ten final emitted CSS budgets pass: Home **71,372 / 75,000 B gzip**;
  Books/Rules **106,644 / 110,000 B**; tool routes remain within their budgets.
  The scanner-parity correction removes 1,333 B from each local route compared
  with the profiling-artifact-contaminated build, not a claimed production gain.
- Scoped ESLint has no errors. One `next/no-img-element` advisory is retained:
  the component deliberately preserves the existing lazy SVG image markup,
  rather than introducing a new image-processing route or dimensions.
- CUA desktop 1280 px and phone 390 px checks pass Home→Books→Home, all five
  masks/finished images, the forge jump target, mobile Library's three public
  links, Books bottom scrolling and no horizontal overflow. No console error;
  the expected development Clerk warning remains. Parent saved the screenshots
  and restored the viewport. No game record or draft was saved.

Build/test/lint logs:
`/tmp/swordweave-perf-trace-{baseline,icons,prefetch,final}-build.log`,
`/tmp/swordweave-perf-trace-final-tests.log`,
`/tmp/swordweave-perf-trace-lint.log`.

## Deployment and production measurement

The normal Git push deployed commit
`952b3847e70e4cb1c78a4c7fe56201e993ba95f6` as
`dpl_87476gGVXaV7o71QHFKR3HNKgywn`. Vercel metadata confirms **Ready**, that
exact SHA and the canonical `www.swordweave.quest` alias. A fresh canonical GET
returns 200/PRERENDER with the new static icon references and without the fixed
cube's old proxy URL. Deployment metadata and the served HTML are saved beside
the traces.

Two sequential fresh-browser mobile runs used the same Lighthouse 13.5.0
settings as the baseline. A separate desktop preset run follows them:

| Live observation | Performance | Simulated FCP / LCP | TBT | CLS | Raw H1 LCP |
| --- | ---: | --- | ---: | ---: | ---: |
| Baseline mobile 1 | 63 | 3.358 / 8.326 s | 73 ms | 0 | 3.381 s |
| Baseline mobile 2 | 65 | 3.430 / 8.216 s | 70 ms | 0 | 2.470 s |
| Published mobile 1 | 76 | 2.551 / 5.242 s | 95 ms | 0 | 1.087 s |
| Published mobile 2 | 69 | 2.448 / 6.601 s | 150 ms | 0 | 2.455 s |
| Published desktop | 97 | 0.619 / 1.281 s | 0 ms | 0 | 1.062 s |

Both published mobile observations improve simulated LCP, by approximately
**1.6–3.1 seconds** across these observations. The difference between repeats
is material; this is an observed lab improvement, not a guaranteed score or
a field Core Web Vitals pass. Mobile LCP still needs work. TBT also varies
and is slightly higher in these two runs; no claim of improved TBT is made.

The intended delivery change is consistent in both published mobile traces:

- Requests **79 → 57** and total transfer approximately **1,277 → 945 KB**.
- Automatic RSC requests **18 → 3**; the remaining three request the current
  homepage, not the removed automatic linked-route prefetches.
- Stylesheets **7 → 5**: no reader/tool stylesheet loads before interaction.
- Fixed game-icon proxy requests **5 → 0**; five static mask files replace them.

`published-comparison.json` records the request lists, transfer sizes and
metrics. The three complete reports are `production-home-candidate`,
`production-home-candidate-repeat` and `production-home-candidate-desktop`,
each with saved trace and network log. Independent remote PageSpeed
verification is recorded by the parent task separately.

### Remaining critical path

Official Lantern recomputation reproduces all three published LCP values
exactly. In the slower mobile repeat, the optimistic/pessimistic estimates are
**6,300 / 6,902 ms**. The old prefetched reader/tool sheets are absent. Clerk's
`ui-common` script (about 134 KB transferred) instead ends at **5,951 / 6,552 ms**;
its vendor/subscription UI delivery ends at **6,251 / 6,853 ms**, followed by
CPU work. The faster observation's graph ends in the initial application
script chain at 5,242 ms. Both observations and their node timings remain
available in `published-lantern-critical-paths.json`; the slower result is not
discarded.

The repeat transfers roughly **278 KB of first-party scripts** and **347 KB
of Clerk scripts**. Lighthouse estimates 267 KiB unused JavaScript, largely
Clerk UI/core plus the React and shared-Clerk application chunks. The next
substantive optimization should investigate supported auth/runtime loading
boundaries on public readers, while testing native Manage account, sign-in,
sign-up, signed-in display and client navigation. This is an investigation
proposal, not justification to repeat the rejected `prefetchUI=false` change
or disable account behavior. The two existing logo masks total roughly
118 KB and are a secondary asset candidate; no unreviewed logo change ships.

No local server was needed for these published checks; port 3010 remains off.

### Independent PageSpeed service checks

The parent also ran the remote PageSpeed service through its actual browser UI,
independently of the local CLI. All reports use Lighthouse 13.5.0 / Chromium
153 and the mobile Moto G Power / Slow 4G preset. Exact calculator-link values
are recorded below; the UI rounds milliseconds in its metric cards.

| Remote report / Bucharest time | Mobile score | FCP / LCP | TBT | CLS | Desktop result |
| --- | ---: | --- | ---: | ---: | --- |
| [Before, apsravokmc](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/apsravokmc?form_factor=mobile), 09:34 | 65 | 3.322 / 8.551 s | 20 ms | 0 | Not reread in this pass |
| [Published, kwnltcrkti](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/kwnltcrkti?form_factor=mobile), 10:23 | 77 | 2.155 / 5.251 s | 75 ms | 0 | 99; LCP 0.961 s; TBT 0 |
| [Repeat, rqxxwg7p1c](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/rqxxwg7p1c?form_factor=mobile), 10:25 | 69 | 2.293 / 6.903 s | 125 ms | 0 | Service error: net::ERR_TIMED_OUT; no valid metrics |

Both valid remote mobile observations improve LCP versus the dated baseline,
by approximately **1.65–3.30 seconds**. The slower repeat stays in the result.
Mobile is improved, not finished: it still exceeds a good LCP target and has
material run-to-run variation. The independent CLI desktop result (97) and
first remote desktop result (99) both remain fast. The second remote desktop
timeout is retained as a failed test, not a zero score or a hidden success.
A subsequent ordinary canonical HTTP control returned 200/HIT. Read-only DNS
checks found the expected Vercel CNAME/A records and no conflicting AAAA record;
no DNS or security change was made from that isolated service failure.

Both valid remote mobile reports retain **100 Accessibility / 100 Best
Practices / 100 SEO**. Neither report has CrUX field data, and the Agentic
Browsing audit is not evidence that ChatGPT search can retrieve or cite the
site. The separate provider-reader problem remains documented.

Production release smoke verifies **17 HTML pages + 17 Markdown alternatives**:
200 responses, correct canonical/alternate pairs, one H1, parseable structured
data, inline Markdown and the expected page surfaces. Robots, llms index and
17-URL sitemap return 200; unknown and saved-record Markdown controls return
404. All five new homepage mask/finished-image pairs are in the actual served
HTML. Desktop/phone UI checks retain the design and navigation; a settled
390-pixel Books session reaches its final paragraph and footer with body
overflow visible and no horizontal overflow. No game record was saved.

Parent evidence is under
`output/marketing/follow-through-2026-10-22/`: the dated PageSpeed snapshots,
report URLs, `production-release-matrix.json`, production screenshots and the
bounded consent-transport diagnostic. The verification script normalizes the
equivalent root canonical forms with/without a trailing slash; it required no
website canonical change. Both local test servers (3010 and 3192) are stopped.
