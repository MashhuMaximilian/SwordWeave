# Discovery and measurement follow-through · 22 October 2026

This is the current evidence for Bing, Google reporting and consent verification. Mobile performance has its own trace/release record. The founder authorized the four remaining workstreams and confirmed normal GitHub-main automatic deployment; no deployment settings, paid service, advertising link, outreach or video work is part of this pass.

## Bing ownership, sitemap and indexing

The existing browser initially used the 360Design Bing account. The parent signed out of Bing and selected **the founder's agreed personal Google account** in Google's ordinary Bing sign-in flow. The existing **https://www.swordweave.quest/** property was already available; no new account, Google Search Console import grant, DNS verification or user permission was created.

- Submitted **https://www.swordweave.quest/sitemap.xml** on **22 October**. Bing first confirmed submission for processing, showing 14 URLs from its older 20 October crawl. At the later check around **10:05 Bucharest**, its table had advanced to **Success / 17 discovered URLs / last crawl 22 October**, with one known sitemap and zero errors/warnings. This confirms a successful current sitemap fetch, separately from individual-page indexing.
- **Homepage URL Inspection:** **Indexed successfully / URL can appear on Bing**, with no SEO/GEO issues reported. Its stored snapshot said no markup. The separate live test completed at **09:48 Bucharest** with **URL can be indexed by Bing**; markup insights returned a retry error. That service error is not evidence that current source JSON-LD is invalid.
- **/creating-a-character URL Inspection:** **Indexed successfully**, no SEO/GEO issues, **one JSON-LD markup type found**. Thus the property has actual indexed-page evidence beyond the homepage.
- **AI Performance:** selected **3 months / 22 July–21 October**, Microsoft Copilots and Partners: **0 citations, 0 average cited pages, no grounding-query rows**. This is the report's scope, not a universal test of every AI product.

Local browser evidence: `output/marketing/follow-through-2026-10-22/bing-sitemap-submitted.png`, `bing-sitemap-success-17.png` / `.txt`, `bing-home-indexed.png`, `bing-live-home.txt`, `bing-character-indexed.txt`, `bing-ai-performance.txt`. No request-indexing button was repeatedly pressed, and no paid upgrade or Clarity/session replay was enabled.

## Processed Google baseline

**Search Console**, personal account, domain property:

- Performance **Web / 3 months**, last update displayed **3 hours ago**: **0 clicks, 0 impressions, no query rows**. The available chart has only **19 October**. This is an immature baseline, not three months of observed demand and not grounds to abandon the existing keyword priorities.
- Aggregate **Page indexing** still says **Processing data, please check again in a day or so**. The earlier individual URL-indexed proof remains distinct from this unavailable aggregate report.
- Sitemaps retains **Success / 17 discovered pages / 0 videos**, submitted and last read **20 October**. No duplicate Google submission was necessary.

**GA4**, existing SwordWeave account **412615852**, property **559734689**:

The saved **SwordWeave · Acquisition & actions** report loaded with **All Users / last 28 complete days / 24 September–21 October**. It shows **7 sessions, 6 engaged sessions, 162 events, 5 key events**. Its source/medium rows are **(direct) / (none): 6 sessions** and **discord / social: 1 session**. These totals include the founder/internal release checks on 20–21 October. They are configuration evidence, not independent playing groups, creator acquisitions or discovery growth. No identifiable AI-source row appears in that processed snapshot. New tests on 22 October are outside this snapshot and must be labelled as further QA.

There is too little independent data for country/device winners, signup funnels or a content rewrite. Keep the US/UK comparison and existing keyword-to-page strategy; review real queries and landing pages when reports provide them. Do not equate zero identifiable AI referrals with zero AI citations.

## Event values and a tagged AI landing: actual live receipt

At approximately **09:49–09:52 Bucharest**, the parent opened this registered internal test destination:

`/press?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=alpha_01&utm_content=creator_kit`

The production privacy dialog initially showed analytics **off**. After acceptance, keyboard activation of the actual creator-kit ZIP CTA produced **media_kit_download: 1** in the correct property's Realtime report. Its parameter drilldowns visibly returned:

| Parameter | Received value |
| --- | --- |
| placement | press |
| release_version | v0.1-alpha |
| page_location | Full canonical /press URL with exactly the four registered campaign values above |

This closes the previous interrupted parameter-value check. It proves event receipt and preservation of allowed attribution inputs. It is not proof that a file transfer completed or that ChatGPT sent a real visitor. A new session's final processed **Session source / medium** and AI-channel classification still need the daily report; Realtime's First user source card is not a replacement. Google's documentation says that card uses established, already-processed users and that full processing can take 24–48 hours. [Realtime report](https://support.google.com/analytics/answer/9271392), [data freshness](https://support.google.com/analytics/answer/11198161).

Local evidence: `ga-placement-press.txt`, `ga-release-version.txt`, `ga-ai-tagged-page-location.txt` in the same dated output folder. Production consent was returned to **Essential only**; after reload the DOM contained **no Google tag, Vercel Analytics or Speed Insights scripts**.

## Consent withdrawal: real SDK transport observation

The available browser exposes no Network panel API. To avoid presenting source mocks as network evidence, the parent created an **isolated localhost diagnostic**, outside application routes, Git and deployment inputs. It bundles the unchanged source consent store, Google client and URL/event contract plus the installed real Vercel SDK injectors. UI actions were performed through the normal browser controls.

The diagnostic displays sanitized observations from native fetch/sendBeacon calls and PerformanceObserver resource records. The real Google tag uses the existing measurement ID with localhost debug mode. Vercel's real production scripts load, but their collection endpoint is a local 204 sink: payloads are discarded instead of creating production Vercel visits. No client identifiers, cookies, raw payloads or request queries are displayed or saved.

Observed lifecycle:

1. **Essential only:** attempted kit event and public-route navigation; **0 transport calls**, no analytics scripts loaded.
2. **Accepted:** real Google tag, Vercel Analytics and Speed Insights scripts loaded. Observed Google `/g/collect` and local Vercel collection calls establish that the observer detects actual SDK activity. Six transport calls occurred across the explicit test actions. The diagnostic deliberately exercises both automatic and manual Vercel navigation, so this count is not a production pageview-count assertion.
3. **Withdrawn with SDKs still loaded:** repeated kit attempts and public-route navigation, then a later checkpoint after independent report/test work: the total remained **6**, with **zero new transport calls or matching resource entries after withdrawal**. This includes time for the earlier Google batch to flush; the batch completed before withdrawal, as the phase-labelled log records.
4. **Reloaded with the stored withdrawn choice:** no SDK reload, attempted event/navigation again, **0 transport calls** in the new document.

This is bounded, actual SDK transport evidence for the tested lifecycle, stronger than DOM unmounting alone. It is not an exhaustive packet capture of every browser/SDK version, nor a substitute for the production event receipt above. Google's documented `ga-disable-MEASUREMENT_ID` control matches the implementation. [Google privacy controls](https://developers.google.com/tag-platform/security/guides/privacy).

Evidence: `consent-transport-loaded-sdk.txt` / `.png`, `consent-transport-after-reload.txt`; the diagnostic source/bundle/server are under the same ignored dated output directory. The local diagnostic must be stopped after verification. No diagnostic route, script or network observer is shipped to the website.

Focused regression verification: **11 tests pass across four files** covering auth success semantics, event/URL allowlists, Google lifecycle and the consent filter. No measurement source change was required by these observations.

## Remaining evidence, not speculative features

- **Bing:** the current sitemap is **Success / 17 URLs** and the homepage/character guide are confirmed indexed. Additional pages and search/citation activity will develop independently; sitemap success is not a guarantee that every page ranks or is cited.
- **Google:** aggregate indexing still processing; search-query baseline empty. Recheck complete reporting dates before making keyword/content decisions.
- **AI referral classification:** in the processed report after the 22 October QA data is available, check the tagged session's source/medium and AI comparison. A genuine provider referral/citation remains separate from this tagged test.
- **ChatGPT retrieval:** see the [fresh correlated request review](ai-retrieval-review-2026-10-22.md). The external reader failed without reaching Vercel during the exact window, while ordinary controls succeeded. No justified site security change emerged. A provider-side diagnostic/support investigation is the next step if this persists; sending a support message requires founder authorization.
- **Mobile performance:** retain measured lab-versus-field limits and the actual candidate/release evidence. No video or extra AI-specific markup is a prerequisite for discovery.
