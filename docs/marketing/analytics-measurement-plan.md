# SwordWeave measurement specification

**20 October implementation update:** See [the implementation and verification record](discovery-implementation.md) for what is configured, tested and still awaiting evidence. The dated planning baseline below is retained for provenance.
19 October 2026 · Proposed GA4 implementation; no GA4 property, tag or event integration has been activated by this planning work.

## Decisions to support

1. Which search queries and referral sources bring suitable players and GMs?
2. Do people find the introduction, books and character tools they need?
3. Does account creation lead to a successfully saved character?
4. Is contact working, and where do visitors encounter failures?
5. Do recruited groups actually play and want another session?

Use GA4 for consented website behavior, Search Console for search exposure, Vercel Speed Insights for consented performance observations, and a separate small playtest ledger for sessions. Do not claim GA4 measures actual tabletop play.

## Service configuration

- Create a dedicated **SwordWeave** GA4 account/property and production web stream under the founder’s approved personal Google account. Use `https://www.swordweave.quest`, Europe/Bucharest reporting time, and document the measurement ID after creation. Do not reuse another project’s property.
- The founder accepted direct, version-controlled Google tag integration and a typed application event helper, with GTM deferred. True success hooks still require application code, and the alpha has no advertising tag estate to manage. If GTM is adopted later, it becomes the single tag delivery mechanism; do not load the same GA4 tag both ways.
- Keep Google Signals, advertising personalization, user-provided data/enhanced conversions, Ads links and cross-domain tracking off. Do not send a Clerk ID, username, email hash or GA4 `user_id` in the initial setup.
- Start with the shortest practical event-level retention (2 months) and review the need for longer explorations after the initial measurement period. Standard aggregated reports have different retention behavior. Do not enable BigQuery export or paid cloud resources without an actual reporting need.
- Disable automatic enhanced-measurement forms, outbound clicks, downloads and site search; the proposed explicit events below provide controlled fields and success semantics. Own page views in one place, including App Router navigations. Do not also enable automatic history-change page views.
- Keep Vercel Web Analytics during validation if useful; review whether to remove duplicate visit collection once GA4 works. Keep Speed Insights as the performance tool. Counts across tools will differ because consent, blockers and event definitions differ.

## Consent and data boundaries

Continue the existing self-hosted CookieConsent v3 `analytics` category. Analytics remains optional worldwide in this design. The form, rules, downloads and account features must work when analytics is refused.

**Proposed basic opt-in behavior:** before acceptance, initialize only local consent state; do not request GA4/GTM scripts, send analytics requests, set analytics identifiers or queue pre-consent interaction events for later replay. Consent Mode is a technical signal, not a consent banner by itself. Advertising consent states remain denied.

After acceptance, load the analytics integration once and send only subsequent allowed events. Withdrawal immediately gates all event producers and updates/disables the already loaded tag; remove its analytics cookies where supported. SDK listeners can outlive React unmounting, so removing a component is insufficient. Test the actual network behavior. Existing data is not erased by withdrawal.

Do not collect email addresses, names, contact text, private character/creation titles, character IDs, account IDs, Discord user data, internal search strings, auth tokens, error bodies, raw DOM labels or arbitrary URL parameters. GA4’s ordinary pseudonymous identifiers still require transparent disclosure; this is not anonymous census data.

### URL and attribution handling

The current Vercel event filter removes all query strings. Reusing that behavior unchanged for GA4 would lose the planned UTM attribution.

- Classify the route before any tag configuration or event. Public editorial paths can use their clean URL and safe title. Use an allowlist of explicit pages and known book slugs.
- For account/private/UGC/auth screens, suppress page views initially or use a fixed, documented screen category. Never transmit actual IDs, usernames, redirect parameters or user-authored document titles.
- Set safe `page_location`, `page_referrer` and `page_title` before the first GA configuration and every page event; automatic events must not fall back to the raw private URL.
- Allow only known campaign fields (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) with controlled registry values on approved public landing URLs. Drop fragments and every other query parameter. Do not accept an arbitrary visitor-supplied string merely because its key starts with `utm_`.
- Preserve source attribution after consent without retaining pre-consent user activity. Keep the current page URL available until initialization; do not erase its approved UTMs before GA4 reads them. Do not set a separate marketing attribution cookie before consent.
- Referrer normalization must retain useful external source identity while removing query strings and private paths. Verify first-arrival attribution from a fresh browser session.
- Include an explicit AI-source registry, initially testing known labels such as `chatgpt.com` against actual provider links/referrers. An allowed `utm_source` can arrive without the other campaign fields; do not require a complete founder-created campaign to recognize it. Verify current provider behavior during QA rather than assuming every AI visit has a UTM or visible referrer. Group only recognized evidence as AI referrals; keep unidentifiable visits unresolved.

Update `/privacy` and the consent description before release to name Google Analytics and the actual collection purpose. Test granted and refused consent. No legal-compliance certification is implied by this technical specification.

## Event contract

Recommended GA4 names are used where their semantics fit. Other names describe a specific SwordWeave action. All extra parameters below are enumerated values, never copied from form fields or arbitrary URLs.

| Event | Exact trigger | Allowed context | Reporting role / limitation |
| --- | --- | --- | --- |
| `page_view` | One approved public route view on initial load or completed App Router navigation, after consent | sanitized location/title/referrer; `page_group` | Acquisition and page paths. No separate duplicate “start guide viewed” event is needed. |
| `sign_up` | Verified completion of a newly created account and its first activated session | `method` when reliably known; otherwise `unknown` | Primary key event. Loading `/sign-up`, an OAuth redirect or seeing an existing signed-in user is insufficient. |
| `login` | A newly completed authentication flow for an existing account | `method` when reliably known | Supporting event. Restoring an existing session or reloading a page must not fire it. |
| `character_created` | Server confirms persistence of a new user-owned character | `creation_flow=quickbuild|complete|unknown`, `page_group` | Primary activation key event. No character name/ID; do not fire again for edits or previews. |
| `generate_lead` | The contact client receives a successful `/api/contact` response with `success === true` | `form_id=contact`, `page_group=contact` | Primary contact key event. Means SMTP acceptance, not guaranteed inbox delivery or a qualified partnership. |
| `contact_form_started` | First deliberate interaction with a contact field during that form visit | `form_id=contact` | Diagnostic denominator; no field name/value or typed contents. |
| `contact_form_error` | Visitor receives a failed attempt outcome | `error_type=validation|rate_limited|unavailable|delivery_unconfirmed`, `form_id=contact` | Diagnostic. No exception messages, addresses or server response bodies. |
| `discord_invite_click` | User activates an actual official invitation link | `placement=hero|fab|footer|about|contact|playtest`, `page_group` | Participation intent. It is not a joined-member event or a primary alpha conversion. |
| `file_download` | User activates a known official book PDF link | `book_id=phb|gm_guide|srd`, `edition`, `release_version`, `placement` | Resource intent. This counts a click, not completed delivery, reading or a unique reader. |
| `support_click` | User activates the project’s existing support link | `placement=fab|book|footer|other`, `page_group` | Supporting intent. It is not a purchase/donation-completed event. |
| `copy_contact_email` | The copy operation resolves successfully | `placement=contact`, `page_group=contact` | Contact preference diagnostic; no address parameter is needed. |

Phase 2 candidates, only when the corresponding behavior exists and is tested: `creation_saved` for a newly persisted non-character creation, `playtest_report_submitted` for an actual confirmed report, and `release_subscription_confirmed` for a real double-opt-in release list. Do not install events for nonexistent features. The current `/start` is a static walkthrough; do not emit `tutorial_complete` just because somebody scrolled past its final section.

## Implementation ownership and deduplication

- Build a typed `track` wrapper with a strict event/parameter allowlist, route sanitizer and current-consent check. Make it the only event dispatch path; test rejection of unknown fields.
- Contact hook: `src/components/contact/contact-form.tsx`, after `sendContactMessage` resolves. The existing pending guard blocks duplicate clicks. A retry after a failure must not fire success unless the new response is successful.
- Discord hook: shared community-link wrapper or explicit handlers at the known links in homepage, About, Contact and global controls. Send a nonblocking event without delaying/opening changes to the link.
- Downloads: shared book-link component used by cards and readers, with curated book/edition metadata. Coordinate with the current publication work; do not infer an edition from a changing label alone.
- Auth: use completion information supported by the installed Clerk SDK and the application’s session activation flow. Distinguish a newly created account from a returning account. Review email, OAuth, redirect and modal flows. An `isSignedIn` effect alone is unacceptable.
- Deduplicate auth completion using the actual current flow/session boundary, held locally only as needed. React StrictMode, remounts and route changes must not produce repeats. Do not transmit the deduplication identifier to GA4. If signup cannot be distinguished reliably, leave that metric unimplemented until the correct hook is established rather than labeling every login a signup.
- Character creation: instrument the successful new-character persistence response shared by the actual creation flows; distinguish create from save/edit, import and clone before naming the event. Start with the simple create contract rather than rewriting the character editor.
- Do not send browser analytics from a Clerk webhook or contact server route to recover missing consent. Operational delivery/account counters are separate from consented acquisition analytics.

## GA4 reporting configuration

Mark only `sign_up`, `character_created` and `generate_lead` as initial key events. Keep `login`, invitation clicks and download clicks as supporting measures. Use “once per event” for genuine separately completed actions, with source-level deduplication. Report distinct users and raw event counts separately; neither a “first event per session” setting nor a double click should redefine what a completed action means.

Register only the custom dimensions actually needed for the initial reports: `page_group`, `placement`, `book_id`, `edition`, `release_version`, `creation_flow`, `form_id`, `error_type`. Keep cardinality bounded. Do not register raw URLs, interaction IDs, timestamps or content text as custom dimensions. Use GA4’s built-in source/campaign/country/device dimensions rather than duplicating them.

Create saved reports/explorations for:

1. Traffic source/medium/campaign and landing page → signup, character creation and contact.
2. New-account signup → character creation, with consented counts and denominator displayed.
3. Contact starts → accepted submissions and error types.
4. Books by format/placement and Discord by placement.
5. Search traffic versus creator/social/referral traffic, with US/UK comparisons.

GSC and GA4 are not an exact row-by-row join: impressions are not sessions, anonymous search queries are omitted, dates differ, and GA4 may miss nonconsenting or blocked visitors. An attribution report is partial evidence, not a complete account of how someone discovered the game.

## Creator links and attribution

Use a small registry: `utm_source` is a public channel/creator slug; `utm_medium` is a conventional value such as `referral`, `social`, `video` or `email`; `utm_campaign=alpha_01`; `utm_content` identifies the published asset/placement. Add a report comparison for creator referrals using the registered sources/campaign, rather than expecting a custom `creator` medium to fall into a standard GA4 channel correctly.

Example: `https://www.swordweave.quest/start?utm_source=example_creator&utm_medium=referral&utm_campaign=alpha_01&utm_content=first_session_demo`.

Never add private recipient emails, account IDs or other personal data. Do not put UTMs on internal navigation. Discord invitations can be shared directly; their joins require separate Discord-side measurement and cannot be inferred from website clicks. Add an optional “How did you find SwordWeave?” question to actual feedback as a complementary self-report.

## Production QA matrix

| Scenario | Expected result |
| --- | --- |
| New visitor before choosing / Essential only | No Google analytics script, request or analytics cookie; all core features work. |
| Accept, then navigate public pages | One initialization and one sanitized page view per route; correct source/referrer. |
| Withdraw consent after loading | Subsequent clicks/navigation produce no analytics requests; refusal survives reload. |
| UTM landing page with extra private-looking parameters | Registered campaign attribution survives; extra query data/fragments never reach analytics. |
| Recognized AI referral or allowed AI source with no campaign fields | Safe source identity survives consented initialization; no arbitrary query data is admitted. Missing attribution is not relabeled as AI. |
| Contact: invalid, failed, rate-limited, then successful | No success for failures; one `generate_lead` after accepted submission; fields never appear in payloads. |
| Signup and login through each enabled provider | Correct event for a new completion; reload, restored session and StrictMode remount emit neither again. |
| Character create, edit, preview, clone/import | New creation counts once; edits/previews do not count; clone/import behavior follows its documented contract. |
| Discord: hero/FAB/footer/About/Contact | One event with correct placement; link behavior remains unchanged. |
| Each book edition link | One `file_download` with known book/version/edition; no automatic duplicate click/download event. |
| Private account/character/profile routes | No private title, username, ID, query, form contents or auth parameter in any request. |
| Blocked GA4 or failed script load | Contact, sign-in, navigation and creation still work; no endless retries or pre-consent backlog. |

Use GA4 DebugView/Realtime plus browser request inspection, then normal reporting after processing. Record the deployed revision and test counts. Keep QA/debug activity out of ordinary decision reports. Configure developer/internal traffic handling carefully in test mode first; a misconfigured exclusion filter can destroy useful data.

## Primary references

- [GA4 recommended events](https://support.google.com/analytics/answer/9267735)
- [Enhanced measurement and the fields it collects](https://support.google.com/analytics/answer/9216061?hl=en)
- [Single-page application measurement](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications)
- [Google tag consent setup](https://developers.google.com/tag-platform/security/guides/consent)
- [GA4 configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [Data retention](https://support.google.com/analytics/answer/7667196)
