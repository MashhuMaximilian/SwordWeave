# Keyword and page priorities

20 October 2026 · English worldwide · US and UK compared separately

This is the current decision layer over the [19 October keyword baseline](keyword-plan.md),
[curated query map](keyword-map.csv) and [20 October intent sample](keyword-intent-review.md).
It incorporates the implemented teaching pages, including the new original-character
guide. Older notes saying these examples are deferred, `/press` is only proposed,
or `/start` should become a new preparation page describe an earlier scope. They
do not describe the current source. The original research files remain unchanged.

The next useful work is to make the existing destinations easy to distinguish
and measure their real use. Preserve the homepage hero, current design, existing
Rules reader, book content and character tools. This document proposes small
metadata and contextual-link refinements; it implements no application change.
Book consistency remains a separate work in progress. No new generic keyword
pages, US/UK copies, paid advertising or automated creator outreach are proposed.

## Outcome and basis for priority

The alpha's useful outcome is a group trying a session and returning actionable
feedback. Search impressions, visits, accounts, downloads and Discord clicks are
supporting evidence; none establishes a completed playtest. The founder still
plans to release the three finished PDFs together on itch.io, and begin personal
creator outreach after personal group feedback. Search work can improve the
existing site while those milestones proceed.

The [product context](../../.agents/product-marketing.md) supplies the working
audience: GMs and small groups interested in unusual characters and shared rules,
with indie creators and homebrewers as a secondary hypothesis. Actual player
interviews, retention and comparative learning-time evidence are not available.
Priority below is an editorial recommendation based on that fit, the usefulness
of the page and the saved research. It is not a measured SEO difficulty score.

## Research evidence and limits

The four saved Keyword Planner exports use English, Google search network and
1 October 2025–30 September 2026. The US and UK were queried separately using two
seed batches. This pass read the exports, reproduced the counts and verified all
four files against their [recorded SHA-256 values](research/2026-10-19/export-sha256.json).

| Saved file | Market | Rows |
| --- | --- | ---: |
| [us-core-google-ads.tsv](research/2026-10-19/us-core-google-ads.tsv) | US | 69 |
| [us-tools-google-ads.tsv](research/2026-10-19/us-tools-google-ads.tsv) | US | 479 |
| [uk-core-google-ads.tsv](research/2026-10-19/uk-core-google-ads.tsv) | UK | 69 |
| [uk-tools-google-ads.tsv](research/2026-10-19/uk-tools-google-ads.tsv) | UK | 475 |

There are **1,092 exported rows and 540 distinct provider queries**. The curated
map contains **138 candidates across 21 clusters**; 35 candidates have a provider
row and 26 have a usable ranged estimate. The other candidates are hypotheses or
unreported estimates. These counts match the saved [research summary](research/2026-10-19/research-summary.json).

The following are observed **historical monthly ranges**, not current forecasts:

| Exact provider query | US range | UK range | Decision supported |
| --- | --- | --- | --- |
| `free tabletop rpg` | 10–100 | 10–100 | A clear free-game category on the homepage. |
| `free ttrpg` | 100–1K | 10–100 | A synonym for the same homepage, not another landing page. |
| `indie ttrpg` | 100–1K | 10–100 | Relevant category discovery, with alpha status and the actual offer clear. |
| `free ttrpg pdf` | 10–100 | 10–100 | A direct route to current books and download choices. |
| `rpg character creator` | 100–1K | 10–100 | Potential builder discovery, with significant intent ambiguity. |
| `rpg character builder` | 10–100 | 10–100 | A supported-game builder guide, qualified as SwordWeave. |
| `rpg character sheet` | 100–1K | 10–100 | A related tool query; do not promise a generic sheet designer. |
| `open source tabletop rpg` | 10–100 | 10–100 | A truthful explanation of software, game-text and asset rights. |
| `modular tabletop rpg` | Not reported | Not reported | Strong product fit; demand is unreported. |
| `custom ability rpg` | Not reported | Not reported | A useful creation topic; demand is unreported. |
| `swordweave` | Not reported | Not reported | Essential brand identity; demand is unreported. |

The raw export sometimes represents a displayed bucket with `50` or `500`.
Retain that raw value for provenance and report the range; do not relabel it as
an exact monthly count. A blank is not reported, not zero. Close variants and
duplicate appearances across seed batches can overlap, so do not sum these rows
into total demand. Advertising competition and bid prices are not organic
difficulty. There is no researched rank, backlink-gap score, forecast or paid
campaign result in this dataset.

US estimates are in a higher bucket for several broad terms. That is a reason
to compare eventual US/UK query and landing-page evidence, not proof that US
visitors fit better or will complete more sessions. Keep one English website;
the saved evidence does not justify regional landing pages or separate spelling
pages. Other English-speaking countries remain within the audience but were not
measured by these exports.

The earlier search-result samples are general English observations, not a
localized US/UK Google rank census. Their useful finding is intent ambiguity:
character queries can mean D&D tools, system-agnostic sheet tools, portraits or
video games; “modular” can mean VTT modules. Do not turn that sample into a
competition score or claim that SwordWeave is unindexed. Live Search Console
and technical verification are handled in the parent's implementation record.

## Eight page priorities

P0 protects essential identity. P1 supports a close-fit visitor's next decision.
P2 is a useful supporting destination to improve when actual questions or search
data warrant it. These are recommendations, not a volume ranking.

| Priority | Primary destination | Job and query family | Evidence status | Small next opportunity |
| --- | --- | --- | --- | --- |
| 1 · P0 | `/` | Evaluate **SwordWeave**, a free modular tabletop RPG. Own brand, free TTRPG and complete-game category intent. | Brand/modular estimates unreported; free/indie ranges observed. | Keep the current category metadata and hero. Maintain clear onward routes to the character guide, books and Rules. |
| 2 · P1 | `/books` | Obtain the current free rules. Own **SwordWeave PDF**, free TTRPG PDF and rulebook-download intent. Existing individual readers own their named book queries. | `free ttrpg pdf`: 10–100 in each market. Branded book phrases are hypotheses. | Keep direct reader/download choices and actual edition status accurate as publication work lands. Do not create a duplicate free-PDF article. |
| 3 · P1 | `/character` | Choose a creation route, understand the SwordWeave builder and inspect **Neris's saved construction**. Own SwordWeave character builder/creation-guide intent. | Broad creator/builder ranges observed; their mixed intent needs qualification. | Retain “builder guide” and the SwordWeave name in metadata. Keep the existing contextual link from Neris to original-character authoring. |
| 4 · P1 | `/creating-a-character` | Turn **your own unusual concept** into rules: nonnumerical traits, a conditional number, reuse, ledger and recovery. Own SwordWeave character-from-scratch/how-to-author intent. | Editorial hypothesis; these exact long-tail phrases have no measurements in the saved research. | Keep the distinct title and invitation to author a personal concept. Retain links to the Neris example, editor tutorial and actual builder. |
| 5 · P1 | `/creating` | Understand and reuse **primitives, abilities and effects** across several actions. Own custom-ability and reusable-construction explanations. | `custom ability rpg`, `custom magic system rpg`, `freeform magic rpg` and `point buy rpg` have rows without reported estimates. | Preserve the concrete Mira reuse example and the handoff to the primitive editor tutorial. Keep editor field instructions in that tutorial rather than duplicating them here. |
| 6 · P1 | `/tutorials/create-a-primitive` | Complete a specific editor task: **Result, Operation, Value, Recipient, Trigger, stacking and save**. Own branded primitive/mechanical-rule tutorial intent. | Product task and founder need; exact demand unmeasured. | Preserve its task-specific metadata, practical chapters and Atelier handoff. Keep “primitive” explained for readers arriving from broader ability queries. |
| 7 · P1 | `/rules` | Learn and look up **SwordWeave rules**, including how to prepare a first session at `#first-session-preparation`. | Branded/how-to-play and first-session phrases are editorial hypotheses, not measured demand. | A small description refinement can name first-session preparation. Keep all existing topics, search and reference material. |
| 8 · P2 | `/combat` | Understand **SwordWeave combat timing** through a round and the checked Rooted Ford example. Own branded combat/round/reaction explanation intent. | No measured demand for these precise queries in the saved set. | A descriptive search title can name rules and the worked encounter; keep the current visual hero and the existing Rules/encounter links. |

Supporting destinations retain clear jobs. `/start` is the character-to-scene
**walkthrough**, not a second rules index or a replacement for the first-session
checklist. `/press` serves creators and referrals with facts, materials and
contact; its value does not depend on high search volume. `/about` owns creator,
open-source and licensing explanation, with `/attributions` supplying credits.
`/contact` remains the working contact/feedback route. None needs a new generic
SEO page to perform that job.

## Keep the overlapping pages distinct

These are potential intent overlaps, not a finding of measured cannibalization.
We have source content and an editorial map, not enough query-to-URL performance
data to conclude that the pages are harming each other.

| Pages | Useful distinction to maintain | Action |
| --- | --- | --- |
| `/character` and `/creating-a-character` | The first explains routes/tools and reads a saved level-8 Neris build. The second authors an original level-1 proposal from a personal concept, with example table-agreed prices. | Keep both; retain their reciprocal contextual handoff. Do not give both the same “RPG character creator” title or call the paper proposal a saved/playtested character. |
| `/start`, `/rules` and `/creating-a-character` | Follow a character into a scene; learn/lookup play and prepare a session; author your own unusual traits. | Qualify `/start` metadata as a walkthrough. `/rules#first-session-preparation` owns preparation. The new guide owns custom construction. |
| `/creating` and the primitive tutorial | Why reusable ingredients express many uses versus how to operate the actual editor. | Keep the reuse example in Creating and the full field-by-field task in the tutorial. Links connect explanation to action. |
| `/creating` and `/rules#creating` | Focused creation reader versus the creation chapter inside the full Rules reference; these deliberately share one source. | Preserve the shared source and reference links. Do not change whole-page canonicals or remove Rules merely because one chapter overlaps. Revisit only with real query/URL evidence. |
| `/rules#combat` and `/combat` | Compact reference versus a dedicated explanation with a worked scene. | Keep short reference and deeper example connected; avoid copying the entire encounter into more pages for keyword variations. |
| `/books` and the three existing readers | Choose/download a book versus read a specific publication. | Keep the hub and book-specific destinations; publication status and reader/PDF content remain the book workstream's responsibility. |

Hash chapters are destinations within their canonical page, not separate keyword
landing pages. Markdown alternatives likewise represent the same public
content. Their existence improves access to the material but is not evidence of
indexing, ranking or AI citation. Keep the substantive definitions and examples
consistent across the visible guide, full Markdown and companion material.

## Specific metadata and link opportunities

These were bounded proposals from the keyword review. The parent implemented
the three metadata refinements and the press-to-Neris handoff in this focused
follow-through; the two `/start` body-link ideas remain optional. Titles and
descriptions should summarize the page accurately; no fixed character-count
formula or ranking uplift is promised.

| Location | Current observation | Proposed small refinement |
| --- | --- | --- |
| `/start` search title | `How to play · SwordWeave` is broad beside the full Rules reader. Its actual body follows Bartholomew from concept to scene. | `Character walkthrough: Bartholomew · SwordWeave`. Its existing description already explains the concept → access → sheet → turn sequence. Keep the current visible hero and walkthrough body. |
| `/rules` search description | It lists core topics but omits the implemented preparation checklist. | `Learn to play SwordWeave and prepare a first session. Find character basics, checks, combat timing, costs and consequences in the rules reader.` |
| `/combat` search title | `Combat rhythm · SwordWeave` describes the tone but omits the substantial worked encounter. | `Combat rules & worked encounter · SwordWeave`, if the current checked example remains on the page. |
| `/start` closing actions | The Rules link opens `#start` with the broad label “Read the play guide.” | A preparation handoff can target `/rules#first-session-preparation` with “Prepare your first session”; retain a general Rules path elsewhere. |
| `/start` after its foundation or closing explanation | It offers the guided creation story but no contextual link to the new original-character lesson. | Add one short link: “Have a particular concept? Create a character from scratch” → `/creating-a-character`. No hero rebuild or extra card section. |
| `/press` public demo paragraph | It links Neris and Orren sheets, while the complete written Neris trail lives in the Character guide and companion materials. | Add a visible “Read Neris's construction walkthrough” → `/character#build-example` beside the public-sheet link, if not already exposed there by the final materials pass. |

Already present and worth preserving: Create-menu access to the new guide;
`/character` → new-guide handoff beneath Neris; Creating-header access to the new
guide and editor tutorial; tutorial → Creating; new guide → Rules preparation,
Neris and the editor; Combat → Rules and the real encounter. Do not add the same
set of generic links to every paragraph or stuff the homepage with keyword anchors.

Retain the current homepage, Character, Creating, primitive-tutorial, new-guide
and About metadata unless actual query evidence exposes a mismatch. These
already describe their different jobs. Book snippets should be reviewed only
against actual publication status and files, without treating historical book
descriptions as proof of final editorial consistency.

## What earns the next decision

The parent handles live Search Console/indexability and technical delivery. This
pass did not open accounts, inspect live reports, run a browser or measure new
positions. Use the [measurement plan](analytics-measurement-plan.md) and the
current [implementation record](discovery-implementation.md) for their real
state; the research folder's 19 October setup observations are historical.

Once enough real evidence has accumulated:

1. Export the same date range for brand versus non-brand queries, landing pages
   and country. Compare US and UK separately and show counts. Early low samples
   can remain inconclusive; do not average page positions into an invented rank.
2. Check **which page answers which query**. A custom-character query landing on
   `/character` may need a better handoff, not a replacement page. A portrait or
   other-system query is a fit warning, even if it has more impressions.
3. Inspect the query/page/device combination before changing a snippet. Record
   the old wording, hypothesis, date and resulting evidence; sparse counts do
   not justify a rushed A/B test or a causal uplift claim.
4. Read consented downstream actions in context: actual `character_created`,
   successful contact (`generate_lead`), downloads, `media_kit_download` and
   `discord_invite_click`. Invite clicks are not joins, downloads are not
   sessions, and consented analytics does not cover every visitor. Founder group
   feedback supplies the real play outcome.
5. Use real questions to refine an existing paragraph or example before adding
   pages. The original-character tutorial already answers a distinct founder
   need without measured keyword volume; assess whether visitors can use it.
6. For AI discovery, maintain the clear game definition, actual procedural
   examples, stable source links and complete public Markdown. Evaluate real
   citation/referral evidence where available. The parent's current live handoff
   confirms a dedicated Google Generative AI report is available and processing
   for SwordWeave; do not assume the report is absent or interpret processing as
   zero visibility. No “AI visibility score,”
   `llms.txt` ranking effect or citation guarantee is inferred from these files.

Hold competitor-comparison pages, “best/easiest/rules-light” claims, unsupported
D&D/Pathfinder compatibility, portrait/video-game tools, another regional copy,
printed-book purchase/preorder intent and additional generic tutorial pages.
The next research expansion should answer a specific question raised by actual
queries or players, rather than increase a keyword count.

## Checks for this document

The keyword-review subtask wrote only this strategy file. The raw exports, curated map and older
notes remain preserved. Counts and four export hashes were independently
reproduced; representative ranges were matched to the saved curated rows and
raw provider fields. Current page intent, metadata and relevant links were
read from the worktree source, including `src/lib/seo/pages.json`, public page
wrappers, the Rules/Creating sources, the original-character guide and the
creator-kit components. This is a source review, not a fresh localized SERP
study, live indexing report or complete rendered-site audit.
