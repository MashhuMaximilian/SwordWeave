# SwordWeave v0.1 alpha: marketing and community working plan

Updated 2026-10-19. This is a working plan, not a claim that services are configured or tasks are complete. Shared product facts and messaging assumptions live in [product marketing context](../../.agents/product-marketing.md).

## Decisions and boundaries

- The founder will personally contact relevant TTRPG creators. No paid advertising.
- Focus the alpha on helping independent groups play and report back.
- Keep the public rules and book access useful without requiring Discord membership.
- Use the existing website routes before adding a marketing microsite or many new pages.
- Keep physical-book production separate from the digital alpha.
- Suggested initial outcome: five independent groups complete a session, with repeat-play interest recorded. This is a planning target, not a forecast or an approved public promise.

**Completed foundation:** The founder's Discord server was configured on 2026-10-19 with 17 channels, seven roles, Community mode, onboarding and a server guide. See the [saved configuration and verification](discord-setup.md). This does not complete the website/discovery, mailbox or outreach checklists below.

## 1. Email: a name, a mailbox and an interface

Owning `swordweave.quest` gives control of the domain. A mail provider receives and sends messages for it. A mail client is the interface used to read and write messages. These can be supplied by different services.

**Verified account constraint:** The founder created a Zoho administrator account in the EU data centre. Its actual domain-hosting setup offered paid plans and trials, with no free plan displayed. Do not continue with a paid plan or represent this account as eligible for free domain hosting. The founder explicitly requires zero cost. Zoho's public free plan remains limited to selected data centres; its existence is not proof of account eligibility.

**Alternative for incoming mail inside existing Gmail:** Porkbun provides up to 20 free forwarding addresses. Forwarding `mashu@` to a Gmail account receives messages but does not itself provide authenticated branded sending. Ordinary replies come from the Gmail account.

**Zero-cost outgoing option under consideration:** Add SMTP2GO Free after forwarding works. Its official documentation states 1,000 messages/month and 200/day, with sending rejected at the monthly cap and no time limit on the free plan. It is an outgoing relay, not an inbox. Signup requires a working domain address, so create and test the Porkbun forward first. Verify the sender domain using account-specific DNS instructions. A free mail app such as Thunderbird can use the relay; Gmail web “Send as” is only an interim interface because of Google's January 2027 change. No SMTP2GO account or credentials have been created yet.

**If the actual Gmail interface must host the domain mailbox:** Google Workspace is a paid option. Do not build a new long-term setup around third-party Gmail “Send as”: Google's current help says that feature ends in January 2027. Google Workspace aliases are exempt.

Suggested addresses:
- `mashu@swordweave.quest`: founder and creator relationships.
- `contact@swordweave.quest`: public contact alias into the same mailbox where supported.
- Add a separate support address only when its purpose is clear.

### Mailbox checklist

- [x] Founder chooses Proton Free as the dedicated destination inbox, with Porkbun free forwarding.
- [x] Verify the zero-cost incoming arrangement; no paid-plan substitution. Zoho's free plan was unavailable in this account's EU setup.
- [x] Founder completes Proton account creation, credentials and required agreements.
- [x] Domain managed through its existing Porkbun account; no separate mail-host verification token needed for its forwarding service.
- [x] Configure one incoming mail service: Porkbun's two forwarding MX records, verified in authoritative and public DNS.
- [ ] Configure provider-specific SPF and DKIM. Use one valid SPF record; merge authorised senders deliberately.
- [ ] Add and verify DMARC with a rollout suited to the selected sending services.
- [ ] Test incoming mail, a new outgoing message and a reply with external accounts; inspect sender identity and authentication results.
- [ ] Publish only addresses that have been tested.
- [ ] Keep credentials, recovery codes and private mailbox contents out of this repository.

**Status:** Both `mashu@` and `contact@` are configured in Porkbun to forward to the founder's dedicated `swordweave@protonmail.com` inbox. Porkbun automatically created its MX and SPF records; authoritative and public MX lookups confirm routing. Both external delivery tests succeeded: `mashu@` was checked in the Proton UI, and the founder confirmed receipt of the separate `contact@` test. No subscription was purchased. The personal Gmail is not a destination. Domain-address sending remains unfinished; Proton Free replies use its Proton address. See the [saved setup and verification checklist](email-setup.md).

Sources checked 2026-10-19: [Porkbun forwarding](https://kb.porkbun.com/article/10-how-to-set-up-email-forwarding-service), [Zoho plans](https://www.zoho.com/mail/zohomail-pricing.html), [Gmail sending changes](https://support.google.com/mail/answer/22370), [SMTP2GO Free](https://support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan), [SMTP2GO signup requirements](https://www.smtp2go.com/blog/from-sign-up-to-sending-get-started-with-smtp2go/), [Proton custom domains](https://proton.me/support/custom-domain), [Proton mail clients](https://proton.me/support/imap-smtp-and-pop3-setup).

### Separate email purposes

Personal correspondence, opt-in release newsletters and application-generated account emails are distinct needs. A newsletter provider does not automatically provide a human inbox. Keep creator conversations in the founder mailbox; choose a small release-list service only when collecting subscriptions. Website registration alone is not a newsletter subscription.

## 2. Search, keyword research and AI discovery

### Initial evidence, not a full audit

Read-only live checks on 2026-10-19 found:
- The apex domain redirects to `https://www.swordweave.quest/`.
- `/robots.txt`, `/sitemap.xml` and `/llms.txt` returned HTTP 404.
- The homepage, `/books` and `/about` returned 200 and had titles. Their initial HTML did not contain canonical links in the check performed.
- Vercel Analytics and Speed Insights components exist in `src/app/layout.tsx`; actual collection and plan entitlements were not verified.
- No GA4 implementation was found in the source searches performed. This does not establish whether an external GA4 property already exists.

A missing robots file does not by itself block indexing. Search Console ownership, indexing state, traffic and keyword volumes have not been established.

### Research workflow

1. Validate the audience problem with GMs/players and inspect language in relevant public discussions.
2. Build seed groups around product/category, player goals, GM tasks, rules questions and brand/navigation.
3. Review representative search results for intent, competing page types and ambiguity. Preserve date, query and useful sources.
4. Distinguish a SwordWeave rules query from a broad “best RPG” query or another game's character tool.
5. Map a cluster to one useful page. Check the existing site before creating another URL.
6. Confirm terminology against actual mechanics and the founder's intended positioning.
7. Use Search Console impressions/queries after verification and sufficient traffic to revise priorities. A rank/volume dataset may be added if available; estimates must retain provider, geography and date.

**Research limits:** The current pass is a qualitative seed/intent review. It has no reliable monthly search volumes, keyword-difficulty scores, comprehensive competitor audit or ranking baseline. Do not manufacture those numbers or call these validated high-volume targets.

### Initial keyword map

| Cluster / example queries | Intent | Existing or proposed destination | Initial priority / qualification |
| --- | --- | --- | --- |
| SwordWeave, SwordWeave RPG, SwordWeave rules | Find the project | `/`, `/rules` | High: accurate brand/entity identity |
| SwordWeave PHB, SwordWeave PDF, SwordWeave alpha | Read/download the game | `/books`, individual book pages | High: release/version and clear downloads |
| modular tabletop RPG, modular roleplaying game | Evaluate a category | `/` with useful explanation | High fit hypothesis; demonstrate the actual construction model |
| free tabletop RPG, free RPG rulebook | Find a game to try | `/books`, linked from `/` | Broad discovery; relevance and competition need further validation |
| how to play SwordWeave, SwordWeave first session | Learn and act | `/start`, `/rules` | High: existing walkthrough; add first-session package when ready |
| RPG custom abilities, build your own RPG abilities | Express a character idea | `/creating` with a worked example | Strong product-fit hypothesis; clarify the game this tool serves |
| tabletop RPG character builder | Find a tool | Public explanation linked to `/characters/new` | Broad, often another system's intent; avoid misleading compatibility claims |
| point-buy RPG, point-buy character creation | Find/evaluate a construction system | Explanatory section on `/creating` | Ambiguous: results include D&D ability-score point buy; explain reusable Build Units |
| classless RPG, RPG without classes | Find character freedom | Candidate explanation only | Validate “classless” against the actual game before targeting |
| freeform magic RPG, create spells during play | Evaluate a play experience | Worked ruling/example linked from `/rules` | Useful adjacent intent; explain access, scope and costs rather than promising unlimited magic |
| SwordWeave combat, Council Fast Measured Heavy | Rules reference | `/combat` and `/rules` | High utility for existing players; do not create duplicate thin pages |
| SwordWeave playtest, SwordWeave Discord | Participate | Proposed public community/playtest destination | Add once there is a tested invitation and participation path |

Do not make one near-identical page per keyword variation. Do not present “rules-light,” “perfectly balanced,” “easiest” or D&D compatibility as established product claims.

### What the initial search review showed

- “Modular tabletop RPG” retrieves complete modular systems such as [Cortex](https://www.cortexrpg.com/), not only digital builders. The landing page must explain both the game and the tools.
- Point-buy searches mix full character-construction systems with D&D attribute calculators. Targeting the term without explaining Build Units risks the wrong visitors.
- Free RPG results include playable games with clear download/start paths, such as [Open Adventure](https://openadventurerpg.com/). SwordWeave should make trying a session equally concrete; this is a content observation, not a usability or quality comparison.
- Freeform magic queries surface rules/projects and player discussions about boundaries and adjudication. A specific worked scene is more useful than a generic feature claim.

The observations above are dated query samples, not a stable ranking report or proof of demand. Recheck intent before commissioning content.

### Technical discovery checklist

- [ ] Inventory public, private, draft, duplicate and user-generated route types.
- [ ] Define canonical `www` URLs and consistent page metadata.
- [ ] Render useful public content and crawlable internal links without login.
- [ ] Keep account/private character data protected by authorisation; keep draft/private URLs out of the sitemap.
- [ ] Add an XML sitemap of canonical, indexable public URLs and truthful modification dates.
- [ ] Add a deliberate `robots.txt` with the sitemap location and appropriate crawler instructions.
- [ ] Verify the domain in Google Search Console through Porkbun DNS, submit the sitemap and inspect representative URLs.
- [ ] Set up Bing Webmaster Tools and verify its indexing view.
- [ ] Inspect mobile rendering, performance, broken links, redirects, page titles, descriptions and social previews.
- [ ] Add structured data only for entities/content actually represented on the page; validate it. Do not promise FAQ rich results for this site.
- [ ] Review preview/development URLs and indexing controls separately from production.
- [ ] Review books/readers and PDF delivery so references remain stable across alpha revisions.

### AI discovery checklist

- [ ] Put the project definition, current version, authorship, examples and authoritative rules in public HTML.
- [ ] Keep consistent names and links between homepage, books, About and creator material.
- [ ] Allow intended search crawlers at both robots and CDN/WAF layers; verify access rather than assuming an allow rule is enough.
- [ ] Treat search-discovery and model-training crawler choices as separate decisions.
- [ ] Optionally add `/llms.txt` as a small curated index of official pages, versions and reuse notices after the fundamentals.
- [ ] Record a small set of useful discovery prompts and their dated results. Distinguish a citation from a recommendation and a click from a played session.

Google says no special AI files or schema are required and its current guide says it ignores `llms.txt` for search ranking. OpenAI documents `OAI-SearchBot` separately from `GPTBot`. These are access/clarity measures, not a guarantee of AI mentions.

Sources: [Google AI features](https://developers.google.com/search/docs/appearance/ai-features), [Google AI optimisation guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview), [OpenAI crawlers](https://developers.openai.com/api/docs/bots).

### Useful content before a large blog

Improve the existing introduction and start guide; prepare a compact first-session package; show one unusual character/ability from concept through a real ruling; explain a common cost/scope question; publish changes and lessons from real play with participant permission. Use original examples from the game. Broader comparison articles follow validated questions and actual product knowledge.

## 3. Measurement

Primary question: Which paths help a GM/group complete a first session and choose another?

| Signal | Suggested event / record | Limitation |
| --- | --- | --- |
| Start guide viewed | `start_guide_viewed` | Page view does not establish comprehension |
| Download link activated | `book_download_clicked`, book/version | Click does not prove successful download or reading |
| First character saved | `character_creation_completed` | Record successful action, not merely the button click |
| Discord invitation activated | `discord_invite_clicked` | Does not prove joining |
| Release subscription confirmed | `release_subscription_confirmed` | Keep subscription/consent record in its appropriate system |
| Session report submitted | `playtest_report_submitted` | A group report, not a unique-player count |
| Another session | Follow-up playtest record | Requires an actual report, not inferred page visits |

- [ ] Verify Vercel dashboards and the browser request flow.
- [ ] Check plan entitlements: Vercel custom events currently require Pro/Enterprise.
- [ ] Choose one primary event-analysis approach; decide whether GA4's features justify its additional configuration and privacy work.
- [ ] Document collection purposes and applicable consent behaviour before adding tracking.
- [ ] Exclude emails, private character text, chat messages and other private content from event payloads.
- [ ] Give creator links consistent source/medium/campaign values and add an optional “How did you find us?” field to feedback.
- [ ] Review weekly at first; keep small-number uncertainty visible.

Example attribution: `utm_source=creator_slug&utm_medium=creator&utm_campaign=alpha_01`. Use one convention; never put private recipient data into a URL. [Vercel custom events](https://vercel.com/docs/analytics/custom-events).

## 4. Creator outreach and first play

The founder sends messages personally. This plan grants no permission to send outreach, post to outside communities or subscribe people automatically.

### Before the first outreach batch

- [ ] Write a one-sentence game description grounded in the product context.
- [ ] Prepare a short screen/video demonstration of an actual character idea and ruling.
- [ ] Assemble one complete first-session package: situation, ready characters, short reference, GM preparation and feedback link. Reuse existing book material where suitable; do not claim this package is already ready.
- [ ] Provide a creator/press page or shared asset folder with logo, screenshots, book links, contact, version and known limitations.
- [ ] Include the actual creator/AI disclosure and reuse notices accessibly. Do not promise broader rights than the material carries.
- [ ] Test the start, download and Discord paths before sharing them.
- [ ] Build a small, manually vetted creator shortlist with evidence of audience fit.

### Creator shortlist fields

Public creator name; channel/site; recent relevant work; audience/game fit; public professional contact route; proposed audience benefit; contact date; response; one follow-up date if appropriate; outcome; attributed link; do-not-contact status. Avoid collecting private contact data or treating follower counts as fit.

First-batch hypothesis: 10–15 carefully chosen indie-system reviewers, actual-play groups, RPG design educators or community GMs. This is a manageable working batch, not a response-rate promise. Respect each creator's submission and AI-content preferences.

### Outreach draft for founder review

> Hi [name] — I enjoyed [specific work], especially [specific relevant point]. I'm Marius, making SwordWeave, a free modular TTRPG with browser tools for building characters and abilities. Its v0.1 alpha is ready for people to explore, and I'm looking for groups willing to try a session and tell me where it becomes confusing. I thought [specific aspect] might interest your audience. [Tested first-session link.] The alpha's limitations and how it was made are described there. If it looks relevant, I'd be happy to walk you through it. An honest response is welcome; there's no expectation of coverage.

Replace placeholders from actual research. Send only after the linked package exists. Do not invent familiarity, testimonials or positive results.

### Community operating rhythm

Start with personal welcomes, practical rules help and a manageable playtest cadence. Publish a short “you reported / changed / still investigating” update when there is meaningful progress. Promote reusable answers into public rules/help content. Record who actually played and what failed; ask permission before using quotes or identifying groups publicly.

### First-session feedback prompts

1. Which alpha version and material did your group use?
2. How many people played, and for approximately how long?
3. Where did preparation or character creation become unclear?
4. Describe one actual ruling or mechanic that worked or failed.
5. Would you play another session? Why?
6. Optional contact for follow-up; separate permission for public quotes.

## 5. Physical books, later

- [ ] Collect non-binding interest in printed PHB/GM Guide copies.
- [ ] Freeze a particular version for a physical proof.
- [ ] Compare trim/binding, paper, colour, shipping to relevant countries and total delivered cost.
- [ ] Prepare printer-specific interiors and complete cover/spine files; the current reading PDF is not assumed production-ready.
- [ ] Order and inspect one proof before offering sales. Expect ink colour to approximate the on-screen metallic treatment unless using an actual specialist finish.
- [ ] Verify channel/content eligibility before choosing distribution. DriveThruRPG's current policy rejects AI-generated text and allows some disclosed AI artwork; check the actual manuscripts against it.
- [ ] Choose price, fulfilment and customer support only after proof quality/cost and interest are known.

Candidates to investigate: Lulu for a physical proof, an appropriate local printer for a quote, and RPG marketplaces only after eligibility review. No printer, budget or sales channel has been selected.

Sources: [Lulu calculator](https://www.lulu.com/pricing), [Lulu print setup](https://help.lulu.com/en/support/solutions/articles/64000255584), [DriveThruRPG product policy](https://help.drivethrupartners.com/hc/en-us/articles/12780748778135-Product-Standards-Guidelines).

## Working order

1. Resolve mailbox choice; finish the Discord foundation.
2. Confirm product language and the first-session offer; audit/map existing public content.
3. Implement discovery foundations and verify indexing/measurement.
4. Finish the first-session/creator package and manually vet an initial shortlist.
5. Founder starts personal outreach; use actual sessions to revise the game, onboarding and content priorities.
6. Investigate physical proof production as a separate milestone.

## Installed supporting skills

General skills already available: product marketing, SEO audit, AI SEO, analytics, schema, site architecture, content strategy, copywriting and customer research.

Added 2026-10-19: community-marketing, influencer-marketing, launch and emails from `coreyhaines31/marketingskills`, pinned to commit `365b412152b9542499ca1439426f7fc3cc92bb65`. Their installed folders contain source records. These are workflows; current provider documentation and actual project evidence take precedence over generic benchmarks/examples.
