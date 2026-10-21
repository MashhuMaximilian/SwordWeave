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

## Homepage follow-up and Books scrolling

The first published split (`9af53a39`) measured mobile **67–73**, LCP
**5.4–7.4 s**, across two fresh lab reports; desktop was **98**, LCP **1.0 s**.
The mobile work remains open: fewer transferred bytes alone did not establish
an acceptable loading result. A separate Books observation measured **71**,
LCP **7.0 s**. Its LCP element is the intro paragraph, rendered in the already
preloaded Aubrey font; adding more font preloads is not an evidenced fix.

The next candidate gives the homepage a third generated surface. Its closed
graph follows 48 local modules and protects 202 project classes plus constructed
class prefixes. It excludes only the unreachable lazy editor body and sheet-only
Play guide. Unknown classes and selector alternatives remain; opaque visual HTML
and nonliteral lazy imports require review. Reader/tool ownership is unchanged.

Actual home → Books navigation exposed a cascade regression that a fresh Books
load did not: retained component CSS preceded the newly loaded reader cascade.
The reader now restores the two small shared plain component sheets (Books and
PublicNav), with their original declaration order/specificity and reader guards.
The source gzip cost is 4,876 B. This is deliberately not a full-theme replay.
Generation discovers these imports, rejects unsafe relocation, skips CSS modules,
and watches both source sheets in development.

Six existing below-screen homepage sections also use supported automatic content
visibility with remembered intrinsic heights. The hero, navigation, overlays and
ending remain fully rendered. Expanded clipping preserves existing card glows;
print and unsupported browsers retain normal layout. Jump links, section content
and reaching the ending are browser checked. This follows the browser's
[documented automatic rendering behavior](https://web.dev/articles/content-visibility),
without removing content from the server HTML or Markdown.

The founder reported Books clipping on localhost:3181, whose server was stopped
when checked. Fresh canonical Books sessions reach the full final paragraph and
footer in dark mode at 390×844 and 1440×812, with 90 px bottom padding. Thirteen
public pages reach their footer without horizontal overflow at both phone and
desktop widths. The reported state-specific cutoff has not been reproduced;
it is not marked fixed and no speculative global overflow override was added.

The concurrent compact-core book release `b142bc47` was fetched and preserved
before the final integrated build. Its downloads, page copy, schema/Markdown
updates and analytics contract are included in the regression checks.

Integrated production-build gzip totals: Home **71,451 B** (68.0% below the
original 223,177 B); Rules/Books **106,723 B**, Contact **103,783 B**, Press
**105,001 B**, Atelier **241,149 B**, public character **228,972 B**. All ten
route budgets pass; Home now has a 75 KB ceiling. The build and 76 focused tests
pass, as does scoped lint. All 17 local HTML/Markdown/schema/surface pairs pass;
unknown/private Markdown probes return 404. Generated artifacts remain ignored.

Final desktop and 390 px phone browser checks confirm Books card margins
(`h2: 0 0 12px`, description `0 0 24px`), normal bottom scrolling after the
editor/dialog journey, homepage deep-link position, interactive approach
selection and full page ending. No draft or game record was saved. The new
candidate's live performance measurement is still required after deployment.

### Published result: performance still open

Application commit `e7e2b316` is live in Ready deployment
`dpl_Bba3GvWfj5LKKCm3W2fWTnstprWH`. The Git push did not create an automatic
deployment within the verification period. A Git-based redeployment of the exact
commit was started through the existing project; its settings and environment
were inherited. Do not claim that the automatic push trigger is verified.

Both canonical HTML/Markdown/schema/CSS matrices pass (17 pairs), as do the four
compact-PDF HTTP checks. Production Home serves the `home` marker and 71,372 B
of gzip-compressed stylesheet bodies (local manifest counting: 71,451 B).
Actual published Books reaches the full ending/footer at 1440×812 and 390×844
with 90 px bottom padding and normal body overflow. Original theme/viewport are
restored, the temporary server is stopped and no game record was saved.

Two new mobile reports, **18:02** (`xgpeqi56am`) and **18:07** (`0e5t83xp7r`),
measure **68 / 65** Performance, FCP **2.8 / 3.3 s**, LCP **7.2 / 8.6 s**,
TBT **0 / 25 ms**, CLS **0 / 0** and Speed Index **5.2 / 5.3 s**. Desktop in
the first report is **98**, FCP **0.32 s**, LCP **1.06 s**, TBT **50 ms**,
CLS **0**, Speed Index **0.58 s**. Accessibility, Best Practices and SEO stay
**100**; Agentic Browsing is **3/3**. There is still no field dataset.

The smaller payload is established, but **better mobile loading is not**.
The first new audit's render-blocking estimate is 150 ms and unused CSS falls
from 59 KiB to 31 KiB. Its remaining LCP element is the hero H1. The raw audit
render delay is 2,430 ms; that and raw network dependency times must not be
subtracted from simulated Lighthouse metrics. No hidden ancestor, reveal
animation, font wait or explicit auth/content gate was found in source or SSR.

The second report's visible script treemap totals 628.2 KiB transferred.
Clerk core and UI entries account for roughly 340.6 KiB, including UI chunks
unused on the landing page. This is a measured delivery candidate, not proof
that Clerk causes the LCP delay. Headless Clerk was previously rejected because
it breaks native account UI; no speculative auth rewrite is included here.
The next mobile task needs a throttled performance trace identifying pre-paint
work and resource timing before changing bootstrap or shared application state.
Evidence is saved under `output/marketing/mobile-second-pass/`.

### Founder confirmation

After confirming the cutoff had also affected production, the founder checked
the current live build on 21 October and replied “all good now.” Close the
reported Books symptom as user-verified on the current release. Its exact
original cause was not established; no additional scroll-lock refactor or
global overflow override was made. Mobile performance remains open.
