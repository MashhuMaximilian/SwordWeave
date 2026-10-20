# Character from scratch: source and numerical review

20 October 2026. Internal delivery record for the new public guide at
`/creating-a-character`; this document is not public teaching prose.

## Scope and authored status

The guide adds twelve chapters using the existing Rules `LearningGuide` reader.
The original copper-toothed tracker is an authored paper proposal. No character,
primitive, item, effect, capability or heritage was created in the database. No
saved build, historical click sequence, independent playtest or successful browser
creation is claimed. No copyrighted fictional character is reproduced.

The user's request is personal construction, including nonnumerical traits,
conditional numbers and optional organization, without selecting an existing
heritage. Complete character supplies the actual no-template creation route.
The advanced subject is authorship, not a higher starting level.

## Accepted PHB source chain inspected

The primary checkout `/Users/max/dev/SwordWeave` was read only. The accepted
source was recovered from:

- `docs/publications/print-edition/accepted-book-standard.md`
- `docs/publications/print-edition/interwoven-edition-delivery.md`
- `scripts/build-phb-interwoven-edition.py` → `build-phb-dance-edition.py` →
  `build-phb-organic-edition.py` → `build-full-phb-v6.py` →
  `build-full-phb-v5.py`
- `scripts/phb_organic_teaching.py`, including its native conditions lesson.

The delivery record identifies the accepted 268-page Interwoven PHB master as
`output/pdf/swordweave-players-handbook-v0.1-alpha-interwoven-edition.pdf`,
SHA-256 `6215d7461b8fe5748898b586d6b89fde52a17a208d555eaea941345422fc39ae`.
This is the identity recorded by the accepted delivery; this task did not rerun
the book renderer or perform a new PDF visual audit.

The manuscript alone was not treated as the full book. The imported v5 runtime
source was also read: the acquisition/reuse spread around lines 320–338, the
character foundation worksheet around 376–381, the targeting field study around
390, and the complete working/equipment records around 430. These native lessons
teach actual access, reuse without repurchase, ordinary supports, target knowledge,
separate ledgers and a working's result/scope/resolution/ending.

`phb_organic_teaching.py` lines 38–43 and 322–339 provide the accepted condition
lesson: actual change, recipient, timing and ending; a numerical counter-bonus
does not end the cause. The guide applies that distinction to its original
Scent-obscured consequence.

The corresponding manuscript references inspected were:

- `docs/publications/manuscripts/players-handbook.md` 108–172: concept,
  foundation, ten attribute points, 25-BU default, training and optional heritages.
- 196–293: ordinary versus exceptional attempts, optional composition,
  reuse, complete conditions, scene testing and execution consequences.
- 301–342: approach-based checks, ten practices, full attribute values,
  proficiency and one combined bonus; PB and selected-attribute DC.
- 416–449: scaling versus missing behavior, location, Cost and upkeep.
  The undecided incoming-damage upkeep rule was not resolved by this guide.
- 565–643: family-specific access, separate tiers, subject binding,
  reach/output baselines, practice modifiers and sensory information boundaries.

## Rules versus the authored example

The actual default and reference facts are level-1 progression 25 BU, PB 2,
base attributes totaling 10, full attribute contribution, selected-attribute
DC `5 + PB + attribute`, Vitality `(10 + PB) × level`, Touch and 1d4 baselines,
and suggested 4-BU Tier-I access anchors.

All custom limits and prices are expressly authored agreements:

| Entry | BU | Status |
| --- | ---: | --- |
| Verb Access I | 4 | PHB suggested access-family anchor |
| Metal Domain I | 4 | PHB suggested named-subject access anchor |
| Heightened scent | 4 | Example table agreement; exposed sampled scent, 10-minute sample/trace, 30-ft sensory boundary |
| Copper-biting teeth | 6 | Example table agreement; soft copper ≤1 mm thick/10 mm wide, contact, safe loose object/fastening, up to one quiet minute |
| Quarry focus: Awareness +1 | 2 | Example table agreement; one precisely declared scent task |
| Touch | 0 | Baseline |
| 1d4 | 0 | Baseline; not used as damage or healing in the worked tasks |

`4 + 4 + 4 + 6 + 2 = 20`; `25 − 20 = 5`. Repeated recipe appearances total 38
if incorrectly summed; the unique acquisition set remains 20. Reference keys
identify the same authored acquisitions, rather than guessing identity from a
similar name. No mirror or drawback credit is used.

The initial cross-device creation path selects the actual 8-BU access foundation
first (17 BU remain), then authors the three custom traits from the saved Build
workspace (12 additional BU; 5 remain). It does not promise a universal desktop
creation-return button for arbitrary custom traits.

The sensory 30 ft is explicitly part of the authored sense, not projected reach.
Neither example requires a separate range purchase merely to supply the sense,
and neither provides current creature location from an old trace. Heightened
scent and Copper-biting teeth use complete narrative permissions, not fabricated
stat outputs. Metal Domain access remains a real foundation binding; it is not
created by the word “metal” in another primitive's name.

The scene's DC 12, die result 6, quiet preparation, smoke consequence and ten-minute
wash recovery are illustrative table agreements. The copper sample is compatible
with its written rule, including safe support by a companion; it is not a worn
restraint, opposed creature or dangerous loaded fastening.

## Numerical verification

The public constants and tests use actual pure helpers in:

- `src/lib/engine/bu.ts`: `cumulativeBuForLevel`.
- `src/lib/engine/bu-balance.ts`: `computeBUBalance` (Item BU separate).
- `src/lib/engine/practices.ts`: `proficiencyBonus`, `validateAttributes`.
- `src/lib/engine/vitality.ts`: `computeMaxVitality`.
- `src/lib/engine/sheet.ts`: `aggregateCharacterSheet`.
- `src/lib/engine/condition-evaluator.ts`: declared manual flag context.

The in-memory sheet has Physical 4, Mental 4, Magical 2; Mental proficiency;
level 1; PB 2; DC 11; maximum/current Vitality 12. Awareness is 6 before the
declared scent task and 7 while the exact modifier is active. Fieldcraft remains
4, and all unrelated practices, attributes, saves and DC remain unchanged.

Awareness is chosen for noticing/differentiating the sampled scent. The guide
explicitly contrasts a survival/navigation Fieldcraft approach. “Tracking” is a
situation, not an invented eleventh practice. The example rule's result is the
actual `skill_practice_check` / PRACTICE AWARENESS, Add fixed 1, Self, with a
declared actor flag and `unique-by-primitive` stacking. The fixture's short flag
key is an in-memory representation; the readable rule carries its full task and
ending terms. The fixture never writes a record.

The illustrative sensory check is `d20 6 + combined bonus 7 = 13`, meeting DC 12.
It gives the matching local trace direction. Current Vitality remains 12/12 and
5 unspent BU remain; the acquired rules are not bought again at execution.

The ordinary kit is another expressly agreed example, with no acquired item
mechanics (0 Item BU), a filled Small size (1 Load), carried unequipped (0 slots).
Its cloth, water and sample container need actual availability; 0 Item BU does
not establish a free physical purchase or unlimited supplies.

## Current tool-source checks

- `src/components/characters/new-character-form.tsx` around 429–519,
  540 and 867–919: Complete route; category/family-specific Domain/Verb access;
  nonempty name/concept, ten attribute points, valid budget; recommended initial set;
  primitive-only authoring return. `CreationAtelierAction` is rendered only on
  phone in this route, so it appears only in optional phone detail in the guide.
- `src/components/characters/creation-atelier-action.tsx`: device/account draft,
  new-tab authoring and Primitive-only selector for Complete.
- `src/components/sandbox/primitive-form.tsx` around 1683–1746,
  1824–1879 and 1925–1984: Exact BU, Verbose Narrative Rule, optional mechanical
  rule, Clear rule, phone Rule format, real access bindings, context-sensitive
  Save Primitive / Add to draft / Update draft.
- `src/components/sandbox/primitive-rule-instrument.tsx`: practice result scope,
  fixed 1, Add, Self, declared table trigger and Once per primitive.
- `src/components/characters/workspace/character-workspace.tsx` around 158:
  active BUILD export selects CharacterBuildWorkspace. Legacy controls later in
  that file were not treated as the current path.
- `src/components/characters/workspace/character-build-workspace.tsx` around
  41–48, 186 and 415–451: choose a destination, Build your own / New piece,
  Rule or trait / Reusable effect / Capability / Heritage bundle, On character,
  Use this entry, preview destination, Review, Check draft & numbers,
  Save & return to play. Root story sections permit direct pieces without a
  supplied heritage purchase.
- `src/lib/character/workspace/model.ts` 42–51: Effect→Primitive;
  Capability→Primitive/Effect; Heritage→Primitive/Capability; Item may reference
  Primitive/Capability/Effect; cycles rejected. The guide does not teach a
  compulsory nesting hierarchy or direct Effect→Heritage containment.

## Delivery and checks

The only implementation files owned by this task are the new structured guide,
its new page wrapper and its focused test. The source is serializable and shared
with the parent's complete Markdown export; the Rules renderer shows one chosen
chapter at a time while the Markdown export includes all twelve.

`pnpm exec vitest run src/lib/rules/__tests__/advanced-character-guide.test.ts`:
6 passed, covering actual aggregation and conditional scope, unique accounting,
the resolved arithmetic and recursive Rules topic/block/detail anchors.

`pnpm exec eslint src/lib/rules/advanced-character-guide.ts src/app/creating-a-character/page.tsx src/lib/rules/__tests__/advanced-character-guide.test.ts`:
passed. This task did not start a dev server, run a full build, commit, push or
deploy. Browser end-to-end testing and final integrated build belong to the
parent; numeric and source checks here do not substitute for that evidence.
