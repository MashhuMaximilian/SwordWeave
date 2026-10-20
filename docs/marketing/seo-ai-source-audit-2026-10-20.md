# SEO and AI discovery source audit — 20 October 2026

Scope: the discovery worktree only. Relevant SEO audit and AI SEO skills, product context, existing discovery notes and current primary documentation were read. This review inspected source and focused local rendering tests. It did not use a browser, change accounts, query private records, run a full build, start a server, commit or deploy. The parent owns live HTTP/Search Console evidence and final browser QA.

## Material defect found and corrected

**High priority: most learning-guide chapters were missing from canonical HTML.** The former shared `LearningGuide` selected only the first topic at initial render. Other chapters' substantive bodies were created only after a button click or a client-side hash effect. `/rules` therefore initially supplied only one of fifteen chapter bodies; `/creating` supplied one of twelve. Complete Markdown exports did not repair that canonical-HTML omission. The same reader affected the ten-topic primitive tutorial, seven-topic Neris walkthrough and new twelve-topic character-authoring guide.

This was a content-discovery defect even though the page itself could be indexed. Google documents that interaction-dependent content is not loaded by its crawler; normal tabs/accordions can preserve equivalent content. It recommends usable HTML links, server rendering and checking the rendered page. These principles support a reader repair, not an assertion that each chapter fragment will get its own indexed result. [Mobile-first guidance](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing), [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

The parent approved this bounded implementation:

- Public guides now server-render every authored chapter, including paragraphs, lists, tables, optional details, examples and sources. Each chapter has one stable authored anchor and labelled heading.
- On hydration, the same DOM enhances into the existing one-chapter reader. Inactive chapters use the native `hidden` attribute; they remain available in the document and can be selected through the reader. Hidden sections leave the accessibility tree until selected. There is no separate bot copy, duplicated fallback article or user-agent detection.
- Contents and previous/next controls are real links to authored anchors. Ordinary clicks preserve the existing chapter navigation, query reset, hash update and focus/scroll handling. Modified clicks retain normal link behavior. Inactive chapter markup does not need another request or user interaction to exist.
- Existing one-topic rendering remains for embedded sheet overlays, avoiding unnecessary private-tool DOM expansion.
- Reader CSS and its metallic current-chapter selectors include links alongside the previous button selectors. Fonts, active-reader composition and mobile treatment were retained.
- Creating reuses Rules block IDs as chapter IDs. The full render initially exposed those duplicate IDs; the child block now omits an identical `id` while keeping its block identifier and the chapter's public anchor.

Files changed for this repair: `src/components/rules/learning-guide.tsx`, `src/app/play-guide.css`, `src/app/arcane-materials.css`, `src/lib/rules/__tests__/learning-guide.test.ts`. No metadata, route, public-copy, schema, analytics or account settings were changed in this pass.

## Source configuration checked

| Area | Current evidence | Finding |
| --- | --- | --- |
| Public indexability | `src/lib/seo/pages.json` plus the publication catalogue register 17 canonical public pages. `metadata.ts` supplies each page's own canonical, index policy, title, description and social metadata. | No additional blocking source defect found. |
| Default exclusion | Root layout defaults to noindex. `src/proxy.ts` excludes unregistered paths and non-approved query views, while preview deployments receive noindex. | Auth/tools/UGC are not automatically promoted because a route can be read publicly. |
| Authorization | Proxy protection and sheet server access checks remain separate from noindex. | Noindex is not treated as security; no auth changes were made. |
| Robots | `src/app/robots.ts` permits production public crawling and disallows API crawling; development/preview production checks exclude non-production discovery. | No special AI allow group is needed when the wildcard group already allows public pages. Training policy was left unchanged. |
| Sitemap | `src/app/sitemap.ts` uses canonical public HTML routes only, omitting made-up last-modified dates and private IDs/filters. | The current source contains 17 URLs; older 14/16 counts in historical notes are earlier snapshots. |
| llms index | `src/app/llms.txt/route.ts` lists the curated Markdown alternatives with game identity, alpha/version limits, creator, rights and contact. Root layout advertises it using `rel="describedby"`. | Useful optional index; not a substitute for HTML. |
| Alternate formats | `metadata.ts` advertises explicit `.md` URLs with `rel="alternate" type="text/markdown"`. Proxy checks a public page/asset allowlist; unknown or private Markdown paths fail closed. | No arbitrary saved-character/Library export added. |
| Markdown response | Discovery route returns `text/markdown; charset=utf-8`, HTML canonical and llms describedby links, cache headers, and `noindex, follow`. It has no attachment Content-Disposition. | Explicit reading format; no Accept-based negotiation is claimed. Unknown/failure statuses are meaningful. |
| Markdown substance | Rules, Creating, advanced creation, primitive tutorial and books serialize their structured source. Other approved pages use a fixed anonymous origin without forwarding authentication. | Complete structured exports remain separate from the repaired HTML render. Canonical-source failure yields 503 rather than invented copy. |
| Neris | `publicHtmlMarkdown` replaces the entire `data-neris-guide` container with the seven structured topics. | Full HTML rendering does not duplicate Neris in Markdown; a focused test checks each topic occurs once. |
| Structured data | `StructuredData` emits server-rendered JSON-LD: WebSite, actual Person, truthful Book entries and breadcrumbs where applicable. | No missing generic FAQ/HowTo/Product package was classified as a defect. Rich-result validation/eligibility is separate from source presence. |
| Books | Structured HTML/Markdown book blocks include edition qualifications and figure/map/worksheet descriptions or references. | Publication reconciliation remains a separate workstream; this audit did not declare unfinished editions equivalent. |

## What the optional AI formats establish

The [llms.txt v2 document](https://llmstxt.org/) is explicitly a proposal, updated 10 August 2026. It describes `.md` alternatives, ordinary alternate/describedby link relations and curated file lists. Those are implemented reading conventions; proposal adoption by documentation platforms does not prove that a particular search engine consumes SwordWeave's files or ranks it more highly.

Google's current guidance says its Search visibility/ranking does not use llms.txt and requires no AI-specific schema or Markdown. It now documents a **Generative AI performance report**, so the installed AI SEO skill's older statement that no such report exists is stale. Do not repeat that older claim. [Current Google guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [report documentation](https://support.google.com/webmasters/answer/16984139?hl=en).

OpenAI documents separate controls for search discovery (`OAI-SearchBot`), potential model training (`GPTBot`) and user-triggered retrieval (`ChatGPT-User`). Allowing discovery is distinct from granting every training use, and a browser/user retrieval result is not proof of automatic crawling. No new security exception or training-policy change was justified by this source audit. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

No OKF bundle, WebMCP server, new AI-only text, keyword-fragment pages or speculative extra schema was introduced. Future protocols should solve a concrete workflow rather than become a checklist of unsupported ranking claims.

## Focused evidence and performance boundary

Passed locally after the repair:

- 16 learning-guide tests, including complete server-rendered substance and unique anchors for all 15 Rules, 12 Creating, 12 advanced, 10 primitive and 7 Neris topics; usable chapter hrefs; retained embedded selection; malformed/deep hash resolver behavior; rich-content search; and single Neris Markdown replacement.
- 20 Markdown route tests and four discovery tests. Total: **40 passed**.
- Scoped ESLint for the changed component/test and `git diff --check` for the changed files.

The test environment renders source directly; it does not establish browser hydration, network responses, Clerk/middleware execution, vendor crawler access, ranking, citations or real user performance. Parent browser checks must cover desktop/phone chapter selection, direct/deep hashes, search then navigation, modified clicks and overlay behavior.

An isolated `renderToStaticMarkup` measurement compared the complete reader with its selected-only embedded rendering. It excludes the page shell, RSC payload, scripts, network and other assets; gzip is a local compression measurement, not an observed transfer:

| Reader | Complete HTML bytes | Local gzip bytes | Selected-only bytes / gzip |
| --- | ---: | ---: | ---: |
| Rules, 15 topics | 161,422 | 31,977 | 31,088 / 5,917 |
| Creating, 12 topics | 54,564 | 7,267 | 9,977 / 1,786 |
| Advanced character, 12 topics | 77,611 | 15,013 | 12,106 / 2,568 |

This is a deliberate increase in useful public HTML. The topic data was already supplied to the client reader. No LCP, INP or field improvement is claimed; the parent can inspect layout/hydration and later performance evidence before release.

## Live evidence supplied by the parent

The parent independently reported anonymous HTTP 200s for all 17 HTML and 17 Markdown routes plus robots/sitemap/llms, and 404s for private/unknown Markdown. It also reported stored Google Rules indexing with successful smartphone crawl/self-canonical, a fresh live test passing, and the new guide's live test passing while indexing was not yet established. The Search generative AI setting remained Include; the dedicated report was visible but processing/no data. These are attributed parent checks, not tests executed by this subagent or evidence of AI citations.

The parent's web-reader tool could not fetch this site while normal HTTP/browser/GSC checks worked. That is a tool-limited retrieval result, not evidence of a WAF block; weakening WAF/security was not proposed. Continue measuring actual indexing, identifiable referrals and dated citation samples separately.

## Remaining action

The material source defect was fixed in this bounded batch. Parent integration/browser QA and any release remain outstanding. Afterwards, monitor the canonical pages and actual reports with the new complete HTML; do not repeatedly request indexing or promise an outcome. Keep selected public demo-sheet exports, publication consistency and later creator outreach in their separately scoped workstreams.
