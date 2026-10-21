# Measurement review · 21 October 2026

## Scope and current evidence

Code and saved implementation records reviewed in the discovery-measurement worktree. The parent then inspected the live property and saved the report/comparison recorded below; this subtask only updated documentation. No contact message, character or new tracking service was created. Videos are deferred.

The existing product context makes independent sessions and useful feedback the alpha outcome. Website actions are supporting evidence; this is not a play-count dashboard.

The public Google measurement ID is **G-LXKDVDEHQZ**. The parent's live UI check on 21 October confirmed the correct **SwordWeave** property in account **SwordWeave**: account **412615852**, property **559734689**. [Open this property's Analytics home](https://analytics.google.com/analytics/web/#/a412615852p559734689/reports/intelligenthome). These are reporting identifiers, not credentials. No stream ID has been recorded here.

The same dated home check showed the last-seven-days period **14–20 October**: **5 active users, 57 events, 3 key events and 16 views**. The property contains founder/internal QA; these are configuration-baseline counts, not evidence of discovery growth, independent players or real creator leads. The separate saved-report snapshot below uses a different date range and a sessions metric; those two denominators must not be interchanged.

Saved 20 October evidence establishes live receipt of signup, login, both guided character-creation flows, contact success, PDF clicks and Discord invitation clicks. All were internal QA. Eight custom dimensions and three key events were configured. `media_kit_download` was added later; live receipt was confirmed in the reconnected follow-up below after an earlier incomplete attempt. The acquisition report and identifiable-AI comparison are saved; a dedicated context-actions/contact report and signup/build funnel have not been created.

## Saved live report and comparison

- **[SwordWeave · Acquisition & actions](https://analytics.google.com/analytics/web/#/a412615852p559734689/reports/explorer?r=16173066165)** — custom report **16173066165**, saved as a copy of Traffic acquisition. Default dimension is **Session source / medium**; channel, campaign and source dimensions remain available. Metrics are Sessions, Engaged sessions, Engagement rate, Average engagement time per session, Events per session, Event count and Key events. Revenue was removed. Use the Key events selector to inspect `sign_up`, `character_created` and `generate_lead` separately; their prior key-event setup was preserved.
- **AI Assistants · identified traffic** — saved comparison **16173053405**. Its exact condition is **Session default channel group contains `AI Assistants`**, case-sensitive. It was applied alongside All Users in the report. This shows traffic Google classifies into that identifiable channel; it is not a count of all AI-assisted discovery, zero-click answers, citations or Google AI Overview/AI Mode visits.
- **Dated snapshot:** last 28 days, **23 September–20 October**, displayed **5 sessions, 3 engaged sessions, 57 events and 3 key events** in the All Users summary. The AI comparison displayed zero rows/counts. These are QA-contaminated report totals. Zero identifiable AI traffic in this snapshot does not establish zero AI visibility or unsuccessful indexing.
- Evidence: `output/marketing/ga-acquisition-ai-2026-10-21.png` and `.json`, captured from the actual saved report. Its comparison parameters and IDs are recorded in the JSON. No account credentials or advertising configuration changed; the live account changes were this saved report and comparison.

At approximately **13:23 Bucharest**, the production press page initially had Essential only consent. After accepting analytics, the parent clicked the creator-kit ZIP. Realtime displayed one user with `page_view`, `first_visit` and `session_start`, but **did not establish receipt of `media_kit_download`**. A second click hit a browser-connection timeout. This is an incomplete verification, not proof that the application event is broken or that a download completed. No speculative tracking fix was made.

**Follow-up after reconnection, approximately 13:49–13:53:** the current press
page was reloaded and its consent dialog confirmed analytics checked. The
visible Google script referenced **G-LXKDVDEHQZ**. Keyboard activation of the
creator-kit ZIP link was followed by the correct property's Realtime table
showing **`media_kit_download`: 1**. Its drill-down also showed one event and
twelve parameter keys. This confirms live receipt and closes the earlier gap
without a tracking-code change. The browser disconnected while paging the
parameters, before the custom `placement` / `release_version` values could be
read back. Their source contract/tests remain separate evidence. This is an
internal QA event, not an independent creator download or proof of ZIP transfer.

Focused verification today: **11 tests pass across four files**: analytics auth, event/URL contract, client lifecycle and cookie-consent filtering. No full build was run for this documentation review. Unit tests do not replace live collection or processed-report evidence.

## What the implementation already does

- Basic opt-in: no Google script or interaction queue before acceptance. Every event producer rechecks current consent; withdrawal sets Google's disable flag, drops pending commands and clears supported analytics cookies.
- One explicit public `page_view` producer; private/auth/UGC screens do not emit public page views. Their allowed success events use `/measurement/private` and the fixed title `Private tools`.
- Strict typed and runtime event parameters. Public paths are allowlisted; only registered UTM values survive. External referrers retain their origin, without private paths, query parameters or fragments.
- `sign_up`/`login` require actual session-completion evidence, not a signed-in snapshot. Local deduplication identifiers never become Google fields. The `method` value is intentionally `unknown`.
- `character_created` follows a successful server response containing a character ID in the complete/quickbuild forms. No character ID/name is sent. Existing saves, preview and imported/cloned records are outside this guided-creation definition.
- `generate_lead` follows contact acceptance; failure events have enumerated error classes. `media_kit_download`, book PDF and Discord events represent link activation.

## Concrete gaps and actions

| Priority | Finding | Bounded next action |
| --- | --- | --- |
| Closed for receipt | Kit event appeared in Realtime after the reconnected check. | Event count 1 is confirmed. Custom parameter values remain a separate readback task if useful; no speculative event-code change was made. |
| 1 | Acquisition report is saved; context-actions/contact report and activation funnel remain proposals. | Use the saved report now. Create additional views only when processed events support the decision. Keep an empty or QA-only baseline explicit rather than implying those unfinished reports exist. |
| Corrected mapping | The previous book helper classified current releases as light/dark. | GM reading/full use `gm_organic` / `gm_organic_full`; the new SRD Reference edition uses `srd_reference`. Earlier dark releases use `earlier_dark`. Contract/download tests and PDF byte checks are separate from live receipt of each new edition event. |
| 2 | No dated live test of an identifiable AI referral's final source/medium. | Confirm registered `utm_source=chatgpt.com` survives a fresh consented landing. Separately observe a genuine provider referrer when available; a tagged QA link is not evidence that ChatGPT referred a player. |
| 2 | Creator campaign example in the older plan uses an unregistered placeholder. | Do not issue `utm_source=example_creator` or a new creator slug until it is explicitly added to `CAMPAIGNS`. Current sources are discord, itch.io, youtube, instagram, reddit, newsletter, chatgpt.com, perplexity.ai and claude.ai. |
| 2 | Individual companion PDF/JPEG/logo links are ordinary links, not tracked download events. | Keep this disclosed scope: `media_kit_download` measures the ZIP CTA only and `file_download` measures official books. Add a separate bounded companion contract only if deciding between materials becomes useful; do not pretend existing events measure every kit asset. |
| 2 | Consent withdrawal has producer/unit checks and earlier DOM checks, not a recorded exhaustive request trace. | During the next actual lifecycle check, verify no Google requests after withdrawal and reload. Do not equate unmounting a component with proof that an SDK listener stopped. |
| 3 | Production QA is mixed with early ordinary traffic; localhost alone sets `debug_mode`. | Annotate dates/times and use a clean reporting period after the release checks. A developer/internal filter needs test-mode validation first; do not activate destructive exclusions based on an unverified IP rule. |

## Reporting setup: live and proposed

Use built-in GA4 session-source, country and device fields. No new custom dimensions, BigQuery, Looker Studio, advertising links or tag manager are needed for this baseline. The existing event-scoped dimensions are `page_group`, `placement`, `book_id`, `edition`, `release_version`, `creation_flow`, `form_id` and `error_type`.

1. **Live — acquisition → useful actions.** The saved report defaults to **Session source / medium** with the metrics above. Select each of `sign_up`, `character_created`, `generate_lead` separately. Use session scope consistently; don't substitute First user source and describe it as the source of every later visit. US/UK and desktop/mobile cuts are a review procedure below, not separately saved reports claimed here.
2. **Proposed — actions by context.** Event-focused table for `file_download`, `media_kit_download`, `discord_invite_click` and the three key events. Drill into book/edition/placement/creation flow with the registered dimensions. Show raw event count and users separately; do not add unlike events into a single “players acquired” total.
3. **Proposed — acquisition-to-first-build diagnostic.** A signup → character-created event funnel for the same consented browser. Show the actual denominator and period. Existing-account builders need a separate event count, not forced into the signup cohort. No cross-device account stitching exists, and the event does not establish a completed play session. No such funnel was saved in this pass.
4. **Proposed — contact diagnostic.** Contact starts, accepted submissions and errors by `error_type`. A start means first input during that mounted form visit, not every attempt. Retries, “send another message,” and consent granted after typing can make event-count ratios misleading. Use this to find failure patterns; do not claim an exact person-level form conversion rate from raw starts/success totals.
5. **Live — identifiable AI comparison.** The saved comparison uses Google's **Session default channel group**, containing case-sensitive `AI Assistants`. Review actual source/medium rows if matches appear. It is narrower than all AI-assisted discovery. Do not infer Google AI Overview/AI Mode referrals from `google / organic`, or reclassify direct/unknown as AI. No custom channel group or broad host-regex group was created in this pass.

If there are too few processed events for useful funnels, keep using the saved acquisition report and leave the funnel as a documented next step. No business conclusion should rest on the 20–21 October test actions. Two-month event retention means longer future exploration windows are not available by default; aggregated standard reports have different retention behavior.

## Practical weekly reading procedure

This is a manual procedure, not a scheduled automation.

1. Open **SwordWeave · Acquisition & actions** using the saved link above. Use the last **28 complete days**, ending yesterday, and record the exact dates. During this alpha, note the 20–21 October QA window alongside every comparison; do not relabel test actions as independent interest.
2. Begin with **All Users** and **Session source / medium**. Write down sessions and engaged sessions as separate counts. Check Event count for book/Discord/kit events only where they exist, then use the Key events selector for signup, character-created and accepted-contact counts separately. Empty processed data remains explicit; Realtime verification of one kit QA event does not guarantee it has already reached a processed report.
3. Apply **AI Assistants · identified traffic** beside All Users. If it has rows, inspect the actual source/medium and landing destinations before describing a provider. If it has none, write “no identifiable AI-channel sessions recorded in this period,” not “no AI discovery.”
4. Inspect **desktop and mobile**, then **United States and United Kingdom**, using available comparisons/secondary dimensions or the existing device/country reports. Keep the worldwide total visible. If those cuts are unavailable in this report, use the standard reports; they were not silently added as new saved reports here. At a few sessions per segment, report counts and examples rather than unstable percentage changes or country/device winners.
5. Compare Search Console queries/pages/countries only when its aggregate reports have processed. Google indexing is a separate check. Search Console totals need not equal consented GA4 sessions, and its aggregate data was still processing in this pass.
6. Record one useful observation and one decision, or “insufficient evidence; keep collecting.” Link the dated source/report. Validate a missing success event before interpreting its absence as user abandonment. Actual sessions played and repeat play still belong to the founder's playtest notes.

Suggested small log: `period | QA caveat | sessions/engaged sessions | selected key-event counts | identifiable AI sessions | useful search queries | desktop/mobile observations | US/UK observations | next action`. It does not need another account, dashboard service or warehouse.

## Reading the baseline

- **Google Search Console:** impressions/clicks/queries/indexing; not a visitor-action census.
- **GA4:** consented browser sessions and recorded actions; blockers/refusal and private-route suppression reduce coverage.
- **Bing AI reports/manual citation log:** their own platform-specific evidence, not universal AI visibility.
- **Speed Insights and lab performance:** performance observations; separate consented field evidence from simulated tests.
- **Founder playtest ledger:** actual groups, completed sessions, feedback and repeat play. These cannot be recovered from download or Discord-click counts.

Record each report's date range, QA exclusions/limitations, consent coverage and data-through date. The initial decision is which source/page deserves attention, not a ranking, citation or player-count promise.

## References checked 21 October

Repository: `src/lib/analytics/{contract,client,auth}.ts`, `src/components/analytics/`, `src/lib/cookie-consent.ts`, contact/character success hooks, publication download helper, press CTA and companion links. Product context: `.agents/product-marketing.md`. Prior configuration/live evidence: `discovery-implementation.md` and `analytics-measurement-plan.md`.

Google's [Traffic acquisition report](https://support.google.com/analytics/answer/12923437) and [traffic-source scopes](https://support.google.com/analytics/answer/11080067) support the session-scoped reporting choice. The [custom channel group documentation](https://support.google.com/analytics/answer/13051316) was checked as an optional alternative; none was created. The saved AI comparison's actual default-channel condition comes from the dated live UI snapshot, not an assumption that every AI source is measurable. No account configuration is inferred from a documentation page.
