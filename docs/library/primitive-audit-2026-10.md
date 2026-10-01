# Primitive audit and character-sheet contract — 1 October 2026

## Scope and rules

This is the implementation record for phases 1–2 of the library plan: repair existing primitive bases and verify their effect on character numbers. The creator's current rules govern this pass: a descriptive permission need not carry a numerical modifier; authored fractional results round up; weaknesses are mirrored uses of eligible primitives, not separate catalog entries. Pricing remains author-defined.

## Inventory

The live system catalog has **276 primitives**: **141 with a stored hard modifier** and **135 without** after the first three repairs below. The no-modifier set is dominated by 96 Domain rows, plus Verb, Range, Duration, Structure, Condition and die permissions. Their absence of a modifier is not a defect by itself. Numeric promises were triaged separately.

The existing character sheet distinguishes the resolver's totals from a second sheet calculation (`primitive-walk.ts`). Both must honor the same binding. Before this pass, the sheet walk matched a parent target such as `speed` or `attribute` without checking `metadata.targetScope.values`, so one scoped primitive could affect other subtargets. The local fix restricts the contribution to the bound result. The live sheet still needs the code deployment before that fix is available there.

## Versioned database repairs already applied

| Primitive | Latest version | Repair | Local resolver check |
| --- | --- | --- | --- |
| 54 Attack Bonus Increment | v4 | Expresses +1 on `action_roll` / `ATTACK_ROLL` instead of an orphan `action_roll.attack_bonus` target. | Attack 5→6; mirrored 5→4. |
| 65 Precise Vector Alignment | v4 | Same working attack target, mirrored eligibility and one explicit +1 promise. The concept currently overlaps row 54; choose one ladder parent before creating variants. | Attack 5→6; mirrored 5→4. |
| 22391 Focused Presence | v3 | Replaces descriptive-only “+1 Save DC” with a tracked `save_dc` modifier. | Save DC 13→14; mirrored 13→12. |

Previous versions remain in `primitive_versions`. Pinned character occurrences use their snapshots through `effectivePrimitiveDefinition`; unpinned occurrences read the updated row. The repair script is idempotent, checks content hashes and prior latest versions, and uses a transaction for each row.

## Verified locally, held for resolver deployment

The following versions are prepared in `scripts/repair-primitive-bases-2026-10.ts` and pass its dry-run against live source rows. They are **not applied to the live database** because the deployed character sheet does not yet contain their required resolver fixes.

| Primitive | Prepared version | Contract |
| --- | --- | --- |
| 218 Stride Extension | v4 | +10 walking speed only, with the scoped sheet walk preventing a swimming/flying bonus. Mirrored use yields −10 walking. |
| 22393 Broad Familiarity | v3 | Half PB, rounded up, on each non-proficient Practice; proficient Practices receive zero. PB 3 contributes +2. |
| 22492–22494 bound Physical/Mental/Magical Attribute Increments | v5 | Each stays +1 to its named attribute and becomes eligible for the corresponding −1 mirrored use. |
| 22495–22497 bound Physical/Mental/Magical Saving Throw Proficiencies | v5 | Grants PB to a named non-proficient save once; it does not double the primary proficient save or repeated grants. |

The code also fixes activation and deactivation of scoped conditions, compiled capability toggles, mirror opt-out, inverse arithmetic mirrors, and upward rounding of fractional results, including resisted damage and Vitality clamping. These are verified with a local resolver contract test and the existing engine tests.

## Further phase-1 decisions before editing these rows

These are real catalog ambiguities, not invitations to add a generic mechanical rule to every permission:

| Row(s) | What the audit found | Decision needed before version edit |
| --- | --- | --- |
| 55 Defensive Save Upgrade | The parent promises one Attribute save proficiency but stores a generic `behavior:saving_throw_proficiency` flag. The bound 22495–22497 rows above are the concrete usable expressions. | Keep 55 as an unbound parent and direct new players to the bound versions; decide whether its generic flag should be removed to prevent a false numeric claim. |
| 175 Minor Linear Displacement | Stores `character.movement.land = −15`; the current sheet speed walk reads the `speed` axis. Its prose also mentions a separate one-shot push. | Split persistent walking penalty from one-shot displacement, then bind recipients in the compositions that use it. |
| 382–385 defensive family | Legacy `defense_dc.<attribute>` keys and text describing three defense scores coexist with the current single Save DC and three saving throws. Universal Aegis claims all three, but stores only Physical. | Decide which current defense number each concept should change. Preserve pinned history and give the universal effect three correctly scoped pieces if all three saves are intended. |
| 849–850 cover | `action.roll` penalties land on an orphan ledger; prose says they apply to attackers at a chosen coordinate. | Define the recipient/targeting semantics in a concrete effect before remapping to an attacker roll. |
| 22396 Expertise Upgrade | Describes double PB for a named Practice but has no named binding or hard modifier. | Keep as an explicitly unbound parent and author named expressions only after deciding whether “double PB” means a second PB contribution or replacement of proficiency. |

The catalog also contains legacy behavior flags and capability-shape pieces. A raw resolver total under an old key is not proof that a displayed sheet number or an action changed. These need composition-aware review in the subsequent library phase; do not bulk-remap by string matching.

One separate condition-context gap remains: `condition-evaluator.ts` still approximates PB from max Vitality and aliases an attack-bonus predicate to Save DC when those values are absent from the context. A primitive whose trigger reads either number should not be promoted as an automatic condition until the character context supplies the actual resolved value. The prepared Broad Familiarity condition reads Practice proficiency and is covered by the checks above.

## Verification evidence and remaining gate

- Versioned repair dry-run: 3 already repaired, 8 ready; all candidate numbers, mirrored results where applicable, inactive compiled use, and Broad Familiarity's proficient exclusion checked against the resolver.
- Engine and Vitality tests: **42 files, 825 tests passed**. This includes character-sheet assertions for a tracked +1 Physical condition and half-PB Broad Familiarity at PB 3. TypeScript typecheck and ESLint on changed files passed.
- The broader `pnpm test` suite is **not green**: 142 failures in 9 files, concentrated in historical DB seed assertions and three old sandbox card expectations. Two seed assertions still expect the repaired rows 54 and 65 to use their former orphan targets. The current engine suite is green; the full-suite failures require separate test/seed reconciliation before any release gate.
- The opened production character sheet was inspected read-only after the restart. It showed existing live totals and authored examples, but it does not contain these repaired system rows. That view therefore cannot certify the new versions' displayed numbers.

**Next gate:** deploy the resolver/sheet changes, then inspect a disposable test character with each repaired row in direct and compiled placements. Confirm the displayed attribute, Practice, attack, Save DC, save, and walking numbers in both active and inactive states, plus mirrored and conditional states. Only then apply the eight pending version edits and recheck the same character against the live rows. Do not repin existing character instances silently.
