# SwordWeave publishable library: research and authoring guide

**Research snapshot:** 30 September 2026  
**Status:** read-only proposal. No database rows, versions, publications, or application code were changed for this guide.  
**Goal:** make the existing library a useful first choice for players who want to build and play a character before authoring unusual content.

Implementation has since started. See [the October primitive audit](./primitive-audit-2026-10.md) for live version edits, local resolver repairs, tests, and pending deployment gates.

## 1. Rules this guide assumes

These decisions come from the creator's clarifications and take precedence over conflicting prices or character-creation steps in the older Player's Handbook, Dungeon Master's Guide, and attached BU Market document.

- A new character begins character creation with **25 BU for the starting package at any level**. The package covers domain, verb tier, range, die type, and a chosen mirrored primitive if the player wants extra budget. Remaining level-based BU is available on the character sheet after creation.
- **Touch Range and the Minor Die Block (1d4) cost 0 BU**. The attached Market's 1 BU d4 entry is stale. Other range and die tiers are purchased.
- The suggested **2/4/8/12/16 BU tier anchors** and the Market's magnitude/scope examples are guidance, not a mandatory pricing formula. An author may give a fork a different price. A narrower condition does not automatically calculate a discount.
- A primitive may be purchased during play, including mid-combat, and placed where the character concept calls for it: direct sheet, lineage, upbringing, manifest, capability, effect, or item. The same kind of trait can be placed differently by different players. Character-creation descriptions establish concept; the sheet develops it. No UX redesign is proposed here.
- **No standalone weakness catalog.** A mirror-eligible primitive is used normally or mirrored. A directly acquired mirrored primitive changes its effect and expands the character's available BU by its mirror credit. Mirroring a primitive inside a capability or effect changes that composition's output; it does not create another separately priced weakness row or an extra character-level credit for each use. Mirror eligibility and operation inversion are properties of the primitive and slot. Current operator pairs include add/subtract, multiply/divide, minimum/maximum, and grant/revoke; set-to is not mirrorable. See `src/types/modifier.ts` and `src/lib/engine/mirror.ts`.
- **All fractional mechanical results round up under the current SwordWeave rule.** For example, half of PB 3 contributes 2. The current resolver/practice aggregation implements that convention; old prose saying “half PB rounded down” should be version-edited, not used to redefine runtime behavior.
- **A condition is authored on the primitive.** Numeric predicates such as self Vitality below 50% can be evaluated from tracked state. Narrative predicates such as “when tracking enemies” are manual/GM-evaluated. The character sheet can override an occurrence. A player does not invent or declare a missing condition at the table to make an incomplete primitive work.
- **Condition names are not global effect formulas.** “Slowed,” “Burned,” or “Poisoned” can mean different things in different events. A given effect may carry a specific speed reduction, damage rule, duration, or recovery; another effect with the same tag may not. Character-sheet consequences record the actual occurrence and its recovery.
- Items have their **own BU**, separate from character BU. Load measures carried capacity; six universal slots measure equipped items. A two-handed item uses at least two equipped slots, and its author can specify more. A pouch holds up to 1,000 tiny items for one Load. Do not conflate Load, equipped slots, and item BU.

## 2. Sources and confidence

| Source | Use in this guide |
| --- | --- |
| Creator's rules and corrections in this conversation | Authority for the rules above and the work order below. |
| Live database, read-only queries on 30 September 2026 | Current rows, links, versions, and gaps. Counts and IDs are a snapshot, not a permanent specification. |
| `src/lib/primitives/canonical-market.ts`, authoring forms, modifier/condition resolvers, fork and version code | What the app can currently express and how rows are related. |
| [Attached BU Market](</Users/max/Desktop/Downloads/BU Market of Primitive components — Complete Syste 37eed8479ccd8155b917c373194dbdf4.md>) | Base taxonomy, tier descriptions, broad/narrow scope ideas, and candidate content; its d4 price and “round down” text are superseded. |
| [Player's Handbook](</Users/max/Desktop/Downloads/Swordweave Light Player's Handbook TTRPG.pdf>) and [Dungeon Master's Guide](</Users/max/Desktop/Downloads/Dungeon Master's Guide_ SwordWeave.pdf>) | Game concepts and examples; several historical prices and creation steps differ from the current app and creator's clarifications. The handbook's starter roles suggest a beginner content shelf. The guide's environmental costs suggest distinct effect concepts such as slick ground, spreading fire, fractured focus, and local gravity warp, without importing its old item-attunement wording. |
| Other games linked in §9 | Inspiration for *content concepts* only. Their classes, costs, status definitions, equipment systems, and UX are not imported. |

This guide does not equate `hard_modifiers=[]` with an invalid primitive. A descriptive permission such as **Metallic Masticators** is complete if its narrative states its useful boundary. A formal unbound template, by contrast, must be specialized before a composition claims a specific domain, attribute, or Practice.

## 3. Current library and the three parent relationships

The live snapshot contains **276 system primitives, 9 system effects, 27 system capabilities, 20 system heritages, and 6 system items**. These are counts, not quality claims. Several player-authored public forks also exist and should be reviewed before a system variant duplicates them.

1. **Market family/tier** classifies a primitive for design and discovery. It does not mean the row has a parent in the fork map.
2. **Formal template plus bindings** specializes a base. Example: Domain Access Tier I (`id=22356`) to Domain of Water (`id=22401`, `domain=water`, 4 BU). Eleven formal system templates exist: four Domain, four Structure, Attribute Increment, Defensive Save Upgrade, and Practice Proficiency. Other families often use priced base expressions instead.
3. **Fork genealogy** is the actual saved source-to-child relation in `forks`, with versions. It records the source copied, not necessarily the child's best semantic category. Do not infer a semantic family solely from a fork's parent or its name.

For a future database pass: **version-edit** an owned/source row to correct its own text or mechanics while preserving intent; **fork** it for a distinct magnitude, scope, condition, or behavior; **create** a primitive where no suitable parent exists; **rebuild/replace** an old composition when its concept is useful but its linked pieces are not. Use the existing version/fork services and inspect references and pinned versions before any change. Do not directly overwrite public user forks or silently repin characters.

## 4. Phase 1 — primitives first

### 4.1 Audit and repair existing primitives before adding variants

First inventory the existing primitive versions, bindings, fork parents, public visibility, composition references, and mechanical rules. Sort each row into **keep**, **version-edit**, **fork**, or **replace**. Repair the existing usable base and its common bound expressions before building a larger ladder from it. A descriptive permission is valid when its text states its actual boundary; only a numeric or tracked promise requires a working mechanical rule.

For each repaired numeric or tracked primitive, follow the complete path: saved rule and binding → purchased or compiled placement → active/inactive state and authored condition → resolver output → displayed sheet value or roll. Check removal/deactivation as well as activation. If `+1 Physical` leaves the displayed Physical value unchanged, the row is not ready as a starter choice even if its JSON looks correct. Preserve pinned old versions and use the versioning/fork flow rather than changing a shared ancestor in place.

| Existing row(s) | Proposed action | Why |
| --- | --- | --- |
| **Broad Familiarity** system `id=22393`; public mechanical forks `id=56`, `id=11848` | Reconcile the system row's “rounded down” prose with the current round-up rule; review the public mechanical version for a curated, versioned system expression. Preserve existing forks. | System description promises half PB but has no modifier; the public fork carries `pb_half` and a non-proficient condition. The rule must give the same number in the library and sheet. |
| **Focused Presence (Global DC Modifier)** system `id=22391` | Review the intended Save DC target; version-edit or publish a correctly scoped expression for the promised `+1`. Do not copy old `defense_dc` modifiers merely because they have a similar title. | Its Market description promises a numeric DC increase, while the system row is currently descriptive. The public older expression targets `defense_dc`, which requires semantic verification. |
| **Attack Bonus Increment** `id=54` and **Precise Vector Alignment** `id=65` | Decide whether they represent distinct axes. Test their actual sheet/roll contribution and cap/stacking, then choose a clear parent for attack ladders. | Both describe `+1` attack but use different targets and prices. Forking both blindly would multiply confusion. |
| **Focused Edge** `id=57`, **Expertise Upgrade** `id=22396`, **Reliable Practice** | Bind the chosen Practice/focus and verify prerequisites and replacement/stacking before publishing exemplars. | A generic named base is valuable, but a beginner needs a usable Awareness/Fieldcraft/etc. expression, not a slot note that merely says which choice to imagine. |
| **Structural Hardening (Domain Resistance)** `id=387` | Keep the unbound base; publish named-domain expressions/forks and adopt the correct expression in new compositions. | One unscoped base is linked to several different named resistances. Globally editing it to Fire, Cold, etc. would break other intended uses and pinned references. |
| **Minor Die Block** `id=19`, **Touch Range** `id=32` | Preserve 0 BU. Correct any documentation or example that still charges for either. | Current DB/code matches the creator's quick-start rule; the attached Market d4 row does not. |
| **Metallic Masticators** public `id=21351` | Keep as a model of a bounded descriptive permission. Review visibility and wording; do not manufacture a numeric modifier. | The level 6/16 bite permissions are the effect. |

### 4.2 After repair, publish a deliberate magnitude × target × scope ladder

The first-wave ladder should include **+1, +2, +3, +5, and +PB**, plus a few **half-PB** and **double-PB** cases where the rule makes sense. These are *distinct library entries/forks*, not merely example numbers in the editor. Price each authored entry individually using magnitude, breadth, uptime, level scaling, stacking, and tier guidance; preserve the author's pricing freedom. A `+PB` Practice bonus must clearly say whether it *grants proficiency*, *adds a further PB*, or *replaces an existing contribution*.

| Parent family / likely source | First concrete forks or expressions | Mechanics to fix in each row |
| --- | --- | --- |
| Attribute Increment (`id=53`; bound +1 Physical/Mental/Magical rows already exist) | +2/+3/+5 and +PB Physical, Mental, Magical; conditional +1/+2 examples | Raw attribute vs attribute modifier, score caps, stacking, always/conditional trigger. PB-scaled attribute variants are advanced and should be checked at low and high level before featuring as starter options. |
| Practice modifiers and Practice Proficiency (`id=22395`) | Flat +1/+2/+3/+5 to Awareness, Fieldcraft, Prowess, Finesse, Reason, Knowledge, Influence, Mysticism, Communion, Intuition; selected +PB variants | Named Practice scope, proficiency vs extra bonus, stacking, and whether a conditional rule is automatically or manually evaluated. Begin with a curated subset in each Practice, then fill the repeated ladder. |
| Attack bonus (after reconciliation above) | +1/+2/+3/+5/+PB to compatible attack rolls; narrow weapon/domain/target variants | Exact action-roll target and global vs one-source scope. |
| Three defenses and three saves | +1/+2/+3/+5 and selected +PB variants on Physical, Mental, Magical axes; all-defense variants | Defense score vs saving throw vs Save DC are different targets. Resistance and immunity are separate permissions/multipliers, not generic +defense. |
| Focused Presence / Save DC | +1/+2/+3/+5 and selected +PB Save DC variants | Verify the actual `save_dc` target and whether the scope is global or capability-specific. |
| Damage/healing output | +1/+2/+3/+5/+PB damage and healing, with source/domain/named-capability scopes | Flat addition vs die type, recipient, when added, and whether a repeated tick gets the addition once or each tick. |
| Sheet/runtime numbers | +5/+10/+PB Max Vitality; speed variants; Load/carry capacity; +1/+2 equipped slots; upkeep/strain variants | Exact tracked value, any lower bound, and whether the primitive belongs to a character or item definition. `+10 Max Vitality` is a useful mirrorable example because its mirrored use is `−10 Max Vitality`. |

Useful **conditioned forks**: self Vitality below 50%; target already marked by *this* ability; while standing in named terrain; while wearing a named item; while maintaining a named capability; after the character moves; against a named damage domain. Store the trigger in each primitive. If it is a narrative condition, say plainly what the GM/player turns on in the consequence or override controls. The condition should not be a loose instruction supplied only by the parent effect's prose.

Useful **permission forks**: controlled glide versus full flight; adhesive climbing; aquatic breathing versus swim speed; tremor sense while touching ground; retractable natural armor; a prehensile tail that manipulates small objects; scent-based communication; limited mimicry; shed-skin escape; touch-based memory impression. Check existing Aero, Aquatic, Subterranean, sensory, and metamorphosis rows before adding a duplicate. These may be descriptive, tracked grants, or numeric rules depending on the promise.

Do **not** create a cross-product of every value, target, and condition. Curate recognizable choices first, then expand after the first character journeys expose gaps. The library should still include more than a single +1 in each important family.

### 4.3 Mirror coverage belongs to these rows

No weakness entries are proposed. For each new numeric or permission candidate, decide whether its operation and vector support a meaningful mirror, record the ordinary and mirrored reading, and inspect BU credit in **direct character acquisition** separately from the same primitive used inside a capability/effect. A mirrored multiplication, division, minimum, maximum, grant, or revoke must use the operator inversion, not a naive negative number. Keep mirror opt-outs and unusual vectors explicit. Descriptive permissions need not be mirrorable merely to offer a weakness at creation.

## 5. Phase 2 — effects: reusable authored outcomes, not universal statuses

Treat the nine existing system effects as legacy research material. At least **Blind Stun** and **Corrosive Decay** need rebuilding: the former links an unmirrored +1 action primitive while describing action loss; the latter links an unmirrored resistance grant while describing erosion. A new effect must be assembled from versions whose actual polarity, recipient, trigger, and duration support its text.

Author a varied shelf with *specific* effect definitions. Names below are working concepts, not global condition rules or mandated prices:

| Effect concept | Specific instance to author | Variants / limits |
| --- | --- | --- |
| Guarding stance | This effect grants +2 Physical Defense until its named end event. | A magical or mental ward can fork the modifier; another “guarded” effect may use a different amount. |
| Exposed seam | This effect applies −2 Physical Defense to its target while an exposed-seam flag remains. | A separate mental-exposure effect may affect a save instead. |
| Frost drag | This effect applies a **Slowed** label and −10 walking speed for its specified duration. | The label alone never makes all Slowed conditions −10. |
| Entangling roots | This effect constrains movement and states the physical escape method and end condition. | Its capability supplies domain, delivery, and target. |
| Ember residue | This effect delivers one stated fire-damage tick and states when further ticks occur. | A different **Burned** consequence could affect sight, gear, or a narrative hazard instead. |
| Field mending | One healing output, e.g. 1d4 plus an authored flat/PB modifier. | Stabilization is a separate effect or primitive if claimed. |
| Hunter's mark | This effect marks one target and grants a scoped bonus only to the specified actor/source. | Define repeat application and end event locally. |
| Food toxin | Specific physical consequence, onset, recovery, and any Vitality/Practice change. | Can carry a Poisoned label. |
| Shamanic vision | Specific perception/mental consequence after a psychedelic exposure. | May also carry Poisoned, with different rules and recovery from food toxin. |
| Conductive wetness | A bounded state read by a particular lightning fork/capability. | No universal “wet doubles lightning” rule. |
| Concealing haze | A local sight/targeting limitation with area and end event. | Does not automatically grant full invisibility. |
| Rallying courage | A target-specific bonus or permission with a stated duration. | Can be repackaged in a shout, banner, or heritage. |
| Slick ground | A specific local movement or balance complication. | Its exact penalty belongs to this authored effect or a particular consequence, not to a universal “difficult terrain” label. |
| Fractured focus | One equipment/capability restriction with a stated repair method. | Useful as an item or hazard consequence; do not assume all focus items use the same restriction. |

Each effect should have a **tested linked-pieces record**: primitive/version IDs, polarity, recipient, authored trigger, scope, duration/upkeep if relevant, repeated-application behavior, and narrative description. An effect can be purely descriptive where that is the complete intended output. Consequences on the character sheet capture a specific application, ongoing restrictions, manual overrides, and recovery; they are not replaced by a fixed condition dictionary.

## 6. Phase 3 — capabilities: complete actions made from the effect shelf

The 27 old system capabilities are not a dependable player starter set. In the read-only snapshot, **16 of 18 system capability links marked DOMAIN disagree with their slot note**. Examples: Tornado Blast says Wind but links Metal; Chronomantic Haste says Time but links Pressure; Mind Scan says Thought but links Pressure; Time Stop says Time but links gravity/space; Simulacrum links an **unbound Domain Access Tier IV template** while saying Existence. Some unusual combinations may be intentional, but names and notes cannot substitute for actual bound pieces. Re-author clean versions or create replacements; retain pinned historical versions.

Starter capability shelf to assemble after Phase 2:

| Concept | Required pieces / purpose |
| --- | --- |
| Basic strike | Physical attack exemplar using a defined verb, Touch, and d4 baseline. Check its domain against the current package rules; do not reuse the old Strike entry's Earth link merely because it is present. |
| Ember touch / ember bolt | Fire domain, compatible verb, Touch or purchased range, d4 or purchased output; shows how one package grows. |
| Water shaping | Water domain plus a simple move/reshape verb; utility without mandatory damage. |
| Field mend | Life/healing access plus the field-mending effect and an explicit target. |
| Stone ward | Earth/stone or physical source plus a guarding effect; self and ally versions. |
| Binding roots | Plant/wood domain, transformative verb, range, target, and the entangling effect. |
| Scout's echo | Existing sensory permission, target/range, and an information boundary. |
| Rallying call | Support delivery of the courage effect to one ally; later a purchased multi-target version. |
| Quick step | Movement or timing primitive with an explicit action window. |
| Intercepting guard | Reaction timing plus protection of a chosen target. |
| Haze screen | Area and concealment effect with its own duration/upkeep. |
| Conductive field | Water/wetness setup that another compatible capability can exploit; explicit interaction trigger. |

Publish **simple single-purpose examples first**, then upgrades and combinations. Do not claim “one round,” “persistent,” “automatic tick,” or “no save” solely in prose if the purchased pieces and resolution do not support it. A capability should be easy to inspect and useful without requiring its owner to know how to fix seed data.

## 7. Phase 4 — heritages: flexible example assemblies

Keep the current lineage/upbringing/manifest placement system. Character-creation descriptions carry the concept; later purchases can join any appropriate container. These examples should never lock a primitive to only one type of heritage.

| Example assembly | Candidate primitive menu, not a forced package |
| --- | --- |
| Scaled lineage | Bounded natural armor, bite permission, scent, tail grip; wings or a breath capability can be purchased later. |
| Shell lineage | Retractable shell permission and one particular guarded effect, with its own movement tradeoff if chosen. |
| Spore lineage | Scent/spore communication, decay sensing, chosen toxin or memory-impression capability. |
| Tidemarked lineage | Aquatic movement, breathing permission, current sensing; a later water capability is optional. |
| Stone lineage | Physical-defense fork, tremor sense, stone memory permission. |
| Sky lineage | Glide, wind sense, then optional full flight. |
| Cartographer upbringing | Awareness/Fieldcraft or Knowledge choices, navigation permission, map tools. |
| Forge upbringing | Fieldcraft/Knowledge choices, heat familiarity, crafting tools. |
| Court upbringing | Influence/Intuition choices, a bounded social read. |
| River upbringing | Swim/boat familiarity, terrain or weather knowledge. |
| Guardian manifest | Reaction/protection choices; may later add a ward capability. |
| Storm manifest | Lightning/wind capability choices and an optional conditional damage fork. |
| Shadow manifest | Concealment and mobility choices with clear limits. |
| Beast manifest | A chosen physical trait and a later growth path. |

For every heritage example, show its actual child primitive/capability versions and explain which pieces are **illustrative**, **already purchased**, or **newly purchased** for a particular character. Avoid old notes that say “Fieldcraft proficiency” while linking an attack-roll primitive. The same Wings primitive can belong to a lizard lineage for one character and to another character's manifest capability.

## 8. Phase 5 — items: separate item builds and useful mundane gear

The six system items are too small a starter shelf. **Healing Tonic** currently claims `1d6+4` healing and stabilization without direct linked pieces for the `+4` or stabilization; **Arcane Focus** claims a DC bonus while its linked system Focused Presence is descriptive. Rebuild such items with verified primitives/effects/capabilities.

| Item candidate | Why it belongs in the starter shelf |
| --- | --- |
| One-slot blade, club, and shield | Straightforward equipped examples, with distinct attack/defense or descriptive properties. |
| Two-handed spear or great weapon | Demonstrates the minimum two equipped slots and authored larger footprints if appropriate. |
| Travel kit and climbing kit | Mundane utility and Load examples without a fabricated character BU charge. |
| Healer's satchel | Carries tools and a clearly specified aid capability, if one is included. |
| Healing tonic and smoke vial | Consumables with one exact authored effect each; carried rather than continuously equipped. |
| Signal whistle and tiny tokens | Pouch-scale item examples; distinguish 1,000 tiny items per Load from equipped slots. |
| Ward charm, resonant bell, and storm rod | Item-built capability/effect examples using the same reusable library pieces as a character build. |

Each item record should state **item BU, Load, equipped-slot cost if equippable, two-handed flag, quantity/consumable behavior, linked primitive/effect/capability versions, and what the item actually does**. Do not infer attunement or another game's item rules.

## 9. Further content inspiration, without changing SwordWeave's UX

- [Daggerheart SRD](https://www.daggerheart.com/srd/) offers concrete biological and cultural feature concepts, including fungal communication and shell-like defensive behavior. Translate the *idea* into SwordWeave permission and modifier primitives, then let players place them wherever their concept fits.
- [Pathfinder 2e character and ancestry rules](https://2e.aonprd.com/Rules.aspx?ID=2027) show many distinct traits under one broad identity. Use that breadth to make several optional Scaled, Stone, Fungal, and Sky variants; do not import its ancestry-selection structure.
- [Blades in the Dark teamwork](https://bladesinthedark.com/teamwork) suggests support and reaction capabilities: assist, protect, coordinate, set up. Express them through SwordWeave's own action, target, strain, and timing primitives.
- [Guild Wars 2 combo fields](https://wiki.guildwars2.com/wiki/Combo) suggest **reusable setups and follow-ups**: a field/effect marks an area or target, while another capability reads that authored state. No global elemental-combo rule is required.
- [Diablo IV item affixes](https://news.blizzard.com/en-us/article/24123440/diablo-iv-1-5-0-patch-notes) show the variety available from conditional bonuses: after moving, while protecting an ally, against a marked target, during a maintained effect. Use these as prompts for numeric primitive forks and item properties, with SwordWeave prices and scopes.

The candidate concepts and names in this guide are original research prompts. Author final SwordWeave descriptions; do not copy external game text or mechanics verbatim.

## 10. Publication sequence and acceptance checklist

**Order:** (1) inventory and repair existing primitives; (2) verify repaired primitives through the character-sheet resolver; (3) fork and create missing primitive variants; (4) rebuild effects; (5) compose capabilities; (6) assemble heritages; (7) build items; (8) repeat external inspiration research and add gaps found during the starter-character walkthroughs. Old compound content can remain pinned for existing users while clean public replacements are made.

Before promoting each entry into the player-facing starter shelf:

1. Inspect existing system and public user rows to avoid duplicate names with different behavior. Choose **edit, fork, create, or replace** deliberately and record the source ID and version.
2. Check result, operation, value, recipient, scope, trigger, stacking, and mirror behavior against the saved rule. A descriptive permission passes when its boundary is clear; a numeric promise needs a working numeric rule.
3. Put the primitive on a test character in the intended placement. Verify the displayed value or resolved roll changes by the promised amount while active, returns when inactive or removed, and follows tracked or manual conditions correctly. Repeat for a representative compiled effect/capability and for both normal and mirrored polarity where applicable. Inspect resolver output and character-sheet display together; a correct stored modifier alone is insufficient.
4. Check a bound domain/attribute/Practice expression rather than leaving a generic template in a finished composition. Inspect every nested link, polarity, and version, not only the title or slot note.
5. Evaluate fractional and PB-based values using **round up**, at a low and a high level. Review caps, repeated applications, and whether a condition is automatically read or manually overridden.
6. Check direct mirrored character acquisition for the intended BU credit; check mirrored capability/effect membership for the intended inverse output without a separate weakness row.
7. Check item BU separately from character BU, and Load separately from equipped slots and tiny-item pouch quantity.
8. Build several vanilla characters from the public shelf without custom authoring: warrior, guardian, scout, healer, controller, social character, and crafter. At both level 1 and a high starting level, the creation package begins with **25 BU**, Touch, and d4 at **0 BU**; later available BU appears on the sheet. Confirm they have useful heritage, capability, effect, and item choices after creation.
9. Preserve previous versions and pinned character references. Do not silently replace another author's public fork. Put repaired/new entries on the public shelf only after their actual components agree with their description.

### Out-of-scope code findings to address before publication, not in this research pass

- `src/components/characters/new-character-form.tsx` currently uses `cumulativeBuForLevel(level)` to size the initial package while storing `startingBu: 25`. The creator's rule is 25 BU for creation at **every** starting level; subsequent BU belongs on the character sheet.
- The character randomizer applies character BU constraints and “budget used” copy to item proposals, while ordinary item discovery prices item additions at zero character BU. Content work should not paper over this inconsistency.
- Some older audit documents and market prose say half PB rounds down or treat a condition name as a fixed global mechanical state. This guide supersedes those assumptions; the system rule is round up and each authored instance carries its own mechanics.

No database mutations are part of this guide. The next work phase is a version-aware database content pass in the sequence above, with small reviewed batches and a starter-character walkthrough after each layer.
