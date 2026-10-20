# Discovery research provenance

Collected 19 October 2026. Public product/category research and approved read-only account inspection. No paid research service, campaign activation, billing change, analytics tag or Search Console property was created by this pass.

## Google Keyword Planner

Founder-approved use of an existing planner account for research only. The project’s Google property ownership remains assigned to the founder’s approved personal account; no account credential or unrelated property identifier is stored here.

Common settings: English; Google search network; **1 October 2025–30 September 2026**. United States and United Kingdom were selected separately, removing the previous location each time. The account displays broad monthly ranges and invites campaign spending for greater detail; no campaign was run to unlock that detail.

| File | Market | Seed batch | Export rows |
| --- | --- | --- | --- |
| [us-core-google-ads.tsv](us-core-google-ads.tsv) | United States | Core | 69 |
| [uk-core-google-ads.tsv](uk-core-google-ads.tsv) | United Kingdom | Core | 69 |
| [us-tools-google-ads.tsv](us-tools-google-ads.tsv) | United States | Tools/resources | 479 |
| [uk-tools-google-ads.tsv](uk-tools-google-ads.tsv) | United Kingdom | Tools/resources | 475 |

**Core seeds:** modular tabletop rpg; free tabletop rpg; tabletop rpg character builder; classless rpg; point buy rpg; freeform magic rpg; custom ability rpg; indie tabletop rpg; open source tabletop rpg; SwordWeave.

**Tools/resources seeds:** free ttrpg; free ttrpg pdf; rpg character creator; tabletop character builder; custom magic system rpg; modular rpg system; tabletop rpg playtest; indie rpg; fantasy ttrpg; rpg character sheet.

Exports were downloaded through the normal CSV control and transcoded from UTF-16 tab-separated text to UTF-8 TSV. Provider column names, values and date header are preserved. Total: 1,092 rows and 540 distinct lowercase query strings. Differences between the US/UK result sets are not filled with invented values.

## Estimate handling and derived files

The rendered UI showed ranges while CSV exports used values such as `50`, `500`, `5000` and `50000`. The derived files conservatively map those observed bucket representations to `10–100`, `100–1K`, `1K–10K` and `10K–100K`. This does not turn an export value into a precise measured count. Blank values are not reported. Zero-valued exports are marked low/unresolved; no exact zero-demand conclusion is made.

- [Keyword universe](keyword-universe.csv): all 540 provider queries, market estimates and initial rules-based triage. Triage is not a claim of manual review of every search result.
- [Curated page map](../../keyword-map.csv): 138 explicit candidates across 21 clusters, including brand and task hypotheses not reported by Planner. Each has intent, destination, priority, product fit, editorial conditions and evidence status.
- [Count summary](research-summary.json): machine-readable dataset counts.

Advertising competition and bid values are retained only as provider data. Organic ranking difficulty, exact positions, click-through forecasts and backlink authority were not measured. Keyword close variants may overlap; do not sum the rows as independent demand. The original idea sets contain many other games and video-game tools; retaining an export is not a recommendation to target those queries.

## Website and account observations

Rendered production DOM checks: homepage title/description/H1 present; no canonical, Open Graph tags or JSON-LD. PHB reader has substantial rendered article text, a book title and no canonical/JSON-LD in the inspected DOM. Robots, sitemap and llms endpoints showed the site’s 404 page. The code review was focused, not a complete crawl or search-index diagnosis.

The approved personal Google account’s visible Search Console and Analytics property lists did not contain SwordWeave. Tag Manager had no account/container. Existing unrelated properties were not modified. Full permissions elsewhere, indexing and historical SwordWeave search traffic were not established by those observations.

Browser proof files live locally under `output/marketing/`: `keyword-planner-us-core.jpg`, `keyword-planner-uk-core.jpg`, `keyword-planner-us-tools.jpg`. Do not publish screenshots containing unrelated account information merely to substantiate public keyword data.

## Search-intent sampling

General web-search samples covered modular tabletop RPGs, free tabletop games with builders, classless RPGs, point-buy creation, freeform magic and the project brand. These are not localized Google rank reports. Official presentation examples included [Cortex](https://www.cortexrpg.com/), [Open Dungeons](https://opendungeons.com/), and [Cypher](https://cypher-rpg.com/). No competitive superiority or compatibility claim was established.

## Primary documentation checked

- [Planner metric definitions](https://support.google.com/google-ads/answer/3022575), [Planner usage](https://support.google.com/google-ads/answer/7337243).
- [Search Console property types](https://support.google.com/webmasters/answer/34592?hl=en), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [robots](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [sitemap construction](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).
- [GA4 recommended events](https://support.google.com/analytics/answer/9267735), [enhanced measurement](https://support.google.com/analytics/answer/9216061?hl=en), [SPA page views](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [consent](https://developers.google.com/tag-platform/security/guides/consent), [retention](https://support.google.com/analytics/answer/7667196).
- [Google AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [Search generative AI control](https://support.google.com/webmasters/answer/16908024), [Generative AI performance report](https://support.google.com/webmasters/answer/16984139?hl=en). The latter two explicitly describe an August 2026 worldwide rollout, superseding older guidance that no dedicated report existed.
- [Bing AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/), [June 2026 additions](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/), [IndexNow](https://www.bing.com/indexnow/getstarted).
- [OpenAI crawlers](https://developers.openai.com/api/docs/bots), [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers).
- [llms.txt v2 proposal](https://llmstxt.org/) (modified August 2026), [Lighthouse optional llms.txt audit](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt), [agent-friendly website guidance](https://web.dev/articles/ai-agent-site-ux). OpenAI's developer crawler documentation itself advertises an llms index and Markdown alternatives; that delivery pattern does not establish a search ranking requirement.
- [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/) (updated 9 October 2026): content negotiation, response/cache behavior and plan eligibility. This is a delivery reference, not a recommendation to move the Vercel website or purchase Cloudflare service.
- [itch.io creator setup](https://itch.io/docs/creators/getting-started).

Recheck UI features and documentation during implementation. A recommended setup is not evidence it has been activated, and an empty or unavailable report is not a complete measurement of absence.
