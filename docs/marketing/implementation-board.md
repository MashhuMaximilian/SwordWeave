# SwordWeave discovery and teaching work

Updated 20 October 2026. This is the current task list; older proposals in the planning documents are historical. Preserve the homepage hero and the Rules page. Book reconciliation remains the founder's work in progress.

| ID | Deliverable / owner | State | Acceptance / next dependency |
| --- | --- | --- | --- |
| WEB-01 | Mechanical editor selected-card contrast · interface agent | Live; verified | Near-black labels and helper text on bright gold. Retain light labels on dark navigation gold; check both themes and mobile. |
| WEB-02 | `/press` and downloadable creator kit · creator-kit agent | Live; verified | Three descriptions, actual facts, book links/status, original logos, real Neris screenshot, PHB previews, notices and reproducible ZIP. About, Contact and footer links. |
| WEB-03 | First-session checklist inside Rules · teaching agent | Live; verified | Append to Your first game; preserve the complete existing guide, topic navigation and search. |
| WEB-04 | Neris character walkthrough · teaching agent | Live; verified | Replace the localized Lyra example; Neris primary, Orren advanced. Explain actual treatment, supplies and manual updates. |
| WEB-05 | Reusable primitives and encounter example · teaching agent | Live; verified | Extend shared creating topic and Combat using PHB and existing encounter records. Distinguish ownership, execution costs and table rulings. |
| WEB-06 | `/tutorials/create-a-primitive` · parent | Live; verified | Follow current Identity, Result, Operation, Value, Recipient, Trigger, stacking, review and private-save controls. No invented BU price. Contextual links from Creating and the editor. |
| AI-01 | Synchronized public Markdown · parent | Live; verified | 16 curated public HTML pages and 16 Markdown alternatives, registry-derived sitemap/llms index. Four public kit Markdown files allowed explicitly; private/arbitrary records excluded. |
| MEASURE-01 | Consented creator-kit download event · parent | Live; contract/consent tests passed | Closed `media_kit_download` event with placement/version only, using the existing consent gate; no personal data or new tag manager. No separate live GA4 count was established for this new event. |
| QA-01 | Focused tests, build and release inspection · parent | Build/tests and representative browser review passed | 28 tests passed; focused ESLint and production build passed. Release evidence below records desktop/mobile checks, actual downloads and remaining limits. |
| VIDEO-01 | Production brief and founder talking points · video agent | Prepared | [Production plan](video-production-plan.md) and [mechanical tutorial outline](video-scripts/create-a-primitive.md). Screen actions and talking points are primary; a read-aloud script is optional. |
| VIDEO-02 | Synthetic narration audition · parent + founder | Revision under review | The founder rejected both AI Doc Maker takes as slow/robotic; the second was worse. Changed engine. A first conversational attempt still measured about 147 wpm and was not presented. A fresh quick-delivery revision is 15.92 seconds, about 180 wpm, and awaits the founder’s ear. No MP3 was sped up; no narration is approved or published. Samples stay outside the website/repository. |
| VIDEO-03 | Finished 20–30 second pilot · parent + founder | Pending narration decision | Actual editor capture, deliberate cursor movement, useful cuts, captions, accurate labels and comfortable audio. Founder reviews the finished result before any website video. |
| VIDEO-04 | Full mechanical tutorial and short demonstrations | Not produced | Only after the pilot passes review. Mechanical tutorial roughly 6–9 minutes, chaptered; simpler clips may work with captions alone. No synthetic voice or final script is assumed approved. |
| BOOK-01 | PHB / GM Guide / SRD reconciliation · founder | In progress; separate | Do not change publication sources or claim synchronized final editions. Update kit facts/previews when the release changes. |
| DIST-01 | itch.io PDFs and listing polish · founder + parent | Deferred until all three PDFs are ready | Founder wants to upload the books together. Existing project remains private; no release announcement yet. |
| DIST-02 | Personal playtests and feedback · founder | Planned | Record actual version, friction and rulings; allow the founder's expected month or longer. No invented results/testimonials. |
| DIST-03 | Creator selection and personal outreach · founder | Deferred | Use checked kit/materials after books and playtest feedback. No outreach sent by the agent. |
| SEO-01 | Search / AI discovery monitoring | Foundation live; evidence accumulating | Search Console and Bing verified; sitemaps submitted. Keep indexing, queries, citations and referrals separate. No promise that Markdown or llms.txt produces recommendations. |
| SEO-02 | Keyword-cluster and result-intent review | Initial research complete; follow-through pending | Existing US/UK Planner exports and keyword map retained. Prioritize real reader questions without rewriting the homepage or publishing filler pages. |
| PERF-01 | Mobile delivery improvement | Partial; further work remains | Previous bundle/font reduction is live. Latest mobile lab score 58 / LCP 8.4 s; shared CSS remains a material issue. No claim that performance is solved. |

## Release evidence

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
