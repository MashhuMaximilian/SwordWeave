# AI retrieval follow-through · 22 October 2026

The external web reader still reports that SwordWeave's canonical pages are inaccessible, while ordinary requests succeed. Today's clean, timed log comparison found **no canonical-host request at all during the reader attempt**. The concrete unresolved blocker is therefore missing provider-side retrieval diagnostics: there is no response status, request identity or matched site-side failure to repair. No application, firewall, DNS or hosting change is justified by that error alone.

This continues the [21 October review](ai-retrieval-review-2026-10-21.md). It is a read-only retrieval and CDN-log check; this document is the only file authored by the subtask. No browser/account UI, security changes, external support message, installation or deployment was used. Current design and existing indexing/access boundaries remain intact.

## Fresh external-reader attempt

The call was bracketed by the clock tool at **2026-10-22 06:42:11–06:42:13 UTC**, corresponding to **09:42:11–09:42:13 Europe/Bucharest**. One `web.run` open batch requested:

| Exact requested URL | Result |
| --- | --- |
| `https://www.swordweave.quest/` | Not accessible via this tool. |
| `https://www.swordweave.quest/rules` | Not accessible via this tool. |
| `https://www.swordweave.quest/index.md` | Not accessible via this tool. |
| `https://www.swordweave.quest/rules.md` | Not accessible via this tool. |
| `https://www.swordweave.quest/llms.txt` | Not accessible via this tool. |
| `https://developers.openai.com/api/docs/bots` | Retrieved successfully in the same batch. |

Each SwordWeave result supplies only the generic tool error. It provides no HTTP status, body, remote address, user agent or request ID. A repeated tool invocation can use cached access decisions; “fresh attempt” here means a new invocation, not proof that it initiated a fresh HTTP request. This is not an unbiased ChatGPT recommendation benchmark and does not establish failure in every ChatGPT client or AI-search platform.

## Exact CDN correlation

Cached **Vercel CLI 64.5.0** queried production request logs for the canonical host. The window **06:42:00–06:42:20 UTC** covers the external-reader call and ends before this subtask's ordinary HTTP checks. It returned:

```json
{
  "recordsReturned": 0,
  "timeRange": {
    "start": "2026-10-22T06:42:00.000Z",
    "end": "2026-10-22T06:42:20.000Z"
  },
  "pagination": { "hasMore": false, "next": null },
  "excludedIntervals": []
}
```

A wider canonical-host query for status **400+** or WAF **deny/challenge** over **06:40:00–06:43:00 UTC** also returned zero records, with no additional page or excluded interval.

A separate query for `OAI-SearchBot`, `ChatGPT-User` or `GPTBot` user-agent substrings over **04:43:27–06:43:27 UTC** returned zero records, `hasMore: false`, `excludedIntervals: []`. A user-agent match alone would not verify bot identity if one appeared. The absence of these names also cannot identify an unspecified reader client or prove that OpenAI never crawls the site.

The canonical-host scope and selected windows matter. The results support **no matched site-side request/failure during this attempt**, rather than a claim that every upstream network layer is healthy or that the site has no errors at any time.

## Ordinary HTTP control succeeded and matched CDN logs

Node `fetch` then made ordinary, unspoofed `node` user-agent requests at **06:42:39.372–06:42:41.090 UTC**. These did not run during the clean reader window. All seven endpoints returned 200:

| Path | Bytes | Response and discovery evidence |
| --- | ---: | --- |
| `/` | 151,239 | HTML; correct canonical `https://www.swordweave.quest`; no `X-Robots-Tag`. |
| `/rules` | 228,374 | HTML; correct Rules canonical; no `X-Robots-Tag`. |
| `/index.md` | 10,479 | `text/markdown; charset=utf-8`; public title; HTML canonical and llms index in `Link`; no attachment disposition. |
| `/rules.md` | 75,046 | Same correct Markdown MIME/link/disposition behavior; title `Rules & play guide`. |
| `/llms.txt` | 5,729 | `text/plain; charset=utf-8`; title `SwordWeave`. |
| `/robots.txt` | 90 | Wildcard permits `/`, disallows `/api/`, and declares the canonical sitemap. |
| `/sitemap.xml` | 1,204 | XML with 17 canonical URLs. |

Markdown retains `noindex, follow` and its HTML canonical. This selects HTML as the intended search result; it did not prevent the successful ordinary Markdown reads. The llms, robots and sitemap responses also retain their existing noindex headers; this review changed none of them.

The **06:42:35–06:42:50 UTC** CDN query returned all seven exact request IDs, each with **HTTP 200 / WAF allow**, and one additional successful homepage request from the Markdown source fetch. It had `hasMore: false` and no excluded intervals. Examples:

| Path | CDN timestamp UTC | Request ID | Cache |
| --- | --- | --- | --- |
| `/` | `06:42:39.718` | `dg554-1792651359718-21a6c9fc1578` | HIT |
| `/rules` | `06:42:39.870` | `v6kln-1792651359870-7368532d7f61` | PRERENDER |
| `/index.md` | `06:42:40.230` | `8nbmp-1792651360230-dc15c708290e` | MISS |
| `/rules.md` | `06:42:40.764` | `8nbmp-1792651360764-186d46821978` | MISS |
| `/llms.txt` | `06:42:40.866` | `8nbmp-1792651360866-89a5e44083ea` | MISS |

The observed production deployment is **`dpl_FsyPA7HhoUjaqeZvum1AixACXJWQ`**. The inspected worktree HEAD was **`be19f64f9183822fff5cf53e3ad4b67b3ee83e0f`**. These identifiers are recorded separately; no claim is made that a deployment identity can be inferred from a local commit without checking its metadata.

An attempted 24-hour log query returned HTTP 402 because CDN request records older than 12 hours require a paid entitlement on this project. No upgrade, purchase or retry of that unavailable range was made. The successful two-hour and exact-window queries provide the evidence needed here; the billing limit is not a reason to pay or weaken security.

## Bounded hostname, cache and search follow-up

At the parent's request, one additional batch ran at **07:02:07–07:02:09 UTC / 10:02:07–10:02:09 Bucharest**:

| Probe | Actual web-tool result |
| --- | --- |
| Search `site:swordweave.quest` | No results returned. |
| Search `"SwordWeave" "modular tabletop"` | No results returned. |
| Open normal apex `https://swordweave.quest/` | Not accessible via this tool. |
| Open `https://www.swordweave.quest/rules?retrieval-check=2026-10-22` | Not accessible via this tool. |

The **07:02:00–07:02:20 UTC** CDN query covering both canonical and apex hostnames returned zero requests, no next page and no excluded interval. The parent independently reports Bing now confirms indexing for the homepage and `/creating-a-character`; this subtask did not inspect that account. The empty search-tool sample therefore must not be described as proof of absent Bing indexing. Different indexes, provider decisions and query handling remain possible explanations, without enough diagnostics to choose one.

Ordinary controls then established that the normal redirect and query handling work:

- Apex at `07:02:36.458Z`: **308** to `https://www.swordweave.quest/`, request `rlvmx-1792652556458-0ccf6f27cd10`, CDN `allow`.
- Query-qualified Rules at `07:02:36.667Z`: **200**, 228,374 bytes, canonical still `/rules`, request `ct7n7-1792652556667-064283f29e45`, CDN `allow`. Its existing `noindex, follow` query policy is correct; the temporary diagnostic URL is not a proposed search destination.

Read-only Vercel inspection identified `sword-weave-phi.vercel.app` as an existing alias of the **Ready production deployment**, rather than an invented or preview hostname. An unauthenticated ordinary GET first confirmed **200**, the same 151,239-byte public homepage, its existing hero and the canonical `https://www.swordweave.quest`. That control matched CDN request `55tbv-1792652577470-ca35416965f3` at `07:02:57.470Z`, with `allow`.

A single web-tool open of that already-public production alias at **07:03:03–07:03:07 UTC** also returned the generic inaccessible error. The alias's **07:03:00–07:03:15 UTC** CDN window contained zero records, no next page and no excluded interval. The ordinary-controls window **07:02:30–07:03:00 UTC** contained exactly the three matched control requests above, confirming that these hostname filters can return their traffic.

Changing from www to apex, adding a query marker, and comparing the known public production alias did not produce a reader request or a successful retrieval. This gives no support to a simple www redirect defect or a `.quest`-only diagnosis. It still does not reveal the provider's decision or prove that all third-party readers fail. The canonical site, aliases, redirects, security and indexing policy remain unchanged. The alias is a diagnostic control, not a promoted replacement URL or an access workaround. Stop repeating generic probes until new provider/request evidence is available.

## Reproduction and next action

The exact-window queries can be repeated with the existing cached CLI from the linked worktree:

```sh
vercel logs requests --environment production \
  --since 2026-10-22T06:42:00Z --until 2026-10-22T06:42:20Z \
  --limit 50 --json --query 'requestHostname:"www.swordweave.quest"'
vercel logs requests --environment production \
  --since 2026-10-22T06:42:35Z --until 2026-10-22T06:42:50Z \
  --limit 50 --json --query 'requestHostname:"www.swordweave.quest"'
```

The actual executable was `node /Users/max/.npm/_npx/69f9afb961c37556/node_modules/vercel/dist/vc.js`; the abbreviated examples assume that version on PATH. Do not expect these historical windows to remain available indefinitely under the current retention entitlement. The summarized evidence above preserves today's observation without exporting visitor addresses or credentials.

[OpenAI's current crawler documentation](https://developers.openai.com/api/docs/bots), retrieved successfully today, continues to separate search discovery (`OAI-SearchBot`), model training (`GPTBot`) and user-requested retrieval (`ChatGPT-User`). The existing wildcard robots rule permits the search crawler. The presence of Markdown and llms files does not establish indexing or a guaranteed citation.

**Actionable blocker:** obtain an actual provider retrieval result with a status/request ID or a provider explanation for the access decision. Today's exact URLs, clock interval, empty canonical-host log window and matched ordinary controls form a concrete support reproduction if the founder later authorizes sending it. This review sends nothing externally. Do not repeatedly change robots, add duplicate allow groups, disable WAF or introduce an alternate origin without a matched cause.

Continue the other authorized workstreams independently: mobile performance, rendered schema validation, and actual processed Search Console/Bing query and AI-report evidence. A manual citation/referral baseline should record real source URLs and distinguish retrieval, mention, citation and referral. No new ranking, citation, Google/Bing indexing count or AI-traffic claim is established by this pass.
