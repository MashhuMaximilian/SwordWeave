# Mobile loading, AI retrieval and schema follow-up · 21 October 2026

This pass preserves the existing design, reader content, books, tools, private boundaries and consent. Video production remains deferred. It follows the founder's request to test before pushing.

## Release candidate

- Retain the exact original 45-file root cascade. A public/tool CSS experiment reduced homepage gzip from 223,152 to 143,145 bytes but raised direct Atelier CSS to 347,178 bytes. It was rejected and removed. [Evidence and next architecture](css-boundary-analysis-2026-10-21.md).
- Keep Syne and Aubrey preloaded: the measured homepage headline and first-screen text use them. Unica One and Oxanium retain the same local files, declarations and swap behavior, but load when used instead of preloading on every route. Their combined 16,172 source bytes leave the unconditional preload queue; this is a priority change, not a measured 16 KB total transfer saving on every page.
- Remove the redundant manual Clerk script preload. Actual production HTML already emits the same async SDK script in the head before this hint. No second network-download saving is assumed. Match the Clerk preconnect's anonymous CORS mode to the SDK; retain jsDelivr DNS prefetch without its unused eager connection.
- Keep Clerk's standard account UI loading. A `prefetchUI={false}` experiment made Manage account throw “Clerk was not loaded with Ui components”; it was reverted before publication. The corrected build successfully rendered account management, which was closed without editing settings.
- Connect existing schema entities through canonical WebPage identities, the WebSite, breadcrumbs and the existing creator/books. [Schema audit](schema-review-2026-10-21.md). No ratings, offers, new authority claims, retired rich-result promises or AI-specific schema are added.
- Keep AI access rules unchanged. All 17 public HTML/Markdown pairs pass ordinary HTTP; the provider reader still fails without a matching OpenAI CDN request or block. [Retrieval evidence](ai-retrieval-review-2026-10-21.md). Neither optional text formats nor schema guarantee citation.

The final application CSS payload is effectively unchanged: homepage 223,177 gzip bytes and Atelier 241,977 bytes. The rejected split is not included. Core mobile CSS delivery remains unfinished; this release does not claim that the large blocking stylesheet has been solved.

## Pre-push verification

- Final production build includes the restored standard Clerk behavior and passes compile, TypeScript and static generation. Log: `/tmp/swordweave-mobile-release-build.log`.
- All **44** focused SEO/schema/Markdown/analytics tests pass; scoped ESLint and diff checks pass. Log: `/tmp/swordweave-mobile-scope-tests.log`.
- Full suite: 3,129 passed, 151 failed, 15 skipped, plus one unhandled mock error. All **151 failing case names reproduce exactly** across the same 11 files on unchanged `e808adf6`, tested in a separate temporary source checkout with the same dependencies/configuration. These include old database-content assertions and existing API/component mocks. No fixture changes, rule changes or unrelated repairs are included. Evidence: `output/marketing/mobile-followup/test-baseline-comparison.json`; logs `/tmp/swordweave-mobile-followup-tests.log` and `/tmp/swordweave-baseline-failures.log`.
- Final candidate SSR: 17 canonical pages return 200, exactly one H1 and parseable JSON-LD with the intended canonical page node. Homepage font preloads are now only Aubrey and Syne. Evidence: `output/marketing/mobile-followup/final-ssr-matrix.json`.
- Google Rich Results Test code mode detects **one valid Breadcrumb item** for the candidate SRD graph: [result](https://search.google.com/test/rich-results/result?id=oVug0SGhTKglKBa07RyV5w). Schema.org code mode reports **no errors or warnings**. These validate the submitted graph, not live-page retrieval, indexing or appearance. The SSR/content review is separate. Screenshots and receipts are under the same evidence folder.
- Actual browser checks use 1280 × 900 desktop and 390 × 844 phone, with both established themes. The homepage reading-content comparison matches all computed non-animation properties across **576 nodes** on each size. The desktop Atelier comparison matches **1,490 nodes** exactly. The selected phone rule comparison aligns 906 nodes; the only difference is the intrinsic block-size of an invisible collapsed JSON preview, with no visible layout difference. Authentication-dependent navigation nodes are not passed off as identical signed-out/signed-in samples.
- Phone primitive flow: Build → Mechanical rule → Change a number → Value 1 → Preview displays “Add +1 to Attack Roll.” Reset clears only that temporary unsaved primitive. Desktop default rule preview also resolves correctly. No game record is saved through the UI.
- Phone Character workshop opens and loads; Identity/Attributes tabs, fields, budget and disabled create validation render; closing works. Existing draft fields are left untouched. Manage account is specifically retested after restoration.
- Public phone navigation exposes Library → Browse library / Monsters / Encounters. Walkthrough → Prepare your first session reaches Rules. Rules search narrows topics for `strain`; selecting Combat updates `#combat` and focuses `guide-combat-title`, without document overflow.

Screenshots and detailed computed comparisons are ignored local evidence under `output/marketing/mobile-followup/`. Earlier experiment captures are historical, not the shipped candidate. The signed-in local instance uses its existing development Clerk configuration; production account/deployment checks remain distinct.

## Remaining work

1. Reduce shared public/tool CSS without duplicate delivery or changed cascade. This requires explicit style ownership, measured budgets on reading **and** tool routes, direct/client/back navigation and overlay checks. The current 7.8-second mobile LCP remains the latest established pre-release lab result until the next production measurement.
2. Keep ChatGPT retrieval unresolved until a real request can be correlated. If attempts do not reach the CDN, retain the reproduction for provider investigation; no speculative firewall change or external support message is made here.
3. Review processed Search Console/Google AI and Bing evidence, plus consented identifiable referrals and the existing acquisition/actions report. Sparse data is not a reason to invent more pages or rankings.
4. Separate engineering maintenance: reconcile the pre-existing failing test suite with current rules/data/mocks. Keep it outside this discovery patch.
5. Founder workstreams remain book/reader consistency, itch.io release preparation, real table feedback and later personal creator outreach. No new distribution or video work is necessary to finish this technical batch.
