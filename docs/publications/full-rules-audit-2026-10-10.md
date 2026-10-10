# Full-system rules audit for the three books

10 October 2026. Source checkout: `3fa371530dbe5713a2d0412eb88aae7118e0af0e`.

**Subsequent creator rulings:** [creator-rulings-2026-10-10.md](creator-rulings-2026-10-10.md) supersedes audit candidates where explicitly accepted. Rest conditions/carryover, stacking dice, sensory targeting, slots, movement and optional surprise have since been clarified. This audit retains the pre-ruling evidence and uncertainties for provenance.

## Scope and result

Audit the whole system, with extra attention to the four first-pass gaps. Checking only those gaps would carry obsolete rules into the books.

This pass compares the current Rules Guide, sheet formula/help modals, Atelier authoring/table guidance, character foundation/editing guidance, canonical market and relevant resolver code with the old books and Notion archive. It is a publication audit: no app mechanics, database definitions, licenses or Notion pages have been changed.

The source inventory contains **48 returned Notion pages** (the root and its 47 linked pages), **67 PDF pages** (36 PHB and 31 GM Guide), and hashes for **28 platform files**. Historical markets, lexicons and example ledgers were inventoried and checked for relevant conflicts; this is not a certification of every old recipe or every live community entry. The Notion connector returned dated snapshots, some with internally contradictory addenda. Retrieval today does not make all their text current. The inventory retains returned snapshot/last-edit metadata and text hashes.

Primary source ledger: [rules-source-index-2026-10-10.json](rules-source-index-2026-10-10.json). Extracted page-tagged PDF text and returned Notion content are local working evidence under `tmp/pdfs/full-rules-audit/`, not new public editions.

## Authority and labels

Use explicit current creator rulings, then current platform explanations, then formulas/canonical definitions as corroborating evidence. Use historical sources to recover missing procedures and explain provenance. A bug, stale code comment, old example or a heading saying “Canonical” does not automatically establish a rule. When current explanations conflict, record the conflict rather than silently choose the implementation.

Adopt these **editorial labels** in all three manuscripts:

| Label | Meaning |
| --- | --- |
| Core rule | The shared published framework: definitions and resolution relationships. |
| Default | The supplied procedure used unless the table agrees a variation. |
| Authored rule | A particular component's stated permission, restriction, recipient, condition or exception. |
| Optional guidance | Advice or a variant that must be chosen explicitly; never a hidden prerequisite. |
| Example | One fictional situation or numerical illustration; not a universal price or consequence. |
| App note | How a digital control records or calculates a result; not a new tabletop rule. |

The table's freedom to agree changes remains explicit. Agree departures clearly; do not make the reader infer that every sentence is both a default and an exception. This resolves **PUB-04 as an editorial task**, without asking the creator to decide a new mechanic.

## Coverage and publication treatment

`G` = `src/lib/rules/play-guide.ts`; `D` = `src/components/characters/bottom-sticky-bar.tsx`; `H` = `sheet-identity-header.tsx` in the same directory; `A` = `src/components/sandbox/author-chapters.tsx`; `T` = `src/lib/capabilities/table-guidance.ts`; `M` = `src/lib/primitives/canonical-market.ts`. Exact source paths/hashes are in the ledger.

| Area | Current baseline and book treatment | Sources / findings |
| --- | --- | --- |
| Participants, expectations, intent | Teach a shared story, expectations/boundaries, natural intent, access, stakes, resolution and consequences. Players may inspect/clarify before committing. | G `start`; Notion Player Loop. Old books' engineering language can supply context but should not be the beginner's teaching order. |
| Character foundation | Base Physical/Mental/Magical total 10, each -1 through +5; distinguish base scores from later rule contributions. A chosen proficient attribute supports its practices. Higher/custom starting budgets are agreed. | Foundation editor; `engine/practices.ts`; G `first-character`; old PHB pp. 18, 25. Foundation editor permits None for specialty; do not describe an app selector as a mandatory class. |
| Ten practices | Prowess/Finesse/Fieldcraft; Awareness/Reason/Knowledge/Influence; Mysticism/Communion/Intuition. Ordinary attempts do not require training. Use a practice for meaningful uncertainty, not as a permission gate. | G `rolls`; D practice modals; Notion Practice Overview. Supersedes the PHB's “18 skills.” |
| Practices, proficiency and expertise | Current full attribute value applies to practices; old distributed slices are obsolete. Proficiency grants upgrade training rather than automatically duplicate PB; expertise reaches twice PB where eligible. Explicit numerical bonuses remain separate authored rules. | `engine/practices.ts`, `practice-grants.ts` and tests; D practice breakdown; G. Old Notion contains incompatible slice and double-proficiency passages. |
| Primitives and composition | Own reusable ingredients; effects organize outcomes; capabilities organize complete intents; presets do not charge again for owned ingredients. Numerical and descriptive permissions both matter. | G `building-blocks`/`creating`; A; M; Notion Composition Map. Distinguish repeated use from deliberately purchasing multiple occurrences. |
| Heritages and conceptual placement | Lineage/upbringing/manifest are flexible foundations, not fixed classes or compulsory one-of-each tracks. They may be authored and developed. | G `heritages`; A. A's “only inherited components” sentence is stricter than G's flexible placement; write it as organization advice. |
| Creation access | Positive owned verb/domain foundation is required; items do not satisfy it. Missing range/output categories receive Touch/d4 baselines. Mirrored access alone is not positive creation access. | `character/creation-primitives.ts`; G; creation tests. Describe these defaults explicitly instead of importing old packages/prices. |
| Purchase budget, Item BU and reuse | Budget pays for acquisition, not each execution. Item BU is separate. New compositions reuse owned definitions; explicit extra purchases and their quantities still matter. | G `budget`; H; `engine/bu.ts`; bundle/creation contracts. Historical “BU has no runtime interaction” means it is not a casting pool, not that purchases cannot happen during play. |
| Progression and rewards | Use the literal threshold table through L21, automatic bracket spikes and current PB curve; spending does not undo progression. No fixed XP or compulsory per-session award. | G; H; `engine/bu.ts`; Notion progression. Old GM Guide pp. 15-19 contains contradictory PB/Vitality cells and a compulsory reward schedule. |
| Mirrors, debt and overflow | Reversal must fit scope/operation/access; accepted personal drawback remains. Credit/headroom, used debt and remaining ordinary budget are different. Ceiling is 4 BU per four-level bracket. Creation limits and later soft-budget warnings are distinct contexts. | G; H; `creation-budget.ts`; `engine/bu.ts`; mirror/debt tests. Do not make credit an extra encounter creature budget or turn Set To into an automatic negative assignment. |
| Checks, attacks, DC and saves | Check/attack use relevant current attribute and eligible training/modifiers. One selected-attribute DC; three saves. Do not add PB twice to a displayed total or demand both attack and save by default. | G; D; `engine/sheet.ts`; old PHB pp. 8, 14-15 and GM pp. 11-12 superseded. |
| Rounding, floors, bias and fixed results | Ordinary rounding is upward. Authored practice/save result limits are distinct from actual attribute/stat bounds. Baseline bias uses two dice/high or low; multiple bias counters need a final table procedure. | G; D roll limits; `engine/sheet.ts` around practice constraints; M; `resolve-modifiers.ts`. See follow-up edge checks below. |
| Combat rhythm and action scope | Council, Fast 0-1, Measured 2-3, Heavy 4+; one coherent Main Intent and one independent reaction. Movement is part of intent. Allied/adversary order and clashes/contests answer different questions. No default initiative queue. | G `combat`/`reactions`; Notion Combat Rhythm/Action Economy; encounter phase state. Remove old initiative fragments and default bonus-action language. |
| Movement and positioning | Sheet defaults by size: Tiny 15, Small 25, Medium 30, Large 40, Huge 60, Gargantuan 90 ft. Swim/climb are half base speed rounded up; flight/burrowing need granted access. Explain positions and reachable paths. | D speed modal; `engine/sheet.ts`; `encumbrance.ts`. Old `stats.ts` generic 30-ft helper is not the complete current sheet default. Scope of extra travel belongs in the intent, not a new bonus action. |
| Source, domain and targeting | Source is Physical/Magical/Psychic; domain is identity. Shape/targets/placement/duration describe the proposed use; extra behaviors may need access. A new verb/domain is not automatically granted by increasing scale. | G; T; A; M; Notion Damage/Composition. Psychic source terminology and Mental attribute must be explained, not treated as extra attributes. |
| Range and output permissions | Touch and d4 baselines; Near 30/Far 60/Very Far 120 ft; current d6/d8/d10 licenses priced 2/4/8 BU. Output die access and selected dice count are distinct. Extreme remains an explicit wording gap. | M; T; G. Old PHB pp. 19-20, 26 prices d6/d8/d10 at 3/5/7 and shifts range names. See PUB-03. |
| Strain, Cost, quickening and CV | Judge whole intent/context; 0-6 grades guide the conversation. State stakes before commitment; cost may be Vitality/resource/narrative/environmental/etc. Optional CV compares minimum/selected evaluated composition; it is not a casting-BU bill or roll bonus. | G `strain`; D action scale; T; Notion evaluation/Player Loop. Remove mandatory three-dial sums, fixed percentage costs and automatic quickening purchase ladders from core procedure. |
| Duration, upkeep, interruption | Track/duration/upkeep independent; a capability has one upkeep track despite multiple effects. Multiple maintained capabilities are possible; contextual costs accumulate. Valid interference needs timing/access/resolution; no automatic concentration save or universal refund. | G `upkeep`; D; A; Notion upkeep and Player Loop addendum. Exact payment/damage window and repeated crossings remain PUB-01. |
| Damage and defenses | Resolve source/domain portions and authored scope; resistance halves rounded up, vulnerability doubles, immunity negates covered output. Applicable resistance/vulnerability cancel; multiple resistances do not quarter by default. | G `damage`; D; `engine/damage-resolver.ts`; Notion Damage. Old immunity examples must not silently grant condition immunity beyond scope. |
| Vitality, collapse, rescue and rest | Max baseline (10 + current PB) x level, with active rules. Healing respects maximum. Collapse/rescue is contextual, not a fixed guaranteed ten rounds; massive damage is separate. Existing stabilization and rest values were found. | G `vitality`; D; Notion Tactical Subsystems and Combat Pipeline. See PUB-02; do not claim no recovery source exists. |
| Conditions and consequences | State cause, mechanical/narrative consequence, trigger, duration and ending/recovery. Named conditions do not imply one universal imported package. | G; conditions drawer; Notion Player Loop addendum overrides the upkeep page's blanket interruption list. A collapsed unconscious actor cannot simply continue an impossible maintained task. |
| Items, slots, Load and cover | Mundane tools, capability carriers and augments; separate BU/value/Load. Six universal slots, authored slot requirements, size Load values 0/1/2/4/8/16, pouches and capacity formula. Projected cover -2/-4/blocked; manifestation still needs legitimate targeting. | G `equipment`; D; A; `encumbrance.ts`; Notion items/cover. Explicit stacking supersedes “all items add”; detailed slot inference needs publication clarification below. |
| Creatures and encounters | Same component grammar; chosen base creature budget and separate equipment multiply by quantity. Show spent/remaining separately. Terrain, objectives, count, control, support and concentration matter. BU ratio is factual appraisal, not a guaranteed difficulty rating. | `monsters/resolve.ts`; `encounters/model.ts`; review/budget UI; accepted encounter plan. Old GM Guide pp. 3, 9-12 exact-equilibrium/minion/extra-turn prescriptions are not current defaults. |
| Loot, exploration, social play and campaign tools | Narratively choose rewards/obstacles; ordinary competence and relevant extraordinary permissions apply. Loot coefficients, synchronized rewards, anomaly meters and rest-based consequence examples are optional/historical candidates. | Notion Loot, practices, GM dashboard; old GM pp. 15-16, 20-31. A campaign pressure meter is not a required extra core subsystem. |
| Platform permissions and state | Pins preserve build versions; active/manual conditions and damage need actual application. Read access is not gameplay edit permission; GM toggle does not grant access. Saves/backups/visibility are app documentation. | G `sheet`/`creating`; continuity, collections and encounter services. Core procedures remain usable without an account. |

## The four initial gaps after checking the archive

### PUB-01 - upkeep payment and damage windows: still unresolved

Established: one capability/one upkeep track, multiple maintained capabilities, contextual amount, payment at “start of the user's turn,” and Vitality damage reaching the upkeep threshold requires immediate repayment or ending. G lines 640-657, D lines 1784-1788 and [Notion Upkeep](https://app.notion.com/p/37fed8479ccd81aa9467d9779c45f40a) agree on much of this.

Not established: where “turn” begins inside shared tracks; whether damage is per round or another window; whether each capability uses its own threshold or a combined threshold; whether paying resets the counter, subtracts a threshold, or caps further triggers. Notion Action Economy also mentions end-of-round upkeep, so a silent timing inference is unsafe.

**Candidate to review, not an adopted rule:** pay continuation upkeep at Council; assess actual Vitality damage between Councils separately for each maintained capability; reset that capability's damage counter after a pressure repayment; define whether excess damage carries over. Include a two-hit example and two maintained capabilities with different costs. No cascading repayment should be inferred from an uncleared counter.

### PUB-02 - recovery: partially recovered from existing sources

Found in [Notion Combat Pipeline](https://app.notion.com/p/37fed8479ccd814fabaed703f85d7af2), section “Recovery”:

- Long Rest: “Restore 100%.”
- Short Rest: “Restore 50%.”
- Healing restores Vitality directly.

Found in [Notion Tactical Subsystems](https://app.notion.com/p/390ed8479ccd80118106cd4b8f28a9bf), “Stabilization Methods”: dedicate an action track; attempt Fieldcraft using the applicable attribute/training, or creatively apply owned primitives; GM establishes suitable resolution/cost; successful stabilization halts the rescue countdown. G already references those methods. No universal stabilization DC was found; normal GM appraisal can supply it. Untrained practice attempts remain allowed under current practice rules.

Remaining details: what counts as a short/long rest and its interruptions; 50% of **maximum** versus missing Vitality or restoration **to** 50%; repeat-rest limits; whether stabilization grants any Vitality/consciousness; how healing changes the rescue state; remaining injury/consequence recovery. The old GM's peaceful-rest recovery for one modifier-burn example (p. 22) is not a universal recovery system.

**Candidate to review:** retain the existing 50%/100% values, specify the denominator and cap, define rest as an agreed safe rest period rather than silently importing another game's one/eight-hour lengths, and distinguish stabilization, restored Vitality, consciousness and lingering injuries. These missing details need one compact decision, not an entirely new healing engine.

### PUB-03 - Extreme range: still unresolved

M lines 235-236 says Very Far maximum 120 ft, then Extreme “from 240 feet out to roughly 3 miles.” T repeats the 240-ft-to-3-mile wording. The Notion market also uses that range; the old quick reference shifts names but does not close the gap.

**Candidate to review:** range access supplies continuous reach up to its stated maximum; Extreme can have a table-agreed ceiling in the 240-ft-to-3-mile envelope and also reaches nearer valid targets. Retain targeting/sensory requirements. That closes 121-239 ft without inventing a new paid primitive, but the minimum/maximum wording needs explicit confirmation before changing catalogue definitions.

### PUB-04 - rule/advice/example labels: resolved as publication structure

Use the six labels above. Keep historical numerical advice only where useful and identified. Do not carry compulsory old sidebars into core prose. This needs editorial implementation, not a gameplay decision.

## Additional edge checks before the final SRD

These surfaced because the audit covers all rules. They are not all blockers for beginning unaffected chapters.

1. **Multiple bias sources.** G gives the two-dice baseline; the resolver tracks separate advantage/disadvantage counters. The checked text does not establish one complete rolling rule for two advantages plus one disadvantage, repeated advantage or ties. Choose/cite a procedure; do not infer extra dice from a counter alone. Fixed-result/floor/ceiling interactions also need one worked example.
2. **Equipment slot inference.** Current engine uses at least one/two slots, quantity and size multipliers, but treats a stored cost above the baseline as already authoritative. Two-handed Large default 2 becomes 4; explicit 3 remains 3. D says “at least two depending on bulk”; old texts say flat 2. Document explicit final slot requirements and determine whether this fallback algorithm is a tabletop default or solely a digital convenience. Do not copy contradictory historical comments about pieces-per-Load: current Load is cost **per item**.
3. **Movement and time reference.** Size speed values are established, but G does not fully teach how ordinary distance is consumed within a coherent shared-round intent or how a long channel occupies subsequent rounds. Use Action Economy as the basis; label the approximate minute/ten rounds as heuristic, not a binding six-second duration for every scene.
4. **Collapse calculation versus digital storage.** Massive-damage arithmetic needs current Vitality *before* final damage, maximum and final post-defense damage. Sheets clamp stored current Vitality at zero and do not automatically implement death/rescue. Include a manual adjudication example so the negative threshold is not lost after the clamp. The phrase “at 0” must also cover overrun below zero that does not meet the massive-damage boundary.
5. **Natural die results.** No general automatic hit/failure or universal critical-damage multiplier was established in the checked core guide/catalogue. Do not import one. Authored fate/bias/roll-limit rules can state their own effects; decide whether an explicit core sentence is desirable when writing resolution.
6. **Access hierarchy and exceptions.** Explain exactly what a tier/domain/range/output permission includes and what an additional behavior requires, using current canonical definitions. Old “Narrative Stretch” grants unowned access with fixed penalties; current G requires access or an explicit ruling. Keep extraordinary exceptions visibly table-agreed; do not turn an old example into universal permission.

## Historical material to correct or reclassify

| Historical claim | Treatment |
| --- | --- |
| Three attribute DCs and an initiative queue | Replace with single DC, three saves and Combat Rhythm. |
| Distributed attribute slices, eighteen skills, automatic double PB | Replace with current ten practices/full attribute and current grant semantics. |
| PB increases at L3 or every two levels; inconsistent Vitality cells | Use current formula and regenerate every table/example. L3/PB2 = 36; L5/PB3 = 65. |
| Old component prices and Close/Near/Far distance labels | Rebuild examples from current canonical definitions. |
| Each scaling step/runtime upkeep spends BU | Separate acquisition from execution consequences and declared scaling. |
| Mandatory three-dial sums and percentage “Reality Tax” | Optional historical scaffolding at most; current contextual cost is the baseline. |
| Cost always determined after a roll or always fully paid upfront | Current rule establishes stakes beforehand and agrees the payment point; interruption refunds are contextual. |
| A fixed list of named conditions always cancels maintenance | Current condition/capability consequences and actual ability to continue govern it; Player Loop addendum explicitly corrects the old list. |
| Owning components makes all improvised actions inherently safe | Ownership removes a new purchase requirement, not consequences from scope, environment or risk. |
| Emergency purchases always add an Adrenaline Surcharge | Historical GM p. 20 optional proposal; not silently made a current default. |
| Equal BU guarantees mathematical encounter fairness | Remove guarantee. Current appraisal is a reference with explicit tactical caveats. |
| Bosses always buy a second initiative turn for 15 BU; all minions are 5 BU/5 Vitality | Historical packages only; rebuild any kept examples through current monster grammar. |
| Every session must award 2-3 BU; milestone 5-10; individual rewards forbidden | Optional pacing advice; current rewards are table/GM-defined. |
| Mandatory campaign friction meter/anomaly triggers | Optional GM module, if retained at all; not required to run the core system. |
| All item modifiers add; all two-handed items cost exactly two slots | Respect authored stacking and explicit slot requirements. |
| Reliable Practice always means natural d20 at least 10; half PB always rounds down | Old examples conflict with current result-limit/upward-rounding guidance. Copy an explicit authored exception only with its own label; never silently generalize it. |

## Writing sequence after this audit

1. Review the small decision packet for PUB-01, PUB-02 and PUB-03; keep bias/slot/time edge checks attached to their relevant chapters.
2. Expand the rule register into shared modules with source links and rule/default/example labels. Every numerical table and teaching example uses the same checked definitions.
3. Draft PHB core procedure, character foundation, composition and resolution while writing matching SRD definitions. Start unaffected chapters without waiting for every optional GM module.
4. Write upkeep/recovery after their missing details are settled, then the GM Guide's practical scene/encounter procedures.
5. Use the approved light/dark metallic proof for layout; test independent play from manuscript-only instructions before declaring a final SRD.

No full-book generation, deployment, seed or license change was performed by this audit. Development servers remain stopped.
