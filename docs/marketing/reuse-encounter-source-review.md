# Reuse, encounter and preparation source review

20 October 2026 · Batch 2 internal review. This records sources and calculations; it is not a playtest report, balance certification or book-edition reconciliation.

## Approved source and scope

- The SwordWeave editorial skill preserves personal creation, actual permissions, shared acquisitions, separate character/Item BU and execution Cost, and the undecided additional damage-triggered Vitality-upkeep rule.
- The approved Interwoven standard was recovered from the primary checkout at `/Users/max/dev/SwordWeave/docs/publications/print-edition/accepted-book-standard.md`; it is absent from this older worktree. Its related `interwoven-edition-production.md` was read for source context. No primary-checkout publication file or book source was changed.
- `docs/publications/manuscripts/players-handbook.md`, **Read and compose your abilities** and **Mira: a complete starting character**, supplies the reusable Water example, its bound ingredient definitions, full ledger and resolved stream diversion.
- The same PHB’s **Clashes and contests**, **One independent reaction**, **Move across the round**, **Attacks, saves and your DC** and **Maintained effects** supply the shared-round procedures. Existing public Rules reflects those procedures.
- `src/lib/encounters/catalogue/system-encounters.ts`, **caravan-at-the-rooted-ford**, provides the objective, terrain, alternatives, cast and tactics. The objective is safe passage for travelers/medicine without separating calf and parent; the animals need not die.
- `src/lib/monsters/catalogue/system-bestiary.ts` and `scripts/seed-system-bestiary-2026-10.ts` explain creature selection, focused attributes and pinned composition. The seed file was read, never executed.

## Public record verification

Read-only parameter-bound `SELECT` queries checked the current public records and exact encounter pins. No record, version, publication, account or secret was changed or printed.

| Record | Public identity / pin | Relevant fact |
| --- | --- | --- |
| Rooted Ford | `2aec9871-7900-59f4-a68f-7cd8b80af5a9` | Public; two Jackals and one Grazer |
| Thornpath Jackal | `74929175-01ef-5a77-a864-b1232d02e940`; v1 pin `00560803-ae09-53fd-a8cb-e4e8347ebaf1` | Quantity 2; 25 BU; Physical 3, Mental 0, Magical 0; Physical-proficient |
| Mossback Grazer | `3ff11c7b-dfb7-583e-a943-d19b7f3fcfd0`; v1 pin `39858d47-5366-5c7c-a0b2-f768fcf5ed7e` | Quantity 1; 50 BU; Physical 3, Mental 1, Magical 1; Physical-proficient |
| Encounter collection | `20bdea10-4878-5ffe-abff-37f9bdc1527e` | Existing starter collection; retained public link |

The Jackal’s pinned **Driving Blow** references **Driving Strike** version `e219582e-fdc4-5f49-bbca-093c42b6e9c9`. Its narrative grants a direct blow using an already available attack, with no extra attack or damage; its hard-modifier list is empty. **Climbing Speed +5** only adds to climbing speed, not attacks, Physical or DC.

The Grazer’s **Anchored Stand** includes **Fixed Anchor Physical Save +2**, **Brace at the Threshold** and **Braced Position**. The +2 requires the named intact rated anchor/tether and affects a Physical save, not DC. The hostile scene supplies no such tether and assumes no bonus. Its Bludgeoning Resistance is real but irrelevant to the Jackal’s illustrative piercing bite against Mira.

## Reuse teaching

Mira is the PHB example, not a newly created or silently published saved character. Her ledger is Verb II 8 + Water I 4 + Near Range 4 + d8 Output 4 + Knowledge Proficiency 4 = **24 BU**, leaving **1** of the 25-BU foundation. The first three ingredients form a **16-BU existing subset**, reused in all three tasks. Organizing them as Guided Water / River Hand does not repurchase them.

The worked uses are deliberately bounded: transfer existing water at 10 ft, divert a narrow visible stream at 20 ft, and reshape a shallow flow around a stepping stone at 20 ft. They concern existing grounded water inside Near’s 30-ft reach. They do not create water, move a creature automatically, heal, grant an absent sense or make a permanent bridge. The first and third are illustrative table applications; the second follows the PHB’s worked use.

For the PHB diversion, Magical 4 + applicable PB 2 = **+6**. A d20 result **7 + 6 = 13**, meeting the scene’s **DC 12**. The agreed Cost is continued direction until the worker crosses, then the channel returns to ordinary flow. No d8 damage, second acquisition or additional Vitality payment is invented. Other scopes/pressures need their own appraisal.

The lesson distinguishes carrying a bucket ordinarily, reshaping water through owned access, and asking for an actually missing healing/sensory/range permission. Output type appears only when that construction needs output. Saved River Hand records a useful expression and leaves scene-specific quantity, opposition, resolution and continuation terms open.

## Hostile branch: actual rules versus scene agreements

The parent approved Mira as the explicitly identified player-side PHB sample. Her PHB values are Physical **3**, Magical proficiency with PB **2**, single DC **11**, maximum/current Vitality **12**, and Speed **30 ft**. She does not add PB to the untrained Physical checks below. The Jackal’s 25-BU baseline is rank sqrt(25/25) = 1 and PB 1 + ceil(1) = **2**, so its Physical check/attack uses **3 + 2 = +5**, with no extra attack modifier in its pinned ingredients.

All positions, Fast assignments, torn strap, slipping pouch, catch DC, bite expression and resulting exposure are **stated illustrative table agreements**. They are not stored encounter properties or universal rules. The chosen bite is a Touch, 1d4 Physical piercing expression agreed for the ordinary creature attack; Driving Strike does not itself define that output. Increasing a die or paying a larger Cost does not silently establish a different attack.

| Step | Independent calculation / ruling | Exact outcome |
| --- | --- | --- |
| Pack timing | Mira d20 12 + Physical 3 = **15**; Jackal d20 8 + Physical 3 + PB 2 = **13** | Mira reaches the pack first. This settles timing; it does not automatically erase the other intent. |
| Immediate catch | d20 8 + untrained Physical 3 = **11**, meeting illustrative DC **10** | The visible single pouch is caught at Touch with a free hand. Reaction Slot **1 → 0**. |
| Jackal pivot | Still-unresolved Main Intent pivots to its available direct attack; d20 9 + Physical 3 + PB 2 = **14** against Mira DC **11** | Hit, with no second Main Intent or automatic extra attack. |
| Separate damage | Illustrative d4 result **3**; no applicable Mira resistance | Current Vitality **12 − 3 = 9**. No automatic condition, shove, drop or upkeep repayment. |
| Movement | Speed **30 − 10 spent = 20 ft** | Remaining movement belongs to this round; no new allowance from the Clash or reaction. |
| Named Cost | One torn carry strap; exposure at Touch | Strap **1 spent**; medicine pack recovered, pouch loss **0**, food rations spent **0** in this branch. Damage is the hit’s outcome, not a hidden Strain invoice. |

The catch qualifies under the PHB default because it responds to a perceived immediate event, affects one object beside Mira at Touch, fits Complexity 0–1, and uses her available independent Reaction Slot. A Reaction Clash is a separate timing procedure; its name does not create or consume an additional Main Intent. A distant or group rescue would need different scope/access. No universal opportunity attack or imported action economy is added.

Every participant has a stated role: Jackal A contests the pack then pivots its unresolved intent; Jackal B climbs to reachable roots and watches instead of also attacking; the Grazer holds beside its calf. Afterward Mira remains at the gravel edge beside the pack, injured at 9/12 and exposed. Safe passage is still unresolved. At the next Council her baseline Reaction Slot resets, while damage, supplies and positions remain. The original nonviolent branch remains available separately.

## Preparation, movement and upkeep

First-session preparation is now the second block of **Your first game**, with stable anchor `first-session-preparation`, exact reading links, selected public character/encounter links, essential versus optional materials and a feedback route. All fifteen Rules chapters remain. Neris’s level-8 starting-point caveat is explicit; Orren is an optional advanced level-16 example. Encounter party-budget inputs are examples, not a difficulty rating. Joining Discord, creating an account for public reading and finishing all three books are not prerequisites.

`/combat` now states the PHB movement baseline: allowance across the round, divisible among tracks/reactions and independent where circumstances permit. `/start` now uses the agreed continuation point, with Council as an example; it no longer imposes upkeep at the start of every individual turn. The damage-triggered Vitality repayment/reset rule stays pending. Book sources and homepage identity remain untouched.

## Acceptance evidence and remaining review

Eight focused tests passed: four teaching-example checks and the four existing Rules-search checks. Scoped ESLint and diff checks also passed. The checks cover the numeric ledger, source bonuses, dice thresholds, damage/reaction/movement state, retained Rules chapters, linked preparation and stable Creating anchors. Parent integration must still check full-source Markdown, visual density/readability, actual routes and desktop/phone behavior. Passing arithmetic is not proof that the teaching is clear or that a real group has played the scene successfully.
