# Neris teaching source review

Source checked: 2026-10-20T11:36:35.477Z. Internal editorial/numeric record, not public teaching prose.

## Scope and method

Inspected only public example `1662962b-14c5-4433-994e-6273b3f7ca57` and its public components through explicit database SELECTs. No writes, seeds, account changes or application play mutations were performed. The query excluded owner IDs, email, notes and DM notes; credentials were neither copied nor printed.

Primary sources:

- `scripts/library-demo-characters-data-2026-10.ts`: the 100-medic concept, spread, origins, direct additions, named capabilities and equipment.
- Saved `characters`, `character_primitives`, `character_heritages`, `character_capabilities`, `character_items` rows; exact pinned primitive/capability/heritage/item version snapshots. The public record is authoritative for what this example currently owns.
- `scripts/phase4-heritage-data.ts`: Ashlung, Field Surgeon Apprentice, Thread Surgeon, Splint and Rally, Mended Vitality, patching and preparation definitions.
- `scripts/phase4-expansion-data-2026-10.ts`: Patient Reassurance Influence +2, Gentle Treatment, Stored Remedy and Dose and Release.
- `docs/publications/print-edition/accepted-book-standard.md` and `swordweave-book-editorial` skill: separate acquired permissions, expressions, execution Cost and context. Preserve book work; website teaching does not reconcile book editions.
- `src/lib/engine/bu.ts`, `bu-balance.ts`, `practices.ts`, `sheet.ts`, `resolve-modifiers.ts`, `condition-evaluator.ts`, `vitality.ts`: actual progression, checks, trigger evaluation and totals.
- `src/components/characters/vitality-tracker.tsx`: Heal / Apply healing / Amount / Heal controls; read-only sheets disable changes.

## Observed foundation and exact totals

Public name Neris Cinderthread; level 8; Medium; Physical 3, Mental 5, Magical 2; proficient attribute Mental. Starting BU field 25, DM bonus 1, saved character expenditure 86, current Vitality 104.

Existing engine evaluation, using all 19 pinned character primitives and the three inventory items:

| Result | Calculation / verified value |
| --- | --- |
| PB | 3 at level 8 |
| Progression pool | max(starting 25, level-8 progression 99) + DM bonus 1 = 100 |
| Character acquisition BU | 19 unique saved IDs, no mirrored rows, sum 86 |
| Unspent | 100 − 86 = 14 |
| Item BU | Satchel 2 + Vest 8 + Roll 4 = 14, separate |
| Single DC | 5 + PB 3 + chosen Mental 5 = 13 |
| Attack with Mental chosen | PB 3 + Mental 5 = +8 |
| Vitality | (10 + PB 3) × level 8 = 104; current 104 |
| Influence, reassurance false | Mental 5 + Mental training PB 3 = +8 |
| Influence, reassurance declared true | 5 + 3 + authored scoped 2 = +10 |
| Knowledge | 5 + training 3 + Knowledge Check +2 + explicitly additive Knowledge Check +PB (3) = +13 |
| Finesse | Physical 3 + Finesse training 3 + direct bonus 2 + direct bonus 3 = +11 |
| Saves | Physical +3; Mental +10; Magical +2 |
| Inventory | Load 3 / capacity 125; equipped slots 2 / 6 |

The extra Knowledge Check +PB is an additive rule, distinct from granting proficiency. Knowledge Proficiency does not duplicate the PB already supplied by the proficient Mental attribute. Conditions were evaluated both with no manual flag and with the exact saved reassurance flag present. The condition affects Influence only; it does not add to healing output, DC, attack or unrelated practices.

## Unique acquisition pins and accounting

The earlier public lesson called 21 entries “character primitives.” The verified character acquisition ledger contains 19; a broad sheet ingredient count must not be substituted for the paid character ledger. Item compositions belong to separate Item BU. The new lesson makes no unverified claim that every displayed ingredient counter equals character acquisitions.

| Saved primitive ID | Name | BU | Pinned version | Version ID |
| --- | --- | ---: | ---: | --- |
| 23340 | Careful Body Preparation | 2 | 2 | `03b71fb7-78cf-5dca-8d31-a1228ad3ed6a` |
| 23175 | Carry Capacity Augment +20 | 4 | 2 | `c35f2835-9c18-5092-9ef7-5a2173a6a8fd` |
| 23176 | Carry Capacity Augment +50 | 8 | 2 | `d0c56233-c7cb-56f9-8613-3469d58d2a26` |
| 23406 | Consent-Based Prepared Remedy | 4 | 1 | `0782299d-0387-54cb-93cb-8e76a832c600` |
| 23183 | Finesse Check +2 | 4 | 2 | `9529af98-4418-53b0-9434-c38ddc5e5a59` |
| 23184 | Finesse Check +3 | 6 | 2 | `b4556edd-1264-5c2a-86d3-8cdf5af31072` |
| 22499 | Finesse Proficiency | 4 | 5 | `eb409a29-3803-55b5-befd-48c78d61ed1a` |
| 23277 | Fire Resistance | 8 | 1 | `7741dc3d-792e-5b69-8a7a-db18bebf815a` |
| 390 | Heavy Die Block (1d8) | 4 | 6 | `c8effaf1-df14-4078-a40f-6b51bde2109e` |
| 23199 | Knowledge Check +2 | 4 | 2 | `11146d37-bdbd-5fca-bb3d-6985fa95b55b` |
| 23262 | Knowledge Check +PB | 12 | 2 | `96256051-e125-5b69-afd6-7896ddb59e0c` |
| 22503 | Knowledge Proficiency | 4 | 5 | `b95cd7ce-a28e-5546-9684-2e674279521b` |
| 23223 | Mental Saving Throw +2 | 6 | 2 | `20eb7be1-7a6b-5235-8a5d-eb2625739c2b` |
| 19 | Minor Die Block | 0 | 4 | `1bdf8380-abc0-4ee8-a3c3-b75c0cb727b4` |
| 23312 | Ordinary Smoke Filtration | 4 | 2 | `9a468634-7e2d-5bfd-9fda-2bb3e4dcfcdc` |
| 23394 | Patient Reassurance Influence +2 | 4 | 1 | `83b5e8e8-9b76-5282-a7f1-c9ea5febd555` |
| 23327 | Temporary Material Patch | 4 | 2 | `2db76db9-89b5-5d6f-9378-a9feb3fabd31` |
| 32 | Touch Range | 0 | 7 | `8f38a8b4-bfcf-4225-8ef1-b0ec58f72f89` |
| 20 | Verb Access Tier I | 4 | 7 | `176c6dba-db6d-4f20-baf3-cc5a76c6dbc3` |

Teaching-order increments (not a historical click log): Ashlung 12; Field Surgeon Apprentice 18; Thread Surgeon 18; Dose and Release 4; Gentle Treatment 4; direct additions 30. Running totals 12, 30, 48, 52, 56, 86.

Shared acquisitions are deduplicated by their saved primitive IDs, not by similar names or a family guess. Knowledge Check +2 (23199), Carry Capacity Augment +50 (23176), and Minor Die Block (19) recur through origin/recipe references but are purchased once. Finesse Check +2 (23183) and Finesse Check +3 (23184) are distinct acquired rules and both remain charged.

## Checked containers and limits

| Container | Saved pin | Version ID |
| --- | ---: | --- |
| Ashlung | 6 | `5ac3c4bd-981a-5727-ac63-6f71f9c16de6` |
| Field Surgeon Apprentice | 6 | `a56df33a-2dc4-5bce-bb6d-48cbec0582e7` |
| Thread Surgeon | 6 | `ac3c9f47-8b08-5e51-9e84-dc6df4cee435` |
| Dose and Release | 1 | `13654153-8af7-5a16-9101-a22702eed9a9` |
| Gentle Treatment | 1 | `1ecde921-390e-500b-986a-40ec1b58aa12` |
| Patch the Seam | 2 | `8fdc7d1b-eb5d-5cee-b912-567d22d184ef` |
| Splint and Rally | 2 | `d1dc5531-97d3-58c5-b6ff-fc849e15f9ba` |
| Boundary Marker Satchel | 1 | `d3aa0ebd-98b1-52d0-a2c4-8c73a0b6d168` |
| Patchplate Vest | 1 | `ef0bdcf4-5001-551b-b077-4090db796826` |
| Patchsmith Roll | 1 | `590c18d2-309d-5940-92e9-df39a9c6efc7` |

Gentle Treatment pin 1 instructs a scoped Influence check, authored 1d4 treatment output and a manual target-Vitality update. Its direct reassurance primitive is 23394; Mended Vitality is effect c46cbcdc-f79d-4b3e-8a61-f41369fc7c44 and uses Minor Die Block 19. The saved primitive’s condition is `actor:manual:speaking_with_a_willing_patient_during_the_named_treatment_ends_on_treatment_completion_or_withdrawal_of_consent`. It ends on completion or withdrawal; a successful Influence check does not compel consent.

Mended Vitality, Stored Remedy and Temporary Patch descriptions were also read from the current public effect snapshots; this review does not claim a complete replay of every historical child-version pin. The two used treatment source definitions agree with the saved character output ingredient and the unchanged seed recipes. Parent review should treat the exact character acquisition pins and the authored parent recipe as the checked teaching boundary.

Minor Die Block is explicit 0-BU baseline output. Heavy Die Block (1d8), saved primitive 390 pin 6, has its own authored description. Keeping d8 in the ledger does not automatically change the saved 1d4 treatment recipe. Careful Body Preparation concerns respectful body preparation/preservation, not healing or resurrection. Smoke filtration concerns ordinary work in light nonmagical smoke/ash, with dense smoke/heat/toxic/magical hazards kept distinct.

## Saved example versus current fresh-creation requirements

None of the 19 saved character acquisitions is a Domain-category entry. The current character-creation flow requires domain and verb access in its foundation; equipment cannot supply that requirement. Do not add a fictional Domain, silently modify the public record, or claim this snapshot was freshly recreated and accepted by that validator.

The guide teaches the actual bounded physical treatments. It tells readers to review required access/foundation, level, budget, equipment and versions before applying a fork/rebuild. It does not claim the saved record is unusable at every table, nor equate ordinary physical care with unrestricted domain magic. This remains an explicit alpha source/validation distinction for founder review.

## New illustrative treatment, not an observed playtest

One willing patient is reachable, has 6 / 12 Vitality and can receive this specific treatment. The group establishes one appropriate clean medical dressing outside the saved inventory. Safe time is available; no extra Neris Vitality Cost is agreed. The table chooses DC 12 before commitment. A failed check spends dressing/time without healing; those failure stakes are authored for this example, not a universal capability rule.

With the saved condition true, the actual bonus is +10. Illustrative d20 7 gives 17, meeting DC 12. Illustrative 1d4 output 3 produces patient Vitality 6 + 3 = 9 / 12. Dressing 1 → 0; Neris 104 / 104 unchanged; the scoped condition ends; character acquisition count 19 and remaining BU 14 unchanged. No requirement to spend BU again, no d8 substitution, no duplicated PB/+2 and no automatic cross-character healing.

On the patient’s editable sheet, Heal / Apply healing opens Amount; entering 3 and confirming Heal applies the agreed result. The patient’s owner/permitted editor performs the operation. Clicking Neris’s Heal would update Neris instead. Source reads verified control names; this task did not submit any live healing or fork/build operation.

## Artifacts and verification boundary

`src/lib/rules/neris-example.ts` supplies NERIS_EXAMPLE, the exact acquisition pins, items, teaching-order stages, the illustrative treatment and all seven NERIS_GUIDE chapters. The web reader and future companion/Markdown share that source. Full ledger and additional calculations remain expandable; the main treatment includes its complete decision and numeric result.

Focused tests check unique acquisition IDs/pins, cumulative budgets, exact stage deduplication, condition off/on through the real engine, treatment arithmetic and source completeness. Parent owns full build, browser review, Markdown integration and publication. No independent playtesting, encounter-balance claim, complete book parity or fresh validator acceptance is established by these checks.
