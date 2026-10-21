# Discovery follow-through · 21 October 2026

Source and external-reader follow-through in the discovery worktree. The founder has deferred video production and supplied the revised GM Guide PDFs; the SRD is still pending. This work reuses the product context, saved US/UK research and 20 October delivery evidence. Bounded link/copy changes are applied in source as recorded below. No account, indexing policy or publication file was changed by this subtask. Parent work owns current Search Console, ordinary HTTP, browser and deployment checks.

## What is already in place

The [keyword strategy](keyword-strategy.md) remains the decision layer: eight page priorities, one English site, distinct purposes for the homepage, Rules/preparation, character guide, original-character guide, reusable-creation guide, primitive editor tutorial and books. The provider research has not become an organic traffic forecast or an organic difficulty score. There is no evidence here to justify another generic SEO page or a homepage hero rewrite.

Source still defines 17 canonical HTML destinations through `src/lib/seo/pages.json` and the publication catalogue. Sitemap, public metadata, Markdown allowlist and llms index derive from that set. The shared readers now contain every authored chapter in initial HTML. Markdown for those guides exports all chapters rather than only the current UI selection. Unknown/private alternatives remain outside the export allowlist. These are source observations; this review did not repeat the parent's full live endpoint matrix.

The wildcard production robots rule permits public pages, including `OAI-SearchBot`, while disallowing `/api/`. Markdown retains its HTML canonical and `noindex, follow`, so HTML remains the intended search result. A browser downloading the text does not make the URL unreadable to an agent.

## Actual web-reader result

This session attempted these exact canonical URLs using the available web-reader tool:

| URL | Tool result |
| --- | --- |
| `https://www.swordweave.quest/` | Not accessible via this tool |
| `https://www.swordweave.quest/rules` | Not accessible via this tool |
| `https://www.swordweave.quest/creating-a-character` | Not accessible via this tool |
| `https://www.swordweave.quest/creating-a-character.md` | Not accessible via this tool |
| `https://www.swordweave.quest/index.md` | Not accessible via this tool |
| `https://www.swordweave.quest/llms.txt` | Not accessible via this tool |
| `https://www.swordweave.quest/robots.txt` | Not accessible via this tool |
| `https://www.swordweave.quest/sitemap.xml` | Not accessible via this tool |

The same tool successfully retrieved current OpenAI, Google and Vercel documentation. Its SwordWeave error supplies no HTTP status, response body, request IP, firewall event or diagnostic cause. It therefore reproduces an unresolved provider-specific retrieval failure. It does **not** establish that SwordWeave blocked OpenAI, that robots caused it, or that all ChatGPT clients fail. The prior dated browser/HTTP/Google-crawler successes remain separate evidence, not a substitute for this missing result.

Six searches (`site:swordweave.quest SwordWeave RPG`, `"SwordWeave" tabletop RPG rules`, `"swordweave.quest"`, `site:www.swordweave.quest`, `"SwordWeave" "modular tabletop"`, and `"swordweave.quest" rules`) returned no canonical SwordWeave page. Broader name matches were unrelated; one result was a third-party GitHub-contribution aggregator. This small search-provider sample is not a Google ranking census, localized US/UK SERP study, or proof of unindexing. Use the actual Search Console URL inspections and report data to establish Google status.

Next diagnostic evidence should come from a matched real request/event: timestamp, hostname/path, response status, firewall rule or verified-bot identity. Vercel's [verified-bot documentation](https://vercel.com/docs/botid/verified-bots) describes identity signals; a locally supplied user-agent string is not equivalent. Only a demonstrated false-positive block would justify a narrow public-read exception. No WAF disabling, auth bypass, alternate-origin workaround or broad bot permission change is justified by the tool error alone.

### Parent-verified Search Console and hosting evidence · 21 October

These are attributed live checks reported by the parent, distinct from this subtask's source and web-reader checks:

- The submitted sitemap reports **Success / 17 discovered URLs / 0 videos**, submitted and last read on **20 October**. No new submission was needed.
- Stored URL Inspection for `/creating-a-character` now says **URL is on Google / Page is indexed**, with HTTPS and one valid Breadcrumb item. Screenshot: `output/marketing/gsc-guide-indexed-2026-10-21.png`. This supersedes the new guide's discovered-but-not-indexed status in the 20 October evidence. No resubmission was made.
- Aggregate Performance and Indexing reports still say processing; Core Web Vitals has no field data. One indexed URL does not establish a site-wide indexed total, rankings, impressions or traffic growth.
- Read-only Vercel CLI **64.5** firewall status/rules: firewall Enabled; Attack Mode Off; IP blocks 0; Bot Protection Off; AI Bots Allow; BotID Basic. The only custom rule is contact-form rate limiting, **5 requests per 60 seconds**. No setting was changed.

These hosting settings provide no affirmative evidence that WAF policy caused the web-reader failure. A matched actual failing request is still unavailable; do not turn the absence of a visible blocking rule into a claim of successful OpenAI retrieval.

## Source follow-through and release state

### 1. Publication readiness corrected in source; website release pending

The founder supplied:

- `/Users/max/dev/SwordWeave/output/pdf/swordweave-game-masters-guide-v0.1-alpha-organic-edges-compressed.pdf`
- `/Users/max/dev/SwordWeave/output/pdf/swordweave-game-masters-guide-v0.1-alpha-organic-edges.pdf`

The initial source inspection found status text calling both GM Guide and SRD revised drafts:

- `src/app/llms.txt/route.ts`: PHB complete; GM Guide and SRD being revised.
- `public/press/README.md`: same status.
- `public/press/fact-sheet.md`: GM Guide's available draft being revised.

The publication agent has now published the unchanged reading/full files to the versioned Cloudflare facade and verified both public byte counts and SHA-256 hashes. The [publication record](../publications/gm-organic-publication-2026-10-21.md) contains its exact object URLs, checks and worker version. This is established PDF-object delivery; the canonical website patch is still pending push/deployment.

The website/kit source now distinguishes current PHB/GM Guide PDF choices from the pending SRD revision, instead of promising that the new reading/full pair are light/dark editions. The parent is also correcting the remaining stale GM wording in Rules' optional references; the press header date now derives from the kit update date. The rebuilt creator kit retains the latest two companion PDFs unchanged: run sheet SHA-256 `7e5ee5497d7a21bdf8f5eaa12158bed053145f50845083952cbc7158e4281379`, Neris SHA-256 `a09bc03a8c11c625ff227a608fa8127262183ce8ac33f81244974eca357f719a`. Final canonical website/kit downloads remain a release check.

`bookMarkdown` already explains that its source is the online reader and revised PDFs may differ. Preserve that distinction. No reconciliation of the PHB/GM Guide/SRD rules is claimed here.

### 2. Two contextual handoffs applied in source

The saved keyword strategy identified these small changes; both are now applied:

- `/start` now ends with “Prepare your first session” linking to `/rules#first-session-preparation`. The existing navigation still provides the general Rules entry.
- `/start` now links “Create a character from scratch” to `/creating-a-character` within its next-step explanation for someone with a particular concept. The link inherits the paragraph typography with a visible underline; no hero or extra card section was added.

These support real user choices, not a guaranteed rank improvement. Google's [link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) supports crawlable href links and concise descriptive text.

Both desktop and mobile public-navigation links to `/sign-up` now say **Sign up**, replacing the vague “Start” found by the parent's Lighthouse check. Their destinations, existing classes and behavior are unchanged. This subtask did not rerun Lighthouse, build or start a server. The parent has performed the bounded reviewer checks below; final canonical deployment and post-release performance verification remain pending.

The active implementation board and execution plan record the supplied full/compressed GM Guide file paths, sizes and hashes, the pending SRD and the founder's video deferral. Historical release evidence remains intact. Publication source work and public Cloudflare verification are reported separately from the pending canonical website deployment.

### 3. Keep public catalogues visible without indexing every record

Library browse and Monsters use a public, access-aware server catalogue. Encounter directory results load client-side through the public discovery API. All are visible in public navigation, but none is currently an indexable `PUBLIC_PAGES` entry; arbitrary character/library/monster/encounter records also receive noindex through the proxy's allowlist policy. Public visibility and search indexing are separate choices.

Do not remove this boundary just to grow the sitemap. A future selected catalogue destination needs its own useful public introduction, stable result links, appropriate canonical/metadata and non-JavaScript discovery of the curated content. Individual records need explicit publication/permission checks, meaningful complete content and private-nested-content protection. Filter/search permutations should not become thousands of indexable pages. The current priority is the 17 authored destinations and useful handoffs to the actual public tools.

### Parent-verified build and bounded reviewer checks

The final code build passed compilation, TypeScript and static generation before the last two text-only edits; scoped lint also passed. The cloud release must still build all final sources. This is not a claim that an earlier build included edits made afterwards.

The public reviewer checked the candidate at 1280 pixels in desktop dark/light themes, at 390 pixels in phone light/dark themes including home/navigation, and Rules disclosures/topics/table plus Books on phone. No document overflow was observed. Exact selected computed-style comparisons for desktop dark and phone light matched the baseline. These checks support the proposed CSS/mask delivery change while preserving the design; they do not establish a fresh field-performance result or exhaustive authoring-tool regression coverage.

A full authoring-tool smoke check has not yet run. The parent's browser connection then dropped, so further browser verification remains open. No unperformed flow or post-release Lighthouse improvement is marked complete. See [the performance review](performance-review-2026-10-21.md) for the candidate's measured asset changes and remaining release checks.

## Current primary guidance and limits

The installed AI SEO skill contains older assertions that should not drive current implementation. This review checked primary documentation on 21 October:

- [OpenAI crawler controls](https://developers.openai.com/api/docs/bots) distinguish search discovery (`OAI-SearchBot`), potential model training (`GPTBot`) and user-requested visits (`ChatGPT-User`). Search discovery depends on permitting the search crawler and its published IP ranges; user-requested retrieval is a different mechanism. No citation or ranking is guaranteed by a Markdown file. The documented bots are not interchangeable.
- [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) requires an indexed, snippet-eligible page and ordinary useful, accessible content. It requires no special AI text file or additional schema. Keep HTML, internal links, visible text and real performance central; do not write separate inflated AI content.
- [Google's Generative AI report help](https://support.google.com/webmasters/answer/16984139?hl=en) explicitly documents worldwide availability since 31 August 2026. It reports supported Google Search AI impressions and dimensions; it is not a ChatGPT report. Its absence from a sidebar or processing state is not zero visibility. The older skill statement that no dedicated report exists is stale.

The current llms index and Markdown alternatives are useful optional reading formats. OpenAI's own docs using them establishes their practical use as formats, not that every discovery engine consumes SwordWeave's exports or awards a ranking boost. This review does not recommend `llms-full.txt`, OKF, WebMCP, FAQ/HowTo markup for its own sake, invented reviews, or another automated content surface.

## What to measure next

After current reports have processed, use the same observation window for brand/non-brand queries, page, country and device. Compare US/UK separately and report counts rather than optimistic extrapolations. Check whether the actual landing page answers the query before creating another page or rewriting a title. Sparse evidence may remain inconclusive.

For AI discovery, keep separate columns for: Google AI impressions, a dated actual external citation with source URL, identifiable referral sessions, and unresolved retrieval checks. An invitation click is not a Discord join; a PDF click is not a completed game; an unattributed direct visit is not proven AI traffic. Technical crawlability is necessary groundwork, while broader discovery will eventually need founder-led real participation, playtest feedback and credible public references. No outreach was sent or listing published during this review.

Video production remains deferred by the founder. There is no video-pilot prerequisite for these SEO, publication, retrieval or performance tasks.
