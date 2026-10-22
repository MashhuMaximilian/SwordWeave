# Discovery follow-up · 22 October 2026

The founder authorized further mobile performance work, actual ChatGPT retrieval verification and processed Google/AI-referral reporting. Preserve the current design and the existing main-to-Vercel deployment trigger. Videos, outreach, paid services and book consistency remain outside this batch.

## Mobile delivery and account UI investigation

The previous published remote PageSpeed repeats were mobile 77/69, LCP 5.251/6.903 seconds; desktop 99 on the first attempt, then a separate desktop timeout. Those remain the prior release baseline, not proof of this candidate's result. See mobile-performance-trace-2026-10-22.md.

Two independent source reviews found no documented narrow way to initialize Clerk's native UI after its headless identity runtime has already loaded. The installed SDK obtains its UI constructor before `clerk.load`; a delayed constructor promise also delays identity readiness. Nested providers reuse the existing context; changing prefetchUI later does not initialize missing UI. Clerk's UI constructor is reserved for SDK internals, so a custom lazy facade would rely on an unsupported lifecycle. No such workaround, SDK upgrade or auth-provider remount was introduced. The traced ~347 KB is about 84 KB core plus 263 KB UI, not 347 KB of removable UI. [Provider documentation](https://clerk.com/docs/reference/components/clerk-provider), [UI lifecycle source](https://github.com/clerk/javascript/blob/main/packages/ui/src/ClerkUI.ts).

The broader supported route is to move provider ownership deeper. That requires a neutral account/session bridge and careful isolation of native auth components while retaining editor state, cross-tab identity changes, account overlays and success-only analytics. It is still open; this release does not claim to solve Clerk's initial UI delivery.

A separate safe transfer reduction is implemented: resolution-selected versions of the two existing alpha masks. The navigation mark still renders at 36×44 desktop and 29×36 phone; the forge mark keeps its responsive dimensions. Gradients, filters, source silhouettes and original PNG fallbacks remain. `image-set()` chooses one appropriate density; the original declarations stay outside `@supports` so production minification retains the fallback. No client script or dynamic transform is added. The eight checked-in PNGs regenerate with `node scripts/generate-brand-masks.mjs`; `--check` verifies exact bytes. PNG encoding is lossless after explicit high-quality resampling.

Original two masks total **117,521 bytes**. Density-selected payloads, before HTTP overhead:

| Density | Two selected assets | Reduction |
| --- | ---: | ---: |
| 1× | 12,045 bytes | 89.8% |
| 2× | 30,118 bytes | 74.4% |
| 3× | 53,785 bytes | 54.2% |
| 4× | 83,547 bytes | 28.9% |

This is a deterministic asset saving, not a promised LCP or score improvement. The auth/runtime tail remains. [CSS density selection](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/image/image-set).

## Actual ChatGPT retrieval

The independent consumer Search test changes the diagnosis: **HTML retrieval succeeds**. A matched `ChatGPT-User/1.0` Rules request received 200/WAF allow; the consumer returned the correct H1 and first two headings with a source citation. Markdown also received 200/WAF allow but the reader rejected `text/markdown`, reproduced on OpenAI's own Markdown documentation. This supersedes the earlier generic no-request Codex-tool outcome as a conclusion about consumer ChatGPT access.

The bounded compatibility change keeps `.md` URLs and Markdown characters, and serves them inline as `text/plain; charset=utf-8`. Public HTML alternate MIME hints and kit Markdown responses match. Canonical HTML targets, `noindex, follow`, anonymous extraction and the exact curated public allowlist remain. There is no user-agent sniffing, broad security allowance or new duplicate endpoint. See chatgpt-retrieval-compatibility-2026-10-22.md for exact requests and standards basis. Fresh production Markdown consumer acceptance is now confirmed below.

## Google reports rechecked

The agreed personal Google account and existing SwordWeave properties were used; no account, tracking link or permissions changed.

- Search Console first returned a temporary 504. The Pages/Performance/Sitemaps reports subsequently loaded normally. Aggregate indexing still says **Processing data, please check again in a day or so**. Web Performance / 3 months still shows 0 clicks, 0 impressions and no query rows; its available chart ends 19 October. The sitemap still has **Success / 17 discovered pages / 0 videos**, last read 20 October. No duplicate submission or indexing request was made.
- GA4 saved Acquisition & actions / 24 September–21 October still shows **7 sessions, 6 engaged sessions, 162 events, 5 key events**; 6 sessions direct/none and 1 discord/social. These include known internal QA and do not establish independent players or growth.
- Selecting **Today / 22 October** explicitly returns **No data available** in the processed acquisition report. The earlier tagged internal test is therefore not yet available for final Session source/medium or AI-channel verification. Its actual Realtime event/parameter receipt was already verified, separately. Restore the report to the normal last-28-complete-days view after inspection.

No AI-referral attribution success or failure is inferred from an unprocessed date. After Google includes 22 October, check Session source/medium `chatgpt.com / referral`, the AI Assistants comparison, campaign alpha_01 and the creator-kit action. These are labelled internal QA, not a real AI discovery visitor. Recheck Google aggregate indexing and actual queries when processing finishes; retain the existing keyword/page priorities meanwhile. [GA4 freshness](https://support.google.com/analytics/answer/11198161).

## Verification and release gate

The candidate build and TypeScript/static generation pass. **74 focused tests across 11 files** pass, scoped ESLint passes, and all **10 CSS budgets** pass. The initial built candidate's **17 HTML/Markdown pairs** pass HTTP/canonical/alternate/one-H1/schema-parse/inline-MIME checks; kit Markdown also returns plain text, while unknown/private saved-record Markdown returns 404. Desktop 1280 and phone 390 layout checks preserve mark dimensions and avoid horizontal overflow. The native Manage account dialog opens and closes; no settings were changed. Home → Books → Home works on the phone, and Books reaches its final paragraph/footer with 90px bottom padding. After the final feature-detection refinement, the rebuild passes, the 26 affected CSS tests pass again, and compiled CSS retains both original masks plus feature-detected responsive variants.

Local evidence is outside deployment inputs under `/tmp/swordweave-discovery-followup/`; source regression logs are `/tmp/swordweave-discovery-followup-{build,tests}.log`. This release record will be completed with deployment, post-release MIME acceptance and measured mask-request results. Local servers are stopped after verification.

## Deployed result

- Code **0079de59**, automatic Ready production deployment **dpl_8BWm7HiuY2WiggKtoonWQ8sgegVJ**. The live 17-pair export matrix and discovery/private-path controls all pass. No deployment settings changed.
- Consumer ChatGPT successfully read and cited both HTML and the fresh Markdown source. The latter matched **08:52:15.667 UTC**, request **h84f2-1792659135667-c4e4f67f689c**, HTTP 200/WAF allow on this deployment. The exact URL first reused an obsolete MIME error without a new origin request; one diagnostic query forces a fresh accepted read. No global cache-flush claim.
- [Remote PageSpeed, 11:51 Bucharest](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/b1cg5tin91?form_factor=mobile): **mobile 71**, FCP **2.320 s**, LCP **6.589 s**, TBT **0 ms**, CLS **0**, SI **5.131 s**. Desktop **99**, FCP **0.605 s**, LCP **0.921 s**, TBT about **51 ms**, CLS **0**, SI **0.902 s**. Both report 100 Accessibility, Best Practices and SEO; those scores are neither a complete manual audit nor indexing/citation proof. There is still no CrUX field dataset.
- Official Lighthouse 13.5 / installed Chrome 153 cold-profile repeats: **75 / 67**, LCP **6.036 / 6.389 s**, FCP **2.253 / 2.470 s**, TBT **53 / 211 ms**, CLS **0 / 0**. Both use **57 requests** and select only `logo-light-72.png` + `logo-mono-384.png`; original full-size masks are absent from actual network requests. Total transfer **858,154 / 860,272 bytes**, versus previous **945,415 / 945,331 bytes**. That confirms the smaller payload (roughly 85–87 KB), not a demonstrated major speed-score improvement; the new scores remain within the earlier variability. The initial CLI attempt could not auto-locate Chrome; it produced no metrics. Explicitly selecting the existing Chrome for Testing binary fixed that diagnostic setup issue.
- Recomputing Lantern from the saved first trace reproduces its LCP **6035.5825 ms exactly**. Clerk UI framework/vendor loading and execution still form its tail (vendor ends about 5.913–6.064 s, followed by about 47 ms CPU). The account UI optimization remains genuinely open and needs the broader stable-provider/identity bridge work described above. No arbitrary timer or broken headless native-account workaround is shipped.
- The local candidate servers are stopped; temporary viewport/theme settings restored. No further production analytics QA was added in this follow-up.

**Still open:** the broader account/runtime loading refactor, Google aggregate indexing processing, and final processed classification of the registered 22 October tagged test. The consumer HTML/Markdown compatibility diagnosis and live validation are complete; they should no longer be listed as an unexplained website block.
