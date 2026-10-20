# SwordWeave discovery plan

**20 October implementation update:** See [the implementation and verification record](discovery-implementation.md) for what is configured, tested and still awaiting evidence. The dated planning baseline below is retained for provenance.
Version 1 · 19 October 2026 · Planning and research, not a deployment checklist marked complete.

## The outcome

Help a GM discover SwordWeave, understand what makes it different, try it with a group, and return useful feedback. Signups, downloads and Discord activity support that outcome; none proves a group played.

The founder approved English-language discovery worldwide, with US and UK demand compared separately. Use one English website. Regional research does not justify duplicate US/UK landing pages. No paid ads, automatic outreach, purchased links or paid SEO subscriptions are part of this plan.

The proposed early milestone remains five independent groups completing a session, with their interest in another session recorded. It is an operating target to review with the founder, not a traffic forecast.

## Founder scope update: preserve the current website

19 October 2026: defer homepage/hero rewrites, character-page expansion, new worked-example pages and broad content/navigation changes. The founder considers the current website suitable. Proceed first with technical SEO, factual search/share metadata, AI reading formats and consented measurement while preserving visible content and design. Keyword opportunities are research, not instructions to rewrite pages.

A compact first-session section **within `/rules`** is a possible later addition. It is not a new `/start` rebuild or a prerequisite for a creator kit or itch.io draft. Existing examples and seed records must be assessed before any is presented as a validated demonstration.

The founder reports the PHB complete and the DMG/GM Guide and SRD still being revised. The 19 October [PHB release manifest](../publications/interwoven-release-manifest.json) records the illustrated PHB's production deployment and verified download. Earlier publication records describing all three books as complete do not establish current editorial readiness. Anchor release preparation on the PHB and label the other material's current status accurately.

## What exists and what remains

| Area | Verified state on 19 October | Next deliverable |
| --- | --- | --- |
| Contact/community | Contact form works in production; founder also tested it. Discord, public contact links and official icons are live. | Measure successful actions without collecting message contents. |
| Consent | Self-hosted CookieConsent v3 gates Vercel Web Analytics and Speed Insights. | Extend the same opt-in boundary to GA4; update the public privacy description. |
| Search Console | No SwordWeave property in the approved personal account’s visible property list. The open page concerned another domain. | Create and DNS-verify `swordweave.quest`; submit the finished sitemap. |
| GA4 | No SwordWeave property in the visible account picker; the open property concerned another project. No GA4 integration found in this site’s source review. | Dedicated SwordWeave account/property/web stream and tested event integration. |
| Tag Manager | No container in the approved personal account. Founder accepted deferring GTM. | Use direct GA4 integration; reconsider only for a clear operational need. |
| Keyword research | Four Google Keyword Planner exports: two seed batches, each in US and UK, English, Google network, Oct 2025–Sep 2026. | Use the curated map and continue intent validation; keep raw estimates and their limitations. |
| Technical SEO and AI access | Rendered homepage and PHB reader lack canonicals and JSON-LD. Homepage lacks Open Graph tags. Robots, sitemap and llms endpoints display 404 pages. | Deliberate indexing policy, canonical metadata, sitemap, search-crawler access, share previews, `/llms.txt` and generated public Markdown alternatives. |
| Public content | Existing pages/books stay in place. Founder reports PHB complete; DMG and SRD revisions continue. The PHB release manifest records production publication. | Preserve visible content; use the existing PHB for distribution preparation. Optional first-session section within `/rules` later. |
| Distribution preparation | The public Mashu profile is updated, with SwordWeave first and a brief Sebaka link. The private project has its saved description, theme, banner, background, cover and three actual PHB previews. Creator-kit copy, a demo outline and verified PHB file inventory are prepared locally. | Wait for all three finished PDFs, then upload the complete set and review the populated preview before public publication. |

These observations are a focused baseline. Missing canonical/schema/robots files do not prove that Google cannot index the site. Search Console is needed to establish actual indexation. No full crawl, field-performance assessment, backlink census or rank-tracking baseline has been completed.

## Working documents

- [Keyword strategy and page ownership](keyword-plan.md), with [curated keyword map](keyword-map.csv).
- [Technical SEO implementation specification](technical-seo-plan.md).
- [GA4 measurement and consent specification](analytics-measurement-plan.md).
- [AI discovery and monitoring](ai-discovery-plan.md).
- [Content and distribution backlog](content-distribution-plan.md).
- [Creator kit, itch.io copy and demonstration preparation](distribution-preparation.md).
- [Research provenance and source links](research/2026-10-19/README.md), with raw exports and the full keyword universe.

The older [alpha marketing plan](alpha-marketing-plan.md) is the historical broad outline. These documents supersede its search/measurement sections and stale service-setup statuses. [Email](email-setup.md), [Discord](discord-setup.md), and [contact/privacy](contact-and-privacy.md) retain their operational details.

## The tools and their jobs

| Tool | Decision it should support | Proposed setup |
| --- | --- | --- |
| Google Search Console | Can Google find the right pages? What queries, countries and pages generate visibility? | Domain property plus the canonical HTTPS www URL-prefix property where needed for the GA4 association. Both owned by the founder’s approved personal Google account. |
| GA4 | Which sources and paths lead to account creation, saved characters and successful contact? | One SwordWeave production property and one web stream. Europe/Bucharest reporting time. Use consented data and document its coverage limits. |
| Google Tag Manager | Do we need to let someone manage tags without application releases? | Defer for the alpha. Code-owned success hooks are needed either way; direct GA4 avoids a second publishing system. Reconsider for multiple independently managed tags. |
| Keyword Planner | How does estimated demand differ across terms and markets? | Existing account used only for approved research. Its advertising competition column is not organic SEO difficulty. No ads or billing changes. |
| Bing Webmaster Tools | Is Bing indexing the right content, and are supported AI experiences citing it? | Verify/import SwordWeave deliberately; use indexation and AI Performance reports when data exists. |
| Vercel Speed Insights | Are real users encountering slow pages or unstable layouts? | Retain behind analytics consent; supplement with lab checks when traffic is too low for field data. |
| Vercel Web Analytics | Do we still need a second page-view dashboard? | Keep during GA4 validation, then consider disabling duplicate visit collection. GA4 is the proposed primary behavioral reporting system. |

Account ownership and service access belong to the founder. Keep personal account identifiers, credentials and verification secrets outside public documentation. Do not connect this project to another business’s analytics or Ads account merely because its tab is open. Keyword research is the explicitly approved exception.

## Execution order and acceptance gates

### Phase 1: make the baseline trustworthy

Estimate the implementation after inspecting how much editorial text must move into shared HTML/Markdown sources. Account setup, output parity and consent/event validation are part of the work; a deployment alone is not completion.

1. Implement the route indexing policy, canonical metadata, sitemap and robots file, including intended AI search-crawler access; preserve existing public URLs and PDF links.
2. Add accurate social previews and small, truthful structured-data entities.
3. Create/verify the Google properties under the approved personal account; associate GA4 with the correct canonical site property when supported.
4. Implement consent-gated GA4 and the first-priority events from the measurement specification.
5. Add `/llms.txt` and synchronized Markdown alternatives for approved public editorial pages and books, with working format-discovery links. Use the existing hosting and content sources.
6. Test production and record a release annotation. Stop any local server started for that work when finished.

**Gate:** crawler files return the correct formats; sitemap contains only approved canonical public URLs; public Markdown matches its HTML source; representative page inspections work; refused consent sends no analytics; one action produces one correct event; no private text or identifiers appear in exports or payloads. A deployment alone does not satisfy this gate.

### Phase 2: prepare the materials for sharing

1. Prepare a creator-kit draft using the real project description, PHB, screenshots, official links, limitations and existing rights/disclosure notices.
2. Prepare one itch.io tabletop-project draft for the complete three-book release. Keep the evolving DMG/SRD status explicit and verify which exact files will be supplied.
3. Choose a short demonstration from an actual working flow or checked PHB procedure. Review seed content before using it; keep unverified content out of claims about tested gameplay.
4. Assemble the minimum useful cover/screenshots/file inventory. A new quickstart, adventure, character tutorial or playtest page is not required to prepare these drafts.

**Gate:** the founder can review the actual description, assets, file versions, credits and proposed page settings. Account setup, uploads and publication follow that concrete preparation.

### Phase 3: earn discovery through actual use

Founder decision, 20 October: begin creator outreach after all three books and founder-led group playtests/feedback are ready. This may take a month or more; no fixed launch date.

- Founder sends a small batch of individually researched creator messages. Reuse the existing outreach checklist; this plan does not authorize sending messages.
- Prepare an itch.io tabletop-game listing using the same release files, description and version. Founder reviews rights/disclosures and publication before it goes public.
- Publish useful short demonstrations and meaningful release notes. One demonstration can supply a webpage example, a video description and a Discord resource link.
- Participate in relevant communities according to each community’s current rules. Answer the question being asked; avoid repeated promotional link drops.
- Collect session reports, separate follow-up consent from permission to quote, and improve the product from the results.

**Gate:** outreach points to working official links and accurately described material; identity, AI-use disclosure, licenses, version and limitations agree across channels; no invented reviews or playtest claims. Offer a prepared session only once such a package exists; sharing the current alpha for evaluation does not imply it includes one.

### Phase 4: revise from evidence

Suggested review points: 28 days after measurement activation, then 8–12 weeks. Data may remain sparse.

- Use Search Console queries and landing pages to revise keyword priorities.
- Compare US and UK demand and actual visitors separately; do not assume the larger market converts better.
- Expand content only when an intent gap is both relevant and inadequately answered by an existing page.
- Promote repeated Discord/rules questions into useful public explanations.
- Review AI visibility alongside referral traffic and actual play outcomes.

## Reports that change decisions

| Report | Read it for | Response |
| --- | --- | --- |
| Search: brand/non-brand × page × country | Indexing gaps, unexpected intent, emerging relevant questions | Fix discovery or improve the page matching that intent. |
| Acquisition: source/medium/campaign → landing page → key action | Whether creators, search, itch or videos bring suitable people | Improve the offer/path or prioritize the source with evidence of fit. |
| Activation: signup → successful character creation | Whether new users reach a usable first result | Investigate the actual blocked step. Report consented sample sizes. |
| Contact: first interaction → accepted submission/error | Whether the form or delivery is failing | Fix functionality; do not optimize for more button clicks. |
| Resources: book/download/Discord placement | Which material people seek | Improve navigation. Do not equate clicks with reading or joining. |
| Playtest ledger | Sessions completed, friction, willingness to play again | Change preparation, rules or tools. This is the principal outcome. |

Suggested maintenance budget: 20–30 minutes weekly for reporting and a monthly AI/distribution review. A weekly content-production commitment is deferred. These are proposed habits, not scheduled automations. Start with counts and examples. Small differences in conversion rates or a single AI answer are not reliable evidence of a winner.

## Scope for the next implementation

Ship the technical foundation and measurement first as one reviewable change set, preserving the current hero and page content. Keep the existing creator/itch drafts; upload and present all three books together once ready. Keep the possible first-session section on `/rules` separate and defer new character/worked-example content. Printed-edition sales, newsletters, large comparison libraries, multilingual pages and paid acquisition remain later work.
