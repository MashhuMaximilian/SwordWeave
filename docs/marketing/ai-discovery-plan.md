# AI discovery specification

**20 October implementation update:** See [the implementation and verification record](discovery-implementation.md) for what is configured, tested and still awaiting evidence. The dated planning baseline below is retained for provenance.

**Current follow-through:** `/llms.txt` and all 14 approved Markdown alternatives are live. Google AI inclusion is confirmed **Include**. Bing ownership is verified, its sitemap read successfully with 14 discovered URLs, and a 14-page sitemap-only scan completed with zero reported errors/warnings. Bing AI Performance is available with no data yet. Google's PHB/Rules live tests pass, while actual Google indexing/citation evidence is still pending. The [current content and creator proposal](content-distribution-plan.md#current-proposal-one-useful-learning-path) plans source-checked teaching material, release consistency, independent evaluation and a manual AI baseline; it does not authorize new public content or outreach.
19 October 2026 · Recommended work and monitoring. No crawler settings or Search Console controls were changed in this research pass.

## What should be discoverable

An assistant should be able to establish what SwordWeave is, whether the alpha is free, what its current version supports, how to start a session, how character/ability construction works, where the authoritative rules live, and how to contact the creator. All of those answers should also help a person visiting the website.

Prioritize the public homepage, start guide, creation/rules explanations, three HTML books, About/contact and versioned release information. Keep private content protected. Do not make a separate contradictory description “for AI” or a mass of nearly identical keyword pages.

Founder scope update: keep the current hero and visible page content. The active AI work is access, metadata, synchronized reading formats and measurement. Broad rewrites and new character/ability/combat examples are deferred. Treat the PHB as complete per the founder; DMG/SRD revisions continue. Markdown and metadata must preserve that distinction and must not turn provisional library seeds into validated rules examples.

## Current reporting changed since older guidance

Google’s current documentation describes a **Search generative AI control** and a **Generative AI performance report**, rolled out worldwide on 31 August 2026. The older skill guidance saying no AI-specific Search Console reporting exists is outdated. Verify the actual SwordWeave property after ownership is established.

The control is under Settings → Search generative AI; inclusion is the documented default, with inheritance for child properties. Check the effective setting instead of assuming it. The Search report covers supported AI Overviews/AI Mode impressions by page, country, date and device. It can be absent when there are insufficient impressions; absence is not proof of zero discovery. Do not describe it as a complete cross-platform citation or AI-conversion dashboard.

Sources: [Google control](https://support.google.com/webmasters/answer/16908024), [Google AI performance report](https://support.google.com/webmasters/answer/16984139?hl=en).

Bing also provides AI Performance reporting for supported Copilot/Bing and partner experiences, with citation/page/grounding-query insights and subsequent preview additions. Use the metrics actually available to SwordWeave, with their scope and dates, rather than treating them as a census of every AI answer. Sources: [initial Bing report](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/), [June additions](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/).

## Access policy by purpose

| Service/control | Purpose to review | Proposed discovery policy |
| --- | --- | --- |
| Googlebot / Bingbot | Search crawling/indexing | Permit intended public pages; verify access and indexation. |
| Search Console Search generative AI | Inclusion in supported Google generative experiences | Confirm effective inclusion for the domain and relevant children. |
| `OAI-SearchBot` | ChatGPT search discovery | Permit public discovery, checking official bot verification/network guidance. |
| `PerplexityBot` | Perplexity search discovery | Permit public discovery; it is documented separately from training. |
| `Claude-SearchBot` | Claude search discovery | Permit public discovery using current vendor documentation. |
| `ChatGPT-User`, `Perplexity-User`, `Claude-User` | User-requested retrieval | Review separately. These are not a substitute for authorization, and robots handling differs by vendor. |
| `GPTBot`, `ClaudeBot`, `Google-Extended` | Training or other documented product controls | Separate founder policy decision. Leave current behavior unchanged until chosen; discovery does not require blanket training permission. |

Check Vercel WAF and Cloudflare artwork/PDF delivery as well as robots.txt. Do not bypass all security checks for a self-declared User-Agent: use vendor-supported verification where an exception is actually necessary. The contact endpoint’s POST rate limit does not need to be removed for public content crawling.

References: [OpenAI crawlers](https://developers.openai.com/api/docs/bots), [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers).

## Content and entity tasks

1. Summarize the existing game accurately in metadata, the llms index and new distribution drafts: a free modular tabletop roleplaying game with browser character/ability tools, currently v0.1 alpha. Keep the current homepage and hero text.
2. Keep project name, creator identity, canonical site, release/version and official links consistent across books, GitHub, Discord and any later itch/creator pages.
3. Use the existing sources to answer evaluation questions in the creator/itch drafts: rules scope, tools, access, current files and unfinished work. Confirm mechanics before claiming “classless,” universal compatibility or effortless learning. A first-session section within `/rules` can be considered separately later.
4. Defer new worked-example content. Existing PHB examples can be cited with their correct scope/version. Review any example selected for a demonstration against the actual rules and working product; a seeded record is not proof of playtesting.
5. Keep rules available in HTML with stable chapter links and downloadable versions. Preserve old links while making the current version clear. Accurate author/version notices help readers resolve contradictions.
6. Use natural headings, lists, diagrams and tables when they clarify the game. No arbitrary answer-length formula or artificial paragraph fragmentation is required.
7. Publish real changes, credited contributions and playtest lessons with permission. Authentic independent coverage can support discovery; fabricated reviews and undisclosed promotional personas cannot.

## llms.txt and public Markdown: included in the foundation

The founder requested both. Ship them with the initial technical foundation, using the approved public route list and canonical URL policy. They are useful reading formats; their presence alone does not establish visibility in an assistant's search results.

Publish `/llms.txt` as a concise introduction and curated index of current official material. Link the Markdown introductions, starting instructions, rules, books, version/reuse information and contact details. Use a project heading, short summary and grouped annotated links. Keep the complete books behind links rather than combining them into one oversized index. The [August 2026 v2 proposal](https://llmstxt.org/) describes Markdown alternatives and discovery links. It remains a proposal; [Lighthouse's current audit](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt) treats the file as optional.

OpenAI's own [developer documentation](https://developers.openai.com/api/docs/bots) exposes an llms.txt index and `.md` page alternatives. This demonstrates use in documentation delivery. Its documented ChatGPT search access control is `OAI-SearchBot`; the crawler documentation does not establish llms.txt or Markdown as a search eligibility requirement.

Google explicitly says it ignores llms.txt for Search visibility/rankings and requires no special AI file or schema. Keep the ordinary HTML useful and indexable. [Google's guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

### Proposed Markdown delivery on the existing Vercel site

| Public content | Proposed text URL | Included material |
| --- | --- | --- |
| Homepage | `/index.md` | Game definition, alpha status, official introduction and start links. |
| Start, character explanation, creation, rules and combat pages | `/start.md`, `/character.md`, `/creating.md`, `/rules.md`, `/combat.md` | The same published explanations and examples as the corresponding HTML. |
| Book index and three current HTML books | `/books.md`, `/books/players-handbook.md`, `/books/game-masters-guide.md`, `/books/srd.md` | Format/version guidance and complete public book text. |
| About, contact, credits and privacy | `/about.md`, `/contact.md`, `/attributions.md`, `/privacy.md` | Public text, links and notices; contact describes the form and its HTML URL. |

These are proposed routes, not live endpoints. `/character.md` describes the public `/character` introduction; it does not export saved characters. Account screens, private content, internal search, library filters, drafts and user-created records are outside this export allowlist.

Implementation choices for SwordWeave:

1. Generate HTML and Markdown from shared approved content rather than maintaining separate copies. The existing `src/lib/publications/books.ts` already exposes structured book blocks from `books.json`; evaluate a block serializer for headings, paragraphs, lists, tables and asides. Editorial React pages may need their text extracted into shared data. Inspect the current source before estimating that work.
2. Retain the substance, order, tables, links, credits and reuse notices of the public page. Include a title, canonical HTML URL and actual version. Use a real content revision date when available. Resolve relative links correctly; describe figures and link their originals instead of silently dropping rules conveyed in a diagram.
3. Serve explicit `.md` alternatives as `text/markdown; charset=utf-8`, with correct 404s for unknown or excluded paths. Prefer the HTML URL through an HTTP canonical link for equivalent text alternatives; keep the XML sitemap focused on canonical HTML. Verify the final headers and avoid accidental blanket noindex inheritance.
4. Advertise alternatives with `rel="alternate" type="text/markdown"` and the index with `rel="describedby"`, following the proposal. Normal readers continue to receive the existing page design. The format changes; the published facts stay the same.
5. Check source-to-output parity, links, Unicode, tables, figure explanations, response types and access boundaries. For long books, assess chapter-level text links generated from the same blocks so an assistant can fetch the relevant chapter efficiently. Preserve stable HTML chapter anchors.

Explicit Markdown URLs work within the existing application and require no new hosted conversion service. Content negotiation using `Accept: text/markdown` can be considered later, with correct `Vary: Accept` and separate cache variants. Cloudflare documents that pattern in [Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/), currently offered on eligible paid plans/SaaS arrangements. The main website is on Vercel with Porkbun DNS; that Cloudflare feature is not already active there. A hosting/DNS migration is unnecessary for the proposed implementation.

## Other current practices to apply selectively

- **Readable and usable pages:** test ordinary HTML, meaningful headings, real links/buttons, labeled fields and stable layouts. These help readers, assistive technology and browser agents. [Google's agent-friendly website guidance](https://web.dev/articles/ai-agent-site-ux).
- **Traceable answers:** show the actual creator, alpha/version, rule sources, illustrated examples, changes and reuse boundaries. Link between the start guide, example, relevant book chapter and working tool.
- **Independent evidence:** make current materials easy for real creators and groups to evaluate. Record actual public coverage and playtest lessons with permission. Keep claims consistent across the website, source repository and later distribution pages.
- **Current delivery and measurement:** verify Google/Bing ownership and reports, submit the canonical sitemap, inspect crawler access, and measure identifiable AI referrals alongside manually checked citations. Consider IndexNow when content-change frequency makes notifications useful.
- **Emerging interaction protocols:** WebMCP is still developing in the linked Google guidance. Reconsider it for a concrete agent-assisted character or rules workflow after the alpha foundation; it is not required for the public rules to be discovered. A custom GPT, MCP server or paid GEO subscription is not a prerequisite in this plan.

## Manual benchmark

Run a small dated baseline after indexing setup, then monthly if useful. Use search-enabled fresh conversations where the service permits, record the platform/model/date/market and actual response links. Three independent runs of a small subset are more informative than treating one answer as stable. Do not use this chat, which already knows the project, as an unbiased discovery test.

Suggested prompt families:

| Question | What a useful result would show |
| --- | --- |
| What is SwordWeave, and where are its official rules? | Correct identity, alpha status and official source. |
| Is SwordWeave free? What do I need to try it? | Accurate access and materials, without inventing paid plans. |
| How do I start a SwordWeave session? | Start guide/current books and practical preparation. |
| How do custom abilities work in SwordWeave? | Actual construction and table-agreement procedure. |
| Which tabletop RPGs let players build their own abilities? | Relevant category visibility; no expectation of instant recommendation. |
| Where can I find a free tabletop RPG with browser character tools? | Relevant discovery and accurate product distinction. |
| What are some modular tabletop roleplaying games? | Correct category treatment rather than video-game confusion. |
| How can I contact or join the SwordWeave community? | Official contact and Discord links. |

Record **retrieved**, **cited**, **mentioned**, **recommended**, **factually accurate**, and **referred a visitor** separately. A citation is not a recommendation, and a referral is not a played session. Correct factual errors through clearer authoritative sources; do not spam the model or publish fake third-party consensus.

## Acceptance and ongoing review

- Intended public pages can be accessed by the relevant verified crawlers and by ordinary readers.
- `/llms.txt` and the approved public Markdown alternatives return the intended content, link to each other, and stay synchronized with their HTML sources. Private and excluded records have no export route.
- Domain identity/version agrees across official sources; no private data is published for discovery.
- GSC/Bing reporting scope and insufficient-data states are documented.
- GA4 groups identifiable AI referrers where available, acknowledging hidden referrers and zero-click answers. Do not label all direct traffic as AI traffic.
- Keyword and content priorities change only when observed questions, source data or real play justify it. No ranking, citation or traffic guarantee is part of this plan.
