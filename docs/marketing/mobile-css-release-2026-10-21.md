# Mobile CSS delivery · 21 October 2026

The previous mobile lab result was 68 performance, FCP 2.9 s, LCP 5.9 s and TBT
240 ms. That remained too slow. This pass removes editor CSS from initial public
reader delivery while retaining the current design, content, fonts and tools.

## Implementation

- `globals.css` and Tailwind stay in the root. The existing 44 subsequent source
  sheets and their order remain canonical in `root-styles.css`.
- Reader and tool server layouts load separate generated bundles before their
  page/component styles. The homepage owns its reader import. The global 404
  theme loads only when that fallback renders; it does not preload tools on
  every reader.
- `RootHtml` server-renders the route's CSS marker and updates it with client
  navigation. Guards add zero selector specificity and require no `:has()`.
- Reader extraction removes 5,899 rules whose every selector alternative
  positively requires a closed tool class absent from the public render graph.
  The graph follows local imports, re-exports and literal dynamic imports, and
  protects dynamic class prefixes. Unknown families and unsupported exclusion
  evidence stay. The exact lazy character-editor dependency is outside that
  graph; its persistent shell remains included.
- The tool bundle retains the complete ordered declaration sequence. Shared
  rules are guarded; tool-only rules can remain unguarded. This matters because
  Next retains styles during client navigation: an unguarded replay could beat
  existing Books, Contact and Press page overrides. Independent review found
  concrete equal-specificity examples, which this guarded version addresses.
- Persistent character, nested stack and icon-picker portals keep their tool
  ownership after a reader transition. Existing draft state is retained.
- Build generation is deterministic and fails closed on unknown compiler
  directives, relative asset URLs or changed canonical entry counts. `pnpm dev`
  watches canonical CSS and reader sources and regenerates changed artifacts
  without compression work or a feedback loop. Generated files are ignored.
- `pnpm perf:css` checks whole emitted route bundles after a production build.

This is route code splitting, not a claim that total downloaded CSS always
decreases across a complete session. Crossing from a reader into a tool loads
that second bundle once; both can stay cached. Direct tools do not receive a
second public-root replay. No runtime auth or firewall behavior changed.

## Production-build payloads

These are sums of gzip-compressed emitted files, not browser transfer or field
Web Vitals. Every shared, layout and component stylesheet is counted.

| Route | Previous | Candidate | Change |
| --- | ---: | ---: | ---: |
| Homepage | 223,177 B | 101,318 B | −54.6% |
| Rules | — | 101,318 B | within 110 KB budget |
| Books | — | 101,318 B | within 110 KB budget |
| Contact | — | 99,026 B | within 110 KB budget |
| Creator kit | — | 99,596 B | within 110 KB budget |
| Atelier | 241,977 B | 240,846 B | −1,131 B |
| Public character | 229,800 B | 228,669 B | −1,131 B |
| Library browser | — | 235,347 B | within 245 KB budget |
| Monsters | — | 235,347 B | within 245 KB budget |
| Encounters | — | 233,192 B | within 245 KB budget |

## Verification before push

- Final production build passes compilation, TypeScript and static generation.
- 66 focused CSS ownership/generation/watcher, SEO/schema/Markdown and analytics
  tests pass. Tool declaration/context/order equality, reader subsequences,
  specificity, sibling/OR/negation cases and graph traversal are checked.
- ESLint checks 47 changed/new source files. The six errors and one warning in
  the two touched legacy components reproduce on unchanged HEAD with the same
  rules, messages and offending source expressions. Other checked files pass.
  These lifecycle/ref/image issues are not suppressed or folded into this patch.
- All 17 HTML and 17 Markdown destinations pass local status, canonical, H1,
  schema, surface-marker and format checks. Unknown book SSR fallback behavior
  matches production's existing Next error-stream fallback; it is not counted
  as a new successful reader or invented fix.
- Actual browser checks use 390 × 844 and 1280 × 900. The matched homepage
  desktop content has no computed-property changes; phone differences are the
  five animated forge shadows sampled at different animation times. Tool
  comparisons expose hover/tooltip and route-announcer state differences,
  rather than falsely calling all DOM snapshots identical.
- Books margins, Contact typography and Press heading values remain identical
  before/after tool round trips. Reader → Atelier → reader/back transitions
  switch the HTML marker correctly. The persistent character workshop stays
  open and retains identical sampled typography/materials on the reader.
- Phone mechanical-rule flow produces **Add +1 to Attack Roll**. Only that
  temporary unsaved primitive is reset; no game record is saved. Character
  workshop tabs and disabled-create validation work; existing draft fields are
  untouched. Cookie preferences open without changing consent. Light theme
  survives client navigation; Rules search returns six topics for `strain`.

Local evidence: `output/marketing/mobile-second-pass/`; build/test logs:
`/tmp/swordweave-mobile-second-final-{build,tests}.log`. The previous full-suite
baseline still has 151 known failures, separately reproduced on unchanged code;
this pass does not claim a full green suite.

## Still open

1. Measure the deployed build on mobile/desktop. Lab gains are provisional until
   real reporting becomes available; editor delivery and interactions still
   deserve their own ongoing performance budgets.
2. Correlate actual ChatGPT retrieval requests; ordinary HTTP access and correct
   schema do not prove ChatGPT retrieval or citation. Keep existing protections.
3. Confirm Bing Webmaster indexing and review processed Search Console/Google AI
   reports, actual referral traffic and acquisition/action reporting.
4. Reconcile existing test/lint maintenance separately. Founder playtests,
   itch.io polish and personal outreach remain on the founder's timetable.
   Video production remains deferred.
