# Discovery implementation · 20 October 2026

## Release scope

Preserves the visible homepage, hero, page design and publication/editor work. The PHB download routing already live from the separate publication deployment is included so this release does not roll it back. The founder will upload all three completed PDFs together to the still-private itch.io project. Creator outreach follows founder-led group playtests and feedback, potentially a month or more later.

## Search and AI access

- Fourteen curated public canonical HTML URLs, each with its own metadata, Open Graph/Twitter image and accurate small JSON-LD graph. Root fallback is noindex; UGC, private/auth/tool routes and non-production previews do not enter the sitemap.
- `/robots.txt` allows public search crawlers through the wildcard rule, including OAI-SearchBot, Bingbot, PerplexityBot and Claude-SearchBot. Training behavior has not been changed. Search access is not a guarantee of inclusion or a security boundary.
- `/sitemap.xml` contains the fourteen HTML destinations without invented modification dates. Query/filter URLs are excluded. Registered UTM parameters retain the clean canonical; other parameterized views receive noindex.
- `/llms.txt` links the approved public Markdown exports, licensing and official contact/community. It is a discovery aid, not a Google ranking factor.
- `/index.md` and the thirteen other public `.md` alternatives are advertised by HTML alternate links. Books and the complete interactive play guide serialize their existing structured source. Other editorial pages convert anonymous, allowlisted canonical HTML at request time, cached for five minutes. This avoids separate manually maintained copy; source unavailability returns 503 rather than fabricated text. Local production-build QA uses the live canonical editorial HTML; test private/draft/unknown Markdown returns 404.
- Online-reader text and newer PDF editions are explicitly distinguished. Private/account/UGC content, cookies and authentication are never forwarded into exports.

## Google configuration

Founder-owned personal Google account; unrelated business properties were not modified. Dedicated SwordWeave account, property and web stream; direct Google tag, with no manually managed GTM container. Measurement ID: `G-LXKDVDEHQZ` (public configuration, not a credential). Production Vercel environment variable: `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

Search Console domain and canonical HTTPS www properties verified through one added Porkbun TXT record; existing mail, Clerk and Vercel records preserved. The canonical property is linked to the SwordWeave Analytics stream. New Search Console reports initially show processing, not established traffic/ranking results.

GA4 event retention and user retention: two months; activity extension off. Optional account sharing off; Google Signals and user-provided data off; advertising personalization disabled for all regions. No Ads links, user IDs, cross-domain tracking, BigQuery or paid resources. Enhanced measurement off to avoid uncontrolled form/search/outbound/download/history events. GA's ordinary first_visit, session_start and user_engagement events still exist.

Eight event-scoped reporting dimensions: page_group, placement, book_id, edition, release_version, creation_flow, form_id, error_type. Signup, character creation and contact success are key events, once per event, with no default monetary amount. GA's built-in purchase entry remains unused.

## Event and consent behavior

CookieConsent revision 1 names Google and requires a new analytics choice. No Google script or queued interaction events before acceptance; refusal persists. Withdrawal gates application producers, sets Google's disable flag, drops pending commands and clears supported analytics cookies. Initial hydration does not clear an existing opted-in session while the consent store loads.

Explicit events: page_view, contact_form_started, contact_form_error, generate_lead, copy_contact_email, discord_invite_click, file_download, support_click, character_created, sign_up and login. The typed/runtime allowlist rejects unknown parameters. Public URLs keep only registered campaign labels; private routes use a fixed synthetic context and no public page view. No names, messages, account/character IDs, arbitrary titles, usernames, search terms or URL secrets are sent.

Auth events require a completed Clerk attempt whose created session is active (and exact created user for signup). Existing/restored sessions and stale attempts are excluded. This conservative hook can undercount redirect/provider flows if Clerk no longer exposes the completed attempt; it must not be interpreted as an exhaustive account census. Provider-by-provider manual completion QA is still needed before relying on the signup funnel. Clone/import/edit/preview are not counted as a new guided character creation.

Localhost events are tagged debug_mode. A download event is a click, a Discord event is an invite click, and generate_lead means SMTP acceptance—not reading, joining, inbox delivery or a qualified partnership.

## Validation and remaining evidence

- 38 focused tests: consent/withdrawal, safe URLs and parameters, exact auth completion proof, existing contact delivery/failure contracts, book/source exports, metadata/sitemap and publication redirects.
- Focused lint and Next production build pass.
- Local HTTP check: all fourteen HTML routes have their own canonical, index directive, social metadata and structured data; all fourteen Markdown alternatives return text/markdown. Unknown/private Markdown returns 404. Social image inspected at 1200×630.
- Browser: Google script absent before consent and after refusal/reload; acceptance loads one correct measurement tag. Actual contact form reaches Message sent.
- Google DebugView receives the test browser's page/session events. Production receipt and sitemap submission are recorded below once released.

Use the saved keyword map as the dated baseline (1,092 provider rows, 540 distinct queries; 138 curated candidates, with hypotheses clearly distinguished). Review actual queries/landing pages/country and consented successful actions after enough data exists; do not forecast traffic from Keyword Planner buckets. Acquisition reports already supplied by GA4 cover sources/countries. Build richer saved funnels/explorations after real actions and dimensions have processed; do not invent results from the empty initial property. Bing ownership/AI Performance and later founder playtest reporting remain follow-up work.

## Production verification

- Code release `5d21dd01`, pushed to GitHub main; automatic Vercel production deployment `dpl_9YSzV9ETVaDDrer93L7qth9n64K8` is Ready. Canonical host is https://www.swordweave.quest.
- Live browser confirms the new SEO title, canonical, index/follow directive and Markdown alternate, with no Google tag before the new consent choice.
- A real production form submission reached Message sent. GA4 Realtime shows contact_form_started, generate_lead and copy_contact_email alongside page views; generate_lead is recognized as a key event. Local and production QA submissions are test activity, not real leads.
- Search Console successfully fetched the submitted sitemap and reports **14 discovered pages**, status **Success**. Discovery is not the same as indexing. Initial homepage inspection said unknown to Google. The live Google test then reported “URL is available to Google” / “Page can be indexed”; the homepage indexing request was accepted. Actual indexing/rankings remain to be observed.
- The live PHB Markdown download is 345,364 bytes (SHA-256 4e695b8ff7916a350e62759f3d440a75b26df1a93919891820a54a8256cb35da); its full reader text and edition warning are present. The live Privacy Markdown export includes the new Google disclosure and 20 October update, confirming canonical-HTML synchronization.
- Browser refusal/withdrawal persists across reload and the Google script is then absent. Live provider-by-provider auth and guided new-character persistence QA remain outstanding; do not present their funnel as complete evidence yet.
- Local test server stopped after verification.

Campaign values are registered in `src/lib/analytics/contract.ts`. Add each approved public creator/source and asset label there before issuing campaign links; arbitrary UTM values are intentionally discarded. No internal navigation UTMs.
