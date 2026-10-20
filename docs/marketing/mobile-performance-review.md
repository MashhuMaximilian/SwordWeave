# Mobile performance review · 20 October 2026

Scope: improve public-page loading without changing the homepage hero, visible copy, fonts, colors, FAB, or rules. Book consistency remains work in progress and is outside this change.

## Measured baseline

[PageSpeed mobile report](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/u0d0xicwze?form_factor=mobile): performance 59, FCP 4.0 s, LCP 9.2 s, TBT 210 ms, CLS 0. The LCP element was `h1#home-title`. This was one Lighthouse 13.5.0 run using an emulated Moto G Power and slow 4G; no CrUX field data was available. It is a laboratory baseline, not a measured ranking or real-user Core Web Vitals result.

The report identified 237.8 KiB of blocking CSS, approximately 180 KiB of unused CSS and 309 KiB of unused JavaScript. Source inspection found:

- `src/app/layout.tsx` imports 44 local CSS files totaling 1,403,102 source bytes, before third-party CookieConsent CSS and compilation. `v12.css` alone is 737,338 source bytes. Tool and character styles therefore reach public pages.
- `AppShell` eagerly imported `CharacterModal`, which eagerly imported `TabbedCharacterForm` and its authoring dependencies even while the modal was closed.
- `GlobalControls` eagerly imported the full play guide for a closed character-sheet panel on every route.
- The root layout preloaded ten fonts, including legacy Teko/Magra and three IBM Plex Mono weights. The current public hero does not use those six files.

Source bytes, compiled JavaScript bytes and Lighthouse transfer estimates measure different things; they must not be added together.

## Implemented, with the existing appearance preserved

- Keep the character provider, modal shell, navigation guards and close controls eager. Load its form through `React.lazy` only when opened.
- Load the embedded FAB play guide only when opened. `/rules` retains its direct import and server-rendered guide. Both deferred panels have a loading status and a contained error fallback.
- Set `preload: false` for the two legacy font declarations and IBM Plex Mono. Their actual font faces remain available on demand. The four current public display/body fonts retain their preloads.
- Leave all CSS declarations, markup classes, existing copy and font choices unchanged.

### Production-build comparison

Before is the existing production build at `a0deed9d4c997c6a16c6f5480ca4253a6c8101df`. After is the same worktree with the three performance source edits, built with Next.js 16.2.10. Route: `/`.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| First-load JavaScript, uncompressed bytes | 1,201,816 | 874,106 | −327,710 / −27.3% |
| Sum of per-chunk gzip bytes | 358,362 | 262,138 | −96,224 / −26.9% |
| Sum of per-chunk Brotli bytes | 311,186 | 228,594 | −82,592 / −26.5% |
| First-load JavaScript chunks | 24 | 20 | −4 |
| Root font preloads | 10 | 4 | −6 |
| Bytes in preloaded font files | 127,552 | 63,760 | −63,792 / −50.0% |

JavaScript paths come from `.next/diagnostics/route-bundle-stats.json`; font paths come from `.next/server/next-font-manifest.json`. Gzip/Brotli values are local compression estimates, not observed Vercel network transfers. The deferred editor chunk no longer occurs in the homepage first-load list. An improved LCP or PageSpeed score still requires a comparable post-deployment measurement.

Local evidence, excluded from Git: `output/marketing/mobile-bundle-before.json` and `output/marketing/mobile-bundle-after.json`.

## Validation

- `npx --yes pnpm@10 build`: passed, including TypeScript and static generation.
- `npx --yes pnpm@10 exec vitest run src/components/character-modal/__tests__/navigation-approval.test.ts src/components/character-modal/__tests__/edit-character-id-invariant.test.ts src/components/character-modal/__tests__/draft-comparison.test.ts`: nine existing invariant tests passed.
- Focused ESLint: `layout.tsx` clean. The other two touched files have the same eight pre-existing errors and one warning as their `HEAD` versions, verified by running ESLint against `git show HEAD:<path>` through stdin. Existing effect/ref diagnostics and a memo-dependency warning were not suppressed or expanded into this task. No new rule/message findings.
- `git diff --check`: passed.
- Desktop/mobile browser checks, deployed-build confirmation and a fresh PageSpeed run belong to the final release verification; record their results separately rather than treating this bundle comparison as browser proof.

## Reproduce the bundle comparison

Run on each production build, before overwriting `.next`; save the printed result separately for each revision. The old build's manifest paths alone cannot reconstruct chunk sizes after its files have been removed.

```sh
npx --yes pnpm@10 build
node <<'JS'
const fs = require('node:fs');
const zlib = require('node:zlib');
const route = JSON.parse(fs.readFileSync(
  '.next/diagnostics/route-bundle-stats.json', 'utf8'
)).find(row => row.route === '/');
const js = { raw: 0, gzip: 0, brotli: 0 };
for (const file of route.firstLoadChunkPaths) {
  const bytes = fs.readFileSync(file);
  js.raw += bytes.length;
  js.gzip += zlib.gzipSync(bytes).length;
  js.brotli += zlib.brotliCompressSync(bytes).length;
}
const fontManifest = JSON.parse(fs.readFileSync(
  '.next/server/next-font-manifest.json', 'utf8'
));
const fonts = fontManifest.app['[project]/src/app/page'];
console.log(JSON.stringify({
  route: '/', ...js, chunks: route.firstLoadChunkPaths.length,
  preloadedFontCount: fonts.length,
  preloadedFontBytes: fonts.reduce(
    (sum, file) => sum + fs.statSync('.next/' + file).size, 0
  ),
  paths: route.firstLoadChunkPaths, fonts,
}, null, 2));
JS
```

## Remaining priority: CSS boundaries

The main blocking-CSS debt remains. `v12.css` mixes shared body tokens, font aliases, backgrounds, heading/control rules, FAB/modal styles and workspace rules throughout 9,294 lines. Moving that file wholesale to `/atelier` would change public pages and public character sheets. Moving global imports independently could also alter the cascade. This release deliberately avoids that uncontrolled visual change.

The next safe refactor is to inventory shared selectors, extract a common foundation and move component/route styles behind explicit boundaries while preserving declaration order. Start with styles used exclusively by one tool or deferred panel; retain tokens, public navigation, FAB and shared overlays in the root. Compare production CSS manifests before and after. Verify home, rules, books, a complete public character sheet, Atelier and the character workshop on mobile/desktop in both themes, including direct entry and client navigation. Only then deploy and rerun the same mobile PageSpeed scenario. Do not remove styles merely because a homepage coverage sample marks them unused.
