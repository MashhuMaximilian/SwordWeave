# Phase 8.I — Engine Math Cluster (Modifiers → Numbers + Tags)

**Author:** Senku
**For:** Mashu — review & answer the remaining open questions before any implementation work
**Status:** 🟡 Recap + question-collection phase. Rounds 1–3 answered 2026-08-04. Round 4 pending.
**Started:** 2026-08-04
**Origin:** Session I from the master plan (post-Sessions G + H which closed on 2026-08-04)

---

## Image evidence (round 3, 2026-08-04)

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
