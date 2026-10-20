# Technical SEO implementation specification

**20 October implementation update:** See [the implementation and verification record](discovery-implementation.md) for what is configured, tested and still awaiting evidence. The dated planning baseline below is retained for provenance.
19 October 2026 · Proposed work; no site code or Google properties were changed by writing this plan.

## Baseline and priority

The rendered production homepage has a unique title, description, one H1, public links and no canonical, Open Graph tags or JSON-LD in the check performed. The rendered PHB reader also has no canonical or JSON-LD and exposes about 352,000 characters of article text. `/robots.txt`, `/sitemap.xml` and `/llms.txt` display the site’s 404 page. No `metadataBase`, `alternates:` or `robots:` metadata configuration was found by the focused committed-source search. Recheck headers, raw server HTML and representative dynamic routes during implementation; this was not a full-site crawl.

First fix deliberate URL/indexing behavior, then metadata/share previews and content gaps. Missing schema and crawler files alone are not proof of an indexing failure.

Current founder scope: preserve the hero, visible copy, page composition and navigation. Technical SEO can add or correct search/share metadata, canonicals, crawler files, schema, reading alternatives and related technical defects. Broader content changes are deferred; a first-session section within `/rules` is a separate optional addition. Metadata must reflect PHB completion and continuing DMG/SRD revisions rather than imply all books are finalized.

## Route policy

| Route family | Proposed index policy | Sitemap | Canonical / other requirements |
| --- | --- | --- | --- |
| `/` | Index | Yes | `https://www.swordweave.quest/`; clear game definition and category. |
| `/start`, `/rules`, `/combat`, `/creating`, `/character` | Index | Yes | Each page owns its distinct intent; self-canonical without tracking parameters. |
| `/books` and the three known `/books/[slug]` pages | Index | Yes | Stable HTML references; unknown slugs are real 404s; book version visible. |
| `/about`, `/contact`, `/attributions` | Index | Yes | Correct authorship, contact and credit information. |
| `/privacy` | Index permitted | Optional | Keep accessible and self-canonical; no keyword-growth target. |
| `/library` overview and selected curated public explanations | Review before inclusion | Only after review | Avoid making filtered database screens the primary category landing page. |
| `/library/browse` filters, `/search`, sorts and internal search results | Noindex unless a specifically curated landing page is justified | No | Control query proliferation; do not canonical unrelated search results to the homepage. |
| Public library items, collections, profiles and shared character sheets | Initially omit; per-type quality/privacy review before index opt-in | No initially | Public access is not automatic consent to broad search promotion. Check visibility rules and moderation first. |
| Auth, settings, private characters/builds/items, encounters and editing flows | Noindex; retain authorization | No | `noindex` is not security. Protect private data at the application layer. |
| Admin/dev/test/API routes and comparison/version views | Noindex where pages exist; correct auth/status for APIs | No | Preview/development hosts must also be excluded deliberately. |
| PDFs / historical book editions | Prefer current HTML as the main discovery destination; audit file variants | HTML first | Preserve download URLs. Consider an HTTP `Link: ...; rel="canonical"` on genuinely equivalent PDF variants after checking the final CDN response. Do not mark substantively different editions as identical. |

Known initial public sitemap candidates: `/`, `/start`, `/character`, `/creating`, `/rules`, `/combat`, `/books`, `/books/players-handbook`, `/books/game-masters-guide`, `/books/srd`, `/about`, `/contact`, `/attributions`; optionally `/privacy`.

Generate Markdown alternatives for these public editorial pages and publish a curated `/llms.txt` in the same foundation release. The [AI discovery specification](ai-discovery-plan.md) defines proposed URLs, shared sources, format-discovery links and parity checks. Prefer canonical HTML in the XML sitemap; text alternatives must not expose private records or inherit the public policy merely from a wildcard route.

## Implementation tasks

1. Add a central production origin and a small metadata helper. Each eligible page supplies its own path, title and description. Never put a homepage canonical in a shared layout and let every route inherit it.
2. Use canonical www HTTPS URLs consistently in internal links, sitemap entries, structured data and social previews. Verify apex and HTTP behavior; do not introduce chains or break bookmarks.
3. Implement `src/app/sitemap.ts` from the approved route list and authoritative content dates. Do not set every `lastModified` to the current date or deployment time. Omit unknown dates rather than inventing freshness.
4. Implement `src/app/robots.ts`, referencing the sitemap. Permit intended public discovery. Do not block JS/CSS needed to render content. Review search bots and training bots separately using the AI plan.
5. Let crawlers see `noindex` on excluded public pages: a robots disallow can prevent a crawler from reading that instruction. Private routes remain protected regardless of crawler behavior.
6. Add Open Graph/Twitter titles, descriptions and an actual accessible brand image. Check the image itself, dimensions, contrast, cropping and absolute URL. This helps creator/Discord sharing; it is not a ranking promise.
7. Add truthful JSON-LD where useful: `WebSite`, the actual creator identity, `BreadcrumbList` on suitable public pages, and `Book`/`CreativeWork` for book pages. Choose Person versus Organization from the real publisher identity. No invented company, ISBN, ratings, reviews or product availability.
8. Ensure public rules and examples are readable without login and have meaningful stable headings/anchors. The large book pages do not need one new SEO URL per paragraph; link focused explanations into the relevant chapter.
9. Inspect the main template and book-reader performance on desktop and mobile. Use lab measurements when field data is unavailable. Check layout shift, font costs, large images, initial rendering and keyboard access without speculative rewrites.
10. Audit final PDF/art redirects and headers at Vercel and Cloudflare separately. Canonical/indexing headers must be present at the final response, not only before a redirect. Coordinate changes with the existing artwork/publication work.
11. Implement the public Markdown allowlist and `/llms.txt` from the same content sources as HTML. Verify response types, canonical/alternate links, correct unknown-route status and representative output parity. Retain the current page design and existing hosting.

## Google and Bing setup

Under the founder’s approved personal Google account:

- Add the Search Console **Domain** property `swordweave.quest`; verify using its actual generated DNS token at Porkbun. Keep mail and website DNS intact. Do not reuse verification from another project.
- Add the canonical `https://www.swordweave.quest/` URL-prefix property if needed for GA4 linking. A Domain property provides the broad view; the canonical prefix gives the matching site scope for the integration.
- Submit the completed sitemap once it serves valid XML. Inspect home, start, one book and one excluded route. Record user-declared and Google-selected canonicals, crawl/render status and indexing reasons.
- Check Settings → Search generative AI and the current report availability, following the [AI discovery plan](ai-discovery-plan.md).
- Enable Bing Webmaster Tools using verified ownership. If using Google import, review the actual permissions first. Submit the same sitemap and inspect indexation. IndexNow is an optional later change-notification channel; it does not replace the sitemap or guarantee indexing.

Google property creation, verification and any consent/agreement steps remain implementation tasks. This research pass did not create properties or modify DNS.

## Verification before and after release

| Check | Passing evidence |
| --- | --- |
| Crawler files | Correct 200 response, correct content type and intended rules; sitemap parses as XML. |
| URL set | Only canonical, public, indexable 200 URLs appear in the sitemap; no private IDs, drafts, filters or redirects. |
| Metadata | Unique, useful title/description and one correct canonical on representative pages; absolute share image loads. |
| Exclusions | Auth/private access remains protected; noindex instructions are visible where intended; preview hosts are handled. |
| Structured data | Rendered JSON-LD is valid, matches visible content and passes appropriate validators. Eligibility does not guarantee a rich result. |
| Content | Public page contains useful text and working links in server HTML and rendered view; heading anchors and downloads survive. |
| Markdown alternatives | Approved public text matches the HTML's substance/version; tables and figure references survive; format-discovery links work; private or unknown routes do not produce exports. |
| Search Console | Ownership verified; sitemap accepted for processing; representative URL inspections saved. Indexing may take time and is not guaranteed. |
| Analytics | See the separate consent/event QA matrix; SEO does not depend on accepting analytics cookies. |

Archive the route list and deployment revision used for verification. Review indexing after processing time instead of repeatedly requesting every URL. Never report a `site:` query or a generic search sample as a complete index count.

## Primary references

- [Google: canonical methods](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google: robots.txt and its limits](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Google: build a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: Search Console property types](https://support.google.com/webmasters/answer/34592?hl=en)
- [Google: structured-data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Bing: IndexNow setup](https://www.bing.com/indexnow/getstarted)
