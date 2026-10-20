# SEO and AI discovery verification · 20 October 2026

Focused follow-through after the original-character/companion release, using the saved US/UK keyword research. This is a technical delivery and prioritization check, not a claim of rankings, AI recommendations or independent playtests. The homepage hero, publication sources, consent settings and private-record access remain outside this change.

## Production creator kit

Downloaded the actual canonical `/press` ZIP through its visible download link. It contains **both final PHB-style companions**, byte-for-byte equal to the current public source files:

| File | SHA-256 |
| --- | --- |
| First-session run sheet, 2 pages | `7e5ee5497d7a21bdf8f5eaa12158bed053145f50845083952cbc7158e4281379` |
| Build with Neris, 3 pages | `a09bc03a8c11c625ff227a608fa8127262183ce8ac33f81244974eca357f719a` |

ZIP: 20 entries, 3,329,537 bytes, CRC check passes; SHA-256 `52053506c5a878473b666cdafe03147345febbb33b53ac1a3eb8db5a54d74dc8`. No regeneration or replacement was necessary. The `/press#materials` page also links the standalone PDFs and equivalent web/Markdown text.

## Live HTTP baseline

Anonymous ordinary HTTP requests, with certificate verification and no account cookies, checked **39 endpoints**: 17 canonical HTML pages, their 17 Markdown alternatives, robots/sitemap/llms files, and two deliberately excluded Markdown routes.

- All 37 intended public endpoints returned 200. Every HTML page had one H1, its own canonical, `index, follow`, an absolute Markdown alternate and parseable JSON-LD. Presence and parseability are not rich-result eligibility or an exhaustive schema-vocabulary audit.
- All 17 Markdown alternatives returned `text/markdown; charset=utf-8`, canonical/describedby response links, and `noindex, follow` to keep HTML as the search destination. No attachment `Content-Disposition` is set on these alternatives. A browser choosing to download text does not make its URL unavailable to agents.
- The sitemap contains exactly 17 canonical HTML locations. No private IDs, filtered database results or Markdown duplicates enter it. Unknown/private Markdown requests return actual 404 responses.
- robots permits `/` through the wildcard group and excludes `/api/`. OAI-SearchBot inherits that public permission; no separate search-bot group is needed. Search access and training controls are distinct; this pass changes neither policy.
- HTTP and apex variants redirect permanently toward HTTPS www. HTTP apex currently uses two hops (HTTPS apex, then www); this is a low-priority hosting cleanup, not an indexing blocker. The supplied canonical links already use the final host.
- A registered UTM landing retains its clean canonical. A non-UTM parameterized view receives the stricter `X-Robots-Tag: noindex, follow`. A nonexistent HTML URL is a real 404 with noindex. The Open Graph image returns 200/image/png.
- Four additional local requests carrying search/user-agent labels returned 200 without a Vercel mitigation header. These **do not** come from verified vendor crawler IPs and do not establish actual ChatGPT crawling or citations.

Closed local evidence (excluded from deploys/Git): `output/marketing/seo-live-http-2026-10-20.json`, `seo-url-boundaries-2026-10-20.json`, `seo-labelled-http-2026-10-20.json`.

## Search Console observations

Read the founder-owned `swordweave.quest` Domain property under the approved personal Google identity.

- **Rules is indexed.** Stored inspection: Googlebot smartphone, successful fetch, crawl/indexing allowed, self-canonical chosen by Google; last crawl displayed 20 October at 11:05:51 AM. The fresh live test at 4:03 PM local also passed “URL is available to Google / Page can be indexed.”
- **Homepage is indexed.** Its separate stored URL inspection reports “URL is on Google / Page is indexed.” This is evidence for that URL, not the entire site.
- **Original-character guide was unknown to Google**, which is expected for a newly published URL and is distinct from being blocked. Its fresh live test at 4:04 PM local passed, with one valid Breadcrumb item. Indexing request/release follow-through is recorded below when complete.
- Submitted sitemap status is **Success**, last read 20 October, **14 discovered pages** in that stored report. The live sitemap now contains 17. The stored count is not the number of indexed pages and is not evidence that the three newer URLs are absent from the current file.
- Aggregate Performance and Pages reports still say processing. Core Web Vitals has no field data. No query/country/CTR or indexing-total conclusions can yet be drawn.
- Search generative AI is already **Include (Default)** at the Domain property. No settings were changed.
- The dedicated **Generative AI features** report is accessible, but says processing / no data. Its absence from the normal sidebar is not proof the feature does not exist. This report covers Google's supported Search AI features, not ChatGPT or other providers.

Screenshots are local QA evidence under `output/marketing/` and may contain account chrome; they are not public creator-kit assets.

## Concrete correction

The shared reader's initial HTML contained only its selected chapter. Other chapter titles were JavaScript buttons. Complete Markdown is helpful but should not substitute for the canonical page's substantive HTML.

The correction server-renders the full authored public guide once, gives chapters stable anchors and real links, and progressively enhances it into the existing single-chapter interface. Embedded/private overlays retain their compact behavior. The same content is available to all readers; there is no crawler-specific copy. The [independent source audit](seo-ai-source-audit-2026-10-20.md) records implementation, byte/DOM costs and limits.

Three search metadata changes distinguish the Bartholomew walkthrough, Rules/first-session preparation and Combat/worked encounter. The press page adds a contextual link to Neris's written construction trail. No hero, book manuscript or reader styling was redesigned.

Local production build and scoped lint pass. **56 focused tests across six suites pass**, covering full server HTML and unique anchors for all five public readers, Markdown parity, guide source/engine contracts, and the compact embedded reader. Independent review found no remaining actionable defect.

Production-built browser QA: desktop chapter links change the hash/focus; search followed by selection clears its query; a modified click opens the correct chapter in a separate tab without changing the original. A direct block deep link focuses first-session preparation. At 390×844 the original-character guide selects the requested chapter, native details expand, and its condition table fits a 330-pixel region without document overflow. The read-only public Neris sheet opens its embedded guide with one chapter, navigates to Combat, and keeps the sheet URL unchanged. No character/Library record was saved or mutated. Screenshots: `seo-reader-desktop.png`, `seo-reader-phone.png` under the local evidence folder.

## Priorities and next decisions

1. Complete and verify the shared-reader correction, then request discovery of the newly published guide once. Avoid repeatedly resubmitting already indexed URLs.
2. Use [the current keyword strategy](keyword-strategy.md) for distinct page ownership and next small metadata/internal-link changes. Preserve the existing design and do not build generic keyword pages to fill a spreadsheet.
3. Revisit indexed pages, query families, landing pages and US/UK demand after reports have processed and accumulated meaningful observations. Do not treat Keyword Planner advertising competition as organic difficulty or sum overlapping ranges into traffic forecasts.
4. Next measurement session: validate the newer kit event in live reporting, prepare a consented acquisition/activation view, distinguish QA from players, and test identifiable AI referrals without labeling unattributed direct visits as AI.
5. Next performance session: address the measured shared CSS/public-shell cost; use one comparable mobile before/after run and preserve the metallic UI and embedded tools. Earlier lab scores (58 performance, 8.4 s LCP) remain a dated baseline, not current field data or a result of this check.
6. Finish a separate video pilot using the approved voice, actual editor footage, legible framing, captions and careful editing. Founder review precedes publication and the longer tutorials.

## Current documentation and limits

- [OpenAI crawler controls](https://developers.openai.com/api/docs/bots): OAI-SearchBot manages search discovery; GPTBot's training setting is independent. A local user-agent string is not vendor-IP verification.
- [Google AI features and website requirements](https://developers.google.com/search/docs/appearance/ai-features): indexable, accessible, useful content remains the basis; special AI files are not required for Google inclusion.
- [Google generative-AI report](https://support.google.com/webmasters/answer/16984139?hl=en) and [inclusion control](https://support.google.com/webmasters/answer/16908024): the current August 2026 documentation supersedes older “no separate report” advice. The actual report was inspected above.
- [llms.txt proposal](https://llmstxt.org/): alternate/describedby links and Markdown are useful retrieval aids. The proposal is not a ranking guarantee or evidence every search provider uses it.

The web-reader tool in this chat returned “not accessible via this tool” for robots/llms/Markdown and the focused search sample returned no results. Ordinary HTTP, the production browser and Google's live crawler succeed. The tool failure's cause is unestablished; it is not grounds to disable security or claim actual ChatGPT retrieval/citation. Keep this platform-specific retrieval check open and distinguish it from the verified public delivery.

## Release follow-through

Pending the shared-reader verification and production release. Do not mark this complete based only on the source proposal.
