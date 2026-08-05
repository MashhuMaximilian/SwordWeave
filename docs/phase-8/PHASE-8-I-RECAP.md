# Phase 8.I — Modifier Resolution Engine (the SHEET, not the TABLE)

**Author:** Senku
**For:** Mashu — the recap is now in scope-refinement mode. Several items have been cut as out-of-scope. The few remaining questions are below.
**Status:** 🟡 Recap + question-collection phase. Rounds 1–4 answered 2026-08-04. R5 in progress. Goal: close the recap and start coding.
**Started:** 2026-08-04
**Origin:** Session I from the master plan (post-Sessions G + H which closed on 2026-08-04)

---

## ⚠️ THE BIG REFRAME (R5-Q7, 2026-08-04)

You said:

> *"OUR SOFTWARE IS MORE LIKE A DIGITAL INTERACTIVE CHARACTER SHEET. NOT A WAY TO ACTUALLY PLAY THE GAME ON THE PHONE. THIS IS THE KEY to what we are trying to achieve."*
>
> *"we need a base of what and when numbers change based on primitives and capabilities that are active/inactive. And to offer a base for custom things and some operations. But not to calculate damage or all sorts of things like that per se."*
>
> *"when it comes to chains of events and stuff, well, that is for the table."*

### What this means

We are **not** building a combat simulator. We are building a **digital interactive character sheet**.

The engine does NOT:
- ❌ Resolve damage rolls at runtime
- ❌ Calculate chains of effects (debuff → damage → condition)
- ❌ Replace the DM's role at the table
- ❌ Auto-roll dice
- ❌ Track round-by-round combat state
- ❌ Enforce the 11-field capability template (range, target, output, duration, casting time, scaling) — these are table syntax, not sheet values
- ❌ Handle "Hybrid" source type — metadata only, not a computational axis
- ❌ Use "Strain Tier" as a numeric value — DM heuristic, not sheet value

The engine DOES:
- ✅ Translate modifiers → numbers per attribute/practice/defense/vitality/movement
- ✅ Display the per-axis running totals (with provenance in the modal)
- ✅ Show capability active/inactive state (the toggle is on the sheet, not at the table)
- ✅ Support custom behavior variables (`blockValue` etc.) AS A PLAYER TOOL, not auto-resolved
- ✅ Evaluate conditions as gates (when toggle is ON, condition is checked)
- ✅ Show glyphs for advantage/disadvantage/mirror/conditional
- ✅ Show small cards for non-numeric tags (resistances, movement speeds, senses, languages)
- ✅ **NEW (R5-Q6):** **Play session scratchpad** — a button to add temporary conditions (e.g. "I'm poisoned until long rest") with optional modifiers. This is a real Session I feature.

### Items cut from the original Session I scope

| Item | Reason |
|---|---|
| I23 — Source Type inheritance enforcement | In our model, source is metadata, doesn't affect sheet math |
| I24 — Effect.has vector type (Direct Manifestation vs Projected Vector) | Table syntax, not sheet |
| I25 — Effect.has resolution gate (save attr, DC formula) | Table syntax |
| I26 — Effect.has temporal boundary (duration tier) | Table syntax |
| I27 — Strain Tier separate from BU | DM heuristic, not sheet value |
| I28 — Effect standalone trigger | Not in scope; caps trigger effects |
| Effect template (mini-capability with own primitives "teeth") | Overkill for our model |
| 11-field capability template | Overkill; we use 3 types (passive/augment/active) |
| "Hybrid" source type | Removed |
| 6 standalone Effect examples (System Freeze, Corrosive Decay, etc.) | Interesting but reference, not engine scope |

### Items that survive in Session I scope

- **I1** — Null sub-target bug (validation at save time)
- **I2** — Engine resolution (replace buCost-as-proxy with hardModifier walk)
- **I3** — Conditions runtime evaluation
- **I4** — Stacking default `highest-only`
- **I5** — Custom behavior variables (`blockValue` etc.)
- **I7** — Advantage/disadvantage glyphs (`︽` / `︾`)
- **I8** — Small cards zone (cards for non-numeric tags)
- **I9** — Modal traceability
- **I10** — Mirror penalties displayed (yellow)
- **I12** — `buCost` is NOT a proxy
- **I14** — Capability active/inactive toggle bundles
- **I17** — Mirror is per-primitive (not per-capability)
- **I18** — Equip gating for items (equippable only when equipped, non-equippable always contributes)
- **I19** — Mirror color is yellow
- **I20** — Hide stacking field when op = `set`
- **I22** — DB backfill for advantage/disadvantage
- **NEW I29** — **Play session scratchpad** (FAB → add temporary conditions with optional modifiers, duration tier, toggle on/off, delete)

### Items deferred

- **I6** — Tag operands in equations (e.g. `[fire]`) — rendered tags on action.roll / damage. Defer to Session K or later.
- **I11** — DB seed quality — explicitly deferred per your H1 decision.
- **I15** — Movement sub-types (climb, fly, swim, burrow) — easy if we do it, but defer.
- **I16** — Action.roll sub-targets — IS happening in Session I (I30 below).
- **I21** — Future FAB for runtime modifiers — **Promoted to I29 (play session scratchpad).**

### New items from R5

- **I30** — Action.roll sub-targets: `attack`, `save.physical`, `save.mental`, `save.magical`, `other` (for proficiencies, custom tools)
- **I31** — Source Type is metadata-only (no engine math); remove "Hybrid" from spec
- **I32** — `*` marker placement on the **target/sub-target axis** (not on the modifier itself), per R5-Q3 clarification
- **I33** — Behavior name field for strain/scene/pace/behavior axes, per R5-Q4

---

You sent 4 screenshots. These are the canonical visual references for the current UI and the modifier convention.

### Image 1 — `MODS + SAVES` drawer (bottom drawer)

Three cards on one row: `PHYS +5` (save: +5) | `MENT +5` (PROF badge) (save: +11) | `MAGI +0` (save: +0).

**This proves the drawer shows two different numbers per attribute:**
- **Modifier** — the attribute's slice + primitive contributions (e.g. `+5`)
- **Save bonus** — modifier + PB (only for the proficient attribute, hence MENT gets `+11 = 5 + 6 PB`; PHYS and MAGI get unmodified saves)

Two concepts, two formulas. Confirms R3-Q1's answer.

### Image 2 — `What changes?` dropdown in the Modifier composer

Current target list verbatim:
```
Attribute
Defense DC
Speed
Max Vitality
Current Vitality
Proficiency Bonus
Action Roll
Skill / Practice Check
Damage / Healing Output
Targeting
Duration
Strain
Item Slot Cost
Scene Pace
Behavior (custom)
```

This is the schema we have today. R3-Q1 + R3-Q2 are about renaming some of these targets.

### Image 3 — `NARRATIVE RULE` + modifier editor with `behavior:disadvantage`

Left column shows a baseline narrative rule: *"Forces negative bias on a narrow narrative trigger. Roll twice and take the lower result."* Fork guidance tells the author to spec the focus via the condition.

Right column shows the modifier editor:
- Target: `behavior:disadvantage` (custom behavior)
- Change: `Grant` op (NOT `bias` — confirms B5's convention)
- Helper text: *"Mirrorable — flips to Revoke when inverted (sign/reciprocal flipped per OP_SPECS)."*
- Value: `1` (number)
- Stacking: `unique-by-target`

This is the canonical pattern for advantage/disadvantage: `Grant` op with `behavior:advantage` / `behavior:disadvantage` target.

### Image 4 — Modifier 1 with `Grant` op + `[advantage]` text keyword

The EXPANDED modifier composer with full UI:
- Target: Attribute (PHYSICAL checked, MENTAL/MAGICAL unchecked). Hint: *"ATTRIBUTE — LEAVE EMPTY FOR 'ANY'"*
- Change: `Grant` op. *"VARIABLE — Mirrorable — flips to Revoke when inverted"*
- Value Type: `Text / Keyword`
- Placeholder: *"No tokens yet — pick suggestions below or type a value"*
- Custom input: `[advantage]` (keyword syntax)
- Custom input syntax hint: `#dice#` (dice), `[tag]` (keyword), `/value/` (number or runtime reference)

**This confirms the existing convention for advantages:** use `Grant` op with text value `[advantage]` or `behavior:advantage`. The legacy `bias` op is gone — do NOT add it back.

---

## What this phase is, in one sentence

Translate **every modifier** a character has access to (from slotted primitives, heritage-bundled caps, item-bundled caps, item-bundled primitives, and runtime state) into the **right number** on the character sheet, with **the right tag** attached, gated by the **right condition**, honoring the **right stacking rule** and **mirror direction** — and surface the full provenance chain in every modal.

---

## Why it's harder than "translate to numbers"

> *"all it has to do is translate the modifiers into numbers on the character sheet. But in reality it's way more complicated. Some literally add numbers. Some change numbers. Some just add some tags."*

The modifier system is rich. There are 9 operations, 5 value types, 6 stacking modes, 4 condition shapes, 23 canonical targets plus a `behavior:` escape hatch, an arithmetic equation system with paren groups and tag-style keyword operands, runtime references for values that don't exist at authoring time, a mirror vector system with 4 vectors, and the ability for a modifier to carry a custom behavior variable (e.g. `blockValue = 6`) that other modifiers reference.

Today the character sheet's v1 roll-up uses **`buCost` as a proxy for hardModifiers** everywhere. That's the bug. A primitive with hardModifiers that explicitly say "+2 to vitality, +1 to physical, +1d4 fire damage on action.roll" all collapse to a single buCost number when the sheet rolls up. We need to actually walk the hardModifiers.

---

## What we already have (working today)

These are already authored, tested, and consistent across the schema, the form, the DB, and the engine layer. **Do not re-author.**

| Surface | Where | Status |
|---|---|---|
| `HardModifier` shape (target / op / value / condition / stacking / metadata) | `src/types/swordweave.ts` | ✅ Locked |
| `Phase75HardModifier` shape (token-based value) | `src/types/modifier.ts` | ✅ Locked |
| 9 ops (`add`, `subtract`, `multiply`, `divide`, `set`, `min`, `max`, `grant`, `revoke`) | `src/types/modifier.ts` | ✅ Locked + tested |
| 5 value types (`number`, `text`, `dice`, `boolean`, `equation`) | `src/types/modifier.ts` | ✅ Locked + tested |
| `OP_VALUE_TYPE_MATRIX` (which ops allow which value types) | `src/types/modifier.ts` | ✅ Locked + tested |
| `OP_SPECS` (chirality + mirror behavior per op) | `src/types/modifier.ts` | ✅ Locked + tested |
| `applyMirror(op, value)` (pure mirror function) | `src/types/modifier.ts` | ✅ Locked + tested |
| 3 attributes (`physical`, `mental`, `magic-abstract`) | `src/types/modifier.ts` | ✅ Locked |
| 10 practices (`awareness`, `fieldcraft`, `influence`, `reason`, `vitality`, `lore`, `magic`, `combat`, `movement`, `social`) | `src/types/modifier.ts` | ✅ Locked (TBD against canon names) |
| 3 derived (`pb`, `pb_half`, `level`) | `src/types/modifier.ts` | ✅ Locked |
| `ValueToken` discriminated union (8 kinds incl. `runtime` for unresolved refs) | `src/types/modifier.ts` | ✅ Locked |
| `Operand` / `Operator` / `renderEquation()` for arithmetic expressions | `src/types/modifier.ts` | ✅ Locked |
| `Keyword` operands (tag-style `[fire]` carried through, not arithmetic) | `src/types/modifier.ts` | ✅ Locked |
| `Paren` operands (nested expression groups) | `src/types/modifier.ts` | ✅ Locked |
| `ModifierCondition` v1 (4 shapes: `preset` / `narrative` / `tags` / `compound`) | `src/types/condition.ts` | ✅ Locked |
| 16 canonical `ConditionPresetKey` catalog (target/scene/actor × N) | `src/types/condition.ts` | ✅ Locked |
| `BehaviorTarget = `behavior:${string}`` (free-form runtime variable axis) | `src/types/modifier.ts` | ✅ Locked |
| `ModifierStackingMode` (6 modes) | `src/types/swordweave.ts` | ✅ Locked |
| `ModifierTarget` (23 canonical axes) | `src/types/swordweave.ts` | ✅ Locked |
| `resolveModifiers(input, sourceNames)` engine | `src/lib/engine/resolve-modifiers.ts` | ✅ Implemented + tested in isolation |
| `resolveMirrorEffect(vector, isMirrored, value)` engine | `src/lib/engine/mirror.ts` | ✅ Implemented + tested |
| `resolveAttributeModifier(input, attr)` engine | `src/lib/engine/target-registry.ts` | ✅ Implemented |
| `resolveAllDefensiveDCs(input)` engine | `src/lib/engine/target-registry.ts` | ✅ Implemented |
| `computeVitalityModifiersFromPrimitives()` engine | `src/lib/engine/vitality.ts` | ✅ Implemented |
| `evaluateCondition()` for legacy `{key, operator, value}` triples | `src/lib/primitives/condition` | ✅ Implemented (legacy only) |
| `applyOperation()` (single-op arithmetic) | `src/lib/engine/operations` | ✅ Implemented + tested |
| `applyStacking()` (combine contributions per stacking mode) | `src/lib/engine/stacking` | ✅ Implemented + tested |
| `migrateOperation("toggle"/"bias") → "set"/"grant"` | `src/types/modifier.ts` | ✅ Implemented + tested |
| `parseValueField()` (auto-coerce raw values into ValueToken[]) | `src/types/modifier.ts` | ✅ Implemented + tested |
| `bulkResolveLatestVersions()` | `src/lib/versions/bulk-resolve-latest-versions.ts` | ✅ Implemented + tested |
| Bundle expansion (heritage → caps → prims + effects → mirror ceiling) | `src/lib/api/enrich-item-links.ts`, `src/lib/api/character-bundle-saver.ts` | ✅ Implemented |
| Version/provenance chips (rounds 7–13 of Session H) | `src/components/characters/slot-source-badge.tsx` | ✅ Implemented |

---

## What's broken or missing (the Session I scope)

| # | Item | Severity | Symptom |
|---|---|---|---|
| I1 | **Null sub-target bug** — modifier with axis set but no sub-target → adds to ALL sub-targets (e.g. "attribute" with no `physical`/`mental`/`magical` selected boosts all three) | 🛑 Root bug | Sheet shows wrong attribute bonuses |
| I2 | **Character sheet rolls up via `buCost`, not via hardModifiers** | 🛑 All modifier math is wrong | Sheet shows `+5 mental` because the primitive's `buCost = 5`, not because any modifier actually says so |
| I3 | **Conditions are display-only** — v1 condition shapes (`preset` / `narrative` / `tags` / `compound`) never gate the modifier at runtime | 🛑 Wrong numbers when conditions should suppress | Sheet shows `+3 to grappled bonus` even when target isn't grappled |
| I4 | **Stacking defaults to `stack`**, not `highest-only` as intended | 🛑 Wrong totals | A modifier slotted twice contributes 2× instead of the safer 1× |
| I5 | **Custom behavior variables** (e.g. `blockValue = 6`) — no system to resolve them across primitives | 🟡 New surface | Author-defined runtime variables don't flow between modifiers |
| I6 | **Tag operands** (`[fire]` inside equations) — resolver carries them through but the sheet doesn't surface them | 🟡 Missing label | Damage rolls don't show the damage type chip |
| I7 | **Advantage/Disadvantage glyph system** (`︽` / `︾` per the spec, with `*` for conditional) | 🟡 New UI | Sheet shows nothing for advantages; should show glyphs next to the affected axis |
| I8 | **"Small cards" zone in bottom drawer** for movement speeds, resistances, vulnerabilities, languages, advantages, custom behaviors | 🟡 New UI | These tags currently have no home on the sheet |
| I9 | **Modal traceability is incomplete** — modals don't show the full primitive → capability → effect → item chain or the substituted formula | 🟡 Quality of life | Hard to debug "where does this number come from" |
| I10 | **Mirror COST_INSTABILITY user-side cost** (extra_strain) — resolver captures it, no place on the sheet for it | 🟡 Missing display | -5 vitality from mirror shows nowhere |
| I11 | **DB seed quality** — most primitives have template/incomplete modifiers | 🟡 Data quality | Even after engine fixes, sheet may show empty for many slots |
| I12 | **`buCost` should NOT be a fallback for modifiers** (per the feedback) | 🛑 Design principle | Delete the buCost-as-fallback path entirely |
| I13 | **Items drive modifiers** — primitives nested in items contribute to the sheet | ✅ Already works via bundle expansion | Confirm |
| I14 | **Capabilities are activatable / triggerable** — cap.active toggle bundles all its primitives; trigger caps fire and log to history | 🟡 New model | Sheet doesn't differentiate between passive/augment/active caps |
| I15 | **Movement sub-types** (climb, fly, swim, burrow) — sheet only shows land | 🟡 Missing axes | Sheet doesn't surface climbing speed, flight, etc. |
| I16 | **Schema cleanup**: rename `action.roll` → `attack_roll`, separate `defense_dc` (saving throws DC) from new `save_dc` (global single DC) | 🟡 Schema rename | Naming is unclear in practice |
| I17 | **Mirror is per-primitive, not per-capability** — capabilities are NEVER mirrored; only primitives are | 🟡 Concept fix | Engine must not propagate mirror from a cap to its primitives |
| I18 | **Equip gating for items** — equippable items contribute modifiers only when equipped; non-equippable items always contribute | 🟡 Behavior | Currently always contributes regardless of equipped state |
| I19 | **Mirror color is yellow, not red** | 🟡 UI | Sheet's color hint was wrong |
| I20 | **Hide stacking field when op = `set`** (stacking doesn't apply to `set`) | 🟡 UI | Form lets author pick a meaningless stacking mode |
| I21 | **Future FAB for runtime modifiers** — add a temporary modifier at runtime (e.g. "I'm grappled", "I have -10ft movement") | 🚫 Parked for later | Out of Session I scope |

---

## Decisions log (your feedback, rounds 1–2)

### Round 1 (2026-08-04)

#### Null sub-target behavior
> *"We have to explicitly set a target/sub target (like what changes? Attribute, mental, not just attribute and leave toggles empty)."*

**Decision:** A modifier with axis set but sub-target empty → does NOT contribute to anything. The author must explicitly fill in the sub-target. This applies to all axes that have sub-targets (`attribute`, `defense`, `vitality`, `movement`, `action.*` if we add sub-targets).

#### Advantage/Disadvantage glyphs
> *"on character sheet if advantage near the practice for example, we should set `︽` (U+FE3D) and for disadvantage `︾` (U+FE3E). But what about advantage on fieldcraft based on tracking? I guess `︽ *` (and we write 'based on tracking enemies' in the modal)."*

**Decision:** Glyphs `︽` / `︾` for advantage/disadvantage. Asterisk `*` appended when the modifier has a condition (so DM clicks the modal to see "based on tracking enemies"). Glyphs go near the affected axis on the sheet.

#### Custom behavior variables
> *"I will create a primitive with a modifier target behavior called (key) blockValue (or block) set to 6. And a capability called Blocking with some primitives that while capability active it will subtract blockValue from damage taken. This is just one example, possibilities should be endless."*

**Decision:** `behavior:<name>` is a fully open runtime variable space. Authors can name any variable. The engine resolves `behavior:<name>` references by walking the slotted modifiers and finding the latest `set` to that name (or `add` / `multiply` etc.). The variable's value lives only as long as the modifiers that set it.

#### `buCost` is NOT a proxy
> *"buCost should be no proxy for modifiers. It has nothing to do with them."*

**Decision:** Delete the buCost-as-proxy path entirely. The engine walks hardModifiers only. If a primitive has empty hardModifiers, it contributes nothing.

#### Capability activation state
> *"there are capabilities that can be triggered or set active/inactive. like a capability will deal 2d6 fire damage (albeit via a primitive inside it), but not the primitive itself."*

**Decision:** Capabilities have an activation state. The sheet at rest shows the *passive baseline*. Trigger caps are normally inert; firing them logs to history AND adds their contribution to the active total for that moment. Augment caps apply their modifier (e.g. `+PB to attacks`) when the augmented action is taken.

#### Items drive modifiers
> *"the primitives from items can also affect the sheet. Like I can get +1 attack roll from item."*

**Decision:** Items contain primitives → primitives carry modifiers → modifiers target `action.roll` (or whatever). Already works via bundle expansion. Confirm at end of phase.

#### Runtime UX — two surfaces
> *"1. In capabilities we already have the description of capabilities and primitives. We click on one, modal opens with all the info we need. 2. In the bottom drawer (modals that open on click for everything) where we have the actual numbers and the traceability for each thing for quick access."*

**Decision:** Two surfaces for tag-bearing modifiers:
- **Modal on click** in capabilities/items tab → describes the modifier and its condition
- **Bottom drawer** → shows the running totals + glyphs + a new "small cards" zone for non-numeric tags (advantages, resistances, movement speeds, custom behaviors)

#### Modal traceability
> *"we need the full traceability. Like we have in drawer +10 Fieldcraft. In its modal we have general formula, we have the provenance of what contributes to it (modifiers, proficiency bonus, primitives that contribute, and tidal) and below we have the formula again with everything substituted it."*

**Decision:** Every modal in the bottom drawer must show:
1. **General formula** — e.g. `final = slice + PB + sum(primitive contributions)`
2. **Provenance breakdown** — list of contributors with their source (heritage → cap → effect → primitive → modifier chain)
3. **Substituted formula** — same formula with every token replaced by its resolved value

#### DB seed quality
> *"some primitives are not good at all when it comes to modifiers. Also, most of those with modifiers (like attribute increment) are just templates, incomplete."*

**Decision:** DB seed cleanup is part of Session I. After the engine is wired, audit the primitives and fill in the missing modifier specs. *(Updated in round 2 — MIX: engine must be flexible, new test characters, defer DB cleanup later. See round 2 below.)*

#### Stacking default
> *"It is stacking by default, but can be changed. […] But highest-only as default should be safer."*

**Decision:** Engine default for missing `stacking` field is `highest-only`. DB should still record explicit `stacking` per modifier (UI enforces this), but the runtime fallback is `highest-only`.

#### Mirror COST_INSTABILITY / user-side cost
> *"A primitive can be mirrored to get some penalties in order to access more primitives. I can get vitality mirror (-5 vitality, appears in modal for vitality), or a mirror to give me vulnerability to fire, in the new section with small cards."*

**Decision:** Mirrored primitives can impose **user-side penalties** (negative vitality, vulnerability, debuffs). These appear:
- In the modal for the affected axis (e.g. -5 vitality in the Vitality modal)
- In the new "small cards" zone (e.g. vulnerability:fire)
- Never DM-only — always visible to the player

#### Sheet shape — numbers AND breakdown
> *"in the drawer and stuff the final number and in the modal on click we have the breakdown and traceability."*

**Decision:** Sheet shows the **final number** per axis in the drawer (compact). Modal on click shows the **full breakdown** with provenance chain + substituted formula.

#### Character sheet = expected outcome
> *"The character sheet is the expected outcome. How we have it now. (We are still missing things maybe like movement speed and specialized movement speed like climbing flying burrowing swimming)."*

**Decision:** The current character sheet (top section + bottom drawer) is the target layout. Phase 8.I adds:
- Movement sub-types (climb/fly/swim/burrow)
- The "small cards" zone for non-numeric tags
- Glyphs (`︽` / `︾`) next to affected axes
- Full modal traceability for every number

---

### Round 2 (2026-08-04)

#### A. Null sub-target validation

> *"For everything that has sub-target raise error. If they want all choose all because they are checkboxes. We need to map all what changes I wonder to figure it out? So we have in modifier inside primitive modal. Some have sub-targets and we'd need to raise error. Some don't have any sub target. Some have free text like strain and scene. And behavior is more like a variable name."*

**Decision:** When a modifier's target has a sub-target AND the sub-target is not selected → raise validation error at save time. Author must explicitly:
- Pick at least one sub-target from the checkbox group (multi-select allowed — pick all to apply to all)
- OR pick single-target axes that don't have sub-targets (`set`, `grant`, `revoke` on a single axis)
- OR use free-text targets (`strain`, `scene.pace`) where the text itself is the value
- OR use `behavior:<name>` where the author must name the variable — `behavior:` with empty name also raises validation error at save time

**Sub-target mapping (to be confirmed in round 3):**

| Axis | Has sub-target? | Validation rule |
|---|---|---|
| `character.attribute` | Yes (physical/mental/magical) | At least one checkbox checked |
| `character.defense` / `saving_throws` | Yes (physical/mental/magical) | At least one checkbox checked |
| `character.vitality` | Yes (max/current) | At least one checkbox checked |
| `character.movement` | Yes (land/fly/swim/climb/burrow) | At least one checkbox checked |
| `character.skill` | No — single-axis | No validation |
| `character.proficiencyBonus` | No — single-axis | No validation |
| `action.roll` / `attack_roll` | No (single-axis) — *renaming TBD* | No validation |
| `action.damage` | No — single-axis | No validation |
| `action.range`, `action.targetCount`, `action.areaSize`, `action.duration`, `action.strain` | No — single-axis with free text | No validation |
| `entity.loadout` | No — single-axis | No validation |
| `item.slotCost` | No — single-axis | No validation |
| `scene.pace` | No — single-axis with free text | No validation |
| `behavior:<name>` | Variable name (author-typed) | Name must be non-empty after stripping spaces/symbols |

#### Schema cleanup — saving throws vs save DC

> *"Defense DC (rename to saving throws). And add save DC (because we have a single save DC, but for each attribute we have modifier and saving throw DC). Do you understand this?"*

**Decision (preliminary, needs round 3 confirmation):**
- Current `character.defense.<physical|mental|magical>Dc` (formulas like `5 + PB + modifier`) → **rename** to `character.saving_throws.<physical|mental|magical>` (or `saving_throw.<physical|mental|magical>`)
- **New axis:** `character.save_dc` (single global DC, e.g. `8 + PB + modifier of proficient attribute`) — the public-facing number enemies must hit against the character

**Open question (R3-Q1):** Does `save_dc` use the same formula as `saving_throws` (i.e. `5 + PB + modifier`), or is it different (e.g. `8 + PB + modifier`)? You said "we have a single save DC, but for each attribute we have modifier and saving throw DC" — confirming these are two different numbers?

#### Schema cleanup — action.roll naming

> *"Action roll should be for all rolls? Or change to attack roll or we add attack roll separately in list?"*

**Decision (preliminary, needs round 3 confirmation):** `action.roll` is currently used as a generic "all rolls" target. You suggested either renaming to `attack_roll` or adding a separate `attack_roll`. The system has many specific roll types (attack roll, save roll, check roll, etc.).

**Open question (R3-Q2):** Should `action.roll` be renamed to `attack_roll` (narrower), or should we add a set of explicit axes (`attack_roll`, `save_roll`, `check_roll`, `initiative_roll`)?

#### B. Advantage/disadvantage clarifications

**B1 — `*` placement:** `*` is the literal symbol next to the glyph (e.g. `︽ *`). The exact condition text is in the modal. **Confirmed.**

**B2 — Source doesn't matter:** A modifier with condition looks the same on the sheet regardless of whether it came from a heritage-bundled cap, a direct cap, or an item. The engine doesn't distinguish source for display. The provenance modal shows the full chain. **Confirmed.**

**B3 — Always show `︽ *` when condition present:** The sheet shows `︽ *` always when the modifier has a condition, regardless of whether the condition is currently met in the scene. The DM decides at the table. **Confirmed.**

**B4 — Advantages stack:** Two modifiers granting advantage on the same practice → both contribute. The sheet shows `︽︽` (two glyphs). At the table, this means "roll 3 dice, take highest" instead of "roll 2 dice, take highest." **No special rule needed.**

**B5 — DB backfill for advantage/disadvantage:** Legacy modifiers in the DB probably store `advantage = 1` or `bias-value = "advantage"` with a `bias` op. These need to be parsed properly into the new `grant` on `behavior:advantage` / `behavior:disadvantage` shape. **Backfill task added to Session I scope (I22).**

#### C. Custom behavior variables

> *"And what about advantage on fieldcraft based on tracking? I guess `︽ *` (and we write 'based on tracking enemies' in the modal when we click on it where we have the what primitives affect this thing I guess. Idk of a better way)."*

**C1 — Capability gating confirmed:** A capability with a primitive that references `blockValue` only contributes when the capability is active. The modifier is gated by `capability.active`. **Confirmed.**

**C2 — Inactive = no contribution:** When the capability is inactive, the modifier inside it does NOT contribute at all — not reduced, not flagged. The toggle bundles ALL the primitives' modifiers. **Confirmed.**

**C3 — Two separate operations:** Setting `blockValue` and referencing `blockValue` are different modifiers. The `set` modifier mutates the variable; the `subtract` modifier reads it. They're independent and the reference is resolved at engine time by walking the current modifier chain. **Confirmed.**

**C4 — Variable creation:** Two layers:
- (a) Engine auto-creates a variable on first `set` (default 0) — permissive
- (c) Engine just reads whatever exists; missing = 0 silently

**Decision:** Go with (a) + (c) hybrid. On first `set` modifier targeting `behavior:<name>`, the engine creates the variable in the character's runtime state. Missing variables resolve to 0 silently. The variable is **transient** (not in DB), pulled from JSON each time the sheet renders. **Open question (R3-Q3):** What is the canonical variable name format? You said "strip of spaces and symbols" — confirm: lowercase, alphanumeric, underscores allowed, hyphens allowed?

**C5 — Variables live in small cards:** `blockValue: 6` shows in the small cards zone. **Confirmed.**

**C6 — Multiple primitives target same variable:** Order: `set` first, then `add`, then `multiply`, then `divide`, then `min`, then `max`, then `grant`, then `revoke`. Within a single canonical-order group, modifiers apply in their original order. Multiple capabilities can target the same variable; engine walks all modifiers in the canonical order. **Confirmed.**

#### D. Capabilities — clarification on types

> *"Only passives and augment. Capabilities are passive augment or active only. Trigger and active/inactive are behaviors on the character sheet. So capabilities that are active only should have trigger and active/inactive buttons. Maybe we need to think more about this."*

**Decision:** The 4 capability types collapse into 3 effective states:
- **Passive** — always contributes; no toggle
- **Augment** — applies when the augmented action is taken (e.g. +PB to attacks)
- **Active** — has a trigger button (one-shot, log to history) AND an active/inactive toggle (toggleable buff)

The "trigger" and "active/inactive" are **two separate buttons** on active caps. The "active/inactive" toggle bundles ALL nested primitive modifiers. **Open question (R3-Q4):** When an active cap is currently toggled ON, does the sheet show its modifier contribution in the standard totals? Or only when triggered?

**D2 — History includes provenance:** When a trigger fires, the history row includes the full provenance chain. **Confirmed.**

**D3 — Capabilities are NEVER mirrored:**

> *"Capabilities are not mirrored, just primitives!! And only when editing/creating character or capability. So I can have a primitive that is direct and mirrored. But maybe a capability uses same primitive but not mirrored. Well that's just how capability works. It doesn't change mirroring of my direct capability nor does it double/dupe it."*

**Decision:** Mirror is a property of the **primitive slot** (the character's slot for that primitive), not the capability. A capability uses the primitive's slot, including its mirror state. The capability itself has no mirror. If the primitive is slotted as mirrored, the cap sees the mirrored version. If slotted as direct (un-mirrored), the cap sees the un-mirrored version. **This is the current behavior — confirmed correct.**

#### E. Items drive modifiers + equip gating

> *"If item equippable only when equipped. If item not equippable both contribute."*

**E1 — Bundle expansion OK:** Already works. **Confirmed.**

**E2 — Equip gating:** Equippable items contribute only when equipped. Non-equippable items (`is_not_equippable = true`) always contribute. **Confirmed.**

#### F. Small cards zone

**F1 — Dedicated zones per category:** Separate row groups for movement, damage types, resistances, etc. Not one giant bag. **Needs round 3 final taxonomy.**

**F2 — No explicit list yet.** The examples are fine as a starting set. **Confirmed.**

**F3 — Read-only on sheet, future FAB to add runtime modifiers:**

> *"readonly. we'd eventually make a button/second FAB on character sheet that would let us add modifiers and conditions with name and description at runtime in ch sheet. To change movement speed or to apply penalties. (I said something like this before)"*

**Decision:** Small cards in the sheet are read-only (computed values). A future FAB (separate phase) will allow adding runtime modifiers — e.g. "I'm currently grappled" — that flow through the same engine. **FAB parked for later (I21).**

**F4 — Modifiers near existing axes already in the drawer:**

> *"Idk.. I guess all. But not everything needs a card. Like for fieldcraft for example we already have practices in the drawer. Condition appears when I click on it. So if we have it in the drawer we apply the symbols and extra info in modal. But for the other things... Hmmm...yeah we can keep the idea with modals I guess....but we need to figure out where it makes sense to."*

**Decision:** For modifiers that target an existing axis already shown in the drawer (practices, attributes, defenses, vitality, movement, etc.), the modifier's symbol (`︽` / `︾` / `*`) appears next to that axis in the drawer. Clicking the axis modal shows the full breakdown. For modifiers that don't have a corresponding axis (resistance:fire, darkvision:60ft, languages:Draconic, custom:blockValue), they get their own small card in the bottom drawer.

#### G. Modal traceability

**G1 — "Tidal" was a typo for "total":**

> *"Typo I meant 'total' but we already have these in those modals. We have a single modal structure I guess that's flexible enough and reusable, we can add to it these new revelations."*

**Decision:** All three sections (general formula, provenance breakdown, substituted formula) are already in the reusable modal structure. We just need to enrich them with the new modifier-resolution data. **Confirmed.**

**G2 — Tree internally, flat list UI:**

> *"Tree. But it's gonna be tricky to illustrate on mobile. If this is just UI, we make flat list. If it's like needed or better and not just UI/UX wise, tree. Idk if I understood correctly."*

**Decision:** The engine returns the **full tree** of provenance (capability → effect → primitive → modifier, recursively with the source chain). The UI **flattens** for display when needed (e.g. on mobile, or when the user clicks "show flat"). Default rendering: tree, with each level collapsible. **Confirmed.**

**G3 — Per-contributor breakdown collapsed with click-for-full-detail:** Each contributor shows name + total contribution. Click to expand: shows the source chain, the modifier's op, condition, stacking mode. **Confirmed.**

**G4 — Yellow for mirror, only mirror value:**

> *"what? Color code yes but yellow for mirror not red. If mirrored only the mirror value. We already have in the primitive accordion what it mirrors to..."*

**Decision:** The modal shows the **mirror value only** (not the pre-mirror value). Mirror contributions are highlighted in **yellow** (not red — red is reserved for negative numbers that aren't from mirror). The primitive accordion already shows the original-to-mirror mapping. **Confirmed.**

#### H. DB seed quality

**H1 — Mix, defer DB cleanup:**

> *"C. Because engine must be flexible because idk how people will create things in the future. I will also not be testing on Tessy I will create new character, new primitives brew things to test against the engine. Defer DB cleanup later."*

**Decision:** Engine is the focus of Session I. After wiring the engine, you create new characters + new primitives to test against it. **DB seed cleanup is deferred** to a later session (post-Session I/J/K). **Confirmed.**

**H2 — Flag malformed modifiers in DB:** Yes, if that's the correct way. **Open question (R3-Q5):** What's the actual mechanism — a `needs_review` boolean column on `primitives`, a separate `modifier_audit` table, or a runtime check that surfaces the issue in the data UI?

**H3 — Custom behavior variables NOT in DB:**

> *"Idk... I'd say not in db. Bc people will do whatever. Engine will pull them from a JSON and resolve them I guess... Right?"*

**Decision:** Custom behavior variables are **transient** — never persisted as a separate row. The engine resolves them by walking the modifier chain at character-sheet render time. No DB column for `runtime_variables`. **Confirmed.**

#### I. Stacking rules

**I1 — Default `highest-only`:** When stacking field is missing, engine defaults to `highest-only`. UI enforces explicit stacking. **Confirmed.**

**I2 — Hide stacking field when op = `set`:**

> *"For set stacking does not make sense. We should even hide field in modal build when set to because it doesn't make sense."*

**Decision:** `set` doesn't have a stacking mode (always last-write-wins). Hide the stacking field in the modifier composer when op = `set`. **Confirmed.**

#### J. Engine vs display-only

**J1 — Capability toggle bundles all its primitive modifiers:**

> *"I guess yes. Sounds ok. But clarification. On Ch sheet I set capability as active/inactive not the modifier. All the modifiers nested inside the primitives of said capabilities are bundled in same toggle to matter or not."*

**Decision:** The character's active/inactive toggle is on the **capability**, not on each modifier. When the cap is toggled OFF, all its primitives' modifiers are bundled into the off state — none contribute. When toggled ON, all contribute. **Confirmed.**

**J2 — Attributes are the base, primitives add on top:**

> *"I don't understand. In identity tabs I only set size. You can trigger it with a primitive or capability (like enlarge reduce spell from dnd5e for example). If you mean attributes in attributes tab (physical, mental, magical), they are used as base for everything else."*

**Decision:** Base attributes (slice values set in the Attributes tab) are the **base** for the formula. `displayed_attribute = slice + sum(primitive modifier contributions)`. Identity tab only has size; size is a separate axis (not a base for attributes). The Enlarge/Reduce example clarifies size can be modified by a primitive/cap. **Confirmed.**

**J3 — Sub-targets are independent checkboxes:**

> *"Yes. But I can choose what targets attribute and choose all 3 and it applies to all of them. Or I can only choose one or 2... Same for practices and movement and all sub-targets."*

**Decision:** Sub-targets are multi-select checkboxes. Author can pick any subset. A modifier targeting `attribute` with physical+mental selected (not magical) applies to physical and mental only. **Confirmed.**

**J4 — Saving throws vs DC:** See A. Schema cleanup section above. **Open question (R3-Q1, R3-Q2).**

**J5 — Too technical, re-asked as R3-Q6 below.**

#### K. Where to start

> *"b with null target because of we don't start with that we cannot properly continue so I can verify. So I say b → a → d (because I cannot verify without UI) c → d (UI polish) → e."*

**Decision: Execution order for Session I:**

1. **b — Null-target bug fix** (validation error at save time + engine drop rule)
2. **a — Engine resolution** (wire `resolveModifiers()` into the character sheet, delete buCost-as-proxy)
3. **d — Small cards UI** (so you can verify with the new characters you create)
4. **c — Custom behavior variables** (`blockValue` system + canonical ordering)
5. **d — UI polish round 2** (small cards refinement, glyph placements, traceability)
6. **e — DB seed cleanup** (deferred to later session per H1)

**K2 — Do NOT touch:**

> *"I mean don't change formulas like how we calculate a roll for a practice or for attack or for vitality or things like this. And don't touch UI that was done in character sheet before now. And don't make changes that are not part of this plan or previously agreed to without asking me...."*

**Decision:** Session I does NOT modify:
- The formula for practice roll, attack roll, vitality, etc. (existing formulas stay)
- The pre-existing character sheet UI (already shipped in earlier phases)
- Anything outside this plan or previously agreed (ask first)

Session I DOES add:
- The new "small cards" zone in the bottom drawer
- Glyphs next to existing axes (`︽` / `︾` / `*`)
- Movement sub-types (extend display, not formula)
- Full modal traceability (extend existing modal structure, not rewrite)

---

## Open questions — round 3 (asked 2026-08-04)

These are the remaining gaps before we can write the subtask breakdown and start implementing.

### R3-Q1. Saving throws vs save DC — what are the two numbers?

You said:
> *"Defense DC (rename to saving throws). And add save DC (because we have a single save DC, but for each attribute we have modifier and saving throw DC). Do you understand this?"*

I think these are two different things but I want to confirm:

- **Saving throw DC** (one per attribute: `saving_throw.<physical>`, `saving_throw.<mental>`, `saving_throw.<magical>`) — the threshold players must meet when **the character is rolling to defend against an incoming effect** (e.g. "save vs. fire" → the player's d20 + modifier ≥ this DC)
- **Save DC** (single global number, `character.save_dc`) — the threshold enemies must meet when they're trying to affect the character (e.g. "enemy attacks the character" → enemy's attack roll ≥ this DC)

Is that right? And do they use the same formula (`5 + PB + modifier`) or different formulas?

### R3-Q2. Action.roll rename vs add

> *"Action roll should be for all rolls? Or change to attack roll or we add attack roll separately in list?"*

Two options:
- (a) **Rename** `action.roll` → `attack_roll` (one target, replaces the generic one)
- (b) **Add a set of explicit axes**: `attack_roll`, `save_roll`, `check_roll`, `initiative_roll` — keep `action.roll` as the wildcard for "any roll"

Which? Or a different set?

### R3-Q3. Behavior variable name format

You said: "strip of spaces and symbols." Confirm:
- Lowercase only?
- Letters + digits + underscore + hyphen allowed?
- Must start with a letter?
- Min/max length?
- Any reserved names (e.g. can't be `set`, `add`, `multiply`, etc.)?

### R3-Q4. Active caps — when toggled ON, contribute to totals?

> *"Only passives and augment. Capabilities are passive augment or active only. Trigger and active/inactive are behaviors on the character sheet."*

Two interpretations:
- (a) **Active caps are toggle-only.** When toggled ON, their modifiers contribute to the sheet's totals (alongside passive). Trigger is a separate one-shot button that adds to the active total temporarily and logs to history.
- (b) **Active caps are trigger-only.** No toggle; they only contribute when explicitly fired. The "active/inactive" toggle you mentioned is for **persistent buffs** (a different category than trigger caps).

Which? Or both? (i.e. an active cap has BOTH a toggle AND a trigger button, and the toggle enables/disables the passive contribution while the trigger fires it once)

### R3-Q5. "Flag malformed modifiers" — implementation

You said: "If that is the correct way to do it then yes." Three options:
- (a) Add a `needs_review BOOLEAN` column on `primitives` — server-side audit script flags primitives with malformed modifiers
- (b) Add a `modifier_audit` table — runtime view that joins primitives + their modifiers + validation status
- (c) No DB change — the engine itself reports malformed modifiers at evaluation time (returns them in the resolver output with a `validated: false` flag)

### R3-Q6. J5 re-asked in plain language

J5 was: "When slot NOT mirrored but modifier's `metadata.mirror.optedOut = true` — no-op (pass-through unchanged), OR inert (no contribution)?"

In plain language: imagine a primitive is slotted as **normal** (not mirrored). But one of its modifiers has a flag that says "I refuse to be mirrored." Does that modifier:
- (a) **Contribute normally** as if nothing was weird (the mirror-opt-out flag is ignored when the slot isn't mirrored anyway)
- (b) **Become inert** (no contribution at all, because the modifier is "broken" without mirror)
- (c) Something else

### R3-Q7. Stacking interaction with cap activation

When a cap is toggled OFF, none of its primitives contribute. But what about **stacking** across multiple active caps that target the same axis? E.g. two active caps both grant `set save_dc = 10 + PB`. When both are ON, do they stack (one wins), or do they all contribute independently?

For `set`, the answer is clear: last-write-wins. But what about `add` from two active caps that are both ON? Do they stack normally, or do we treat the cap-toggle as a stacking boundary?

### R3-Q8. Per-action modifier scope

When a modifier targets `action.roll` (or `attack_roll` if we rename), does it apply to:
- (a) **All attack rolls** (universal +X to attack)
- (b) **Specific attack rolls** (e.g. "ranged attack roll vs. melee within 5ft")

If (a), no sub-target needed. If (b), we need a sub-target like `action.roll.attack_sword` or a free-text field for "weapon type" or similar.

### R3-Q9. Mirror contributions to small cards

When a mirrored primitive grants `vulnerability:fire`, the small card shows `vulnerability:fire`. Does the card have a `*` marker to indicate "this is from a mirrored primitive" (so the player knows it's a penalty they're paying for)?

### R3-Q10. Item equip preview

When an item is in the inventory but NOT equipped, does the sheet show its potential contribution in a dimmed/grayed-out state? Or is it invisible until equipped?

---

## What happens after you answer

1. Fold round 3 answers into the doc (replace this section with "Decisions log round 3").
2. Write concrete subtask breakdown for I1–I11 in execution order (per K1: b → a → d → c → d → e).
3. Start with the highest-priority item (b — null-target bug).
4. Each subtask gets its own commit (per your preference: 4 sequential commits over 1 signoff-gated commit).

---

## Notes for future reference

- The DB stores modifiers as `hard_modifiers JSONB` on each primitive row. The shape is the legacy `HardModifier` (`value: JsonValue`). The Phase 7.5 shape (`Phase75HardModifier` with `tokens: ValueToken[]`) is the target. There's an in-flight migration window where both shapes parse via `parseValueField()`.
- The resolver today does NOT walk v1 condition shapes (`preset` / `narrative` / `tags` / `compound`). It treats `null` condition as active and treats any condition with a `kind` discriminator as active. Only the legacy `{key, operator, value}` path is actually evaluated. **I3 fix.**
- The `conditionActive` field in `ModifierContribution` is currently `!mod.condition || "kind" in (mod.condition ?? {})` — a soft-warn placeholder. I3 replaces this with real evaluation.
- The runtime reference token (`{kind: "runtime", name: "blockValue", hint: "number"}`) is the parser's fallback when the author types a non-canonical inner string. The resolver soft-warns at character-sheet render time if the runtime reference is still unresolved — no hard error, it's an open future slot.
- The mirror button on a primitive is per-slot: it lives on the character's slot for that primitive (in `character_primitives.is_mirrored`). The capability uses the primitive's slot, so it sees the mirror state. **Critical:** the capability's own mirror flag is irrelevant — mirror is always primitive-level, not capability-level.

---

## Canonical reference: capability specification (Mashu 2026-08-04)

You attached `capabilities.txt` (762 lines). This is the **canonical spec** for how capabilities, effects, and primitives combine. All Session I work must respect this structure. Full text saved at `/home/xeun/Projects/SwordWeave/.hermes-capabilities.txt` (gitignored).

### The 3 Capability Styles

| Style | Description | Effect slot? | Range/Target? | Example |
|---|---|---|---|---|
| **A — Passive / Stance** | Always-on or toggled. No targeting, no active execution. Modifies sheet directly. | NONE | NONE | Bloodhound Master (advantage on tracking) |
| **B — Direct Resolution** | Instant execution. Damage/heal/move resolves immediately, leaves no state. | NONE | YES | Gravity Impact (kinetic blast) |
| **C — Dynamic State** | Delivers a mini-capability (Effect) to a target. Lingering conditions. | REQUIRED | YES | Compelled Focus (taunt via disadvantage) |

Mapping to the recap's `capability.type`:
- `passive` → Style A
- `augment` → Style A or B (augments existing action)
- `active` → Style B or C (active execution)

### The 4-step Resolution & Runtime Safety Valve

```
[1. License Check] ──> Confirm player owns the utilized Primitive Tiers globally.
[2. Source Match] ──> Downward-inherit Source (Physical/Magical/Psychic/Hybrid).
[3. Vector Match] ──> Projected Vector (applies Cover penalties) OR
                      Direct Manifestation (bypasses Cover, requires bare Line of Sight).
[4. DM Strain Appraisal] ──> Analyze Complexity + Targets + Nesting Depth.
                            └──> Assign Strain Level (Low ──> Extreme) ──> Collect Vitality/Strain Cost.
```

**Critical for Session I:**
- **Source Type inheritance** — All nested primitives downward-inherit the cap's source type. This is a NEW concept the engine must enforce (`source_type` on cap propagates to all primitives below it).
- **Vector Match** — Direct Manifestation vs Projected Vector is an Effect-level property, not a cap-level property. Means an effect can be "Direct Manifestation" while the cap that delivers it is "Projected Vector" or vice versa. Engine must support per-effect vector type.
- **DM Strain Layer** — Runtime toll. Affects vitality/strain. This is what the COST_INSTABILITY mirror vector maps to.
- **Strain Tier** — Calculated from complexity, NOT from BU. Two different ways to compute "how hard is this?" — engine must support both.

### Effect Template (v1)

```
EFFECT IDENTITY
- Name: [Narrative/Thematic Name]
- Execution Type: Direct Manifestation / Projected Vector

THE MECHANICAL TEETH (the primitives that power the effect)
- Core Primitive Component A: [Primitive Name - BU Cost]
- Core Primitive Component B: [Primitive Name - BU Cost]

RESOLUTION GATE
- Saving Throw Attribute: [Which Attribute/Practice defends against this state]
- Difficulty Threshold: [Character DC = 5 + PB + Attribute Modifier + Modifiers]

TEMPORAL BOUNDARY
- Persistence Layer: Instant / Short / Medium / Long / Scene / Persistent / Permanent
```

**Critical for Session I:**
- An Effect IS a mini-capability with its own primitives ("teeth")
- Effects have their own resolution gate (which attribute defends, which DC)
- Effects have their own temporal boundary (duration)
- **Effects can be triggered on their own** — they're not just "applied to a target from a cap"; they can be triggered independently at runtime (advanced usage)

### Capability Template (v1 — Canonical)

```
1. Identity
   - Name
   - Type: Passive / Active / Augment
   - Source (Physical / Magical / Psychic / Hybrid)
     - SOURCE TYPE is inherited by all effects in the cap.

2. Construction
   - Verbs (1–n)
   - Domains (1–n)
   - Effects (1–n)

3. Targeting
   - Target Mode: Single / Multiple / AoE
   - Target Shape (if AoE): cone / line / sphere / zone / beam
   - Target Size: 5 / 10 / 20 ft/m etc
   - Placement: self / target / point / directional

4. Range
   - Touch / Close / Near / Far / Very Far / Extreme
   - (cost gate only, no scaling effect)

5. Output
   - Dice type and number (d4–d12 numeric)
   - 2d6, 4d8, 4d8+8d6, etc
   - Damage type (inherited from domain)

6. Duration and casting time
   - Duration of spell effects: Instant / Short / Medium / Long / Scene / Persistent / Permanent
   - Time needed to be cast: Instant / Short / Medium / Long / Scene / Persistent / Permanent

7. Scaling
   - Intensity modifiers (optional expansion rules)
   - BU equivalence reference (non-binding)

8. BU Evaluation (CORE VALUE)
   - Base BU cost (construction equivalence)
   - Adjusted BU (scaled version if expanded)

9. Strain (DM LAYER)
   - Heuristic difficulty
   - Scaling pressure
   - Complexity load
   - Vitality consequence (DM discretion)

10. CV (NERD LAYER ONLY)
    - Computed complexity estimate
    - BU-equivalent approximation
    - Scaling comparison tool

11. Verbose Description
    - Narrative explanation (player-facing text)
```

### Standalone Effect Examples (from the spec)

These effects are referenced in the existing data:

| Effect | Domain | Teeth | Save | Duration |
|---|---|---|---|---|
| **System Freeze** | Technomancy/Ice | Velocity Arrest (6 BU) + Reaction Lock (4 BU) | Physical vs Character DC | Short (end of round) |
| **Corrosive Decay** | Acid/Void | Kinetic Hardening Degradation (-3 Phys Def, 6 BU) + Standard Tick d4 (4 BU) | Physical vs Character DC | Medium (3 rounds) |
| **Vertigo Spasms** | Psychic/Air | Negative Bias on offense (6 BU) + Involuntary Vector Shift 5ft (4 BU) | Mental vs Character DC | Long (until saved) |
| **Compelled Focus** | Psychic/Emotion | Selective Negative Bias on non-caster attacks (8 BU) | Mental vs Character DC | Short (end of round) |

These are the canonical effect templates. The engine should be able to express each of these as a Style C capability with one Effect.

### Scope changes for Session I (from the canonical spec)

These were NOT in the original Session I plan but are now required by the spec:

| # | Item | Notes |
|---|---|---|
| **I23** | Source Type inheritance — cap.source_type propagates to nested primitives and effects | Engine must walk the chain |
| **I24** | Effect has its own vector type (Direct Manifestation vs Projected Vector) | Per-effect, not per-cap |
| **I25** | Effect has its own resolution gate (save attribute, DC formula) | Engine resolves per-effect |
| **I26** | Effect has its own temporal boundary (duration tier) | Display on sheet |
| **I27** | Strain Tier is separate from BU | Two parallel complexity metrics |
| **I28** | Effect can be triggered standalone (not just from a cap) | Runtime, not engine |

---

## Round 3 decisions (2026-08-04)

### R3-Q1. DC vs Saving Throws — two different numbers

> *"we have DC (when somebody attacks me he rolls against my DC. If I use a spell he needs to make a saving throw based on a certain attribute but against same DC). And we have saving throws. If I am subject to a Mental Save DC, I roll with save."*

**Image 1 confirms** the drawer shows two numbers per attribute: `modifier` (attr + primitives) and `save` (modifier + PB for the proficient attribute).

**Decision locked:**
- **`saving_throw.<physical|mental|magical>`** — the bonus this CHARACTER rolls when subject to a save. Formula: `modifier + PB` (only for the proficient attribute). Display: shown in the `MODS + SAVES` drawer card, below the modifier (e.g. `+5` then `save: +11`).
- **`save_dc`** — the threshold enemies must meet when attacking THIS CHARACTER (or this character casts a spell that requires a save). Formula: `8 + PB + modifier_of_proficient_attribute` (per your `target-registry.ts` comment, "save DC always uses PB"). Display: `SAVE DC` card in the bottom drawer (the existing one).
- The renaming `defense DC` → `saving throws` is a **schema rename** for the target list. The single `save_dc` is a separate axis that uses the existing `5 + PB + modifier` formula.
- **Open follow-up (R4-Q1):** the modifier used for `saving_throw.<attr>` is the same as the attribute's modifier (slice + primitive contributions). The modifier used for `save_dc` is the modifier of the proficient attribute. Confirm.

### R3-Q2. Action Roll sub-targets

> *"we should just add a couple of sub-targets to action roll? to offer flexibility? what comes to mind is Attack Roll / Spell attack roll (which should be same thing. Because a spell is a capability and an attack roll is either just an attack or still via a capability) and Contested Check [x] Contested Check: Modifies non-attack active maneuvers (grapples, shoves, contested actions) or what do you think? Just rename it to attack roll and call it a day?"*

**Decision (preliminary, needs R4 confirmation):** Add sub-targets to `action.roll`:
- `action.roll.attack` — attack roll (covers both physical attacks and spell attacks, since spells are caps)
- `action.roll.contested` — contested check (grapples, shoves, contested actions)
- `action.roll` (no sub-target) — wild card, applies to all roll types

Open follow-up (R4-Q2): Validate this 3-sub-target set, or pick a different set.

### R3-Q3. Behavior variable name format

> *"idk, i guess we can do like: blockvalue, blockValue, block-value.... idk if Blockvalue and block.value would not be good...something to not confuse the engine or programming."*

**Decision locked:**
- Accept: `blockvalue`, `blockValue`, `block-value`, `BLOCK_VALUE` (all normalized to lowercase-hyphen for storage)
- Reject: `Blockvalue` (ambiguous case), `block.value` (dot would confuse parser)
- Validation rule (at save time):
  - Strip whitespace and most punctuation except `-` and `_`
  - Must start with a letter
  - Must contain at least 1 character after stripping
  - Normalize to lowercase + hyphens for storage: `blockValue` → `blockvalue`, `block-value` stays as `block-value`, `BLOCK_VALUE` → `block_value`
  - The engine resolves the variable by the normalized form
  - The author sees the original form on the sheet (display only)
- **Reserved names** (to be added in R4): `true`, `false`, `true_only`, `false_only`, `set`, `add`, `multiply`, `divide`, `min`, `max`, `grant`, `revoke`, `stack`, `highest`, `lowest`, `unique`, `replace`, the canonical attribute/practice/derived names from the enum. Names matching these reject at save time.

### R3-Q4. Active caps — toggle + trigger

> *"active/inactive would be for those with conditions/triggers when set. but not necessarily. Like invisibility would be a thing you need to keep active to be invisible even with no triggers when. And A capability giving you +3 attack when enemy is below 50% health should give you +3 if you trigger it while active. Also a Capability like fireball would not need active/inactive, just trigger but idk how to differentiate... i guess we leave both on all capabilities (except the rule with passive that we said... but actually there too, because a passive could have a condition... idkk this is hard...."*

**Decision (preliminary, needs R4 confirmation):** Every capability has BOTH:
- **Active/inactive toggle** — persists state. Default is ON when there are no triggers, OFF when there are triggers. The toggle bundles all its primitive modifiers.
- **Trigger button** — fires a one-shot. Modifiers inside a triggered cap contribute for that one moment AND log to history.

The complications:
- `invisibility` (no trigger, just keep active) → toggle ON, no trigger button visible (or disabled)
- `+3 attack when enemy < 50% HP` (condition + trigger) → toggle must be ON for the trigger to fire, AND the cap must be triggered
- `fireball` (just trigger, no persistence) → toggle starts OFF, only fires on trigger

**Open follow-up (R4-Q3):** The condition in "+3 attack when enemy < 50% HP" — is it a per-trigger-check (each trigger verifies the condition) or a per-cap-toggle (the cap is only active when condition is true)? Per your wording "should give you +3 if you trigger it while active" — I think it's per-cap-toggle: the toggle checks the condition, and the trigger fires whatever the toggle currently allows.

Open follow-up (R4-Q4): For `fireball` (no trigger input), the toggle should default to OFF when the cap has only triggers and no modifiers. Per your answer. Confirm.

### R3-Q5. "Flag malformed modifiers" — implementation

> *"I do not understand the question."*

**Re-asked (R4-Q5):** When a primitive in the DB has a malformed modifier (e.g. `target: "attribute"` with no sub-target selected), how should the data tool surface it?

### R3-Q6. Mirror is per-primitive, not per-capability — confirmed

> *"Look, in character creation we can set a primitive mirrored or not. After we save, in character creation we don't play with those anymore. However. As I stated over and over again. Capabilities and effects are just bundles of primitives. […] The reason we display these on character sheet is just to have a quick book at base with everything like a quick sheet. especially for beginners."*

**Decision locked:**
- Mirror is a property of the **primitive slot** on the character (`character_primitives.is_mirrored`)
- Capabilities and effects are bundles that use the primitive's slot
- The capability itself has no mirror flag
- When a cap uses a primitive, the cap sees the primitive's mirror state
- Heritages are bundles for story/flavor with some mechanics, most primitives flow through
- The character sheet shows everything slotted (mirror state included) — beginners can see the full picture
- Advanced players can theoretically recompile primitives at runtime (out of platform scope)

**Test verification:** I need to confirm the current behavior matches this. Adding a test as part of Session I step 1 (null-target bug) — verify that a mirrored primitive slotted via a heritage-bundled cap displays the mirrored value on the sheet.

### R3-Q7. Cap toggle is a stacking boundary

> *"I guess cap toggle is a boundary. So maybe I have 2 capabilities that give me +1 to mental attribute. each one has triggers when differently. And I have another passive always +1 mental and all are stacking. So i get +3 is both capabilities are active, I get +2 if only one capability is active. By default all capabilities should be active unless they have conditions/triggers when. If they have triggers when they should either be inactive. because in triggers when we only have text pills, not modifiers or things I guess.... maybe we should extend that to allow for things that our engine could resolve such as different variables like attributes, practices, attack rol, etc."*

**Decision locked:**
- Each capability's active/inactive toggle IS a stacking boundary
- Modifiers inside a single cap stack normally (per the cap's stacking rules)
- Modifiers across caps stack normally if all relevant caps are active
- When a cap is toggled OFF, all its modifiers are excluded from the running total
- Default: caps are ON unless they have triggers/conditions
- Trigger caps default to OFF (so they don't stack their modifier until fired)
- **Future extension:** extend the "triggers when" condition to allow engine-resolvable things (attributes, practices, attack roll, etc.) so a cap can be auto-toggled based on character state

**Open follow-up (R4-Q6):** When a cap is toggled OFF, does its modifier still appear in the modal traceability (with a `*` or "(inactive)" marker), or is it completely hidden?

### R3-Q8. No weapon types, no sub-targets on action.roll

> *"We don't have weapon types. And it would make things harder because we'd need to have items involved and it would make things harder for now. If anything, An item could have a capability that gives +1 to attack roll when triggered only not always idk..."*

**Decision locked:**
- `action.roll` is a single target for now (no weapon sub-targets)
- Items can have caps that grant +1 to attack roll via the trigger flow (see R3-Q4) — "fire when active, +1 attack roll" is a complete capability
- No need for per-weapon resolver

### R3-Q9. Mirror glyph

> *"maybe we just use `🪞` (U+1FA9E)? or idk, we'd need some identifiers for 'this has conditions', 'this is advantage/disadvantage', 'this is mirrored', idk"*

**Decision (preliminary):**
- Advantage glyph: `︽` (U+FE3D) — confirmed from round 2
- Disadvantage glyph: `︾` (U+FE3E) — confirmed from round 2
- Conditional marker: `*` — confirmed from round 2
- Mirror glyph: `🪞` (U+1FA9E) — proposed in round 3

**Open follow-up (R4-Q7):** Are the glyphs always visible on the sheet, or only on click in the modal? Hover tooltip? Different colors for different states? (E.g. mirror is yellow, advantage is teal, disadvantage is red?)

### R3-Q10. Item equip preview

> *"yes. not active, but shows it dimmed if unequipped. maybe we add '(when equipped)'"*

**Decision locked:**
- Unequipped items show their potential contributions in a dimmed state
- The contribution is suffixed with `(when equipped)` so the player knows it's not currently active
- This applies to all modifier contributions from the item (via bundle expansion)

---

## Round 4 open questions (asked 2026-08-04)

These are the remaining gaps. Plain language, no technical jargon.

### R4-Q1. Saving throw formula — confirm the modifier used

Per R3-Q1's decision:
- `saving_throw.<attr>` = `modifier_of_<attr> + PB` (only for proficient attribute)
- `save_dc` = `8 + PB + modifier_of_proficient_attribute`

In the drawer the SECOND number (`save`) below the modifier is the saving throw bonus. Confirm: a PHYS save (non-proficient) shows save bonus = modifier + 0 PB? Or always modifier + PB for the proficient attribute regardless of which attribute?

The image shows: `PHYS +5, save: +5` (no PB), `MENT +5, save: +11` (= +5 + 6 PB). So PHYS save = modifier only, MENT save = modifier + PB (because MENT is proficient). **Confirm: each attribute's save bonus replaces PB with the proficient attribute's PB only IF this attribute is the proficient one, else no PB?**

### R4-Q2. Validate action.roll sub-targets

Per R3-Q2, proposed sub-targets: `attack`, `contested`, (none). Other options:
- `attack`, `contested`, `save` (save roll)
- `attack`, `contested`, `check` (skill check)
- Just `attack` (rename `action.roll` → `attack_roll`, drop the wildcard)
- Keep `action.roll` as is, no sub-targets (current state)

Which?

### R4-Q3. Capability condition is per-toggle or per-trigger?

> *"A capability giving you +3 attack when enemy is below 50% health should give you +3 if you trigger it while active."*

"While active" suggests the toggle is the gate. So:
- Toggle ON, condition met → trigger fires, +3 attack
- Toggle ON, condition NOT met → trigger does nothing (or logs "ignored")
- Toggle OFF → trigger does nothing

Or:
- Toggle ON, condition met → trigger fires, +3 attack
- Toggle ON, condition NOT met → trigger fires, but +3 doesn't apply (because condition is in the modifier, not the toggle)
- Toggle OFF → trigger does nothing

Which?

### R4-Q4. Cap defaults

Confirm:
- **Passive cap** — toggle defaults to ON, no trigger button
- **Augment cap** — toggle defaults to ON, no trigger button (applies to augmented action)
- **Active cap with no conditions** — toggle defaults to ON, no trigger button OR trigger button always visible (your choice)
- **Active cap with conditions** — toggle defaults to ON, trigger button visible (fires when conditions met)
- **Active cap with triggers only** — toggle defaults to OFF, trigger button visible (toggle turns it on as a persistent buff)

### R4-Q5. Re-ask of R3-Q5 (flag malformed modifiers)

In plain language: when a primitive in the DB has a malformed modifier (e.g. `target: "attribute"` with no sub-target selected), how should the data tool surface it?

- (a) Add a `needs_review` boolean column on `primitives` — server-side audit script flags malformed primitives
- (b) Add a `modifier_audit` table — runtime view that lists malformed modifiers
- (c) No DB change — the engine reports malformed modifiers at evaluation time (returns them in the resolver output with a `validated: false` flag, no DB persistence)

### R4-Q6. Cap toggle OFF — hide or show inactive?

When a cap is toggled OFF, does its modifier still appear in the modal traceability:
- (a) **Hidden** (completely invisible to the player)
- (b) **Dimmed** with `(inactive)` or `(when toggled on)` marker
- (c) **Visible in the modal only** (DM sees the full list, drawer shows only active caps)

### R4-Q7. Mirror glyph visibility

`🪞` (U+1FA9E) for mirrored contributions. Where does it appear?
- (a) Always visible next to the modifier value on the sheet
- (b) Only visible in the modal (hover/click)
- (c) Visible only in the equipped/inventory sections (not for slotted primitives which are baseline)

And what color?
- Yellow (per G4)?
- A different color?

### R4-Q8. Small cards taxonomy — brainstorm

Let's start the category list. Suggestion for first pass:

| Category | Examples |
|---|---|
| **Movement** | `movement: 30ft`, `movement.fly: 30ft`, `movement.swim: 15ft`, `movement.climb: 15ft`, `movement.burrow: 5ft`, `movement.conditional: +10ft when X` |
| **Damage modifiers** | `resistance:fire`, `resistance:cold`, `immunity:poison`, `vulnerability:radiant`, `damage:fire 1d6` |
| **Senses** | `darkvision:60ft`, `blindsight:30ft`, `tremorsense:any`, `truesight:120ft` |
| **Languages** | `languages:Common`, `languages:Draconic`, `languages:Thieves' Cant` |
| **Custom behaviors** | `blockValue:6`, `manaPool:30`, `spellSlots:1/day` |
| **Meta tags** | `cantSpeak`, `isFlying`, `isInvisible`, `isGrappled`, `isStunned` |

Add / remove / merge categories?

### R4-Q9. Item equip preview — which surfaces get the dimmed state?

Per R3-Q10, unequipped items show dimmed with `(when equipped)`. Does this apply to:
- (a) The item card in the inventory tab only
- (b) The item contribution in the bottom drawer (e.g. PB card "from item Dagger: +1 when equipped")
- (c) Both

### R4-Q10. Trigger button placement

When a cap has a trigger button (active cap with conditions OR active cap with triggers only), where does the button live?
- (a) On the capability card in the Capabilities tab (next to the cap name)
- (b) In the bottom drawer near the relevant axis (e.g. near the attack roll card, since the trigger grants +3 attack)
- (c) In the history tab (fire from history, logs there)
- (d) A floating action button (FAB) on the character sheet

### R4-Q11. Condition text — where shown

When a modifier has a condition (e.g. `target is grappled`), the condition text appears:
- (a) In the modal traceability only (you click the modifier to see the condition)
- (b) In a small chip next to the modifier on the sheet (along with the `*` marker)
- (c) Both — modal is the full text, sheet shows a tooltip on hover

### R4-Q12. Free-text axes validation

Per your answer for A1's free-text axes (`action.strain`, `scene.pace`): "yes I guess, especially scene and pace are more of an info thing because they are resolved at runtime."

Confirm: validation rule for free-text axes is **no validation** (any text accepted, since they're info-only, resolved at runtime). The same applies to `behavior:<name>` (handled by R3-Q3's normalization).

Two edge cases:
- Empty string for `action.strain` — accept (no value, no contribution)? Or reject?
- `behavior:<name>` with name matching a reserved name (e.g. `behavior:set`) — reject at save time (per R3-Q3's reserved names list).

### R4-Q13. DB backfill for advantage/disadvantage — exact encoding

Per R3-Q5, advantages use `Grant` op with `behavior:advantage` / `behavior:disadvantage` target. The image confirms this convention.

But the DB may have OLD rows with:
- `op: "bias"` with `value: "advantage"` / `value: "disadvantage"` (legacy)
- `op: "grant"` with `value: "advantage"` / `value: "disadvantage"` (modern, but using bare text instead of `behavior:advantage`)
- `op: "set"` with `value: 1` for `target: "advantage"` (incorrect category)

The migration should:
- Map `bias` → `grant`
- Wrap bare `advantage` / `disadvantage` values in `behavior:advantage` / `behavior:disadvantage`
- Leave already-correct rows untouched

Confirm this is the encoding.

### R4-Q14. Verifying mirror-is-per-primitive

Per R3-Q6, I'll add a test that confirms the current behavior. The test:
- Create a primitive with `+2 to physical` modifier
- Slot it as **mirrored** directly on a character
- Wrap it in a capability
- The capability slotted on the same character should see the **mirrored** value (`-2`) on the sheet
- Same test with the primitive NOT mirrored → +2

OK to add this test as part of step 1 (null-target bug)?

### R4-Q15. Anything else ambiguous

Any other thing from your answer that I might have misinterpreted?


---

## Round 4 decisions (2026-08-04)

> **Note:** You could not see the local doc file, so several questions were unclear. The answers below are what I could extract. Some questions are re-asked in the message stream with full text.

### R4-Q1. Saving throw formulas — locked

> *"I have Physical +5, Mental +4, magic+1. I am proficient in Physical. I have PB = +3. Physical save is 5+3 =8, mental +4 and magic +1 (ofc + modifiers from primitives if the case)"*

**Decision locked:**
- `saving_throw.<attr>` = `modifier_of_<attr> + PB` **IF this attribute is the proficient one, ELSE just `modifier_of_<attr>`**
- Each attribute is independent (doesn't share PB across them)
- Primitive modifier contributions to the attribute's modifier feed into the save (additive)
- **Example confirmed:** PHYS+5 prof + PB=3 → PHYS save = 8; MENT+4 not prof → MENT save = 4; MAGI+1 not prof → MAGI save = 1

### R4-Q2. action.roll sub-targets — locked

> *"attack, saves. Attack is attack, and we have like a checkbox for attack, and one for each save (one for physical, one for mental, one for magic save). For contested idk we already have practices and we have conditions and triggers when. So for grappling contest we make like targets practices prowess with condition for/while grappling."*

**Decision locked:**
- `action.roll.attack` (covers all attacks and spell attacks)
- `action.roll.save.physical`, `action.roll.save.mental`, `action.roll.save.magical` (three separate sub-targets)
- No `contested` — contests are handled via practices + conditions/triggers when. A "Grappling contest" is a `practice(physical)` check with a `target grappled` condition.
- **Mapping needed:** `action.roll` is currently a single target. Need to add sub-targets.

### R4-Q3. Capability condition is per-toggle

> *"But it should be per-toggle."*

**Decision locked:** Condition check is on the **toggle**, not the trigger. The toggle bundles the cap's condition check. When the cap is toggled ON, the engine checks the condition; if met, the cap's modifiers contribute. The trigger fires whatever the toggle currently allows.

- Toggle ON, condition met → modifiers contribute
- Toggle ON, condition NOT met → modifiers don't contribute
- Toggle OFF → modifiers don't contribute

### R4-Q4. Cap types — passive, augment, active (per capabilities.txt)

> *"passive, augment, active. I attached more about capabilities in capabilities.txt"*

**Decision locked:** The 3 capability types map to the canonical 3 styles (see "Canonical reference" section above):
- `passive` → Style A (no effect, no range/target, always-on)
- `augment` → Style A or B (modifies an existing action)
- `active` → Style B (direct) or Style C (with effect)

**Trigger button defaults:**
- **Passive** — toggle ON, no trigger button
- **Augment** — toggle ON, no trigger button (applies when augmented action is taken)
- **Active** — toggle ON, trigger button visible (fires when triggered)

### R4-Q5. Flag malformed modifiers — re-asked in message stream

> *"I don't understand. I cannot see the local files you created."*

### R4-Q6. Hide or show inactive caps — show inactive

> *"show inactive I guess. If hide how would i be able to unhide it??"*

**Decision locked:** Inactive caps are visible in the modal traceability (with `(inactive)` marker). The drawer shows only active caps. The user can change the toggle to bring them back.

### R4-Q7. Mirror glyph — unicode for now

> *"we can use unicode for now I guess."*

**Decision locked:** Use unicode glyphs (`🪞` for mirror, `︽` for advantage, `︾` for disadvantage, `*` for conditional). No icons/sprites needed for Session I.

### R4-Q8. Small cards taxonomy — re-asked in message stream

> *"I don't understand. I cannot see the local files you created."*

### R4-Q9. Item equip preview — entire card dimmed

> *"I guess the entire card? idk..."*

**Decision locked:** When an item is unequipped, its ENTIRE contribution to the sheet is dimmed (in the drawer, in modals, everywhere). The card itself shows it dimmed with `(when equipped)` suffix.

### R4-Q10. Trigger button placement — already exists

> *"We already have trigger button on the capabilities. and capabilities inside items."*

**Decision locked:** Trigger button already exists on capability cards (and capabilities inside items). No new UI needed. Session I should ensure the trigger button is wired to the engine's modifier-resolution flow.

### R4-Q11. Condition text — re-asked in message stream

> *"I don't understand. I cannot see the local files you created."*

### R4-Q12. Free-text axes validation — re-asked in message stream

> *"I don't understand. I cannot see the local files you created."*

### R4-Q13. DB backfill for advantage/disadvantage — encoding is Grant+keyword

> *"I guess op grant value type keyword, value advantage/disadvantage should be."*

**Decision locked:** The DB backfill should:
- Map `op: "bias"` → `op: "grant"`
- Wrap bare `value: "advantage"` / `value: "disadvantage"` in keyword form: `value: { kind: "keyword", text: "advantage" }` OR `value: "behavior:advantage"` (whichever the form uses)
- Leave already-correct rows untouched

This confirms the modern convention from Image 4 (the modifier editor screenshot showing `[advantage]` keyword syntax).

### R4-Q14. Verifying mirror-is-per-primitive — yes, verify

> *"yes. But we already have this functionality I guess that is why you need to check."*

**Decision locked:** Add a test as part of Session I step 1 (null-target bug). The test verifies that a mirrored primitive slotted via a heritage-bundled cap displays the mirrored value on the sheet. If the test passes, the current behavior is correct. If it fails, we need to fix it.

### R4-Q15. Anything else ambiguous — re-asked in message stream

> *"I don't understand. I cannot see the local files you created."*

### R4-Q16 (NEW). Source Type field — Hybrid is a 4th option

The canonical spec says Source Type is "Physical / Magical / Psychic / Hybrid" but the recap's `CapabilitySourceType` has only 3 (`physical`, `magical`, `psychic`). Hybrid is missing.

**Deferred to round 5** — needs disambiguation.

### R4-Q17 (NEW). capabilities.txt reveals: Source Type includes "Hybrid"

The `capabilities.txt` spec lists source types as "Physical / Magical / Psychic / Hybrid". The current schema enum `CapabilitySourceType` only has 3 options. **Add Hybrid?** Or is Hybrid = a capability that uses primitives from multiple sources (e.g. a Psychic attack with Physical components)?

**Deferred to round 5** — needs disambiguation in the message stream.

---

## Round 5 questions — full text in message stream

Several questions were unclear because you couldn't see the local doc. Full text is in the latest message stream.


---

## Round 5 decisions (2026-08-04)

### R5-Q1. Flag malformed modifiers — column

> *"a."*

**Decision locked:** Add a `needs_review` boolean column on the `primitives` table. Server-side audit script flags malformed primitives. Surface flagged primitives in the data-atelier UI.

### R5-Q2. Small cards taxonomy — agreed + Other category

> *"yes those are good. however, Custom behaviors would be like bigger cards like we have for Attributes in the drawer. The rest like smaller cards, not necessarily like tags. meta tags would be tags. And the rest maybe we would group them in lists inside cards like for primitives, one card each category. But they are good. We also need proficiencies though. Like they would be targets action roll. sub-target other. so R4-Q2 we add other. And would be for proficiency with painting tools like targets action roll other grant proficiency bonus condition when using painting tools. I guess... so R4-Q2 we have attack, save, other."*

**Decision locked:**
- **Custom behaviors** (blockValue, manaPool, etc.) — **BIG cards** (like Attributes in the drawer)
- **Movement, Damage modifiers, Senses, Languages, Proficiencies** — **smaller cards**, grouped by category (one card per category)
- **Meta tags** (cantSpeak, isFlying, isGrappled, etc.) — **inline tags** (chips, not cards)
- New category: **Proficiencies** (with `other` action.roll sub-target)

### R5-Q3. Condition text — modal, `*` on the axis

> *"a. in the modal. we add the * on the proper thing -> which is the target or sub-target to let them know there are more conditions. Like I would have prowess + 4 *. In modal we have breakdown but we'd have a section for conditions and there we have extra +1 if target is grappled. I don't want to use on hover because on mobile we cannot make hover work... that is why we have on click modals."*

**Decision locked:**
- `*` marker is on the **target/sub-target axis** (e.g. `PROWESS +4 *`), not on the modifier itself
- Modal has a "Conditions" section showing explicit conditions
- No hover tooltips (mobile-incompatible)
- On-click modals are the only expansion mechanism

### R5-Q4. Behavior name field for free-text axes

> *"yes. we need to set value for 'Behavior name (key)' in strain, scene pace, behavior."*

**Decision locked:** For `action.strain`, `scene.pace`, and `behavior:<name>` axes, the modifier composer needs a "Behavior name (key)" field. The value writes to that behavior variable. So `action.strain` modifier with `+5` value and `behavior:exhaustion_penalty` key would write `exhaustion_penalty = 5` to the character's runtime state.

### R5-Q5. Anything else ambiguous — covered

> *"i answer per question and I write extra things for ambiguous things. After we clear up all the questions we will make a big recap so we understand the scope and see if anything is wrong or whatever. Because there are also db and in UI in the primitive build modal in selection fields etc."*

**Decision locked:** You'll continue answering per question. After the recap closes, we'll do a big review pass to verify scope. DB seating and UI selection fields in the primitive build modal are also part of the review.

### R5-Q6. Hybrid source type — removed

> *"We don't need hybrid. Psychic changed to mental. basically we know how it scales. If physical attack bonus scales with physical attribute, mental with mental, and magic with magic. (with pb where the case and modifiers from primitives). Hybrid would be hard to resolve. It's implicit, dm rules at the table, but not our software."*

**Decision locked:**
- Remove "Hybrid" from spec
- Note: "Psychic" was renamed to "mental" in your head — but the spec calls it "Psychic". Let me know if this is a rename.
- Source Type is metadata only (doesn't affect sheet math)
- The scaling rules per source:
  - Physical attacks/abilities use Physical attribute (+ PB where applicable)
  - Mental abilities use Mental attribute
  - Magic abilities use Magic attribute
- DM adjudicates mixed-source cases at the table

### R5-Q7. capabilities.txt may be outdated

> *"that may be outdated. But the capabilities.txt may be outdated tbh...like the capability template I guess is very different from the model we built.... but the model we built is better on how to construct capabilities. Because a lot of things like targeting, range, output, Duration and casting time, scaling are for the table, not in-app. Like the template is more of a syntax how to say you use at the table. Also not all capabilities need to include verb or domain, since those are more for flavor and table. Sometimes they may be implied."*
>
> *"maybe, now that i am thinking about all this, maybe we are trying to do too much....idkkk..."*

**Decision locked:**
- `capabilities.txt` is reference material, not authoritative spec
- Our model (3 cap types: passive/augment/active) is the canonical engine structure
- Targeting, range, output, duration, casting time, scaling are TABLE syntax, not engine scope
- Verb/Domain are flavor/implicit, not required engine fields
- "Maybe we're trying to do too much" — **YES**, the recap was sprawling. The big reframe at the top of this doc cuts scope significantly.

### R5-Q8 (NEW). "Psychic" → "Mental" rename

You mentioned "Psychic changed to mental" in R5-Q6. Both names appear in the spec. Per the spec's "BU Market" page, attributes are "physical / mental / magical". But the source types in the capability template are "Physical / Magical / Psychic / Hybrid". 

**Decision locked:** Source type "Psychic" → "Mental" (matches the attribute name). Confirm: are these the same thing or are they different concepts (e.g. Psychic = mental magic, Mental = psionic)?

**R5-Q8 — answer in next message.**

### R5-Q9 (NEW). "What" the capability does — what does this mean?

> *"It's important what the capability does mainly like does it fire things up, does it stun, does it make me invisible or transform me? how many targets how many dice how far how fast those are resolved by the dm and the player at the table."*

So the capability needs to describe its INTENT (what it does) and the TABLE mechanics (how many targets, dice, range) are resolved by the DM/player. The sheet needs to show the intent + the modifier contributions.

**Open follow-up (R5-Q9):** Where does the "intent" live in the schema? Is it the existing `capability.description` field? Or do we need a new field like `capability.intent` or `capability.sheet_summary`?

**R5-Q9 — answer in next message.**

### R5-Q10 (NEW). "Review pass" before starting code

You mentioned a "big recap" to review scope. Let's do that now. The current scope is:

- 17 surviving items (I1, I2, I3, I4, I5, I7, I8, I9, I10, I12, I14, I17, I18, I19, I20, I22, I29)
- 4 new items from R5 (I30, I31, I32, I33)
- 8 items deferred (I6, I11, I15, I16→I30 done, I21→I29 done, I23–I28 cut)
- 1 new question (R5-Q8, R5-Q9)

Is the scope right? Anything else to add / cut?

---

## Next round of questions — full text in message stream

The recap is close to closing. I have 3 final questions to ask:

### R5-Q8. "Psychic" → "Mental" — confirm or not?

Per the spec, source types are "Physical / Magical / Psychic / Hybrid". Per the attributes, they are "physical / mental / magical". You said "Psychic changed to mental" — is this a rename (Psychic and Mental are the same concept, just different names) or are they DIFFERENT (e.g. Psychic = mental magic, Mental = psionic)?

### R5-Q9. Capability "intent" — where does it live?

The capability needs to describe WHAT it does (intent: "fire things up", "stun", "make me invisible", "transform me"). The HOW (how many targets, dice, range) is DM/player table territory.

Question: is the "intent" stored in the existing `capability.description` field, or do we need a new schema field (e.g. `capability.intent` or `capability.sheet_summary`)?

### R5-Q10. Scope review — anything else to add/cut before we start coding?

The current Session I scope is 17 surviving items + 4 new items. Anything else to add? Anything that should be cut further?

If you're ready, we can start coding after this round.
