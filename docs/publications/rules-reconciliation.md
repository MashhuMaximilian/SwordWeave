# Rules reconciliation - first publication pass

Date: 10 October 2026. Current source revision: `3fa371530dbe5713a2d0412eb88aae7118e0af0e`.

This is an editorial reconciliation, not a rules-engine patch. No website rule, database value, source license or Notion page is changed. The companion rules register records the current publication baseline. Unresolved gaps remain visible.

**Second-pass update:** [the full-system audit](full-rules-audit-2026-10-10.md) supersedes the first pass's source-coverage limits. It compares the current platform with 48 returned Notion pages and the complete 36-page PHB/31-page GM drafts. Rest values and stabilization methods were recovered; PUB-04 is resolved editorially. The source ledger records dated snapshots rather than assuming retrieval makes historical text current.

**Creator follow-up:** [the ruling register](creator-rulings-2026-10-10.md) now records explicit accepted clarifications, including stacking dice (N net stacks means N + 1 dice), rest conditions/unused recovery, sensory targeting, ordinary 1/2-slot equipment and split movement across a round. Remaining questions are narrower than the historical gap table below.

## Authority

1. Explicit current user rulings in this conversation.
2. Current website Rules Guide, sheet modal explanations and builder guidance.
3. Implemented engine/resolver and canonical market as evidence of formulas and authored prices, checked against the explanations.
4. Historical audits, Notion and old drafts for provenance and missing coverage.

An implementation can be wrong. Do not silently turn an app bug into a tabletop rule. The current guide's recorded reconciliations already settle the discrepancies below; future unresolved differences need a decision.

## Selected baseline and corrections

| Stable ID | Current publication baseline | Reconciliation |
| --- | --- | --- |
| SW-PLAY-01 | Describe intent, verify access and scope, agree stakes/cost/resolution, resolve, then update the fiction. | Website introductory loop supersedes terse engineering pipelines as the teaching order. |
| SW-BUILD-01 | Primitives are reusable purchases, including narrative permissions. Capabilities, effects and heritages compose or organize them. | No extra purchase for reusing the same owned primitive; saved capabilities are not a closed action menu. |
| SW-BUILD-02 | Lineage, upbringing and manifest organize ancestry, experience and current expression. | No fixed class progression or mandatory one-of-each restriction. |
| SW-BUILD-03 | A character foundation needs owned verb and domain access; items do not fulfill this requirement. | Touch and 1d4 are free baselines when their categories are absent. |
| SW-BU-01 | Level 1 foundation is 25 BU; Item BU is separate. | Cost of executing an action is not another progression-BU payment. |
| SW-BU-02 | Level thresholds include spikes: 25, 35, 45, 55, 69 ... 117 at L9, 127 at L10, 169 at L13, 225 at L17, 286 at L21. | Old spike prose labels the prior bracket end; do not add a spike twice or replace the explicit L21 value with a simplified formula. |
| SW-BU-03 | Unspent BU can acquire/invent primitives during play with table agreement; progression awards need no fixed XP schedule. | Spending a purchase allowance does not reverse progression. |
| SW-BU-04 | Compatible primitives can be mirrored in use; accepted personal drawbacks still apply and credit remains constrained. | Add/subtract, min/max and multiply/divide have supported opposites. Set-to has no automatic opposite. |
| SW-ROLL-01 | Check = d20 + relevant attribute + PB if trained + applicable modifiers. | Do not add PB again when it is already part of a displayed total. Attribute means its current numerical value, not a D&D-style conversion. |
| SW-ROLL-02 | PB starts at 2 and increases every four levels; expertise uses twice PB where granted. | Do not import unrelated class proficiency schedules. |
| SW-ROLL-03 | One character DC = 5 + PB + chosen eligible modified attribute + direct DC modifiers. | Old attribute-specific DC descriptions are superseded. |
| SW-ROLL-04 | Physical, Mental and Magical saving throws remain distinct. | Three saves do not imply three DCs; capability resolution does not automatically require both an attack and a save. |
| SW-ROLL-05 | Round up when rounding is required. | No alternating/default round-down arithmetic. |
| SW-COMBAT-01 | Council, Fast (0-1), Measured (2-3), Heavy (4+). | No default initiative roll; complexity is timing dependency, not a power rating. |
| SW-COMBAT-02 | Reaction Clash decides timing; Active Contest decides an opposed struggle. | Roll only where opposing intent creates a meaningful collision; losing timing does not automatically erase the whole intent. |
| SW-COMBAT-03 | One independent Reaction Slot per round, reset at Council. | Default reactions are immediate, narrow, complexity 0-1 and self/touch or one target, with a real trigger and access. |
| SW-SCALE-01 | Owned range and dice type are access; selected count, area, duration and other scaling add pressure. | Declared scaling does not require a separate purchase for every dial by default. New behaviors may require additional access. |
| SW-SCALE-02 | Near 30 ft; Far 60 ft; Very Far 120 ft; Extreme authored as 240 ft-3 miles. | Historical Close/Near/Far shorthand is not reproduced. The Extreme transition is recorded as an open clarification below. |
| SW-STRAIN-01 | Contextual Strain uses scale, impact, complexity, environment, opposition and urgency; grades 0-6 are guides. | No fixed Strain-to-Vitality bill, automatic success chance or mandatory numerical scoring formula. |
| SW-STRAIN-02 | Cost can be Vitality, resources, roll-related pressure, environmental change or a narrative consequence, including negligible cost. | Historical “cost is not numerical” is not a prohibition on quantified payments. |
| SW-STRAIN-03 | CV is total evaluated construction/use weight; selected value minus minimum is the scaling increase. | CV is analytical, not a roll bonus, runtime BU charge or synonym for the scaling delta. |
| SW-UPKEEP-01 | Track, duration and upkeep answer different questions. A fixed duration does not automatically require upkeep. | No universal concentration restriction. |
| SW-UPKEEP-02 | One maintained capability has one execution, one Strain evaluation and one upkeep track, even with several effects. | Multiple maintained capabilities may coexist; costs accumulate. |
| SW-UPKEEP-03 | Vitality upkeep is re-paid immediately when cumulative turn damage reaches its upkeep amount, or the maintained effect ends. | Non-Vitality maintenance requires contextual interference rules, not a numerical damage conversion. Damage alone does not universally cancel casting. |
| SW-DAMAGE-01 | Matching resistance halves, vulnerability doubles, immunity negates covered damage; resistance and vulnerability cancel. | Round halved damage up; split mixed sources; authored scope controls applicability. |
| SW-VIT-01 | Base max Vitality = (10 + current PB) x level, then active modifiers. | Correct old Notion Vitality cells that disagree with their PB column. L3/PB2 is 36, not 39; L5/PB3 is 65, not 70. |
| SW-VIT-02 | Collapse at 0 uses contextual rescue stakes; massive damage has separate lethal thresholds. | Do not convert the approximate rescue minute into an unconditional universal countdown. |
| SW-COND-01 | Condition names have no universal numerical package; specify cause, consequence, duration and ending conditions. | No imported named-condition table or automatic interruption list. |
| SW-ITEM-01 | Read each rule's condition, operation and stacking behavior. Item BU is separate; six universal equipment slots and Load remain independent measures. | Old universal-additive stacking prose is superseded by authored stacking semantics. |
| SW-ENCOUNTER-01 | Compare chosen creature budgets and separate Item BU, multiplied by quantity. Show spent/remaining as different figures. | Do not add mirror credit as another creature budget, double-count equipment or invent CR/difficulty bands. Comparable BU does not guarantee comparable difficulty. |
| SW-APP-01 | The app stores and resolves build data; contextual damage, costs, consequences and upkeep still need table resolution/manual application. | Core book procedures must work without an account or an automatic action engine. |

## Unresolved before a complete core release

| ID | Gap | Safe treatment in the proof |
| --- | --- | --- |
| PUB-01 | Exact upkeep payment/damage-aggregation point within the shared round: current guide says start of “your turn,” while combat has a shared rhythm. Repeated threshold crossings also need an explicit reset rule. | State the existing rule and require an agreed payment point; do not invent a reset or phase. |
| PUB-02 | Notion Combat Pipeline supplies short-rest 50% and long-rest 100%; Tactical Subsystems supplies Fieldcraft/owned-primitives stabilization that halts the rescue countdown. Rest length, percentage basis, repetition, consciousness and lingering-consequence recovery remain incomplete. | Preserve the recovered values as an existing proposal; do not silently assume maximum/missing Vitality, one/eight-hour rests or that stabilization heals/wakes the character. |
| PUB-03 | Extreme range wording begins at 240 ft after Very Far's 120 ft limit; behavior in the transition needs clarification. | Use Near 30 ft in the example and preserve the actual catalogue wording in source notes. |
| PUB-04 | Resolved editorially: Core rule, Default, Authored rule, Optional guidance, Example and App note. | Apply consistently in all manuscripts. This is publication structure, not a new gameplay decision. |

PUB-01 through PUB-03 and the relevant edge checks in the full audit must be settled before calling the complete SRD final and independently playable. They do not block writing unaffected chapters or retaining the approved graphic proof.

## Notion and old draft checks

- [SwordWeave TTRPG](https://app.notion.com/p/37eed8479ccd81fa8150d0b31e22ff1f): collaborative, heuristic game philosophy and explicit CC BY SRD intent.
- [Combat Rhythm](https://app.notion.com/p/392ed8479ccd80f5b55ffe9863ab815d): shared intent, timing clashes, active contests and independent reactions.
- [System Mathematics](https://app.notion.com/p/391ed8479ccd801081f0c0f3fba1bf9d): old global formulas; attribute-specific DC language and cost wording differ from current guide.
- [Leveling & Progression](https://app.notion.com/p/37fed8479ccd80fba08bc88bb715658a): explicit BU table retained; incorrect Vitality cells corrected against the current formula.
- Existing Google SRD draft: legal notice only, including unresolved attribution placeholders. No editing performed.
- Second pass: both older PDFs compared from disk; 48 returned Notion pages checked. Recovery is not a blank slate. See the full audit and `rules-source-index-2026-10-10.json` for detailed findings and source coverage.

Earlier source review and beginner audit remain provenance: `docs/rules/play-guide-review-2026-10-03.md`, `docs/play-guide-beginner-audit-2026-10-04.md`.

## Proof checks

Mira's worked ledger: Verb II 8 + Water Domain I 4 + Near 4 + d8 4 + Knowledge proficiency 4 = 24 BU. Level 1 budget 25; remaining 1; no mirror credit or item cost included. Attributes 3/3/4 total 10. PB 2; Magical-selected DC 11; base Vitality 12; trained Knowledge bonus 5. The check 9 + 5 = 14 meets example DC 12.

This is an original teaching example using current canonical prices, not a newly seeded character. Monster artwork and identity are existing material; the proof does not invent a fully resolved monster statblock.
