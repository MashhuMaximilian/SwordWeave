# SwordWeave discovery and teaching work

Updated 20 October 2026. This is the current task list; older proposals in the planning documents are historical. Preserve the homepage hero and the Rules page. Book reconciliation remains the founder's work in progress.

**Acceptance correction:** the founder rejected the teaching/UI and material completeness of this release. The [delivery review](delivery-review-2026-10-20.md) supersedes earlier “Live; verified” labels for product quality. Live deployment and technical tests are retained as evidence, not acceptance.

| ID | Deliverable / owner | State | Acceptance / next dependency |
| --- | --- | --- | --- |
| WEB-01 | Mechanical editor selected-card contrast · interface agent | Live; verified | Near-black labels and helper text on bright gold. Retain light labels on dark navigation gold; check both themes and mobile. |
| WEB-02 | `/press` and downloadable creator kit · creator-kit agent | Partial starter kit; revision required | Three descriptions, actual facts, book links/status, original logos, real Neris screenshot, PHB previews, notices and reproducible ZIP. About, Contact and footer links. |
| WEB-03 | First-session checklist inside Rules · teaching agent | Implemented; preparation path revision required | Append to Your first game; preserve the complete existing guide, topic navigation and search. |
| WEB-04 | Neris character walkthrough · teaching agent | Partial summary; full walkthrough required | Replace the localized Lyra example; Neris primary, Orren advanced. Explain actual treatment, supplies and manual updates. |
| WEB-05 | Reusable primitives and encounter example · teaching agent | Partial lessons; worked resolution required | Extend shared creating topic and Combat using PHB and existing encounter records. Distinguish ownership, execution costs and table rulings. |
| WEB-06 | `/tutorials/create-a-primitive` · parent | Shared Rules reader implemented; review pending | Ten complete structured chapters, search, chapter links, steps/tables and phone behavior. Current corrected authoring instructions retained. A finished video and founder teaching review remain open. |
| AI-01 | Synchronized public Markdown · parent | Complete reader-source exports implemented; external retrieval verification open | All Rules, Creating and primitive tutorial chapters export from shared data independently of selected HTML chapter. Six structured sources; 16 curated public alternatives in total. Private/arbitrary records excluded. External crawler delivery remains Batch 4. |
| MEASURE-01 | Consented creator-kit download event · parent | Live; contract/consent tests passed | Closed `media_kit_download` event with placement/version only, using the existing consent gate; no personal data or new tag manager. No separate live GA4 count was established for this new event. |
| QA-01 | Focused tests, build and release inspection · parent | Batch 1 technically verified; founder review pending | 35 focused tests, scoped ESLint, final production build and current local browser checks pass. Earlier release acceptance remains failed; deeper teaching and materials remain open. |
| VIDEO-01 | Production brief and founder talking points · video agent | Prepared | [Production plan](video-production-plan.md) and [mechanical tutorial outline](video-scripts/create-a-primitive.md). Screen actions and talking points are primary; a read-aloud script is optional. |
| VIDEO-02 | Synthetic narration audition · parent + founder | Voice direction approved | The founder rejected both AI Doc Maker takes as slow/robotic; the second was worse. Changed engine. A first conversational attempt still measured about 147 wpm and was not presented. A fresh quick-delivery revision is 15.92 seconds, about 180 wpm, and was approved by the founder on 20 October. No MP3 was sped up; no final script or video is approved or published. Samples stay outside the website/repository. |
| VIDEO-03 | Finished 20–30 second pilot · parent + founder | Pending corrected teaching flow | Actual editor capture, deliberate cursor movement, useful cuts, captions, accurate labels and comfortable audio. Founder reviews the finished result before any website video. |
| VIDEO-04 | Full mechanical tutorial and short demonstrations | Not produced | Only after the pilot passes review. Mechanical tutorial roughly 6–9 minutes, chaptered; simpler clips may work with captions alone. The voice direction is approved; the final script, footage and edit still need review. |
| MATERIAL-01 | Standalone first-session run sheet | Not created | Target 2-page printable/fillable PDF plus HTML/Markdown; authored for actual preparation/play, not a PHB image. |
| MATERIAL-02 | Annotated Neris construction companion | Not created | Target 3 pages explaining actual decisions, checked acquisition/reuse and one resolved use; supports a complete website walkthrough. |
| BRAND-01 | Navigation gradient logo export | Missing | Faithful export of the existing CSS-gradient mark; add to manifests and ZIP without redesigning the logo. |
| NAV-01 | Creating/tutorial/Creator kit discoverability | Implemented; review pending | Create groups the preserved character guide, builder, abilities/primitives guide, primitive tutorial and Atelier. Creator kit, Rules and Contact are direct destinations. Related Library/About groups preserve existing links. |
| BOOK-01 | PHB / GM Guide / SRD reconciliation · founder | In progress; separate | Do not change publication sources or claim synchronized final editions. Update kit facts/previews when the release changes. |
| DIST-01 | itch.io PDFs and listing polish · founder + parent | Deferred until all three PDFs are ready | Founder wants to upload the books together. Existing project remains private; no release announcement yet. |
| DIST-02 | Personal playtests and feedback · founder | Planned | Record actual version, friction and rulings; allow the founder's expected month or longer. No invented results/testimonials. |
| DIST-03 | Creator selection and personal outreach · founder | Deferred | Use checked kit/materials after books and playtest feedback. No outreach sent by the agent. |
| SEO-01 | Search / AI discovery monitoring | Foundation live; evidence accumulating | Search Console and Bing verified; sitemaps submitted. Keep indexing, queries, citations and referrals separate. No promise that Markdown or llms.txt produces recommendations. |
| SEO-02 | Keyword-cluster and result-intent review | Initial research complete; follow-through pending | Existing US/UK Planner exports and keyword map retained. Prioritize real reader questions without rewriting the homepage or publishing filler pages. |
| PERF-01 | Mobile delivery improvement | Partial; further work remains | Previous bundle/font reduction is live. Latest mobile lab score 58 / LCP 8.4 s; shared CSS remains a material issue. No claim that performance is solved. |

## Active execution

The [execution plan](execution-plan.md) defines all seven ordered batches, dependencies, owners and acceptance checks. This board remains the source of status.

**Batch 1 is implemented and technically verified; founder review is pending:** shared Rules reader, clear Create/Creator kit navigation, structured primitive tutorial and complete Markdown exports. Three agents delivered separate reader, navigation and data scopes; parent integrated and reviewed them. `/character`, Rules and the homepage identity are preserved. No other batch is reported complete by this work.

### Batch 1 evidence — 20 October

- Focused checks: 35 tests pass across Rules/search/reader/Markdown/discovery; scoped ESLint and diff checks pass. An initial full build found a Creating mapping type error; that was corrected and the final production build passes, including TypeScript and static generation.
- Preservation: the complete `PLAY_GUIDE` data is identical to the previous commit: 15 topics, 99 top-level blocks, including nested content. Tutorial conversion preserved all 80 original substantive text blocks, both tables and ordered actions.
- Independent review caught copied Creating keywords and historical Notion source links leaking into Rules Markdown. Creating search now uses actual chapter text; Rules HTML/Markdown use the same public book-link mapping. Regression tests cover both corrections.
- Browser: local current code at 1280/1440 desktop and 390 phone. Create/Creator kit fit the desktop header; phone Create disclosure exposes all five destinations; Escape closes the inner group first and returns focus, then closes the drawer. Original theme/viewport restored after dark/light checks.
- Reader: Creating search `private` finds its visibility chapter; next clears the query and focuses the next heading with the correct `/creating#play` URL. Tutorial identity survives refresh at its existing hash. Rules search finds nested practice explanations and opens them.
- Embedded regression: the guide opened over the actual read-only Neris sheet. Search and Continue learning worked; the full-guide link targeted `/rules#rolls`, chapter navigation focused the heading and reset the reading scroll without rewriting the character URL. No character record was changed.
- Phone correction: a wide tutorial table initially expanded the inner content grid and clipped prose. The grid now constrains its column; prose is 332px wide in a 390px viewport and only the 640px table scrolls inside its 332px container. The document has no horizontal overflow.
- Actual browser downloads: Creating Markdown has 9 chapters / 7,383 bytes; tutorial Markdown has 10 chapters / 9,972 bytes, including its final Contact link and corrected number/private-save/standalone instructions. These local downloads establish source completeness, not external production crawler access.
- Local screenshots: `output/reader-batch1/tutorial-desktop.jpg` and `tutorial-phone.jpg` (review artifacts excluded from Git/deployments). Local server stopped after checks.
- Limits: GM-only navigation was source-reviewed, not checked with a signed-in GM session; nested authored block anchors have unit coverage but the existing production guides do not yet define those anchors. No claim of founder acceptance, completed deeper teaching, original PDFs, new video, improved mobile performance or production release.

## Previous release evidence

- Core release: `a72a0b22`, instructional corrections `217527f2`; final Markdown-link/chapter-name follow-up `2fd10736`. All three reached Ready in Vercel. Final code deployment: `dpl_22V9zNNkwrXhm2ujtczSNnx3ZKxq`.
- Build: production Next.js build passed on 20 October.
- Tests: 28 focused SEO/Markdown, analytics and play-guide tests passed.
- ZIP: deterministic creator-kit archive built with 14 entries; asset notices and source captions included.
- Browser: canonical press/tutorial pages render; 390-pixel press, tutorial tables and character page have no document overflow. Previews load when scrolled into view. Neris and Orren links match the selected public records; the existing encounter link is retained.
- Contrast: selected Always label and helper text resolve to `rgb(23, 20, 15)` in desktop dark/light themes; the mobile dark card is visibly readable. Original theme and viewport restored; temporary unsaved editor tab closed without saving any record.
- Downloads: live ZIP is 1,304,949 bytes, SHA-256 `74f783e27dd17fe1a3ed7051e815f4a322940bcd41cc40eb16973b0614f81a1e`, integrity passes with 14 entries. Live fact sheet contains descriptions and revision status. `/press.md` renders 10,203 characters of synchronized public text.
- Discovery: live XML sitemap has 16 canonical locations and llms.txt links both additions. Direct browser navigation to the nested tutorial Markdown URL was blocked by the client; its explicit page download link works. Actual final-release downloads verified `/tutorials/create-a-primitive.md` and `/press.md`, including their end sections, source links and corrected instructions. Route tests include every registered alternative.
- Tutorial review: source audit corrected number-entry confirmation (`Use number`), phone field labels and the distinction between acquiring a standalone primitive and toggling an effect/capability. The deployed HTML contains all three corrections. The preparation checklist now uses the actual topic name `Strain, Cost & scaling`.
- Scope: no homepage hero rewrite, book-source edits, video publication, new account, purchase or creator messages. No local development server is running.

Close rows only after the corresponding result is verified. The written pages can ship independently of video production and the founder's later book/playtest work.
