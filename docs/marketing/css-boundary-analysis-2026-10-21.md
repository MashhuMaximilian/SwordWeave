# Rejected public/tool CSS split · 21 October 2026

**Decision: do not ship.** The experiment substantially reduced homepage CSS,
but made direct entry to the Atelier materially heavier. Its implementation,
generated styles, new layouts, build scripts and tests were removed before
publication. `layout.tsx` again imports the existing `root-styles.css`; all 45
canonical stylesheet sources remain unchanged. The independent font/resource-hint and structured-data changes are outside
this rejection. Clerk UI deferral was separately tested and also rejected; its
standard UI loading is restored.

The latest published mobile laboratory result remains performance 63, FCP 4.1
seconds and LCP 7.8 seconds. The visible homepage H1 was its LCP element.
Render-blocking CSS remains a major observed bottleneck. No new mobile score,
field improvement or complete visual regression pass is claimed by this
experiment.

## Actual production-build result

These are sums of individually compressed emitted production CSS files, not
observed network transfers or field measurements. Root styles, route styles
and relevant component styles must all be counted for each route.

| Route / CSS delivery | Existing build | Rejected candidate |
| --- | ---: | ---: |
| Homepage gzip | 223,152 B | 143,145 B |
| Direct Atelier gzip | Approximately 240 KB | 347,178 B |

The homepage reduction was 80,007 bytes, about 36%. The Atelier instead received
both the retained public root bundle (136,958 gzip bytes) and the literal full
restoration bundle (185,233 gzip bytes), plus other shared/route styles. That
roughly 100 KB tool-route regression defeats the delivery goal. Next.js did not
remove the cross-bundle duplication merely because the declarations matched.

Parent evidence is retained in the ignored `output/marketing/mobile-followup/`
folder, including `baseline-css.json` and `candidate-css.json` for the homepage.
The integrated candidate build log is
`/tmp/swordweave-mobile-candidate-build.log`. These are local experiment artifacts;
they are not a deployed release or an ongoing generation workflow.

## What the experiment established

The dominant canonical file is `src/app/v12.css`: 737,338 source bytes. A
conservative selector parser could exclude 3,227 complete rules from public
readers while retaining generic rules, tokens, fonts, shared shell/dialog
classes, unknown families and unmatched selector syntax. Its generated public
V12 subset was 140,230 source bytes. Source gzip fell from 106,652 to 28,572
bytes and source Brotli from 79,205 to 23,863 bytes. Those source-only figures
were insufficient to establish an acceptable whole-site release.

Rules were classified only if every selector alternative necessarily required
a closed authoring, archive, source-browser or play-sheet class. Commas and
`:is()`/`:where()` were treated as OR branches. `:not()` and `:has()` arguments
could not establish ownership. Literal classes from the public render graph
were protected, including static imports, re-exports and literal dynamic imports.
The audited graph contained 90 TypeScript modules and 345 class-like tokens.
The broad public `sw-character-*` and homepage `sw-forge-node*` families remained
public. The exact root CharacterModal-to-lazy-editor import edge was excluded
because the FAB opens that editor only on the Atelier.

The candidate restored all 45 original stylesheets through 17 tool server
layouts covering 37 page source files, including anonymous Library and public
character viewers. A literal concatenation avoided module-import deduplication
that could otherwise drop later overrides. Only root Tailwind compiler inputs
were omitted. Nine focused tests and scoped ESLint passed. An independent parse
matched all 27,111 non-compiler declarations and their complete selector,
condition, layer and keyframe context in original order. Both original and
restoration records had SHA256
`9722ded7fb85c9534e2c8578052ae2bfe85da15e24a4daa0b633191bfbcf7e46`.

That established source preservation, not acceptable delivery cost. The full
restoration copy duplicated much of the public stylesheet payload. Its source
was 1,439,655 bytes / 222,964 gzip / 164,679 Brotli. The emitted route measurements
exposed the material regression, so passing source tests did not justify release.

A strict identical-value declaration cleanup was also considered, but saved
only about 127 compiled Brotli bytes in V12. It is not the main solution.

## Required architecture for a later attempt

A correct boundary must give each declaration a shared, public-reader or tool
owner and deliver it once per route. Shared variables, fonts, materials, FAB,
account, consent and persistent overlay chrome belong to a small common root.
Reader and tool styles should follow their server/page/component owners. This
requires moving or consolidating the existing override chains, rather than
loading a smaller root and replaying the complete old root afterward.

Source order is material. Known equal-selector/property conflicts include:

- `compact-mobile.css:117` versus `encounters.css:553/651/686` entry grid/gap.
- `compact-mobile.css:131/133` versus `live-encounter.css:73/191/192/198` controls.
- `compact-mobile.css:102` versus `visibility-choices.css:4/14` choice geometry.
- `v12.css:4203` versus `creations-tabs.css:20` archive tab height.
- `v12.css:9276/9280` versus `character-randomizer.css:43/78–80` scaling controls.

For each component family, move its later corrections into the same explicit
owner or prove its complete ordered declaration closure. Keep route-specific
styles after their shared/layout dependencies. Unknown selectors and newly
added UI routes need an explicit safe owner; unsupported automated purging is
not a substitute for that work.

CSS lifetime must also be proved. The character draft store and modal shell
persist at the root, while the editor is lazy. A route transition must not remove
styles still needed by an open or reopened overlay, nor display tool content
before its stylesheet is available. Do not assume that Next.js retains route
styles: inspect emitted resources and test direct entry, public-to-tool client
navigation, tool-to-public return, back/forward navigation and overlay reopen.
The same proof applies to embedded monster/encounter editors and the character
sheet's play-guide dialog.

A future candidate needs both source/cascade checks and compressed payload
budgets for homepage, Rules, Books, anonymous Library, Atelier, public character,
monster and encounter routes. A homepage improvement cannot be paid for by a
material tool regression. Then compare desktop and phone, light and dark themes,
menus, consent, readers, selected mechanical-rule contrast, drafts and persistent
overlays against the existing compiled baseline. Only after those checks pass
should publication and a comparable PageSpeed measurement follow.
