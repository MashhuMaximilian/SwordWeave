# Review of the creator and teaching release

20 October 2026 · Reviewed release `fc094b2c`. Review only: no website code, book sources, accounts, DNS, records or deployment changed in this pass.

## Verdict

The release is a partial teaching implementation and a starter media kit. Its routes, text exports and downloads work in the recorded browser checks, but it does not meet the intended instructional and material quality. The earlier board's “Live; verified” labels confused technical checks with product acceptance. Reopen the affected work rather than count the pages as finished.

The founder approved the latest faster conversational voice audition. That approves the voice direction, not a full script or edited video. No finished pilot, tutorial recording or timed captions exist.

## What was reviewed

Three independent source reviews covered teaching content, creator assets, and templates/navigation/Markdown. The parent inspected the live Rules, Creating and primitive tutorial layouts. Source references below identify the actual implementation rather than a future proposal. The bundled design context loader and one isolated detector attempt both failed with permission denied; no detector result or injected browser overlay is claimed. The review uses source, actual assets and browser evidence.

## Findings and corrections

| Priority | Finding | Evidence | Required correction / acceptance |
| --- | --- | --- | --- |
| P1 | Primitive tutorial does not use Rules' UI or behavior. | `src/app/tutorials/create-a-primitive/page.tsx:25`, `tutorial.css:26`; compare `src/components/rules/play-guide.tsx:53`. | Use the same learning shell: searchable index, selected topic, active state, expandable detail, previous/next, source links and phone topic navigation. A similar header and CSS classes are insufficient. |
| P1 | Creating is a sparse third presentation of a Rules topic. It has a large empty gap, no index/search/step navigation, and nine prose sections. | `src/app/creating/page.tsx:10`; live desktop inspection. | Give it a distinct worked-composition job, using the shared Rules reader. Lead with reusable permissions and decisions, then explain authoring, editing and publishing. |
| P1 | Neris is an inventory/treatment summary rather than a complete construction walkthrough. | `src/app/character/page.tsx:29–40`. | Show concept → actual attributes/proficiency → origin choices and why → checked acquisitions/BU deduplication → one saved capability → resolved use and explicit sheet changes. The existing sheet links remain useful supporting material. |
| P1 | Reuse is asserted more than demonstrated. | `src/lib/rules/play-guide.ts:910`. | Place the same owned ingredient list beside several legal intents. Show what changes in scope/resolution/use Cost while acquisition ownership stays unchanged. Explain ordinary actions, already-owned access and genuinely missing access before editor/publishing instructions. |
| P1 | New encounter example does not resolve the promised combat workflow. | `src/app/combat/page.tsx:42–50`. | Keep the valid nonviolent approach. Add one clearly labelled hostile branch with checked actual bonuses, dice totals, a legal reaction, resolution and before/after state. No invented playtest claims or assumed encounter balance. |
| P1 | Two public explanations conflict with current Rules wording. | `src/app/combat/page.tsx:22` says movement belongs to an intent; Rules `play-guide.ts:456` permits independent movement when circumstances allow. `src/app/start/page.tsx:17` implies upkeep at the start of each turn; Rules `play-guide.ts:668` uses an agreed continuation point. | Correct both website explanations against the approved shared-round procedures. This is website consistency work, not a rewrite of the founder's books. |
| P1 | First-session checklist is appended after “Where to go next” and names materials without linking them. | `src/lib/rules/play-guide.ts:82`; `src/components/rules/play-guide.tsx:12`. | Make preparation a clear entry within Rules, with linked reading order, character, encounter, downloads and feedback. Distinguish essentials from optional references. Preserve the full existing Rules page. |
| P1 | Standalone worksheets/build companion were not produced. | `public/press/press-kit.json:154–175`, `src/app/press/page.tsx:79–87`; ZIP contains zero standalone PDFs. | Retain the JPEGs under book previews if useful. Add separately authored, short printable/fillable resources; do not rename a book-page image into a completed independent resource. |
| P2 | Creation navigation is ambiguous and incomplete. | `src/components/home/public-nav.tsx:36`: “Create” links to `/character`; no `/creating` or primitive tutorial item. | Explicit guide/tool destinations in desktop and phone navigation, with active-parent state. Keep Rules directly accessible. Avoid adding labels to an already crowded row without responsive treatment. |
| P2 | Creator kit has no primary navigation entry. | Footer, About and Contact link it; `PublicNav` does not. | Add a clear “Creator kit” navigation destination on desktop and phone. It is currently low-visibility rather than completely orphaned. |
| P2 | Gradient navigation mark is missing from downloadable assets. | `src/app/public-guide-refinements.css:3` supplies the gold/teal gradient through the existing logo mask; the kit has only three flat PNG marks. | Export the exact existing gradient mark as a transparent, usable asset, with suitable resolutions and a preview; add it to the kit manifest/ZIP. Do not generate a substitute logo or redesign it. |
| P2 | Kit reuse/version instructions need finishing. | `public/press/asset-notices.md:17`, hardcoded visible date `press/page.tsx:27`, screenshot provenance `press-kit.json:183`. | Explain the intended editorial use of each supplied asset under the founder's existing rights. Derive the visible date from the data; record source snapshots and kit revision consistently. No blanket new art license. |
| P2 | Technical checks were reported as broader acceptance than they establish. | Existing board and tests. | Track implementation, functional verification, instructional review and founder acceptance separately. A correct ZIP hash or no horizontal overflow does not establish a useful kit or coherent guide. |

## Current access paths

- `/creating`: Rules header's “Learn to create, edit and fork”, Character example CTA, Press text, or the primitive tutorial's return link. The same source topic is also inside Rules under “Create, edit & fork”. It is absent from the public menu and has no active menu item.
- Primitive tutorial: Creating's bottom tutorial card or the editor's contextual help. The equivalent Rules topic does not contain that bottom card because it is outside shared content.
- `/press`: footer, About and Contact; not desktop/phone public navigation.
- Public “Create”: `/character`, an explanatory page. Actual character creation is `/characters/new`; the Atelier is `/atelier`. These destinations need unambiguous labels.

## Markdown: what is true and what remains unverified

The pages are not gated behind a download interaction. The route returns `Content-Type: text/markdown; charset=utf-8`, with no `Content-Disposition: attachment`. Visible links use the HTML `download` attribute, which asks the browser to save the response. An HTTP-reading AI client requests the explicit `.md` URL directly and does not need to click that link.

The HTML advertises a Markdown alternate and the llms index links the exports. HTML remains canonical; noindex on duplicate Markdown does not create an authentication gate. This configuration does not guarantee that an AI product will fetch, index or cite the text.

Recorded production downloads of Press and the tutorial are genuine delivery evidence. Route tests mock editorial HTML and invoke the handler directly, so they do not prove all production rewrites, CDN/security behavior, all 16 pages' live parity or retrieval by an AI vendor. A fresh external web-reader attempt in this review could retrieve neither `/creating` nor the nested tutorial Markdown URL; browser access works. Cause is unresolved, and it is not evidence that every AI crawler is blocked. Keep external retrieval verification open rather than claim it is solved.

When the guides move to a selected-topic reader, export all chapters from the same structured content source, as Rules already does. Extracting only the initial rendered chapter would silently shorten the new Markdown equivalents. Also note that the current local production export handler fetches canonical production HTML, so a local production test can conceal unpublished content differences.

## Proposed standalone materials

These are new deliverables, not files already created.

1. **First-session run sheet — target 2 pages.** Preparation and first-scene plan on page one; intent → access → scope/Cost → resolution → changed state, followed by useful feedback on page two. Space for writing, real labels, clickable destinations and version/date. A printable/fillable PDF and equivalent HTML/Markdown. Complement the PHB's session-zero page rather than copy it.
2. **Build with Neris — target 3 pages.** Why the concept leads to these foundations; checked acquisition/BU/reuse map; one complete capability/use example plus space to plan a personal variation. Use the actual selected record and reviewed source snapshot. Annotations and teaching text are authored for this companion, not lifted as a screenshot of PHB page 53.
3. **Navigation-gradient logo asset.** Faithful export of the existing mark, transparent background, useful resolutions, clear caption/source and inclusion in the updated archive.

The website Character page must teach the construction itself; a downloadable companion is not an excuse to leave the page as a set of outbound buttons.

## Correction order

1. **Shared reader and navigation.** Extract a parameterized learning shell and common block renderer from Rules, then use it for Creating and the primitive tutorial. Do not move or replace Rules. Parameterize content, base URL, initial topic, references and next/previous actions; the current component hardcodes `/rules#…`. Add useful links inside shared content, not just a wrapper page.
2. **Instructional rewrite and consistency.** Complete the Neris construction trail, unchanged-ingredients/multiple-uses lesson, genuinely resolved combat branch and connected preparation path. Correct movement/upkeep wording. Keep advanced qualifications in appropriate detail panels so they do not overwhelm the main demonstration.
3. **Real materials and kit revision.** Author the two compact companions, render/review each PDF page, validate fillable fields and update the public kit with the exact gradient mark. Keep PHB excerpts explicitly under book previews. Review allowed editorial reuse against existing founder notices.
4. **Acceptance and discovery verification.** Check desktop/phone behavior and keyboard/search/deep links; have a reader follow a complete task; verify all guide chapters in HTML/Markdown, actual PDF fields/printing, archive contents and real navigation paths. Separate these results from build success and from AI-vendor retrieval evidence.
5. **Video pilot.** Use the approved voice direction for one finished 20–30 second excerpt with actual editor footage and corrected teaching flow. Review that finished edit before producing the long mechanical tutorial or embedding videos.

## Other work still open

- SEO/AI discovery: technical foundation and keyword research exist; deeper priority-cluster intent review, useful reporting and independent retrieval/citation evidence remain work. Do not substitute more thin pages or special files for that work.
- Performance: previous bundle/font reductions did not solve mobile loading. Last recorded lab result remains Performance 58 / LCP 8.4 s; shared CSS is a material follow-up.
- Measurement: existing contact/auth/creation events had earlier verification. The new kit-click event has contract/consent tests, but no independently established live GA4 count. A click is not a completed download or a creator partnership.
- Videos: outlines and an approved voice direction exist; no finished video, final transcript or timed captions exist.
- Founder-deferred work: book reconciliation, uploading all three PDFs to itch.io together, personal playtests and later outreach remain intentionally deferred. Do not count those as failed deliverables from this batch.

No clarification is needed to choose the first correction pass: the founder explicitly asked for Rules-consistent UI, understandable construction, useful materials and clear navigation. Preserve the existing homepage and visual identity.
