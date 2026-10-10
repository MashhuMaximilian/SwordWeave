# TTRPG publication structures and SwordWeave scope

Researched 10 October 2026. This note compares publisher descriptions, public contents pages and official reference documents. It is not a claim to have read the full paid editions of every book. Recommendations below are editorial conclusions for SwordWeave, not rules borrowed from these games.

## What the four document types actually do

| Document | Main reader and task | Typical contents | Boundary |
| --- | --- | --- | --- |
| Player's handbook / core rulebook | Learn to create a character and play | Play loop, character creation, abilities, resolution, combat, equipment, advancement; explanatory examples | A core rulebook can also include GM material. A player supplement need not be a complete rulebook. |
| GM guide | Prepare and run situations, make rulings, create content | Adjudication, consequences, encounter/adventure design, opposition construction, campaign tools and worked situations | Some games put this in the core book; a separate volume should earn its place through useful guidance. |
| System Reference Document | Look up precise mechanics and create compatible material | Designated reusable rules, definitions, tables, construction procedures and any included game options; version and reuse notice | Neither a fixed-length summary nor automatically a copy of every supplement. Its scope and license must be explicit. |
| Bestiary / content supplement | Obtain prepared material | Ready-made creatures, abilities, equipment, setting material or adventures | Construction rules can remain in the core/GM/SRD books while prepared catalogues are separate. |

These are functions, not a universal requirement to publish four PDFs. The following games combine them differently.

## Comparisons

### Pathfinder Second Edition Remaster

Paizo separates **Player Core**, **GM Core**, **Monster Core** and **Player Core 2**. Its announcement explains that these replace the older core rulebook, GM guide, bestiary and advanced player guide. It also identifies Archives of Nethys as the online destination for remastered rules, retaining legacy material. Thus the public rules reference is a different presentation from the teaching books and prepared creature catalogue. This comparison concerns the Remaster arrangement, not Pathfinder First Edition. [Paizo's Remaster announcement](https://cdn.paizo.com/blog/pathfinder-second-edition-remaster-project).

**SwordWeave application:** distinguish rules for making opposition from a volume of prepared opposition. The latter can be deferred. Do not import Pathfinder's class structure or assume an online reference requires a matching fourth printed book.

### Call of Cthulhu Seventh Edition

The **Keeper Rulebook** contains the core rules along with GM guidance, spells, monsters and background. The **Investigator Handbook** expands character creation and adds occupations, player guidance, equipment and setting information. It is a player aid, rather than the same split as a D&D PHB and DMG. [Keeper Rulebook](https://www.chaosium.com/call-of-cthulhu-keeper-rulebook-hardcover/), [Investigator Handbook](https://www.chaosium.com/call-of-cthulhu-investigator-handbook-hardcover/).

Chaosium's **BRP SRD** is a separately identified system reference, not a substitute title for the Call of Cthulhu books. The publisher-linked PDF covers character creation, resolution and combat and includes a single sample foe. [BRP SRD download page](https://www.chaosium.com/brp-system-reference-document/), [publisher-linked SRD PDF, section 7](https://www.chaosium.com/brp-current-srd-download/).

**SwordWeave application:** book titles do not determine completeness. Make our PHB's player coverage explicit. A reference can demonstrate opposition with a small worked example without reproducing a large bestiary. This is an organizational comparison, not an assessment of Chaosium's various reuse licenses.

### Daggerheart

The **Core Set** supplies a rulebook and character cards. The current **SRD 2.0** includes character creation, classes, ancestries, communities, equipment, GM mechanics, adversaries/environments and domain-card references. Its introduction describes reference and compatible-content purposes and distinguishes it from the core book's additional examples, advice and presentation. Its contents illustrate that an SRD can cover both player and GM mechanics and substantial prepared content. [Core Set overview](https://www.daggerheart.com/buy/), [SRD page](https://www.daggerheart.com/srd/), [SRD 2.0 contents and introduction, pages 2–3](https://www.daggerheart.com/wp-content/uploads/2026/08/DH_SRD_2_2026_08_25.pdf).

**SwordWeave application:** share mechanical definitions across teaching and reference editions. Daggerheart's included creature catalogue is a publisher scope choice, not a requirement for our SRD. Keep our approved metallic styling in all three books; concise reference writing does not require visually plain pages.

### Fate Core

**Fate Core** combines character creation, explanatory examples and GM worldbuilding material. The publisher points readers to the Fate SRD. Its stunt chapter teaches constructing abilities, using example stunts as models rather than an exhaustive list; its opposition chapter teaches creating NPCs. [Evil Hat's Fate Core description](https://evilhat.com/product/fate-core-system/), [Building Stunts](https://fate-srd.com/fate-core/building-stunts), [Creating and Playing the Opposition](https://fate-srd.com/fate-core/creating-and-playing-opposition).

**SwordWeave application:** this is especially relevant to our construction emphasis. Teach the vocabulary, bounds and decisions needed to make something, then demonstrate the method. Readers should understand why a component works and how to alter it. Fate's mechanics remain its own; SwordWeave retains BU, primitives and Council/track play.

### Cairn Second Edition

Cairn has a **Player's Guide** with creation and core procedures and a **Warden's Guide** with worldbuilding, tools, advice, examples, a bestiary and monster/background construction. These materials also have web presentations and downloadable game files. The monster-creation chapter gives guidance and demonstrates the process with examples. [Player's Guide](https://cairnrpg.com/second-edition/players-guide/), [Warden's Guide contents](https://cairnrpg.com/second-edition/wardens-guide/), [Creating Monsters](https://cairnrpg.com/second-edition/wardens-guide/creating-monsters/), [Game files](https://cairnrpg.com/second-edition/game-files/).

**SwordWeave application:** use practical worksheets, compact references and worked creation sequences. Website and PDF formats can share content; a prepared catalogue can accompany construction guidance without defining the size of our release.

## Conclusions for SwordWeave

1. Keep our three free books. The distinction is reading purpose: **learn/play**, **run/create**, and **reference/reuse**.
2. Every player rule in the SRD also belongs in the PHB. Include complete formulas, tables and procedures where players need them; write more teaching examples in the PHB.
3. The GM Guide teaches applying the system: consequences, ambitious workings, scenes, opposition, encounters and adventures. Put essential GM mechanics in the SRD as well.
4. Give both PHB and SRD the **base primitive families and their actual tier definitions**. The PHB explains and demonstrates them; the SRD provides a structured lookup. Include suggested prices and restrictions, clearly labelled.
5. Teach how to compose capabilities, heritages, items and creatures. Use a few fully explained constructions to demonstrate reuse, accounting and adjudication. The examples are adaptable teaching material.
6. The 100 seeded monsters, a large heritage catalogue and community forks are **outside the current book-writing scope**. They can remain platform resources and inform selected examples. A monster manual is not a prerequisite for this release.
7. The standalone-play check is: can readers build a character and opposition, resolve play and find the necessary base definitions without signing into the platform? It is not: have we printed every existing entity?

These decisions supersede the earlier proposal to package all 100 system monsters as a required bestiary appendix. See [the corrected scope](book-content-scope.md) and [revised outlines](book-outlines.md).

## Next writing unit

Build the base-primitive reference inventory from `src/lib/primitives/canonical-market.ts` and the reconciled Rules Guide. Group the families for readers, verify each base entry's meaning and suggested cost, and write matching PHB teaching/SRD reference sections. Preserve differences between a family's access tier, a range/die ladder and general authoring cost guidance; they are not one universal tier scale. Do not bulk-import bound variants or forks. Once that foundation is clear, use it for a few complete character/heritage/capability and GM creature examples.

The approved interactive light/dark design and separate light/dark PDF exports remain the production approach. The manuscripts are still partial, and the creator-deferred damage-triggered upkeep decision remains visibly pending.
