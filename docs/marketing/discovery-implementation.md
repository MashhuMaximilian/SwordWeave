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

Auth events originally required a completed Clerk attempt whose created session is active (and exact created user for signup). Follow-through QA found that a provider redirect can clear the attempt before the app mounts. The updated hook also accepts a consented, same-tab signed-out auth-page marker plus a session created after that marker. It excludes session IDs already present before the attempt, classifies a genuinely new user by the user creation timestamp, consumes the marker, and deduplicates the session. It waits for Clerk readiness; stale markers expire after 30 minutes. IDs/timestamps remain local, never GA parameters. Restored sessions/reloads do not count. Missing storage or clock skew can undercount; this is not an exhaustive account census. Google login, a new registration and both guided creation flows are verified below; an existing email/password login also reached the working Atelier using the browser's existing form state. Clone/import/edit/preview are not counted as a new guided character creation.

Localhost events are tagged debug_mode. A download event is a click, a Discord event is an invite click, and generate_lead means SMTP acceptance—not reading, joining, inbox delivery or a qualified partnership.

## Validation and remaining evidence

- 38 focused tests: consent/withdrawal, safe URLs and parameters, exact auth completion proof, existing contact delivery/failure contracts, book/source exports, metadata/sitemap and publication redirects.
- Focused lint and Next production build pass.
- Local HTTP check: all fourteen HTML routes have their own canonical, index directive, social metadata and structured data; all fourteen Markdown alternatives return text/markdown. Unknown/private Markdown returns 404. Social image inspected at 1200×630.
- Browser: Google script absent before consent and after refusal/reload; acceptance loads one correct measurement tag. Actual contact form reaches Message sent.
- Google DebugView receives the test browser's page/session events. Production receipt and sitemap submission are recorded below.

Use the saved keyword map as the dated baseline (1,092 provider rows, 540 distinct queries; 138 curated candidates, with hypotheses clearly distinguished). Review actual queries/landing pages/country and consented successful actions after enough data exists; do not forecast traffic from Keyword Planner buckets. Acquisition reports already supplied by GA4 cover sources/countries. Build richer saved funnels/explorations after real actions and dimensions have processed; do not invent results from the empty initial property. Bing ownership/AI Performance setup is recorded in the follow-through below; richer reporting and founder playtest evidence remain follow-up work.

## Production verification

- Code release `5d21dd01`, pushed to GitHub main; automatic Vercel production deployment `dpl_9YSzV9ETVaDDrer93L7qth9n64K8` is Ready. Canonical host is https://www.swordweave.quest.
- Live browser confirms the new SEO title, canonical, index/follow directive and Markdown alternate, with no Google tag before the new consent choice.
- A real production form submission reached Message sent. GA4 Realtime shows contact_form_started, generate_lead and copy_contact_email alongside page views; generate_lead is recognized as a key event. Local and production QA submissions are test activity, not real leads.
- Search Console successfully fetched the submitted sitemap and reports **14 discovered pages**, status **Success**. Discovery is not the same as indexing. Initial homepage inspection said unknown to Google. The live Google test then reported “URL is available to Google” / “Page can be indexed”; the homepage indexing request was accepted. Actual indexing/rankings remain to be observed.
- The live PHB Markdown download is 345,364 bytes (SHA-256 4e695b8ff7916a350e62759f3d440a75b26df1a93919891820a54a8256cb35da); its full reader text and edition warning are present. The live Privacy Markdown export includes the new Google disclosure and 20 October update, confirming canonical-HTML synchronization.
- Browser refusal/withdrawal persists across reload and the Google script is then absent. The subsequent live signup/login and guided creation checks are recorded below; this does not establish exhaustive device/provider coverage or an account census.
- Local test server stopped after verification.

Campaign values are registered in `src/lib/analytics/contract.ts`. Add each approved public creator/source and asset label there before issuing campaign links; arbitrary UTM values are intentionally discarded. No internal navigation UTMs.

## Follow-through checks · 20 October 2026

### Search access and indexing

- Bing Webmaster Tools is verified under the same founder-owned personal Google identity. Manual CNAME verification was used, avoiding a new grant of access to the Google Search Console account. Added only `1fd53ad0bd0b9c29f7ee269117e03849.swordweave.quest → verify.bing.com`, TTL 600; prior 14 records remain, now 15 total.
- Bing fetched the canonical sitemap successfully: **Success, 14 URLs discovered**. AI Performance is available, with **No data available** at this stage. Its citation sampling is not a cross-platform census.
- Bing's stored homepage inspection reports **Indexed successfully / URL can appear on Bing**, last crawl **8 October 2026**. It therefore predates the new metadata. The old result's missing canonical/markup fields do not establish a defect in the current release.
- Bing's Live URL utility returned a generic inspection error twice. No cause or WAF block was established; security settings were not weakened. A fresh homepage indexing request was accepted.
- A one-time **sitemap-only, 14-page Site Scan** completed: **14 scanned, 0 errors, 0 warnings**. Scan email updates were unchecked. This is a scoped crawler diagnostic, not proof of perfect SEO, performance or all-page accessibility.
- Google Pages and Crawl stats are still processing/no data. robots.txt is reported **Valid**. The canonical prefix's Search generative AI control inherits **Include** from the domain; no setting change was necessary.
- Google's live PHB and Rules tests passed **URL is available to Google / Page can be indexed**. PHB details confirm crawl allowed, fetch successful, indexing allowed and the exact self-canonical; Google-selected canonical is only determined after indexing. Both indexing requests were accepted. Actual Google inclusion and search performance remain to be observed.

### Application measurement

- A private, clearly named Quickbuild QA fixture was saved and survived a full sheet reload. Realtime records **character_created**, recognized as a key event, with **creation_flow=quickbuild**. This is internal test activity, not an independent player activation. An existing complete-mode draft was found and left intact.
- Actual PDF and Discord clicks were received as **file_download** and **discord_invite_click**. Production contact success was already verified; no additional contact messages were required for this pass.
- A fresh Google login returned to the working Atelier. After processing, Realtime records **login = 1**. The earlier restored signed-in snapshot was not treated as a signup. The redirect hook changes are commits `a91a97a4` and `51f2c5d5`; latest Vercel production deployment `dpl_9NT7LU38PXk2sqHxKUw3okhQGs7x` is Ready.
- Nine focused analytics checks pass (auth proof/redirect/expiry, safe event/URL contract, consent lifecycle); lint and Next production build pass. Previous foundation checks remain recorded above; this is not a claim that every repository test was rerun.
- **Human step completed:** the founder created the separate test account and completed verification directly. Realtime shows **sign_up = 1**, including after subsequent page/sheet reloads. A private complete-mode QA fixture was then saved, reached the Build editor and survived a full reload. The **character_created** parameter drill-down showed **complete = 1** and **quickbuild = 1**. These figures are a dated Realtime snapshot; older QA events subsequently age out of its 30-minute window.
- An existing email/password login using the browser's already-populated form reached the working Atelier, without reading, changing or exporting credentials. Realtime subsequently showed login increased to 2. Google login had already been received as login. The event contract intentionally records method=unknown; it does not expose account identity or infer a provider from an email address. The founder's Mashu session was restored after testing. Two clearly named private QA character fixtures remain available; they are not public examples.
- A live registered campaign URL reached GA4 with exactly `utm_source=discord`, `utm_medium=social`, `utm_campaign=alpha_01`, `utm_content=profile`. The added `qa_noise=discard_me` parameter is absent from the received page_location; the canonical remains the clean homepage. Campaign labels are retained without forwarding arbitrary query data.
- Live withdrawal: choose Essential only, reload, reopen preferences; analytics remains unchecked and the DOM contains no Google measurement script after consent restoration. The original accepted choice was then restored. Contract/lifecycle tests cover producer gating, pending-command clearing and no replay. This pass does not claim a full network trace or exhaustive cross-browser validation.
- Minor creation-UX observation for later review: choosing a creation mode immediately during initial account hydration reset that choice once, before any form data was entered. Choosing it after the account loaded completed normally. The measurement release does not alter the creation UI.

### Remaining SEO work and planning

The [current content/distribution proposal](content-distribution-plan.md#current-proposal-one-useful-learning-path) contains first-session, complete-character, ability, combat, creator-kit and demonstration briefs, source candidates, placements, production gates and founder-led outreach sequencing. The PHB's Mira/River Hand and bridge-round examples are source candidates, requiring final-PDF/app reconciliation before publication. No new tutorial, public `/press` page, finished recording or creator message has been published.

The mobile homepage [PageSpeed baseline](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/u0d0xicwze?form_factor=mobile) is **59 Performance / 100 Accessibility / 100 Best Practices / 92 SEO**, LCP **9.2 s**, CLS **0**, simulated slow 4G. Real-user data is unavailable. Blocking styles and unused CSS/JS warrant investigation; a Start signup link triggers the one basic link-text warning. These are concrete follow-ups preserving the current design, not a reason for a hero rewrite. See the plan for exact metrics, limits and next priorities.

Evidence screenshots are in the original workspace's `output/marketing/`: `bing-sitemap-success-2026-10-20.png`, `bing-public-scan-completed-2026-10-20.png`, `bing-home-indexed-2026-10-20.png`, `bing-indexing-requested-2026-10-20.png`, `gsc-phb-indexing-requested-2026-10-20.png`, `gsc-rules-indexing-requested-2026-10-20.png`, `gsc-ai-inclusion-2026-10-20.png`, `ga4-quickbuild-verified-2026-10-20.png`, `ga4-login-verified-2026-10-20.png`, `ga4-signup-and-creation-verified-2026-10-20.png`, `ga4-character-flows-verified-2026-10-20.png`, `consent-withdrawal-verified-2026-10-20.png` and `pagespeed-mobile-baseline-2026-10-20.png`.
