# Account runtime and mobile delivery · 22 October 2026

The founder authorized the broader account-loading refactor, preserving all visual design and working sign-in/account controls. Videos remain deferred. This record supersedes the earlier account-runtime and unprocessed-GA4 limits in `discovery-followup-2026-10-22.md`.

## Account release

Code **71ad00d29392b0388cb8efd9e357170a66440fae** automatically reached production **Ready**, deployment **dpl_GwDGx64EPG6JpRoj6d2MJUjM4Fpj**. Normal main-branch deployment settings were retained.

The application now owns a small stable authentication context. A private, no-store server snapshot avoids downloading Clerk only for a definitively anonymous request. Authenticated, expired, uncertain and failed checks load the normal SDK. The native SDK loads on an explicit account action or auth route, then remains mounted as a sibling of the application. Loading it never wraps/reparents the page. Every protected API retains its existing server authentication; the snapshot is only a loading hint.

The bridge uses Clerk's real `useAuth()` principal, preserving pending-session restrictions, and `useUser()` only for display fields. Clerk IDs, local database IDs, ownership checks, genuine-account-change resets and fresh-token requests retain their distinct meanings. Native forms keep the original props, wrapper and appearance. Failed downloads/startups reject queued actions into existing status alerts; the same action retries. The 30-second deadline detects startup failure; it does not defer useful work.

## Measured production result

[Remote PageSpeed report h6ghspzjj7](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/h6ghspzjj7?form_factor=mobile), captured **22 October, 12:49 Bucharest**, Lighthouse 13.5:

| Homepage | Mobile | Desktop |
| --- | --- | --- |
| Performance | **95** | **100** |
| FCP | 1.501 s | 0.321 s |
| LCP | **2.851 s** | **0.621 s** |
| TBT | 0 ms | 0 ms |
| CLS | 0 | 0 |
| Speed Index | 2.644 s | 0.768 s |

Both report 100 Accessibility, Best Practices and SEO. These automated scores do not establish a full accessibility audit, indexing/citations or field performance; CrUX still has no dataset. The comparable earlier remote report was mobile 71 / LCP 6.589 s and desktop 99 / LCP 0.921 s.

Two independent official Lighthouse cold-profile mobile runs measured **92 / 88**, LCP **3.097 / 3.250 s**, FCP **1.747 / 1.645 s**, TBT **79 / 128 ms**, CLS **0 / 0**. Both made **43 requests**, transferred **452,238 / 452,195 bytes**, and made **zero Clerk requests**. Earlier comparable cold runs made 57 requests and transferred 858,154 / 860,272 bytes, with LCP 6.036 / 6.389 s. The actual homepage transfer reduction is about 47%; the speed improvement is substantial across these lab observations, with normal score variability.

The real production anonymous endpoint returns HTTP200, `private, no-store`, `noindex, nofollow`, and `status: anonymous`; its installed SDK reason is `session-token-and-uat-missing`. A development handshake correctly falls back to native browser resolution. Local browser checks subsequently observe a real anonymous response after development sign-out too.

The Books entry point independently measured86 / LCP3.657s / FCP1.959s / TBT40ms / CLS 0, with no Clerk requests. Its shared reader stylesheet and unnecessary route prefetches remain a separate delivery opportunity, being checked without changing canonical CSS values.

## Verification

- Production build, full TypeScript check and all 10 route CSS budgets passed before the main push. Core new auth/provider/account code passes scoped lint. Migrated consumers retain the three established unrelated effect lint errors; no new errors were introduced.
- **148 focused tests** pass:61 session/controller/snapshot/auth-measurement/Neris tests;46 ownership, draft-recovery, navigation and client-sync tests;35 discovery/Markdown/schema tests;6 analytics/privacy/consent tests. The pre-existing Neris test needed a union discriminator guard for TypeScript; its behavior/assertions are unchanged. This is not a claim that every legacy repository test passes.
- Native desktop/phone sign-in and sign-up forms render. Existing Google sign-in returns successfully to the protected character-creation route. Quickbuild and Complete character load. Native Manage account opens and closes locally and in production; saved account/GM display remains intact, and no preferences/profile values were changed.
- An unsaved local primitive name survives native account management and editor tab changes. A local Quickbuild name survives the account modal. No test creation was saved to the server. A cold anonymous Library visit starts without Clerk, then its bookmark action loads the native sign-in modal without leaving the Library; the selected preview remains after closing.
- Sign-out returns to the anonymous homepage. Expired/restorable production session resolution successfully restores the existing account. Controller tests cover late anonymous snapshots, identity preservation, reconnect/cleanup races, failed imports, startup deadline/retry and disposal.
- The live17 public HTML/Markdown pairs all pass HTTP200, one H1, canonical/alternate, nonempty content, inline text/plain Markdown and parseable JSON-LD checks after release. No private records were added to the public allowlist.
- Live Books at 390 px has no horizontal document overflow; its final note and footer are reachable at the actual scroll end. Native production account management has no console errors.

Local diagnostic evidence stays outside deploy inputs in `/tmp/swordweave-account-*`, `/tmp/swordweave-books-*` and `/tmp/swordweave-ga4-source-comparison-2026-10-22.*`. Screenshots can contain private account/report details and are not committed.

## Processed Google reporting

The agreed personal Google account and existing SwordWeave properties were used. Search Console's aggregate Pages report still says processing. Performance still has 0 clicks/impressions and no query rows; the available chart ends 19 October. Sitemap remains Success / 17 discovered pages / 0 videos / last read 20 October. Individual indexed-page evidence recorded earlier remains separate from this aggregate lag. No duplicate submission or indexing request was made.

GA4's last 28 complete days (24 September–21 October) still show 7 sessions, 6 engaged, 162 events and 5 key events: 6 direct/none sessions and 1 discord/social. These include known QA and do not establish independent growth.

**Today / 22 October now includes the registered test:** 1 session from **chatgpt.com / referral**, 4 events, 0 key events. That verifies processed source/medium attribution. The native **AI Assistants · identified traffic** comparison (`16173053405`) returns 0 for the same date; do not equate its channel classification with the source label.

A separate saved **ChatGPT · identified source** comparison (`16180362027`) exactly matches Session source `chatgpt.com`, independent of medium/native channel. Applied alongside the native comparison, it correctly returns the 1 known QA session. Its description explicitly warns that the visit was tagged QA and that untagged discovery may be missed. This is attribution plumbing proof, **not an independent visitor or organic ChatGPT discovery claim**. Add other observed provider-source labels separately when supported by actual data. Realtime creator-kit parameter receipt and consent withdrawal evidence recorded earlier remain valid; today's 0 key events is not evidence of a failed form or auth event.

## itch.io next release

**Later same-day update:** this historical inspection is superseded by the [completed public nine-file release](itch-release-2026-10-22.md).

Read-only inspection of the existing project editor confirms **Draft**, **No payments**, no uploaded downloads, and stale description text saying the GM Guide/SRD are still being revised. The public creator profile has the same stale readiness wording. No upload, edit or publication occurred in this run.

The [current upload checklist](distribution-preparation.md#current-itchio-upload-checklist--22-october-2026) identifies nine ready PDFs: three current reading books, four compact guides, and the two original fillable companions. The creator-kit ZIP is an optional tenth file; it is not a replacement for the books/guides. Update readiness text and replace old PHB-page gallery previews with the actual companion previews during that separate release preparation. Keep high-resolution/old editions outside the main file list. Founder playtests, cross-book reconciliation and outreach remain separate workstreams.

## Books delivery follow-up

Code **2b6bc511** separates Books CSS using the existing conservative source/selector proof for the hub and all reader slugs. Canonical properties and source order are unchanged; the existing component replay protects client-navigation margins. Books links avoid unnecessary route prefetches; PDF links and other pages keep their behavior. Home, general reader and tool CSS outputs remain byte-identical. The built Books hub changes from 106,847 to 67,915 gzip bytes; book readers use 66,362 bytes. All 11 emitted budgets and the production build pass.

A matched 1280 px light-theme browser comparison reproduces production title, kicker, card, note and navigation typography/colours/geometry exactly. Reader heading, paragraph, table and callout properties and dimensions match exactly too. At 390 px, the hub reaches its last note/footer without overflow; the PHB’s 27 tables do not expand the document. Home→Books→reader, Books→Rules→back and the missing-book 404 response render correctly. No text or canonical style value was changed. The automatic main-branch build is Ready; final deployed measurements follow.


Code **2b6bc511** automatically reached production **Ready**, deployment **dpl_5xtVCPMjyf2A5pCVaqzaRmDwf9no**. The final live 17-route HTML/Markdown/canonical/schema matrix passes again; all four Books routes have the correct Books stylesheet owner. Native production Manage account opens/closes on this final release with the restored account, correct saved GM state and no console errors.

[Books remote PageSpeed report 7207t8ltxo](https://pagespeed.web.dev/analysis/https-www-swordweave-quest-books/7207t8ltxo?form_factor=mobile), captured **13:10 Bucharest**, measures **mobile 95 / desktop 100**. Mobile FCP 1.201 s, LCP 2.851 s, TBT 72 ms, CLS 0, SI 2.891 s; desktop FCP 0.321 s, LCP 0.561 s, TBT 27 ms, CLS 0, SI 0.658 s. Both also report 100 Accessibility/Best Practices/SEO. The same no-field-data and automated-audit limits apply.

The independent final Books mobile run measures **90**, FCP 1.598 s, LCP 2.948 s, TBT 130.5 ms and CLS 0. Actual network requests change **50 → 35**, transfer **559,794 → 404,712 bytes** (about 28% less), and Clerk requests remain 0. This confirms a real smaller delivery and faster LCP, while TBT and score vary with lab scheduling. The earlier Books baseline was 86 / LCP 3.657 s / TBT 40 ms. There is no claim of stable field performance from a single before/after pair.

Books-specific verification adds **30 unique tests** (17 selector/cascade/source tests, 9 development-generation tests, 4 route tests), for **178 focused tests** across this run. The parent repeated the 21 selector/route tests after the agent's complete 30-test run; those repeated tests are not counted twice. Both production builds and full TypeScript checks pass; all 11 final route CSS budgets pass. Temporary local theme/viewport settings were restored, local test tabs closed, and the local server stopped.

**Remaining:** Google aggregate indexing/query processing and ongoing reporting. Lab mobile performance is materially improved, not a guarantee of rankings or a field Core Web Vitals pass. The next distribution batch is the private itch.io download/copy/gallery update from the reviewed checklist; no videos or outreach are scheduled by this work.
