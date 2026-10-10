# SwordWeave publication plan

Date: 2026-10-10. Status: proposal for review, not new game rules.

First review package prepared later on 10 October: see `docs/publications/README.md` for the reconciliation, chapter outlines, publishing/rights policy, eight-page PDF and responsive preview. Figma access was verified; the proof uses local structured content. The original plan below remains the research baseline.

Current decision: the creator approves the app-font/metallic visual direction and interactive light/dark reader, with separate PDFs. Next is the remaining rules reconciliation followed by manuscripts; see [Current and deferred work](../next-work.md). Figma remains optional. All three complete digital books will be free.

## Recommendation

Begin with a rules inventory and editorial outlines, then validate an eight-page visual and writing sample using actual SwordWeave material. Approve that sample before laying out whole books. Use Figma for the sample and visual system; keep the manuscript in structured, versioned text and use a book production workflow for the final PDFs.

The three publications should share rule definitions, terminology, formulas and examples, while addressing different readers. SRD means **System Reference Document**.

## Research and lessons

These observations are based on official contents, reference pages, licensing material and download listings; they are not claims to have read every cited book in full.

| Reference | Observed approach | Application to SwordWeave |
| --- | --- | --- |
| [D&D Player’s Handbook contents](https://www.dndbeyond.com/sources/dnd/phb-2024) | Playing the game precedes character creation and detailed options; a glossary supports lookup. | Teach one complete play loop before explaining the catalogue and construction language. |
| [D&D Dungeon Master’s Guide contents](https://www.dndbeyond.com/sources/dnd/dmg-2024) | DM basics, running the game, a toolbox, adventures and campaigns have distinct sections. | Provide procedures, examples and preparation aids alongside adjudication principles. |
| [Wizards SRD](https://www.dndbeyond.com/srd) and [SRD 5.2.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) | A separately licensed reference contains a defined selection of reusable rules. | Publish a coherent, versioned rules reference with explicit reuse terms rather than treating all live website entries as the SRD. |
| [Blades in the Dark basics](https://bladesinthedark.com/basics) | Establishes the roles of players and GM and play as a conversation. | Explain SwordWeave’s negotiation of intent, scope and cost before introducing analytical terms. |
| [Blades licensing](https://bladesinthedark.com/licensing) | Distinguishes reusable SRD material from other creative assets and branding. | State exactly which text and assets are open and how future adventures relate to them. |
| [Fate Core SRD](https://fate-srd.com/fate-core) | Core rules sit alongside separate toolkits. | Separate essential procedures from optional numerical scaffolding and advanced design advice. |
| [Ironsworn downloads](https://tomkinpress.com/collections/free-downloads) | Offers books together with rules summaries, playkits, sheets and other aids. | Plan useful table references as deliverables in addition to books. |

Borrow these editorial approaches, while retaining SwordWeave’s own terminology, procedures and examples.

## Existing SwordWeave sources

The initial review covered the current play guide, author chapter guidance, character sheet formula and field-guide explanations, construction quick rules, canonical market definitions, progression code, previous rules audits, and historical Notion player/GM/monster/item notes. A systematic rule-by-rule reconciliation is still required before publishing a definitive manuscript.

Primary working sources:

- `src/lib/rules/play-guide.ts`: current teaching guide used by the Rules Guide.
- `src/components/sandbox/author-chapters.tsx`: primitives, effects, capabilities, heritages and items.
- `src/components/characters/bottom-sticky-bar.tsx`: sheet formulas, declared scale, costs and upkeep.
- `src/components/characters/sheet-identity-header.tsx`: budget and mirror-debt explanations.
- `src/components/character-modal/tabs/attributes-tab.tsx`: character foundation guidance.
- `src/components/characters/workspace/editor-workspace.tsx`: builder explanations.
- `src/lib/character/workspace/discovery/quick-rules.ts`: construction guidance.
- `src/lib/primitives/canonical-market.ts`: canonical family definitions and priced access.
- `src/lib/engine/bu.ts`: current progression and mirror-credit calculations.
- `docs/rules/play-guide-review-2026-10-03.md` and `docs/play-guide-beginner-audit-2026-10-04.md`: recorded rulings and resolved inconsistencies.
- `docs/audit-sources/`: historical material to reconcile, not automatically republish.
- `docs/library/srd-publication-and-role-art-2026-10-03.md`: catalogue publication context.
- `LICENSE`: existing software/game-content licensing scope.

The app is evidence of implementation, not an automatic authority over intended rules: a discrepancy may be an app bug or obsolete prose. Resolve against recorded user rulings, then identify only unresolved decisions for review.

### First audit priorities

| Issue | Publication treatment |
| --- | --- |
| Historical Close/Near/Far labels differ from current market range names. | Choose one canonical vocabulary and reconcile every table and example. |
| Generic BU tier heuristics differ from canonical family price anchors. | Explicitly distinguish design guidance from actual published purchases. |
| Older monster notes emphasize spent purchases; current encounters compare chosen base budgets and separate Item BU. | Explain base, spent, remaining and equipment budgets without conflating them. |
| Older item notes say all stacking is additive; current authored rules support other stacking behavior. | Document current stacking semantics and scope. |
| Some old check summaries risk counting proficiency twice. | Derive worked examples from the current check formula and explain what displayed practice bonuses contain. |
| Old cost language says costs are nonnumerical or always mandatory. | Distinguish the contextual choice of cost from its possible numerical magnitude, including effortless actions. |
| Duration, track, interruption and upkeep have historically overlapping descriptions. | Give each a definition and a complete multi-effect example. |
| Recovery, rewards and some optional numerical tables need classification. | Identify established rules, optional guidance and unresolved gaps; do not import another game’s rest or difficulty system. |

Keep Council → Fast → Measured → Heavy, contextual Strain, reusable purchases, personal mirror consequences, separate Item BU and flexible character concepts central to the explanation.

## Proposed books

### Player’s Handbook — learn and play

1. What SwordWeave is; what the group needs; player and GM roles.
2. A complete example of play: intent, scope, agreement, cost and resolution.
3. Your first character: concept first, attributes and practices, a guided purchase ledger, heritage choices, equipment and ready examples.
4. The construction language: primitives, effects, capabilities and heritages; owned access versus declared scale.
5. Checks, attacks, saves, clashes and contests.
6. Combat rhythm, movement and reactions, with an annotated round.
7. Strain, costs, duration, upkeep and interruption.
8. Vitality, damage, consequences, items, Load and cover.
9. Progression, new purchases, mirrors and invention during play.
10. Quick references, glossary and index.

A reader should be able to play without a website account. Put changing website controls in a short optional companion guide rather than making the core handbook depend on app screenshots.

### Game Master’s Guide — prepare, adjudicate and run

1. Prepare and run a first session, including a short worked scenario.
2. Establish shared expectations, stakes and table agreements.
3. Adjudicate unfamiliar intent: permitted access, scope, Strain, cost, resolution and consequences.
4. Run exploration and social scenes with practical examples.
5. Run Council and the three execution tracks; handle clashes, reactions, ongoing effects and interruptions.
6. Build monsters through the shared construction language.
7. Prepare encounters: creature and Item BU, quantities, objectives, terrain, enemy roles and tactical concentration. Explain the limits of BU comparison without inventing difficulty ratings.
8. Rewards, progression and equipment; label optional loot guidance explicitly.
9. Author new components and review their clarity, costs and interactions.
10. Worked rulings, encounter worksheets and table references.

Use original SwordWeave examples. Replace legacy examples named after another game’s spells with independently written situations.

### System Reference Document — use and build upon the system

1. Version, scope, license, attribution and terminology.
2. Core play procedures, including essential GM adjudication.
3. Character foundation, progression, formulas and tables.
4. Construction grammar: component types, recipients, conditions, operators, reuse, mirrors and stacking.
5. Checks and combat rhythm.
6. Strain, costs, scaling, duration, upkeep and interruption.
7. Vitality, consequences, equipment, Load and cover.
8. Canonical lexicons and enough components to support independent play and creation.
9. A curated set of characters, items and monsters illustrating the system.
10. Glossary, cross-references, change history and errata.

Include the procedures required for playable third-party material. The SRD can contain concise examples; precision does not require removing all teaching. Freeze a defined catalogue selection for each release rather than including every community entry or the entire changing database.

## Shared editorial structure

Maintain one approved rules register with stable identifiers, source references, status and version. Classify passages as core rule, default, optional guidance, example or app behavior. Maintain one glossary and formula/example ledger.

The PHB teaches the approved rules progressively; the GM guide explains adjudication and preparation; the SRD states them precisely. Shared definitions and numerical examples should be reused or checked together so a correction cannot silently leave the other publications behind.

## Visual proof before full layout

Create an eight-page pilot with real content:

1. Chapter opener and a short introduction.
2. Beginner play loop and dialogue example.
3. Character purchase ledger and explanatory table.
4. Primitives/capabilities/effects explanation and diagram.
5. An annotated Council → Fast → Measured → Heavy round.
6. A GM adjudication example with clearly labelled optional guidance.
7. A compact monster reference using existing SwordWeave artwork.
8. An SRD rule entry and quick-reference treatment.

Test dense tables, long names, formulas, captions and cross-references in this sample. Validate the writing and the design together.

### Aesthetic direction

- Preserve teal, warm gold, silver detailing, restrained arcane geometry and the existing illustration style.
- Use expressive display typography for headings and comfortable reading typography for body text.
- Use a light, print-friendly body treatment as the initial proof; compare a dark chapter opener. A dark digital edition is optional after readability testing.
- Translate orange mechanical text into a readable print color and pair it with labels; meaning must survive grayscale.
- Keep decorative rims and metallic lines thin enough to support text rather than dominate it.
- Separate rules, examples and optional advice through consistent labels and layout.
- Test an A4 reference page and a single-column screen page before fixing final dimensions.
- Provide a single-column screen edition or responsive web companion for phones. Do not expect a dense two-column print PDF to become comfortable mobile reading merely by shrinking it.

### Figma’s role

Use Figma to review covers, sample spreads, typography, tables, callouts and illustration placement. Figma supports frame-based multipage PDF export, with one frame per page: [official explanation](https://www.figma.com/blog/our-path-to-creating-the-highest-quality-pdf-exporter/).

My recommendation is to keep long manuscripts outside manually maintained page frames. Choose a reproducible typesetting pipeline or a dedicated book layout tool after the proof, with flowing text, automatic contents, references, bookmarks and reliable revision handling. For example, [InDesign documents linked contents and PDF bookmarks](https://helpx.adobe.com/indesign/desktop/indexes-and-references/add-a-table-of-contents/add-interactivity-to-tocs.html); choosing or purchasing it is not necessary for this planning phase.

## Licensing and future paid content

The current repository licenses software under MIT and game material under CC BY 4.0. Its game-content wording already includes descriptive lore.

CC BY permits commercial sharing and adaptation; compliant recipients retain those freedoms. Charging for a publication is possible, but previously licensed material cannot simply be made exclusive later. See the [Creative Commons license summary](https://creativecommons.org/licenses/by/4.0/).

Before release, specify the exact SRD content boundary and attribution language. Separately identify future original adventure text, stories, artwork, maps and branding where different terms are intended and permitted. Audit existing art, icons and font licenses before embedding them in distributed books. Do not assume the repository’s code license settles every asset’s rights. This plan makes no license changes.

## Delivery sequence and review gates

1. **Rules foundation:** inventory, conflict register, glossary and provisional contents for all three books. Gate: identify settled rules versus unresolved decisions.
2. **Real-content proof:** draft one complete example across the player, GM and reference treatments; design and render the eight-page sample. Gate: approve teaching voice, density and aesthetic.
3. **Manuscripts:** write the PHB first while building its shared SRD rule modules; develop the GM guide against the same material; assemble the full SRD. Gate: complete, consistent drafts.
4. **Usability:** have a new player create a character and a GM run a scene using only the drafts. Check every formula, purchase ledger and worked encounter. Gate: no hidden website dependence or unexplained procedures.
5. **Editing and production:** terminology, references, index, credits, licenses and layout. Gate: rendered page inspection, readable phone output, grayscale checks, searchable/selectable text, linked contents and bookmarks.
6. **Release:** versioned PDFs and web text, source archive, attribution examples, errata and changelog. Gate: all three publications identify the same rules release.

No fixed page counts or full production layout should be committed before the writing sample. The immediate next deliverable is the reconciled outline and eight-page proof, not three fully typeset manuscripts.
