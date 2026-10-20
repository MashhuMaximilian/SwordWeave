# Public Markdown coverage and AI access

20 October 2026 · Source audit and focused route verification. These formats support public reading and retrieval; they do not establish ranking, citation or playtest success.

## Scope and current coverage

All **16 curated public discovery pages have Markdown alternatives**. “Each page” means the public game explanations, guides, books and project information. Account screens, private workspaces, drafts, private notes, search/filter combinations and arbitrary user submissions are not public discovery exports.

| Canonical HTML | Markdown alternative | Source used by the export |
| --- | --- | --- |
| `/` | `/index.md` | Anonymous rendered public page |
| `/start` | `/start.md` | Anonymous rendered public page |
| `/character` | `/character.md` | Anonymous rendered public page |
| `/creating` | `/creating.md` | Anonymous rendered public page |
| `/rules` | `/rules.md` | Complete shared `PLAY_GUIDE`, including all chapters |
| `/combat` | `/combat.md` | Anonymous rendered public page |
| `/books` | `/books.md` | Anonymous rendered public page |
| `/books/players-handbook` | `/books/players-handbook.md` | Complete shared online-reader book blocks |
| `/books/game-masters-guide` | `/books/game-masters-guide.md` | Complete shared online-reader book blocks |
| `/books/srd` | `/books/srd.md` | Complete shared online-reader book blocks |
| `/about` | `/about.md` | Anonymous rendered public page |
| `/contact` | `/contact.md` | Anonymous rendered public page, excluding the interactive form |
| `/attributions` | `/attributions.md` | Anonymous rendered public page |
| `/privacy` | `/privacy.md` | Anonymous rendered public page |
| `/press` | `/press.md` | Anonymous rendered creator-kit page |
| `/tutorials/create-a-primitive` | `/tutorials/create-a-primitive.md` | Anonymous rendered written editor tutorial |

The online readers and downloadable PDF editions may differ. Book Markdown explicitly identifies the online reader as its source. Reconciling books remains separate work in progress, as the founder requested; this audit does not certify edition consistency.

The creator page `/press` and editor tutorial `/tutorials/create-a-primitive` use the same curated registry for HTML metadata, sitemap, llms index and Markdown. The kit also exposes exactly four static text files: `/press/README.md`, `/press/fact-sheet.md`, `/press/captions.md` and `/press/asset-notices.md`. The proxy explicitly allows those public assets while keeping other unregistered `.md` paths excluded. Videos belong beside their relevant guide and in the creator kit; their captions/transcripts should be public text, with the same factual content available in the corresponding Markdown export. No separate video directory or duplicate SEO landing pages are required for that plan.

## Delivery and access contract

- The public-page registry is the export allowlist. Unknown or excluded `.md` paths return 404 before fetching any source.
- Public HTML advertises its `text/markdown` alternative. `/llms.txt` links the 16 exports. Markdown responses identify their canonical HTML source and, after this update, describe their index through an HTTP `Link` relation to `/llms.txt`.
- Markdown is served as `text/markdown; charset=utf-8`. HTML remains the search canonical, and the XML sitemap lists only the 16 canonical HTML pages. Equivalent Markdown has `noindex, follow` to avoid a second search result for the same text; this does not make it private or prevent direct retrieval.
- Production editorial extraction uses the fixed canonical origin and an allowlisted path. It does not forward the incoming host, queries, cookies or authorization. Redirects are rejected, requests time out after 15 seconds, and missing or invalid public sources return a temporary 503 with a retry hint.
- Scripts, navigation, forms, decorative SVGs and hidden accessibility elements are removed from the editorial reading scope. Links and image sources are made absolute. Book/rules exports preserve their shared structured source rather than depending on the selected interactive chapter.
- Editorial text can be cached publicly for five minutes at the edge. The current route does not export mutable personal records. A future record export must choose caching appropriate to immediate privacy changes.
- Explicit `.md` URLs work on the existing Vercel application. No additional conversion account, paid Cloudflare plan, DNS migration or `Accept` content negotiation is needed.

## Gaps corrected in this pass

The existing HTML conversion shortened the semantics of some headings: an intentional visual `<br>` became a Markdown line break, splitting the heading into a heading and a detached line. Conversion now joins those visual breaks with spaces while retaining the words and emphasis.

The table conversion also dropped captions, including the qualifications on `/character`’s progression and drawback tables. It now retains captions, cell links and cell line breaks, while escaping literal pipes. These are changes to the text alternative; the visible HTML and its design are unchanged.

The export response now links back to `/llms.txt`, making index discovery available to clients reading only response headers. No additional AI-specific meta tags or schema were added.

## Shared demo characters: deliberately separate from the editorial export

The founder supplied two candidate existing public characters:

- [Neris](https://www.swordweave.quest/characters/1662962b-14c5-4433-994e-6273b3f7ca57?view=public): level 8; 21 primitives observed in the public sheet.
- [Orren](https://www.swordweave.quest/characters/1da4e351-da76-4822-bf1f-632d2e657145?view=public): level 16; 31 primitives observed in the public sheet.

The parent browser review found read-only, forkable sheets. That is evidence of their working presentation, not independent playtesting or certification that each mechanic is finalized. These are candidates for the existing character guide and teaching material; their selection and explanation belong in the content proposal.

Neither sheet is silently added to the Markdown allowlist in this update. Public sharing is not the same decision as promoting every saved character into an indexed official guide. The present character catalogue helper returns a limited summary, while the actual sheet has multiple tabs, pinned component versions and a connected workspace graph. Calling that summary a full Markdown equivalent would be misleading.

A proper selected-demo export should:

1. Deliberately select the public teaching records, rather than exporting every matching UUID or every user's records.
2. Check the current publication visibility and unpublished state anonymously on every request. A public-view query parameter must never create an access grant. Private, followers-only, removed or unavailable records must fail closed.
3. Use a defined public projection of the same resolved/pinned sheet data. Include the actual teaching-relevant attributes, permitted primitive/capability rules, equipment and public concept only after source parity review. Do not serialize raw database rows, hidden client payloads or internal workspace data indiscriminately.
4. Exclude personal/GM notes, account identifiers, sharing/proposal metadata and private history. Verify nested component disclosure instead of assuming every linked record is independently public.
5. Handle revocation without a stale public CDN copy, retain an HTML source link, and test public-to-private/unpublished transitions and access failures before release.

Existing private tools remain protected. A future public `/press` page or approved teaching section can link the two shared sheets without expanding arbitrary record exports.

## AI search and crawler policy

Production `robots.txt` already allows `/` for the wildcard crawler group and disallows `/api/`. Public `.md` URLs are allowed; the internal application rewrite is not an additional externally requested URL. Search crawlers such as `OAI-SearchBot`, `PerplexityBot` and `Claude-SearchBot` inherit the public rule. There is no need to add redundant named groups that might accidentally drop shared restrictions.

Search discovery, user-directed retrieval and model training are different controls. OpenAI documents `OAI-SearchBot` for ChatGPT search, `ChatGPT-User` for user-directed visits and `GPTBot` for potential training. Anthropic likewise distinguishes its search, user and training bots. This update preserves the existing training policy. Source: [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots), [Anthropic crawler documentation](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler).

Markdown and `/llms.txt` are useful alternate reading formats, not a citation guarantee or a Google eligibility requirement. Google says it ignores `/llms.txt` for Search visibility and rankings and does not require special AI markup or Markdown. Useful indexable HTML, accurate sources and normal SEO remain the foundation. Its current guide also names a Generative AI performance report; older skill text saying none exists is outdated. Source: [Google's current AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

The August 2026 `/llms.txt` v2 proposal describes `.md` alternatives plus standard `alternate` and `describedby` links. It remains a proposal, rather than a mandatory search protocol. Source: [llms.txt proposal](https://llmstxt.org/).

## Verification and limits

The subsequent creator/teaching implementation passed a combined 28 focused SEO/Markdown, analytics and play-guide tests, plus the production build. Release browser checks are tracked in [the implementation board](implementation-board.md). Earlier test counts and download sizes below describe the previous technical release.

The focused source and route suite passed **15 tests**. Coverage includes all 14 registered alternatives, complete book/rule generation, canonical/type/index headers, anonymous canonical-host fetches, excluded routes, source errors, heading structure and table context. ESLint also passed for the changed implementation and tests. These do not represent a new live fetch from every third-party crawler, independent AI-answer experiments, a new indexing result or full book/PDF equivalence.

A separate retrieval probe by the parent on 20 October used the search query `site:www.swordweave.quest SwordWeave primitives character tabletop RPG` and returned no results. Its web reader also reported `/llms.txt` and `/creating` as inaccessible, while ordinary browser access worked in the existing verification. This records a limitation of that particular search/reader attempt. It does not establish a Vercel/WAF defect, a robots restriction, successful retrieval by other AI services or an independent ChatGPT recommendation baseline. Do not weaken security based on that result alone; use the search-property evidence and actual supported crawler logs when available.

The existing live verification record and search properties remain the evidence for deployment and discovery state. After production code `9d5a211d` reached Ready, browser downloads verified `/character.md` (6,928 bytes), `/rules.md` (58,159 bytes) and `/books/players-handbook.md` (345,364 bytes). The actual character export contains its complete heading and both table captions; Rules includes the early, creation and final sheet topics; PHB retains its online-reader source notice. These representative downloads verify the release without claiming a live fetch of every endpoint by every AI vendor. Continue the manual retrieval/citation baseline in `ai-discovery-plan.md`; record retrieved, cited, mentioned, recommended, accurate and referred separately.


Final creator/teaching code `2fd10736` reached Ready (`dpl_22V9zNNkwrXhm2ujtczSNnx3ZKxq`). The live sitemap contains 16 canonical URLs, and llms.txt includes the two additions. Explicit visible links downloaded both `/press.md` and `/tutorials/create-a-primitive.md` successfully; the tutorial includes mobile labels, Use number confirmation, the standalone-primitive testing distinction, its final section and canonical source. An initial direct nested-URL browser navigation was blocked by the client; the actual page download link resolved that verification limitation. Kit ZIP and static fact-sheet downloads also succeeded. No arbitrary saved-character export was added.
