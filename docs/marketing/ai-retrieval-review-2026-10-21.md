# AI retrieval review · 21 October 2026

SwordWeave's public HTML and Markdown remain accessible through ordinary HTTP, but the available external web reader still cannot retrieve the exact canonical URLs. This review found no matched OpenAI request or blocking event that explains that reader failure. It does not justify a firewall exception, a hosting migration, an alternate origin or an indexing-policy change.

This is a read-only source, live HTTP, primary-documentation and CDN-log review. It preserves the current design. Schema and mobile performance have separate workstreams. The review changes no application code, security setting, account, publication file or outreach message.

## Current publication and source context

The [keyword strategy](keyword-strategy.md) remains the editorial decision layer: one English site, eight distinct page priorities, and US/UK evidence compared separately. There is no new keyword-demand or ranking evidence in this pass to justify a homepage rewrite or extra generic landing pages.

Both revised GM Guide PDFs and the standalone SRD Reference PDF are now published. The founder's SRD publication request and source release `40a0536c` supersede older notes saying the SRD is pending. Live `/llms.txt` explicitly identifies the available Reference edition and preserves the distinction between downloadable PDF editions and the existing online readers. This review does not claim that every book edition has been reconciled editorially.

Observed CDN request records during this review identify production deployment `dpl_GWEeqiXxjhVEZKVNjk7ANcD1rchg`. That is the deployment actually serving the checks, rather than an assumption that the first SRD deployment is still the active alias.

## Ordinary retrieval and format discovery

At **11:51:30 UTC / 14:51:30 Bucharest**, a bounded HTTP matrix returned:

| Check | Observed result |
| --- | --- |
| `/`, `/rules`, `/creating-a-character`, `/books/srd` | HTTP 200 HTML; their correct HTML canonicals and Markdown alternate links present; no `noindex` HTTP header. |
| `/index.md`, `/creating-a-character.md` | HTTP 200 `text/markdown; charset=utf-8`; correct HTML canonical and llms index in HTTP `Link`; no attachment disposition. |
| `/llms.txt` | HTTP 200 `text/plain`; current game/alpha identity and available SRD Reference edition. |
| `/robots.txt` | HTTP 200; wildcard allows `/`, disallows `/api/`, and declares the canonical sitemap. There is no more-specific OpenAI disallow group. |
| `/sitemap.xml` | HTTP 200 XML containing the same 17 curated canonical HTML URLs. |
| Unknown `/private-test.md` and the public Orren record's `.md` URL | HTTP 404 with `noindex`; arbitrary saved records are outside the export allowlist, including this public demo. |

A second complete matrix during the same review checked all **17 HTML pages and 17 Markdown alternatives** from `pages.json` plus the publication catalogue. Every pair returned 200; every HTML response contained its correct canonical, Markdown alternate and exactly one H1; none contained a detected noindex directive. Every Markdown response had the expected MIME type, a title, its public source URL and no attachment disposition. This is format/access evidence, not a substitute for all content-parity tests or rendered interaction checks.

The Markdown alternatives deliberately retain `noindex, follow` with the HTML canonical. That keeps HTML as the intended search result. It does not block an ordinary request from reading the Markdown: the observed 200 responses demonstrate this directly. Robots also evaluates the public `.md` URL, rather than the internal application rewrite under `/api/discovery/`.

Source checks retain the explicit public export allowlist, complete shared-source learning readers and books, and authentication/publication boundaries for arbitrary records. This pass did not broaden the sitemap to every public community record. Public visibility and suitability for search indexing remain separate decisions.

## External reader and search observations

The available `web.run` reader was asked to open these exact canonical URLs:

- `https://www.swordweave.quest/`
- `https://www.swordweave.quest/rules`
- `https://www.swordweave.quest/creating-a-character.md`
- `https://www.swordweave.quest/index.md`
- `https://www.swordweave.quest/llms.txt`
- `https://www.swordweave.quest/robots.txt`
- `https://www.swordweave.quest/sitemap.xml`
- `https://www.swordweave.quest/books/srd`

All returned “not accessible via this tool.” The tool supplied no HTTP status, response body, request ID, client address or reason. It successfully retrieved current OpenAI, Google, Vercel and Perplexity documentation in the same review. This reproduces an unresolved provider-reader failure; it does not establish that all ChatGPT clients fail or that SwordWeave's server denied a request. The tool can also use cached decisions, so a repeated error does not prove a fresh network request occurred.

Six narrow search formulations were sampled: `"SwordWeave" tabletop RPG official`, `site:swordweave.quest SwordWeave`, `"swordweave.quest" rules`, `site:swordweave.quest`, `"swordweave.quest"`, and `"SwordWeave" "tabletop"`. No canonical SwordWeave page appeared in the returned sample; unrelated word matches did. This is neither an unbiased ChatGPT recommendation benchmark nor a Google/Bing index census. The earlier actual Search Console inspection confirming `/creating-a-character` indexed remains separate, stronger evidence for that URL's Google state.

## CDN correlation narrows the uncertainty

Vercel CLI **64.5.0** exposes CDN request records through `vercel logs requests`. Read-only checks now provide more than the earlier configuration-only review:

- The ordinary HTTP requests above match the exact `x-vercel-id` values in CDN logs. Each intended public response was `httpStatus: 200` and `wafAction: allow`. The saved-record/unknown Markdown checks match deliberate application 404s with `wafAction: allow`.
- Example: `/rules` at `2026-10-21T11:51:30.975Z`, request `8wl68-1792583490975-491d06b9d852`, returned 200, `HIT`, `allow`. `/creating-a-character.md` at `11:51:30.972Z`, request `sws48-1792583490972-52eb0cd0a8cd`, returned 200, `MISS`, `allow`.
- A production/canonical-host query for `OAI-SearchBot`, `ChatGPT-User` or `GPTBot` user-agent substrings over **09:51:55–11:51:55 UTC** returned **0 records**, `hasMore: false`, `excludedIntervals: []`.
- A canonical-host query for status 400+ over approximately the same two-hour window returned six records: the two deliberate Markdown 404s, three Lighthouse probes of the optional `/.well-known/ai-catalog.json` returning 404, and one unrelated `/wp-admin/install.php` probe denied with 403. No public reader failure appeared in that result.
- A `deny`/`challenge` query returned only that unrelated WordPress probe, with no further pages. An optional catalogue probe does not establish a required discovery feature or justify inventing an AI API catalogue.
- Current firewall status: enabled, attack mode off, zero IP blocks, one active custom rule, Bot Protection off, AI Bots allow, OWASP off. This review changed none of them. Existing source notes identify the custom rule as the contact POST rate limit.

Reproducible read-only commands, from the linked worktree:

```sh
vercel logs requests --environment production --since 2h --limit 50 --json \
  --query 'requestHostname:"www.swordweave.quest" AND (clientUserAgent:*OAI-SearchBot* OR clientUserAgent:*ChatGPT-User* OR clientUserAgent:*GPTBot*)'
vercel logs requests --environment production --since 2h --limit 50 --json \
  --query 'requestHostname:"www.swordweave.quest" AND httpStatus >= 400'
vercel logs requests --environment production --since 2h --limit 50 --json \
  --query 'requestHostname:"www.swordweave.quest" AND wafAction:("deny" OR "challenge")'
vercel firewall status
```

The actual invocation used the already-cached CLI, with no package installation. Logs were inspected without printing client IPs, credentials, session values or private request bodies.

The zero matching user-agent result is useful but limited. The web reader does not expose its real user agent, a cache decision may not contact the site, and a user-agent name alone would not verify bot identity even if present. These checks therefore do not prove OpenAI never requests the site, nor do they prove a complete absence of upstream network issues. They show that no identifiable failing request supports a site-side security change in the observed window.

## Primary guidance checked this run

OpenAI distinguishes **search discovery** (`OAI-SearchBot`), **model training** (`GPTBot`) and **user-requested visits** (`ChatGPT-User`). Its search guidance recommends permitting the search crawler and its published IP ranges. The site's wildcard rule already permits it; adding a duplicate named allow group would not repair an unexplained reader error. A self-declared local user agent is not evidence of a verified OpenAI request. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots)

Google requires an indexed, snippet-eligible page for supported AI search links and recommends accessible text, internal links, page experience and accurate structured data. It requires no special AI file or AI-specific schema. The existing Markdown and llms formats are useful additional reading paths, without a demonstrated ranking or citation bonus. [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)

Google's newer dedicated help page documents the Generative AI performance report, including AI Overviews/AI Mode impressions by canonical page, country and device; insufficient impressions can prevent the report appearing. Keep that actual report's state separate from the older general guidance and from ChatGPT evidence. No live report data was fetched during this subtask. [Search Console Generative AI report](https://support.google.com/webmasters/answer/16984139?hl=en)

Vercel documents verified-bot signals separately from arbitrary client identity. A narrow exception would require an identified false-positive block on the intended public read route, rather than an unverified user-agent bypass. [Vercel verified bots](https://vercel.com/docs/botid/verified-bots)

Perplexity separately documents its search crawler, published network ranges and user-requested retrieval. That supports purpose-specific diagnostics rather than treating every AI crawler as training or assuming one provider's result establishes another's. No fresh real Perplexity/Claude retrieval result is claimed here. [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

The installed skill's unsupported visibility percentages, mandatory-file implications and broad schema prescriptions are not adopted as causal evidence. No paid visibility service, vendor score, `llms-full.txt`, OKF bundle, WebMCP surface, fabricated FAQ/review or mass-produced content is needed to resolve the observed access uncertainty.

## Actions and follow-up

| Priority | Action | Acceptance evidence |
| --- | --- | --- |
| Current release | Retain the 17 canonical destinations, correct public Markdown links, complete reader sources, accurate publication status and current access boundaries. Recheck them after any parent changes. | Endpoint matrix and existing parity/boundary tests pass on the candidate; production smoke matches. |
| Current release | Complete the independent schema review and mobile loading work without changing the current design. | Appropriate source/rendered validation and measured before/after results, with limitations recorded separately. |
| Retrieval diagnosis | On the next fresh real ChatGPT/user-reader attempt, capture exact UTC time, canonical path and tool error. Inspect the same CDN window and any actual request ID/verified identity. | A matched success establishes that path worked; a matched failure supplies a status and policy/network cause. Do not label the current issue fixed without this. |
| If no request reaches CDN | Retain the evidence above for a provider/hosting support investigation if the problem persists. Prepare a concise reproduction with exact URLs/times and separate ordinary successes; obtain permission before sending external support messages. | A provider-side explanation or reproducible network evidence, rather than speculative WAF changes. |
| Next evidence review | Read processed Google/Bing indexing, query/page/country/device and AI reports; compare the same date range and actual counts. Review identifiable AI referrals and actual citations separately. | A real query/landing-page or citation mismatch justifies the next small change. Processing/no-data states remain explicit. |
| After founder playtests and release preparation | Make the now-available books easy to evaluate on itch.io and in founder-led creator/community participation, following the founder's timing. Preserve consistent project identity, official source links, alpha limitations and feedback route. | Real public listings/coverage and useful table feedback; no automatic outreach or publication is authorized by this review. |

Videos remain deferred. There is no video prerequisite for discovery. More immediate SEO pages are not the missing step; after the technical work, the highest-value new input is real indexed-query evidence and credible independent use/coverage. Book/online-reader consistency remains its own workstream rather than a hidden SEO rewrite.
