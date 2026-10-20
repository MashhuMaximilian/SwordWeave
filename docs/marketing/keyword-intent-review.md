# Keyword intent review · 20 October 2026

This pass refines the existing keyword plan. It does not commission new landing pages or rewrite the homepage hero. Book consistency remains a separate work in progress. Visible tutorials, character examples and a creator kit still need the founder’s page-by-page review.

## Method and limits

Read-only web searches were sampled on 20 October 2026 for these exact English queries:

- `free tabletop rpg pdf`
- `modular tabletop rpg custom abilities`
- `tabletop rpg character builder`
- `rpg character creator tabletop free`
- `open source tabletop rpg`
- `tabletop rpg first session guide`
- `tabletop rpg quickstart free pregenerated characters`
- `SwordWeave tabletop RPG`

The search service did not expose a reliable Google country/location setting. These are general English intent samples, **not separately localized US and UK Google results or a rank report**. Result order, total result counts and absence from a sample do not establish organic difficulty or indexing status. Only original publisher, tool maker and author pages inform the examples below; no third-party review scores or unsupported comparative claims are used.

The quantitative source remains the four October 2025–September 2026 Google Keyword Planner exports described in [keyword-plan.md](keyword-plan.md). No new volume estimates were obtained. US/UK ranges remain separate, blanks remain unreported, and advertising competition is not organic difficulty. Existing Search Console reports should supply actual query and country evidence once data is available.

## Intent and existing destinations

| Query family | Evidence from the sample | SwordWeave destination and decision |
| --- | --- | --- |
| Free tabletop RPG / free TTRPG | [Icar](https://www.icar.co.uk/) identifies the game and genre, then distinguishes core rules from handouts. Free-game searches can seek a complete playable offer rather than a software utility. | `/` owns game evaluation. Keep its current title; make the metadata description explicitly say free modular tabletop RPG, v0.1 alpha and browser tools. The hero stays unchanged. |
| Free TTRPG PDF / rulebook downloads | Icar’s direct rulebook route and the author’s [Build Your Own RPG page](https://thatonegm.itch.io/build-your-own-rpg) show download/format intent. An informational article is a weaker fit than actual files and their context. | `/books` owns downloads; each existing book page owns its branded reference query. No “free RPG PDF” duplicate page. Leave current book material and edition reconciliation with the publication work. |
| Modular tabletop RPG / custom abilities | [Tangential Reference](https://inner-masquerade-games.itch.io/tangential-reference) presents a complete game with modular construction; [RealmsRPG](https://realmsrpg.com/) separates its game introduction from power-creation tools. The sample also retrieves VTT modules, so “modular” alone is ambiguous. | `/` explains the game; `/creating` explains composing its rules. Give `/creating` a descriptive search title mentioning abilities and effects. Do not claim universal VTT support or another game’s compatibility. |
| Character creator / tabletop character builder | [D&D Beyond](https://www.dndbeyond.com/en/players) explicitly identifies its supported game; [Rolekit](https://rolekit.com/) instead offers system-agnostic sheet construction. The sampled free-builder query also retrieves VTT and 5e tools. | `/character` owns the **SwordWeave** builder guide. Say “guide” because this public page explains creation before opening the actual builder. No generic cross-system, avatar or D&D promise. Actual playable examples can be proposed here using the founder’s existing public characters. |
| Open-source tabletop RPG | [Expedition](https://expeditiongame.com/source/) explains contribution through its tool repositories; [OS-SIX](https://alchemygamelab.com/os-six) distinguishes reusable core rules from brand/art rights. “Open” can refer to software, game text or creation permissions. | `/about` owns creator and licensing context, with `/attributions` for credits. Use an explicit metadata title. Preserve the separate MIT software, designated CC BY 4.0 game material and asset/font notices; do not describe every asset as freely reusable. |
| First session / how to play | [Tomeus’s own introductory guide](https://www.tomeus.com/en/how-to-play-tabletop-rpg) addresses preparation and the order of play. It is a generic hobby introduction, distinct from learning one game’s exact procedures. | `/start` stays the concept → sheet → scene walkthrough. The proposed SwordWeave preparation checklist belongs in the existing **Your first game** topic at `/rules#start`, as the founder requested. Link the two rather than creating another “first session” landing page. |
| Quickstart / ready characters | The studio’s [Stillfleet quickstart](https://stillfleet.itch.io/quickstart) provides rules, encounters and separate pregenerated characters. That is evidence of a concrete package, not evidence that every new game must copy it. | Treat “SwordWeave quickstart” as a readiness requirement: check the actual existing characters, monsters and encounters, then link a coherent first-session selection. Do not claim no examples exist; do not label a selection independently playtested before that happens. No new quickstart PDF or `/playtest` page is approved by this review. |
| SwordWeave / branded queries | The general branded sample did not reliably return the canonical SwordWeave site and retrieved similarly named projects. This is a visibility observation, not proof of deindexing. | Keep one consistent name, canonical site and page titles. Use the existing Google/Bing verification and later query reports to assess visibility; avoid repeated indexing requests or fabricated ranking conclusions. |

## Metadata refinements applied in this pass

The changes are limited to four entries in `src/lib/seo/pages.json`. Their values feed the existing page metadata and social previews. Markdown continues to serialize the actual page body; changing a search title does not replace its visible heading. No body, hero, navigation or layout was changed.

| Page | Refined metadata | Reason |
| --- | --- | --- |
| `/` | Existing title retained. Description starts “Free modular tabletop RPG in v0.1 alpha” and names reusable rules, books and browser tools. | Identify category, alpha status and actual offer in a search snippet. |
| `/character` | **Character creation & builder guide · SwordWeave**. Description identifies Quickbuild, Complete character, attributes, BU and reusable rules. | Qualify the supported game and explain that this destination is a guide. |
| `/creating` | **Create abilities, effects & rules · SwordWeave**. Description explains composing primitives and reusing owned rules in new actions. | Replace an opaque search title with the page’s real job. Avoid teaching a separate primitive purchase for every saved ability or scaling choice. |
| `/about` | **Creator & open licenses · SwordWeave**. Description identifies Marius Ion, openness, MIT/CC BY 4.0 and credits. | Answer creator/reuse intent with the existing material. |

Google recommends distinct, descriptive titles and warns against keyword stuffing; it can generate a different title from other page signals. Descriptions help summarize a page but the displayed snippet is not guaranteed. These edits improve the accuracy of the requested signals, not a promised ranking uplift. Sources: [Google title links](https://developers.google.com/search/docs/appearance/title-link), [Google snippets](https://developers.google.com/search/docs/appearance/snippet).

## Mechanics constraint for later examples

The founder clarified that the same owned primitives can express many actions and capabilities. Relevant base access is principally verb tier, domain, range and a die when the action needs one. Other at-table scaling choices depend on the situation; they are not automatically separate primitive purchases. Additional primitives can supply particular permissions or rules when desired. A saved capability organizes a familiar use without charging its owned rules again. Scope, feasibility, resolution and costs still need the table’s ruling.

That explanation belongs beside a concrete example in `/creating` and a real public character in `/character`; it should not be compressed into a stuffed description tag. Final examples must be checked against the current approved rules without folding the ongoing book revision into this SEO pass.

## Next evidence to collect

1. Once Search Console has data, compare brand/non-brand queries, country and landing page. Keep US and UK separate and show sample sizes; low early counts are inconclusive.
2. Review whether relevant searches land on their intended page before changing more text. A builder click is not a completed character or a session played.
3. Use consented `character_created`, book-download and Discord-invite events as supporting actions. Keep invite clicks distinct from joins and downloads distinct from playtests.
4. When the founder approves visible materials, link each from the page that answers its intent. A creator kit can live at one proposed `/press` page; its purpose is helping personal outreach, not generating many keyword variants. Outreach and the full itch.io release remain after the agreed book and playtest milestones.

No campaigns, saved ad plans, account changes, paid tools, outreach messages or localized keyword pages were created for this review.
