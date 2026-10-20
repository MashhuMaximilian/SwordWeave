# SwordWeave v0.1 alpha: marketing and community working plan

Updated 2026-10-19 after the contact/community release and discovery research. This is a working plan; distinguish the completed setup below from proposed implementation. Shared product facts and messaging assumptions live in [product marketing context](../../.agents/product-marketing.md).

## Decisions and boundaries

- The founder will personally contact relevant TTRPG creators. No paid advertising.
- Focus the alpha on helping independent groups play and report back.
- Keep the public rules and book access useful without requiring Discord membership.
- Use the existing website routes before adding a marketing microsite or many new pages.
- Keep physical-book production separate from the digital alpha.
- Preserve the current hero, page content and design. Broader content changes and new character/worked-example pages are deferred; a first-session section within `/rules` is a possible later addition.
- Prepare creator-kit, demonstration and itch.io materials from the existing website and completed PHB. DMG and SRD revisions continue; describe their status accurately.
- Suggested initial outcome: five independent groups complete a session, with repeat-play interest recorded. This is a planning target, not a forecast or an approved public promise.

**Completed foundation:** The founder's Discord server was configured on 2026-10-19 with 17 channels, seven roles, Community mode, onboarding and a server guide. See the [saved configuration and verification](discord-setup.md). Incoming email, the production contact form and website community/privacy controls are also live. Search/measurement implementation and outreach remain separate tasks.

## 1. Email and contact: current status

Porkbun forwards `mashu@swordweave.quest` and `contact@swordweave.quest` to the dedicated `swordweave@protonmail.com` Proton Free inbox. Both incoming addresses were tested. The website contact form uses SMTP2GO Free through a first-party Nodemailer backend. Its sender domain is verified; local and production submissions arrived in Proton, and the founder independently confirmed the form works. No paid mailbox plan was purchased. General replies in Proton Free still use the Proton address.

Authoritative details: [email configuration](email-setup.md), [contact and privacy controls](contact-and-privacy.md). Credentials are outside the repository.

## 2. Search, keyword research and AI discovery

The expanded [discovery plan](discovery-plan.md) now supersedes this document’s original seed research. English worldwide was approved, comparing US and UK. Research on 19 October 2026 exported 1,092 Google Keyword Planner rows covering 540 distinct queries, with a curated 138-query map across 21 clusters. Only 35 curated candidates have provider rows, and 26 have usable ranged estimates; other demand remains explicitly unmeasured or unreported.

- [Keyword strategy](keyword-plan.md) and [query-to-page map](keyword-map.csv).
- [Technical SEO and indexing specification](technical-seo-plan.md).
- [AI crawler access, content and reporting](ai-discovery-plan.md).
- [Original content and distribution backlog](content-distribution-plan.md).
- [Research files, settings, limitations and sources](research/2026-10-19/README.md).

The website still needs its deliberate canonical metadata, sitemap and robots setup. No Search Console property or new crawler control was activated by the planning work. Current Google documentation now describes a generative AI inclusion control and a dedicated impressions report; the new AI plan supersedes older guidance saying no such report exists.

## 3. Measurement

Use the detailed [GA4 measurement specification](analytics-measurement-plan.md). Proposed primary key events are completed signup, confirmed new-character persistence and SMTP-accepted contact submission. Login, official Discord invitation clicks, book PDF clicks and support clicks have distinct supporting definitions. Refused consent must send no analytics, and no private form/character/account text is collected.

GA4 is the proposed primary behavioral tool; GTM is deferred unless its separate publishing workflow becomes useful. Search Console handles search visibility; actual sessions played remain a separate playtest record. UTM naming uses conventional media and a public source registry rather than private recipient details. No GA4 tags/property were activated by the research pass.

## 4. Creator outreach and first play

The founder sends messages personally. This plan grants no permission to send outreach, post to outside communities or subscribe people automatically.

### Before the first outreach batch

- [ ] Write a one-sentence game description grounded in the product context.
- [ ] Prepare a short screen/video demonstration of an actual character idea and ruling.
- [ ] Identify the exact current PHB files and working official reader/download links. A complete first-session package is deferred and is not a prerequisite for sharing the alpha for evaluation.
- [ ] Provide a creator/press page or shared asset folder with logo, screenshots, book links, contact, version and known limitations.
- [ ] Include the actual creator/AI disclosure and reuse notices accessibly. Do not promise broader rights than the material carries.
- [ ] Test the start, download and Discord paths before sharing them.
- [ ] Build a small, manually vetted creator shortlist with evidence of audience fit.

### Creator shortlist fields

Public creator name; channel/site; recent relevant work; audience/game fit; public professional contact route; proposed audience benefit; contact date; response; one follow-up date if appropriate; outcome; attributed link; do-not-contact status. Avoid collecting private contact data or treating follower counts as fit.

First-batch hypothesis: 5–10 carefully chosen indie-system reviewers, actual-play groups, RPG design educators or community GMs. This is a manageable working batch, not a response-rate promise. Respect each creator's submission and AI-content preferences.

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

1. Maintain the completed mailbox, contact and Discord foundation.
2. Implement the discovery/measurement foundation and verify it against the new specifications.
3. Prepare the creator kit, short demonstration and private itch.io draft from existing material; use the [distribution preparation pack](distribution-preparation.md).
4. Verify the final PHB/assets/notices and manually vet an initial creator shortlist. Keep the possible `/rules` first-session addition separate.
5. Founder starts personal outreach; use actual sessions to revise the game, onboarding and content priorities.
6. Investigate physical proof production as a separate milestone.

## Installed supporting skills

General skills already available: product marketing, SEO audit, AI SEO, analytics, schema, site architecture, content strategy, copywriting and customer research.

Added 2026-10-19: community-marketing, influencer-marketing, launch and emails from `coreyhaines31/marketingskills`, pinned to commit `365b412152b9542499ca1439426f7fc3cc92bb65`. Their installed folders contain source records. These are workflows; current provider documentation and actual project evidence take precedence over generic benchmarks/examples.
