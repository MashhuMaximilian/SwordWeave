# Structured-data review · 21 October 2026

Scope: the 17 curated public HTML destinations in the discovery worktree. This review uses the product context, current page/component sources, anonymous production HTML, Google Search Central and Schema.org documentation. It makes no visual, authentication, analytics, publication-file or indexing-policy changes. The parent owns integration, browser verification and any release.

## Observed production baseline

An anonymous HTTP GET of every route returned 200, the intended self-canonical and a substantive first heading. Every response already contained parseable JSON-LD in server HTML; JavaScript execution was not needed to retrieve it. The production inventory before this patch was:

| Pages | Existing graph |
| --- | --- |
| `/` | WebSite |
| `/about` | Person, BreadcrumbList |
| `/books/players-handbook`, `/books/game-masters-guide`, `/books/srd` | Book, BreadcrumbList |
| `/start`, `/character`, `/creating-a-character`, `/creating`, `/tutorials/create-a-primitive`, `/press`, `/rules`, `/combat`, `/books`, `/contact`, `/attributions`, `/privacy` | BreadcrumbList |

The current entities were not a broken Product/FAQ/HowTo implementation. The useful gap was their disconnected identity: most pages described only a trail, without an explicit page node, site relationship or link between the book/creator and the page describing them.

## Bounded source corrections

- Every curated route now emits one canonical page node with its existing metadata title/description, English language and a relationship to the homepage WebSite identity. About, Contact and the three-book hub use the matching AboutPage, ContactPage and CollectionPage subtypes. The remaining guides and assets page use WebPage.
- Non-home pages identify and reference their existing breadcrumb trail. The home has no one-item breadcrumb. Book trails retain Home → Books → specific book; other destinations retain Home → page. All entries have ordered positions, readable names and canonical destinations.
- About links to the existing Marius Ion / Mashu Person identity. Book authors reuse that same stable identifier and public creator URL. Each book is the main entity of its own canonical reader page, with the reciprocal page relationship.
- Homepage WebSite remains a single node with the established name and canonical URL. It is not repeated as a second disconnected site identity on every page.
- The small pure helper uses the curated-route allowlist, including an own-property check. Arbitrary record URLs, query views, private paths and object-prototype names produce no graph. It imports the small publication catalogue, not complete book manuscripts.
- The component remains server rendered. JSON serialization retains the existing HTML-escape defense so text containing a script terminator remains data.

The graph deliberately does not add ratings, testimonials, prices, offers, a publisher organization, awards, unverified dates, ISBNs, video objects, FAQ/HowTo rich-result promises or an AI-specific schema package. A generic Book is vocabulary describing the visible publication, not a claim of eligibility for Google's partner [Book Actions integration](https://developers.google.com/search/docs/appearance/structured-data/book). Online readers can differ from revised PDFs: no PDF page count, edition, encoding-equivalence or shared full-asset license assertion was added.

## Primary-source basis

Google recommends JSON-LD and requires markup to represent the actual page. Search appearance is conditional, and syntax alone does not establish eligibility. This patch connects existing facts; it does not manufacture additional search features. [Introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), [general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [supported feature gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery).

Google documents homepage WebSite name and URL for site-name preference, separately from the Rich Results Test. BreadcrumbList remains supported on desktop and needs at least two ordered ListItems. The existing site and trails meet those structural requirements; their appearance is still Google's decision. [Site names](https://developers.google.com/search/docs/appearance/site-names?hl=en), [breadcrumbs](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb).

Schema.org documents explicit page descriptions and breadcrumb relationships, content-specific page subtypes, and the Book/mainEntity/mainEntityOfPage vocabulary. These supply the semantic relationships used here. [WebPage](https://schema.org/WebPage), [AboutPage](https://schema.org/AboutPage), [ContactPage](https://schema.org/ContactPage), [CollectionPage](https://schema.org/CollectionPage), [Book](https://schema.org/Book), [mainEntity](https://schema.org/mainEntity).

## Verification and limits

Locally passed:

- **11 focused schema tests**: real server rendering and JSON parsing on all 17 routes; canonical identity and metadata consistency; unique graph IDs; homepage site identity; meaningful page subtypes; creator/book/page relationships; complete ordered trails; exclusion of private/query/unknown/prototype paths; and HTML script-breakout resistance.
- **24 existing discovery/Markdown tests**: 20 route tests and four discovery tests. Combined run: **35 passed**.
- Scoped ESLint for the component, helper and focused test, plus `git diff --check`.

These are source/SSR and structural contract tests, not a claim of a live Google Rich Results Test or Schema.org Validator pass. No external validator UI was used by this subtask. Parent release verification should parse final server HTML on all curated routes and check a book/guide breadcrumb in Google's validator when browser access is available. WebSite and general semantic page nodes are not all Google rich-result features, so missing detection in that tool would not itself be an error.

This patch does not establish Google indexing, OpenAI retrieval, citations, rankings, traffic or a performance improvement. It adds a small server-side JSON payload without CSS or client interactions. Full build and production checks belong to the integrated release.

## Parent integration verification

The integrated candidate production build passes. All 17 final server HTML pages return 200, with the intended canonical, one H1 and the connected JSON-LD graph. A combined SEO/Markdown/schema/analytics run passes 44 tests.

The parent also used the external validator interfaces in **code mode** on the candidate SRD graph. Google's [result](https://search.google.com/test/rich-results/result?id=oVug0SGhTKglKBa07RyV5w) reports one valid Breadcrumb item; Schema.org reports no errors or warnings. This is submitted-code validation, separate from the live-page content/SSR checks, and does not establish indexing, citation or an eventual search appearance. Receipts/screenshots: `output/marketing/mobile-followup/schema-rich-results-code.*` and `schema-vocabulary-code.*`.
