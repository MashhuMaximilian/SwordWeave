# Keyword strategy and page map

19 October 2026 · English worldwide; compare United States and United Kingdom separately.

## What is researched

The first quantitative pass contains **1,092 exported rows, representing 540 distinct provider queries**, from Google Keyword Planner. Two batches of ten seeds were run in each market. Settings: English, Google search network, October 2025–September 2026. The founder approved using the existing planner account for research only; no campaign activation, budget or billing change was made.

The [curated map](keyword-map.csv) contains **138 candidate queries across 21 clusters**. Of those, 35 have a row in at least one provider export; some rows have no numeric estimate. The rest are explicitly labeled editorial hypotheses with unmeasured demand. This is a researched starting map, not 138 independently validated ranking opportunities.

Raw exports and method: [research folder](research/2026-10-19/README.md). The [full keyword universe](research/2026-10-19/keyword-universe.csv) includes initial rules-based triage: 35 curated candidates, 205 clear other-product/medium exclusions, 43 comparative/dated-list holds, and 257 needing manual intent review. Do not interpret automated triage as a completed manual SERP audit.

## Read the numbers correctly

- The account exposes **ranges**. The UI shows `10–100`, while an exported row can contain `50`; likewise `100–1K` can export `500`. Preserve the raw field for provenance, but use the range in decisions and summaries. Do not call the export value an exact monthly count.
- Blank estimates are **not reported**, not zero demand. An exported `0` is marked low/unresolved; it does not justify declaring no one searches for the subject.
- Advertising competition and bid prices are not organic ranking difficulty. No organic difficulty, backlink-gap score, exact Google rank or reliable traffic forecast was obtained in this research.
- Close variants may be grouped. Do not add their volumes together as independent demand or multiply a range by a hoped-for conversion rate.
- US and UK estimates use the same dates/network/language settings, but cannot establish how either audience will convert. Monthly percentage swings on tiny rounded buckets are weak trend evidence.

Google’s definitions: [historical metrics](https://support.google.com/google-ads/answer/3022575), [Keyword Planner usage](https://support.google.com/google-ads/answer/7337243).

## Representative observed demand

| Query | US range / month | UK range / month | Interpretation |
| --- | --- | --- | --- |
| free tabletop rpg | 10–100 | 10–100 | Relevant category discovery; explain the complete game and how to try it. |
| free ttrpg | 100–1K | 10–100 | Useful synonym; same category page, not a duplicate keyword page. |
| free ttrpg pdf | 10–100 | 10–100 | Direct download intent; books page. |
| indie ttrpg | 100–1K | 10–100 | Relevant, though still broad; a clear alpha offer matters. |
| open source tabletop rpg | 10–100 | 10–100 | Explain the actual software/rules/asset license boundaries. |
| rpg character creator | 100–1K | 10–100 | Mixed intent: portrait/video-game/other-system tools. Qualify SwordWeave support prominently. |
| rpg character sheet | 100–1K | 10–100 | Broad and often system-specific; do not promise generic sheet-authoring capabilities. |
| classless rpg | 10–100 | 10–100 | Mechanics/positioning validation required; also includes video games. |
| modular tabletop rpg | Not reported | Not reported | Strong positioning fit can matter even without a Planner estimate. |
| swordweave | Not reported | Not reported | Brand/entity baseline; Search Console should supply actual query evidence later. |

All rows above refer to the dated exports, not live forecasts. The entire internet is not represented by this small seed set.

## Page ownership

One primary destination owns an intent cluster. A keyword variation is not a brief to create a new page.

**Founder scope update, 19 October:** this map records research opportunities, not approved content changes. Preserve the current hero and visible page copy; new character explanations and worked examples are deferred. Use the map for accurate metadata and later evidence review. A possible first-session section belongs within `/rules`, using existing material; the earlier `/start` expansion below is on hold. Creator-kit and itch.io preparation can proceed from the completed PHB without these content additions.

| Destination | Main job | Main query family | First change / content requirement |
| --- | --- | --- | --- |
| `/` | Identify and evaluate the game | SwordWeave; modular tabletop RPG; free TTRPG; indie TTRPG | Plain definition, version, what the game/tools do, practical start path. |
| `/books` | Obtain current rules | SwordWeave PDF; free TTRPG PDF; rulebook downloads | Formats, sizes, version/edition, HTML and PDF options, clear first-book choice. |
| `/books/players-handbook` | Learn player procedures | SwordWeave PHB/player rules | Stable reference and links from beginner examples. |
| `/books/game-masters-guide` | Prepare/run the game | SwordWeave GM guide | Preparation and actual table procedures. |
| `/books/srd` | Inspect/reuse rules | SwordWeave SRD | Accurate reference scope and licenses. |
| `/start` | Prepare a first session | How to play SwordWeave; first session; quickstart | Improve the existing walkthrough; identify missing session-ready materials. |
| `/character` | Explain and enter creation | SwordWeave character builder | Public supported-system explanation, example output, clear save/account boundary. |
| `/creating` | Explain custom mechanics | Custom abilities; Build Units; point-buy distinction; constrained magic examples | One complete ability example with actual construction and table adjudication. |
| `/rules` | Explain core play | SwordWeave rules; resolution; costs/conditions | Concise overview linked to authoritative detailed chapters. |
| `/combat` | Explain round procedures | SwordWeave combat; Council; Fast/Measured/Heavy | A worked round, including changed circumstances and consequences. |
| `/about` | Establish identity and reuse | Creator; open source; license; AI-use disclosure | Clear authorship and truthful rights boundaries. |
| `/contact` | Reach the creator | SwordWeave contact/support | Existing working form; no additional SEO landing page needed. |
| `/playtest` — proposed | Explain participation | SwordWeave playtest/community | Create only after the offer/materials/reporting path are ready. |
| `/press` — proposed | Help a creator evaluate coverage | SwordWeave review/press kit | Screenshots, short description, version, files, limitations, disclosures, contact. |

First search-title direction for review: `SwordWeave — Free Modular Tabletop RPG`. This concerns document metadata; keep the current hero and visible introductory text. Titles and descriptions should accurately summarize each page, not obey an arbitrary character-count formula.

## Intent checks already sampled

Read-only web-search samples on 19 October 2026 show:

- Modular-game searches retrieve complete systems, including [Cortex’s official site](https://www.cortexrpg.com/). SwordWeave’s page needs to identify the game, not merely advertise an editor.
- Free-game/tool searches surface projects with clear download and tool paths, including [Open Dungeons](https://opendungeons.com/) and [Cypher](https://cypher-rpg.com/). These are presentation references, not proof of comparative quality or compatibility.
- “Classless RPG” mixes tabletop discussions with video-game results. “Point buy” can mean another game’s ability-score calculator. “Character creator” can mean visual avatar creation. These ambiguities reduce the value of a large unqualified volume number.
- Freeform-magic questions often concern boundaries, cost and GM agreement. A SwordWeave worked ruling can answer that need without a claim of unlimited magic.
- The branded search sample did not reliably surface SwordWeave. That is a diagnostic lead, not proof of Google deindexing or an exact rank. Confirm ownership/indexation in Search Console.

These were general web-search samples, not localized US/UK Google rank reports. Before commissioning a new article, inspect a representative Google results page in the intended market and record the query/date, dominant intent, useful competing pages and the specific gap SwordWeave can answer.

## Prioritization rules

1. **P0:** protect brand navigation and essential support/reference destinations. Low search volume does not make these optional.
2. **P1:** close product fit, useful to a new group, and deliverable through an existing page or a concrete playtest offer.
3. **P2:** broader/ambiguous demand that needs a clearer example or further intent validation.
4. **HOLD:** terminology or functionality not yet validated, comparative claims requiring real evaluation, or features/materials not ready.

For future sorting, use separate editorial scores for product fit, intent fit, evidence quality and creation effort. Do not disguise a homemade priority score as measured SEO difficulty. A large “indie RPG” number can mostly represent video-game interest; a smaller first-session query may bring a better group.

Exclude from initial targeting: other systems’ character builders/sheets, RPG Maker/pixel/portrait tools, MMORPGs, illegal book-download intent, “best” claims about ourselves, rigid rules-light/easiest claims, printed-book purchasing intent before sales exist, and imaginary D&D/Pathfinder compatibility. Do not add competitor names as metadata bait.

## The next research loop

After the technical setup and enough Search Console data:

- Separate brand queries from non-brand; compare country and landing page.
- Review relevant impressions with weak clicks for intent/title problems, with sample sizes shown.
- Investigate unexpected queries before making content changes. Avoid chasing the wrong medium or another game’s audience.
- Update the map with actual query evidence and conversion paths, retaining the provider, date, market and estimate quality.
- Add a page only when an existing destination cannot adequately satisfy the distinct intent. Otherwise improve the existing page and its internal links.

No monthly search estimate is a promise of visitors, signups or sessions played.

## Founder sequencing update · 20 October 2026

Release the PHB, GM Guide and SRD together on itch.io after all three PDFs are ready (expected this week). Keep the project private and defer additional itch theme/file work until then. Creator outreach follows founder-led personal group playtests and feedback, potentially a month or more later. Technical discovery and consented measurement can proceed now. Preserve the hero, design and current visible editorial content; new tutorials and worked examples remain deferred.
