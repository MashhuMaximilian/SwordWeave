# Primitive audit and character-sheet contract — 1 October 2026

## Scope and rules

This is the implementation record for phases 1–2 of the library plan: repair existing primitive bases and verify their effect on character numbers. The creator's current rules govern this pass: a descriptive permission need not carry a numerical modifier; authored fractional results round up; weaknesses are mirrored uses of eligible primitives, not separate catalog entries. Pricing remains author-defined.

## Inventory

The live system catalog has **276 primitives**: **141 with a stored hard modifier** and **135 without** after the first three repairs below. The no-modifier set is dominated by 96 Domain rows, plus Verb, Range, Duration, Structure, Condition and die permissions. Their absence of a modifier is not a defect by itself. Numeric promises were triaged separately.

The character sheet distinguishes the resolver's totals from a second sheet calculation (`primitive-walk.ts`). Both now honor `metadata.targetScope.values`, so one scoped primitive cannot affect unrelated subtargets. The client speed bridge also reconciles only local runtime conditions and inactive published sources; adding every resolver contribution to an already calculated server speed counted the new Stride Extension twice.

## Versioned database repairs already applied

| Primitive | Latest version | Repair | Local resolver check |
| --- | --- | --- | --- |
| 54 Attack Bonus Increment | v6 | Expresses +1 on `action_roll` / `ATTACK_ROLL` instead of an orphan `action_roll.attack_bonus` target. | Attack 5→6; mirrored 5→4. |
| 65 Precise Vector Alignment | v6 | Same working attack target, mirrored eligibility and one explicit +1 promise. The concept currently overlaps row 54; choose one ladder parent before creating variants. | Attack 5→6; mirrored 5→4. |
| 22391 Focused Presence | v5 | Replaces descriptive-only “+1 Save DC” with a tracked `save_dc` modifier. | Save DC 13→14; mirrored 13→12. |

Previous versions remain in `primitive_versions`. Pinned character occurrences use their snapshots through `effectivePrimitiveDefinition`; unpinned occurrences read the updated row. The repair script is idempotent, checks content hashes and prior latest versions, and uses a transaction for each row.

## Eight further database repairs applied

The following versions were applied with `scripts/repair-primitive-bases-2026-10.ts` after the resolver deployment and initial live sheet check.

| Primitive | Prepared version | Contract |
| --- | --- | --- |
| 218 Stride Extension | v4 | +10 walking speed only, with the scoped sheet walk preventing a swimming/flying bonus. Mirrored use yields −10 walking. |
| 22393 Broad Familiarity | v3 | Half PB, rounded up, on each non-proficient Practice; proficient Practices receive zero. PB 3 contributes +2. |
| 22492–22494 bound Physical/Mental/Magical Attribute Increments | v5 | Each stays +1 to its named attribute and becomes eligible for the corresponding −1 mirrored use. |
| 22495–22497 bound Physical/Mental/Magical Saving Throw Proficiencies | v9 | Grants PB to a named non-proficient save once; it does not double the primary proficient save or repeated grants. |

The code also fixes activation and deactivation of scoped conditions, compiled capability toggles, mirror opt-out, inverse arithmetic mirrors, and upward rounding of fractional results, including resisted damage and Vitality clamping. These are verified with a local resolver contract test and the existing engine tests. All 11 repaired rows now report `already repaired` on a rerun; a full `migrate-v12-library.ts --apply` rerun generated zero versions. The migration has guards in its template expression, generic classification, and late content-repair passes so deployments preserve reviewed versions.

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

## Verification evidence and follow-up

- The resolver deployment and eight version edits were tested against the original [i2 Test Character](https://www.swordweave.quest/characters/462f9048-b0da-4185-98db-d18027132c82) and a [disposable copy](https://www.swordweave.quest/characters/f07c81b8-62e1-497a-a221-9b96e248c0b8). The original's baseline was Vitality 338/338, Physical +6, Mental +7, Magical +4, PB +6, DC 21, attack +14, Physical save +19, Fieldcraft +24, Intuition +7, walking 50, climbing 20, swimming 25. These remained stable after deployment. Turning the compiled Stone's Endurance capability off changed Reason +10→+7 and DC 21→19; turning it back on restored both.
- On the disposable copy, Iron Will's tracked below-half-Vitality condition changed Awareness +7→+12 at 168/338 and back to +7 after healing. This checked live condition activation and deactivation. The copy had a different Physical baseline because the existing Clone flow lost the source character's mirrored flag; see below.
- All eight repaired primitives were added through the library to the copy and passed draft validation. Its review showed walking speed 50→60; Physical/Mental/Magical +1 each; proficient Fieldcraft +1 only; non-proficient Awareness +4 (Mental +1 plus half PB +3). On the live sheet, Physical +14→+15, Mental +7→+8, Magical +4→+5, attack +22→+23, Physical save +27→+28, Mental save +7→+14, Magical save +4→+11, Fieldcraft +32→+33, and Awareness +7→+11. Mental and Magical saves gained PB once; the already-proficient Physical save gained only the attribute point. Walking is 50→60 while climbing stays 20 and swimming stays 25. [Live sheet screenshot](primitive-audit-live-sheet-2026-10-01.png).
- The first post-save live view still showed old resolver numbers until reload, while server-derived speed had changed. The build apply path now reloads after a confirmed save so the user sees authoritative character values immediately. This was confirmed live by mirroring the new Physical increment (+15→+13, attack +23→+21), then undoing the mirror (+13→+15, attack +21→+23); both saves returned directly to the correct play-mode totals. A separate speed bridge bug added the published +10 walking modifier twice after reload (70 instead of 60). `client-speed.ts` now adds only runtime-condition deltas and removes inhibited published contributions. The live speed card and formula both show 60 = 40 size base + 10 walking primitive total + 10 from Fast.
- Engine and Vitality tests: **42 files, 825 tests passed** before the final speed patch; the focused speed and sheet tests passed **50/50** after it. TypeScript typecheck and local production build passed. The broader `pnpm test` suite is **not green**: 142 failures in 9 files, concentrated in historical DB seed assertions and old sandbox card expectations. Two seed assertions still expect repaired rows 54 and 65 to use former orphan targets.
- The former Vercel build command ran the v12 library migration against the live database on **preview** builds. Two previews exposed separate migration paths that rewrote audited rows. They were corrected through versioned repairs; the migration now skips audited rows in all three relevant passes, and a full apply rerun generated **0 versions**. `vercel.json` now builds the app without running a database migration. Library migrations can be run as an explicit, reviewed task. The corrected latest versions are 54 v6, 65 v6, 22391 v5, 218 v4, 22393 v3, 22492–22494 v5, and 22495–22497 v9.

The disposable copy exposed a separate existing Clone problem: the clone route copies primitive IDs but not `isMirrored`, pinned `versionId`, slot source, or origin metadata, and does not reproduce heritage links. Its “Mirrored Str Buff” therefore became +4 instead of −4. This copy is useful for isolated post-copy tests but is not a faithful regression baseline. The original was not edited except for a capability toggle that was restored to Active. Do not silently repin existing character instances.

The final app revision was deployed as production deployment `dpl_C7DZf46oumcCqBWzKdMRrRCGwbuX` and was verified on `www.swordweave.quest`. The original character still showed its pre-deployment quick-dock baseline after the final deployment. The test copy pins the saving-throw primitives at v5 from its original purchase; v9 changes their reviewed description while retaining the same hard modifier. The versioned repair script checks each v9 rule against the resolver, and a fresh migration apply creates zero new versions.
