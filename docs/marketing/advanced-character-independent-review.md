# Advanced character guide: independent source review

Reviewed 20 October 2026. This note checks a new, explicitly authored character lesson against the accepted PHB and the actual website source. It does not create a Library record, character, new price tariff, or rule decision. Source inspection is independent of the guide's authoring pass. Browser behavior, saved records and playtest balance are outside this review.

## Authority and source boundary

The accepted publication is the Interwoven PHB approved on 19 October 2026, as recorded in `/Users/max/dev/SwordWeave/docs/publications/print-edition/accepted-book-standard.md` and `interwoven-edition-production.md`. Publication sources in that checkout were read only.

The renderer chain is `scripts/build-phb-interwoven-edition.py` → `build-phb-dance-edition.py` → `build-phb-organic-edition.py` → `build-full-phb-v6.py` → `build-full-phb-v5.py`. The v5 source at lines 60–64 reads `docs/publications/manuscripts/players-handbook.md`, `expanded/player-workshops.md` and `expanded/player-depth.md`; later organic and Interwoven teaching instruments preserve and clarify the same framework. The manuscript alone is not the complete accepted book.

Relevant accepted native teaching copy is in the primary checkout's `scripts/phb_organic_teaching.py`: lines 12–18 distinguish an ordinary approach, scaling owned access and acquiring missing permission; lines 21–28 distinguish an acquisition from repeated references; lines 38–43 define conditions and show why offsetting a penalty does not remove its cause. The Interwoven source at `scripts/phb_interwoven_teaching.py:87–125` reprises the conditional contribution and single-source reuse example.

## Rules the lesson must preserve

References below are to the primary checkout's `docs/publications/manuscripts/players-handbook.md`.

| Question | Authoritative boundary | Source |
| --- | --- | --- |
| Start with an original person | No fixed class, compulsory Library heritage, or prescribed sequence. A concept and actual acquired permissions define the person. | 108–112, 164–168, 192 |
| Starting foundation | Default level 1 has 25 BU and PB 2; base Physical + Mental + Magical totals 10 with each between −1 and +5. Keep acquired modifiers separate. Baseline maximum Vitality is (10 + current PB) × level; selected-attribute DC is 5 + current PB + the eligible current modified attribute, before explicit direct modifiers. | 118, 134, 158, 328–342, 461 |
| Required construction access | A character build needs owned Verb and Domain access. An item cannot substitute for that character foundation. | 136 |
| Baseline reach and output | Touch and 1d4 are free when their corresponding categories are absent. A bigger die does not supply permission, automatic damage, number of dice, or target count. | 138, 601 |
| Ordinary action | Ordinary tasks can be attempted without training. A normal bucket, an ordinary scent clue and inspecting an object do not automatically require a new primitive. Extraordinary smell or biting through metal needs an actual bounded permission. | 130, 200–202, 633–635 |
| Price of a new rule | The actual authored scope, limitation, stacking and table agreement govern its proposed BU. Suggested tier anchors do not establish a universal price for enhanced smell or metal-biting. Clearly label new example prices and their status. | 140, 220–222, 567, 673–675 |
| Reference reuse | Count the same owned acquisition once when several arrangements reference it. Do not confuse a new reference with a second explicitly purchased instance, a cloned definition, or an item acquisition. | 164–168, 228, 711–715; accepted organic teaching 21–28 |
| Separate accounting | Character BU, Item BU, execution Cost, equipment slots and carried Load answer different questions. A narrative jaw permission on the character is not an equipment purchase merely because it is physical. | 170–178, 293, 719–725 |
| Numerical tracking | Choose an actual practice and scope it. Fieldcraft is a Physical practice; there is no built-in Tracking practice. A +1 scoped modifier neither grants proficiency nor adds the proficiency bonus again. | 122–130, 306–328 |
| Descriptive permission | A rule can be nonnumerical. Describe its subject, affected recipient, reach, eligible material, information gained, limits and resolution; a name or family label alone does not supply those facts. | 230–237, 269–273, 565, 633–635, 673 |
| Conditions and effects | Write the cause/source, recipient, actual change, timing, ending and recovery. A condition name has no hidden package; offsetting one number does not resolve the condition. A new round or rest does not erase unmet ending terms. | 275–293, 498; accepted organic teaching 38–43 |
| Duration and continuation | Instant, fixed duration, ending event and continued work are distinct. State any required maintenance and its agreed payment point. There is no universal one-capability concentration limit. | 443–445, 609 |
| Optional containers | Effects, Capabilities and heritages organize working expressions and history. They are not a compulsory nesting pipeline or automatic new powers. | 164–168, 228, 667 |

Internal pending publication proposals should not be inserted into this public lesson unless the taught rule requires that boundary. This review does not resolve the undecided damage-triggered Vitality upkeep proposal.

## Actual builder path without existing heritages

All UI references in this section are relative to the discovery worktree.

1. `src/components/characters/new-character-form.tsx:867–900` offers **Complete character**, separate from Quickbuild. Complete does not require choosing an existing Lineage, Upbringing or Manifest. It still requires name, concept, a valid 10-point base allocation, valid budget, and real Domain and Verb access (`505–519`, `599–634`, `748–822`).
2. Complete may automatically apply a recommended starting set (`540–564`). Tell the reader to review and replace its selections in **Make your own set** / **Open Library** (`3518–3556`); do not promise a completely empty initial list.
3. The validator recognizes Domain access through actual `DOMAIN_ACCESS` family/bindings and Verb through `VERB_ACCESS` (`451–469`). A descriptive primitive merely named “Smell Domain” is not an equivalent stored construction rule.
4. **Create in Atelier ↗** saves the creation draft and opens authoring. It is currently rendered only on phones (`new-character-form.tsx:919`), not a universal desktop control. `src/components/characters/creation-atelier-action.tsx` offers only **Primitive** in Complete mode. Its return handler at `new-character-form.tsx:419–424` rejects non-Primitive entries and directs other entries to the saved sheet. Do not claim an Effect, Capability or heritage returns directly to that initial step. The cross-device teaching path can select the real Verb/Domain foundation, create that valid character, and add custom traits through its saved Build workspace.
5. Finish the valid minimum foundation, then add more authored pieces through the saved character workspace. **Follow the actual BUILD export:** `src/components/characters/workspace/character-workspace.tsx:158–161` selects `CharacterBuildWorkspace`; the old controls lower in `LegacyCharacterWorkspace` are not the current editing path. In `character-build-workspace.tsx:41–48,180–188,415–428`, choose **Lineage**, **Upbringing** or **Manifest** as a placement section, then **Build your own** (desktop) / **New piece** (phone). The type chooser labels are **Rule or trait**, **Reusable effect**, **Capability** and **Heritage bundle**. **Items** is a separate placement section. Overview does not choose a destination. These sections are organizational convenience, not a compulsory purchase of a pre-existing heritage.
6. Character-local authoring uses **Add to draft** / **Update draft**; standalone authoring uses **Save Primitive**, **Save Effect** or **Save Capability** (`primitive-form.tsx:1984`, `effect-form.tsx:599`, `capability-form.tsx:1104–1110`). The active editor then offers **Review changes** (desktop) / **Review** (phone), **Check draft & numbers** when the preview is local, and **Save & return to play** (`character-build-workspace.tsx:448–451`). Adding an entity to a draft does not apply it to the live character.

## Authoring a custom rule accurately

`src/components/sandbox/primitive-form.tsx:1696–1790,1925–1927` provides **Verbose Narrative Rule** and an optional **Mechanical rule**. **Clear rule** removes a stored mechanical output; the verbose description can be the complete player-facing explanation. On a phone, **Rule format** reveals the choices. This supports a bounded descriptive smell or jaw permission; it does not automatically implement a new sensor, material simulation, damage type or tracker.

For an illustrative +1 tracking modifier, the real numerical path is **Change a number**, select **Skill / Practice Check** and **Fieldcraft**, choose **Add**, use a constant **1**, choose the appropriate recipient, then a scoped trigger. `src/lib/primitives/modifier-scope.ts:449–461` explicitly places narrow focuses such as “Fieldcraft (Tracking)” in the condition rather than a separate granularity/stat field. `src/components/sandbox/primitive-rule-instrument.tsx:109–112,143,1097–1180,1530–1663` supplies these controls.

**Declared at table** creates a named manual event; **Tracked condition** reads actual sheet/target/scene state. The editor does not detect an animal's scent or infer that a scene meets a prose rule. `use-sheet-conditions.ts:102–161` recognizes manual condition tokens; `character-sheet-view.tsx:970–996,1083–1109` surfaces them in the **Consequences** drawer; `condition-overrides.ts:21–57` applies a user's explicit eligibility override to the original modifier instead of adding the bonus twice. An authored modifier and its active eligibility are different facts.

The existing **Consequences** drawer has **Add consequence** and a composer with **Recovery requirements** plus **Long rest**, **Short rest** or **Manual toggle** duration controls (`conditions-drawer.tsx:120–145`; `condition-composer.tsx:498–536`). These controls record the chosen lifecycle; they do not decide the table's fiction or grant automatic recovery for every authored condition.

## Exact reference containment

`src/lib/character/workspace/model.ts:42–70` permits:

| Container | Compatible children |
| --- | --- |
| Primitive | None |
| Effect | Primitive |
| Capability | Primitive or Effect |
| Heritage | Primitive or Capability |
| Item | Primitive, Capability or Effect |

The model rejects incompatible children and reference cycles. A Heritage cannot directly contain an Effect in this UI. The active BUILD surface's **Find** column uses **Library** / **On character** / **Ideas** (`character-build-workspace.tsx:416–420`). An owned row's **Use this entry** opens its preview; the preview can **Add to active [container]** when compatible (`362–375`). An existing composition row also offers **Use in…** to retain its source and add a reference elsewhere (`398,455`). The underlying `EntityComposer` has **On this character** / **Library** and **Add** in its separate composition source panel, but the active desktop editor uses its integrated Find column; phones also expose **Add a piece to this …** (`entity-composer.tsx:419–466`). Match the control to the actual surface instead of conflating standalone Atelier, legacy workspace and the current draft editor.

`membershipCostChange` in `src/lib/character/workspace/cost-preview.ts:1–65` distinguishes inherited references from direct explicit purchases, adopts the first inherited supply where applicable, and excludes item paths from character-BU changes. A guide should reuse the actual existing piece through **On character** / **Use this entry** or **Use in…**, not create several look-alike rules and call them one acquisition. Applying the resulting draft and reviewing its budget remain necessary.

## Delivery review

Initial delivered files reviewed: `src/lib/rules/advanced-character-guide.ts` and `src/app/creating-a-character/page.tsx`.

The original copper-toothed tracker is explicitly an authored paper proposal, not an existing Library record or playtest. The proposed arithmetic reconciles: Physical 4 + Mental 4 + Magical 2 = 10; Mental proficiency at level 1 supplies PB 2; Awareness 4 + 2 = 6 and the qualifying modifier gives 7; untrained Fieldcraft stays 4; Mental DC 5 + 2 + 4 = 11; maximum Vitality (10 + 2) × 1 = 12. The stated acquisitions cost 4 + 4 + 4 + 6 + 2 = 20 BU, leaving 5 of 25. The illustrative 6 + 7 = 13 meets DC 12 and neither the sense attempt nor the safe copper cut changes the acquisition ledger or Vitality.

The 30-ft scent reach is a written limit of the separately priced sensory permission. It is not Near Range for projected actions. PHB lines 633–635 explicitly require a sensory rule's own reach, information, obstacles and limits, and line 218 rejects compulsory one-from-each-family construction. Preserving that boundary prevents this channel from granting remote bites, unrestricted targeting or the quarry's current location. The narrative and scene use local scent information only.

Findings sent to the author and parent during review:

- The initial teeth rule allowed an **unattached strip**, but the recipes and worked scene cut a fastening holding a bundle. That use requires a safely exposed fastening within the actual authored material/tension/target bounds, or a genuinely unattached sample. The reviewer did not silently expand the rule.
- The initial universal **Create in Atelier ↗** step described a phone-only control as available on desktop. The cross-device minimal-foundation-then-saved-Build path above is supported by the actual source.
- The actual editing path and chooser labels must come from `CharacterBuildWorkspace`, including **Rule or trait**, **Reusable effect**, **On character**, draft review and **Save & return to play**. The author began incorporating these labels during review.
- “The completed cut is a lasting physical change” distinguishes the one-minute work requirement from the result's persistence more clearly than calling the whole use instantaneous.

### Final bounded reread

The author corrected all reported issues before this review closed:

- `advanced-character-guide.ts:44,185` now permits either a loose copper object or a loose fastening on an unmoving, safely supported bundle, away from a creature's body and without dangerous tension or resistance. The companion-supported scene at line 297 is eligible; worn restraints, opposed targets and dangerous tension remain excluded.
- Lines 334–342 now create the real 8-BU Verb/Metal foundation first, then author the 12 BU of custom traits in the current saved-sheet editor. The initial balance is 17; the final balance is 5. The creation-return button is explicitly an additional phone route.
- Lines 338–342 use the current creation/source/review labels, including **Rule or trait**, **Reusable effect**, **On character**, **Check draft & numbers** and **Save & return to play**.
- The copper work's minute and lasting cut are distinct at line 320. The PHB link is `/books/players-handbook`; the foundation Rules link is `/rules#first-character`.

The six focused tests were inspected as source. Their actual-sheet-engine fixture checks the numerical effect of the declared flag, unrelated values remaining unchanged, the 20-BU ledger, reference counts and recursive Rules anchors. The teaching author reported all six and scoped lint passing. This reviewer did not rerun tests or perform application writes. No further material source, numerical, permission or tool-instruction issue was identified in the final bounded pass.

Source review does not establish browser success, indexing, public record creation, or playtest balance. The parent retains browser/integration QA. Later changes outside the inspected source require their own review.
