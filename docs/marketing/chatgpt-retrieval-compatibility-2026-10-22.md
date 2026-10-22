# Concrete ChatGPT retrieval result · 22 October 2026

Consumer ChatGPT Search **can retrieve SwordWeave's HTML Rules page**. The independent test also identified a specific Markdown compatibility issue: the origin successfully returns Markdown, then the consumer reader rejects its `text/markdown` media type. This supersedes any broad inference that ChatGPT cannot reach the website.

The parent operated an independent temporary consumer ChatGPT conversation with Search explicitly selected and a source-only prompt. This subtask used no browser/account UI and independently read the corresponding Vercel CDN records. The reported consumer response is attributed to the parent; the CDN observations below were obtained directly through cached Vercel CLI. No source, account, hosting, security or DNS setting was changed by this subtask. Only diagnostic evidence was written by that subtask.

## Matched pre-fix Markdown attempt

The parent sent the independent test at approximately **08:30:04–08:30:10 UTC** and observed:

> Failed to fetch: (400) Unsupported content-type: text/markdown

The response identified `https://www.swordweave.quest/rules.md` and declined to invent its headings. The exact canonical-host CDN window **08:30:00–08:32:00 UTC** contains one request:

| Field | Value |
| --- | --- |
| Timestamp | `2026-10-22T08:30:10.412Z` |
| Path | `/rules.md` |
| Request ID | `gjgtf-1792657810412-d72512b65f22` |
| Origin/CDN status | **200** |
| WAF action | **allow** |
| Cache | MISS |
| Route | `/api/discovery/[...discovery]` |
| Client user agent | `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot` |
| Country | PL |
| Deployment | `dpl_F2wVjw6SiPiCCXg38DSZbmFDbE8a` |

The log summary has `recordsReturned: 1`, `hasMore: false`, `excludedIntervals: []`. The website's response was not HTTP 400; the **consumer reader generated the unsupported-type error after an allowed HTTP 200 delivery**. The time/path match with the controlled consumer test establishes a meaningful correlation without claiming cryptographic bot verification from a user-agent string alone.

## Independent cross-site MIME control

During the **08:32 UTC** follow-through, this subtask opened the official OpenAI alternative `https://developers.openai.com/api/docs/bots.md` using the available web reader. It returned the same explicit error:

> (400) Unsupported content-type: text/markdown

The corresponding official HTML documentation URL had already retrieved successfully. This reproduces the MIME limitation on another site's documented Markdown alternative; it is not evidence that SwordWeave's Markdown serialization or firewall is malformed. It also explains why API/file-upload documentation accepting Markdown is not sufficient evidence of web-reader support: these are different processing paths.

## Matched successful HTML control

The parent then asked the same independent consumer Search surface to retrieve the canonical HTML Rules page. It returned a source citation and the expected H1 **Rules & play guide**, with headings **Keep the core rules at your table** and **Your first game**. The exact `/rules` CDN window **08:32:00–08:36:00 UTC**, queried after it ended, contains one request:

| Field | Value |
| --- | --- |
| Timestamp | `2026-10-22T08:32:08.450Z` |
| Path | `/rules` |
| Request ID | `gg29z-1792657928450-09e52f3709ed` |
| Origin/CDN status | **200** |
| WAF action | **allow** |
| Cache | PRERENDER |
| Client user agent | Same `ChatGPT-User/1.0` string |
| Country | PL |
| Deployment | Same production deployment |

Its summary also has `recordsReturned: 1`, `hasMore: false`, `excludedIntervals: []`. The parent-observed cited answer plus this matched request confirms actual consumer HTML retrieval. The earlier Codex-tool generic no-request failures remain a separate tool/surface observation, not a site-wide ChatGPT access verdict.

## Compatibility recommendation and exact limit

`text/markdown` is a registered media type, and Markdown is a family of plain-text syntaxes. The original MIME choice was technically legitimate; the observed consumer does not support it. [RFC 7763](https://www.rfc-editor.org/rfc/rfc7763.html)

For SwordWeave's existing source-reading URLs, serving the **unchanged Markdown characters as `text/plain; charset=utf-8`** is a reasonable universal compatibility fallback: recipients can display the source as-is without interpreting formatting. This is an engineering recommendation based on the reproduced failure, not a claim that OpenAI officially mandates that publisher configuration. [RFC 2046, text/plain](https://www.rfc-editor.org/rfc/rfc2046.html#section-4.1.3)

Prefer retaining the existing `.md` URLs and body bytes over adding another duplicate endpoint. Update their declared alternate/link MIME hints to match the response, while preserving the Markdown labels/syntax, canonical HTML targets, `noindex, follow`, inline delivery and existing public allowlist. The same behavior should apply to everyone; no user-agent sniffing or security exception is needed. A link's type hint represents its linked resource's media type. [HTML link type documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#type)

The parent is implementing and testing that bounded transport change. **Post-change Markdown retrieval has not yet been verified in this artifact.** Acceptance requires the new response type and unchanged text/access boundaries to pass source/HTTP tests, followed by a fresh consumer source-only Markdown attempt and its actual answer/citation, ideally correlated with a new allowed CDN request. A cached previous error must not be reported as a new origin failure.

No indexing, search ranking, citation frequency or general AI-discovery outcome is established by this single successful HTML test. It closes the concrete question of whether a user-triggered consumer ChatGPT request can reach and read this public HTML page.
