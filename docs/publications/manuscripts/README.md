# SwordWeave manuscript drafts

The three books use the **v0.1 alpha** rules edition and accepted rule register. These are text drafts for the approved platform-font, gold/silver/teal light/dark publication design. The existing eight-page visual proof remains the layout reference; these manuscripts have not yet been typeset into new PDFs.

See [book content and shared coverage](../book-content-scope.md): every player procedure belongs in both PHB and SRD. The PHB now has drafts for all nine main teaching chapters. The SRD includes matching reference procedures, an initial base-access/range/output reference and creature/encounter construction. Full family definitions, remaining construction examples and final editorial checks are still pending. A full bestiary or finished heritage/fork catalogue is outside the scope.

- [Player's Handbook](players-handbook.md): play, character creation, DIY composition, resolution, combat, scaling, maintenance/consequences, survival/recovery, equipment/progression.
- [Game Master's Guide](game-masters-guide.md): first chapter on reviewing creations, choosing consequences and constructing an encounter around competing objectives.
- [System Reference Document](system-reference-document.md): corresponding definitions and procedures, base families/access tiers/range/output, construction, creature formulas and a checked quantity/budget appraisal.
- [Creator rulings](../creator-rulings-2026-10-10.md): source for the latest clarifications and deferred upkeep decision.

The rest of the GM Guide, complete base-family definitions, item/creature record examples, high-level continuation and mirror edge cases, glossary/index and final credits remain to be completed. The creator-deferred upkeep placeholder is visible in all three manuscripts. The earlier eight-page proof and historical source audit are retained as dated material, not current complete editions.

## Coverage and example checks

| Shared subject | PHB | SRD |
| --- | --- | --- |
| Intent, agreement, Rule of Cool | Begin a shared story | Core procedure |
| Attributes, practices, acquisition | Make someone you want to play | Character foundation and construction |
| Checks, baseline formulas, stacking dice | Both opening chapters | Resolution |
| Sensory targeting and exceptions | Push the limits | Scope and targeting |
| Movement and optional surprise | Act together in combat | Combat and movement |
| Upkeep/consequences | Composition, persistence and survival chapters | Costs and persistence; deferred numerical placeholder |
| Short-rest carryover/long-rest recovery | Survive and carry consequences | Recovery and equipment |
| Equipment and progression | Equipment and growth; 21 checked rows | Resolution; Recovery and equipment |
| Creature/encounter construction | Reading a creature remains pending | Construction reference; also the first GM chapter |

Mira: base attributes 3 + 3 + 4 = 10; ledger 8 + 4 + 4 + 4 + 4 = 24; remaining 1 from 25; level 1 PB 2; trained Knowledge 3 + 2 = 5; selected Magical DC 5 + 2 + 4 = 11; base Vitality (10 + 2) × 1 = 12. Short rest: ceil(13 / 2) = 7, heal 3 from 10/13, retain 4. Two advantages minus one disadvantage gives one net stack and two dice; two net stacks give three dice. Prices are examples using current canonical entries, not compulsory universal prices.

## Local implementation verification

Earlier clarification checks passed 114 tests and typecheck. The subsequent release check passes 62 focused tests across five files and a production build with TypeScript checking. Actual shared recovery controls and the synchronization client were browser-checked with intercepted fixture responses: carryover, partial long-rest reset, negative-value rejection, Escape/focus and offline/reconnect behavior. Phone light/dark and desktop layouts were inspected. Homepage/FAB badges fit at desktop, 412px and 320px. This is not a claim of testing a personal account or two physical devices. See [implementation verification](../../engineering/rest-recovery-alpha-2026-10-10.md).

All 21 progression rows in both manuscripts were checked against the literal source table and PB/Vitality formulas. Mira's 24/25 ledger, the 13-Vitality rest example, and the 25-BU/13-Vitality creature foundation were checked. Full manuscript-only playtesting, cross-book copyediting, complete base definitions and typesetting are still required before publication.
