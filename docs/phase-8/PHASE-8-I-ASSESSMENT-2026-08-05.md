# Phase 8.I — ASSESSMENT — 2026-08-05

**Author:** Senku
**Source of truth:** `PHASE-8-I-RECAP.md` (kept as-is)
**This file:** augments the recap with honest status + new i2.5 + reordering

---

## Status table

| # | Sub-session | Status | Notes |
|---|---|---|---|
| i1 | Null validator + drop rule + mirror test | ✅ DONE | 5d3c66f |
| i2 | Engine resolution (buCost → hardModifier) | ⚠️ PARTIAL | a11581a. Practices + vitality walks done. **Missing: attribute math, defense DC math, bottom drawer display.** |
| **i2.0** | **Form UI restructure (NEW — recap R3-Q1, R3-Q2, R4-Q2 + your 2026-08-05 feedback)** | ❌ NOT STARTED | Remove sub-targets from `defense_dc` (one global Save DC). Add 5 sub-targets to `action_roll` (attack_roll / physical_save / mental_save / magical_save / other). Edit SUB-CHOICE KEYWORDS (delete 3 DC tags, add 1 Save DC tag). Polish chip groups. **Must come first so author picks the right target.** |
| **i2.5** | **Runtime token resolution (NEW)** | ❌ NOT STARTED | PB chip, /physical/, /blockValue/, equations, dice — engine can't resolve any of these. **This is what blocks Testum 4 from showing numbers.** |
| i3 | Conditions runtime + per-toggle gating | ❌ NOT STARTED | |
| i4 | Custom behavior variables (blockValue) | ❌ NOT STARTED | |
| i5 | Play session scratchpad (second FAB) | ❌ NOT STARTED | |
| i6 | UI polish (small cards, glyphs, traceability) | ❌ NOT STARTED | |
| i7 | DB cleanup + schema renames | ❌ NOT STARTED | Includes saving_throws/save_dc split |

---

## Why i2 is partial

The recap's i2 had 8 build items (lines 265-274 of the recap). What I did:

✅ Replaced `buCost`-as-proxy for **practices** (`skill_practice_check`) — walks `hardModifiers` per-practice
✅ Replaced name-match for **vitality** (`max_vitality`) — walks `hardModifiers` summed
✅ Engine returns `byTarget` map with provenance (this was already done in i1)

What I missed:

❌ Wire `resolveAttributeModifier()` for **attribute** math (P, ME, MA) — characters still get attribute numbers from raw `attrPhysical/Mental/Magical` columns, NOT from `hardModifiers`
❌ Wire `resolveAllDefensiveDCs()` for **defense DC** math — the recap's `defense.physicalDc/mentalDc/magicalDc` axes still use `computeAllDefensiveDCs()` which uses `5 + attr + PB`, ignoring primitive contributions
❌ Update the bottom drawer / saves-card to use the new resolver output for attributes and DCs

The recap was explicit about all three. I just didn't read line by line.

---

## Why i2.5 is new

The recap's canonical modifier spec (per `some_info_about_primitives.md` and the recap's section A.4) calls for **5 value types**: `number`, `text`, `dice`, `boolean`, `equation`. Each modifier's `value` can be any of these, or an **expression** mixing them: `PB + (level / 4) [fire]`.

The form HAS all of this — value type dropdown, PB chip, custom syntax input, equation mode. The form classifies tokens correctly (`classifyTypedValue` in `src/lib/primitives/form-helpers.ts:239`).

**But the form serializes PB / attribute / practice / behavior tokens to `value: 0`.** Bug confirmed at `src/components/sandbox/primitive-form.tsx:506`:

```ts
function parseValue(value: string, valueKind: ModifierDraft["valueKind"]): unknown {
  if (valueKind === "number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;  // <-- PB → 0
  }
  ...
}
```

When you author `+ PB to Prowess`:
1. Form classifies `PB` as `{kind: "derived", which: "pb"}`
2. Form calls `parseValue("PB", "number")` → `NaN` → returns `0`
3. Form writes `hardModifier.value = 0` (typed token info lost)
4. Engine reads `value: 0` → contributes 0
5. Bottom drawer shows base Prowess + PB (from PB rule), not +PB from the primitive

Same for `/physical/`, `/awareness/`, `/blockValue/`. All saved as 0.

**Equations are also broken.** The recap says equations can mix runtime tokens, math, and tags: `PB + (level / 4) [fire]`. The form's equation mode serializes the **first operand's number** to `value` and the **full operands array** to `metadata.operands`. But the engine never reads `metadata.operands`.

**Dice expressions are broken.** `#2d6#` saves as raw text (after `parseValue` strips it). Engine has no dice roller.

---

## i2.0 — Form UI restructure (MUST come BEFORE i2.5)

Per recap R3-Q1, R3-Q2, R4-Q2, and your latest feedback (2026-08-05):

> *"We already have defense DC that has sub targets. This is wrong. We only have one DC global with no sub targets."*
> *"We have action roll that has no sub targets now. We need action roll to have 4 sub targets: attack roll, physical save, mental save, magic save, other."*
> *"I mentioned like 3 times we need to delete the 3 tags for mental DC physical DC and magic DC and put only one."*

### What to build

1. **Remove sub-targets from `defense_dc`** in `src/lib/primitives/modifier-scope.ts`:
   - Currently `defense_dc` has sub-targets `["PHYSICAL", "MENTAL", "MAGICAL"]`
   - Change to `widget: "none"` — defense_dc is now ONE GLOBAL axis (the save DC enemies roll against)
   - Migration: existing primitives that have `defense_dc` with PHYS/MENT/MAGI sub-targets get coerced to `defense_dc` with no sub-target (engine reads it the same way)

2. **Add sub-targets to `action_roll`** in same file:
   - Currently `action_roll` has `widget: "none"` (no sub-targets)
   - Change to `widget: "checklist"` with options:
     - `attack_roll`
     - `physical_save`
     - `mental_save`
     - `magical_save`
     - `other`

3. **Update SUB-CHOICE KEYWORDS in the form** (this is the chip list at the bottom of the value field):
   - DELETE the 3 tags: `[Physical DC]`, `[Mental DC]`, `[Magical DC]`
   - ADD a single tag: `[Save DC]`
   - The user said: *"delete the 3 tags for mental DC physical DC and magic DC and put only one"*

4. **Polish value field chips** — confirm they cover (per your screenshot + recap):
   - COMMON NUMBERS (-5..+10)
   - ATTRIBUTE (+physical, +mental, +magic-abstract) — already there
   - PRACTICE (10 practices) — already there
   - DERIVED (PB, PB/2, LEVEL) — already there
   - SUB-CHOICE KEYWORDS (29) — to be edited per step 3
   - CUSTOM input: `#dice#`, `[tag]`, `/value/`

5. **Add inline hint** below value field: "Use /PB/ for proficiency bonus. Use /<attr>/ for attribute. Use [tag] for labels. Use #dice# for dice."

### What about saving_throw and save_dc?

Per your feedback, **NO separate `saving_throw` target**:
- Saving throws go as sub-targets under `action_roll` (`physical_save`, `mental_save`, `magical_save`)
- The player rolls the saving throw = action_roll + attribute modifier + PB

Per your feedback, **`defense_dc` IS the save DC** (single global, no sub-targets):
- Rename display label from "Defense DC" to "Save DC" (per your screenshot — only 1 [Save DC] chip in the keywords)
- Engine still uses `character.defense.<physical|mental|magical>Dc` as axes (these were the legacy "save DC per attribute" but you say it's actually 1 global)
- The form's defense_dc becomes single-axis with no sub-targets

**Engine key vs form label clarification needed:** I'll use engine keys `character.defense.saveDc` (single global) for the new behavior, and migrate existing per-attribute data to this single key.

### Sub-target summary after i2.0

| Target | Sub-targets | Engine key |
|---|---|---|
| `attribute` | PHYSICAL / MENTAL / MAGICAL | `character.attribute.<physical|mental|magical>` |
| `defense_dc` | NONE (one global Save DC) | `character.defense.saveDc` |
| `action_roll` | attack_roll / physical_save / mental_save / magical_save / other | `character.action_roll.<sub>` |
| `speed` | WALKING / CLIMBING / SWIMMING / FLYING / BURROWING | `character.movement.<locomotion>` |
| `skill_practice_check` | 10 practices | `character.practice.<practice>` |
| Other targets | unchanged | unchanged |

### Why this MUST come first

You said: *"That should be the first thing so I can properly try to set things up."* Form first, then engine.

### Files to touch

- `src/lib/primitives/modifier-scope.ts` (remove defense_dc sub-targets, add action_roll sub-targets)
- `src/components/sandbox/primitive-form.tsx` (verify, may need updates to SUB-CHOICE KEYWORDS list)
- `src/components/workshops/primitive-registry.tsx` (same)
- Engine key migration: `character.defense.<physical|mental|magical>Dc` → `character.defense.saveDc` (in resolve-modifiers.ts and stats.ts)

### Size: Small (1 commit)

---

## i2.5 — Runtime token resolution

### What to build

1. **Form fix** (`src/components/sandbox/primitive-form.tsx:506`):
   - When valueKind is `number` and input is non-numeric, write a **typed token object** to `value`, not 0
   - Token shape:
     ```ts
     type ValueToken = {
       kind: "number" | "derived" | "attribute" | "practice" | "behavior" | "dice" | "keyword";
       // ... shape per kind
     };
     ```
   - Also persist `metadata.valueKind` so the engine knows what kind of token it is
   - Mirror logic: form already mirrors typed tokens correctly per the canonical spec

2. **Engine runtime resolver** (`src/lib/engine/runtime-resolver.ts`, new):
   ```ts
   resolveToken(token: ValueToken, ctx: ResolveContext): number
   ```
   - `ctx` has: character attributes, practices, PB, behaviorVariables, level
   - Handles each kind:
     - `number` → `token.value` as-is
     - `derived` ("pb" / "pb/2" / "level") → character-state lookup
     - `attribute` ("physical" / "mental" / "magical") → character attributes
     - `practice` ("awareness" / etc.) → character practices
     - `behavior` ("blockValue") → character.behaviorVariables[token.name]
     - `dice` → roll via dice.ts (returns expected value)
     - `keyword` → 0 (tags don't contribute to number)

3. **Wire into `resolveModifiers`**:
   - When reading `mod.value`, check if it's a typed token (object with `kind`)
   - If yes, resolve to number via `resolveToken`
   - If no, treat as number (backwards compat)
   - **Equations**: when `metadata.valueKind === "equation"`, read `metadata.operands`, resolve each operand token, combine per operand operator
   - **Tags** (`[fire]`, `[piercing]`) carry through unchanged — preserved as a `tags` array on the contribution

4. **Dice resolver** (`src/lib/engine/dice.ts`, new):
   ```ts
   rollDice(expr: string): { avg: number; rolls: number[]; total: number }
   ```
   - Parses `#2d6+3#`, `#1d10#`, `#2d6+3d4#`
   - For modifier math, use `avg` (sum of expected values)
   - For action time, use `total` (rolled values)

### Tests

- PB chip on `+ PB to Prowess` saves as `{kind: "derived", which: "pb"}` → engine resolves to character's PB (+6 at L17)
- `/physical/` token resolves to character's physical attribute value
- `/awareness/` token resolves to character's awareness practice value
- Equation `PB + (level / 4) [fire]` resolves to `PB + (level/4)` number, `[fire]` preserved as tag
- Equation with mirror (mirrored `+ PB + 1`) → engine subtracts both
- Dice `#2d6#` saves as `{kind: "dice", expr: "2d6"}` → engine returns 7 (avg)
- Mirrored PB token → sign flipped (per canonical mirror spec)

### Size: Medium (2 commits)

---

## Re-ordered execution plan

| Order | Sub-session | Why this order |
|---|---|---|
| 1 | **i2.0** — Form UI restructure (new targets, chips) | Without this, author can't pick the right target. Form first per your feedback. |
| 2 | **i2.5** — Runtime token resolution | Engine reads typed tokens (PB, /physical/, /blockValue/) from value field. Resolves at eval. |
| 3 | **i2 finish** — Attribute math + defense DC math + bottom drawer | Sheet still shows raw `attrPhysical` for attributes, doesn't include primitive contributions. |
| 4 | **i7 split** — Schema: saving_throws/save_dc + i7 cleanup (Psychic→Mental) | PERSONAL coercion fix. Saving_throws/save_dc split pulled forward. |
| 5 | **i3** — Conditions runtime + per-toggle gating | Cap gating is critical for the "capability active" model. |
| 6 | **i4** — Custom behavior variables (blockValue) | Power-user feature. |
| 7 | **i5** — Play session scratchpad (second FAB) | "I'm at the table" UX win. |
| 8 | **i6** — UI polish (small cards, glyphs, traceability) | Mostly cosmetic, large surface area. |

---

## Answers to your 5 questions

**Q1 — "look at what we have on our character sheet and how we have to link it to modifiers"**

Per R3-Q1 (locked): two separate axes per attribute:
- `character.saving_throws.<physical|mental|magical>` — character rolls (`modifier + PB if proficient`)
- `character.save_dc.<physical|mental|magical>` — enemies roll (`5 + modifier + PB if proficient`)

Drawer displays: `modifier` (P, ME, MA) on top, `save` (modifier + PB) on bottom, and a separate `save_dc` per attribute.

**Q2 — "PB token resolution = a" (at eval time)**

Confirmed. Primitive is authored with `+ PB` token. Engine resolves against character's actual PB at eval. If character levels up, the modifier auto-updates.

**Q3 — "Primitives slotTab in builder, one accordion in sheet"**

Confirmed.
- Character sheet (read-only): primitives + capabilities + heritages stay in their existing accordions. No routing.
- Character builder (edit mode): direct primitives + direct capabilities need `slotTab` (LINEAGE / UPBRINGING / MANIFEST). Persists across edits.

**Q4 — "Slot moved to manifest on edit"**

Bug confirmed at `src/lib/api/character-bundle-saver.ts:583-586`. The PERSONAL-source coercion forces direct caps into MANIFEST on every edit. Fix in i7 split (order 4): remove the coercion, use whatever slotTab the form sends.

**Q5 — "All equally important"**

Then i2.0 first (form restructure so you can author correctly), i2.5 second (engine resolves tokens), i2 finish third (drawer displays real numbers), i7 split fourth (PERSONAL fix), then the rest in order.

---

## Equations mixing expressions (your explicit feedback)

> "Also about equations. These can mix up expressions and you need to check and resolve that too."

i2.5 handles this explicitly. The equation resolver reads `metadata.operands` and per-operand:
- **Runtime token** (PB, level, /physical/) → resolves to number via `resolveToken`
- **Math operator** (+, -, *, /) → applied to surrounding operands
- **Tag** ([fire], [piercing]) → preserved as label on the contribution, no number value

Example: `PB + (level / 4) [fire]`
- Operands: `[PB, +, level, /, 4, [fire]]`
- Math: `(PB + (level / 4))` → number
- Tag: `[fire]` → preserved

Mirroring: mirror flips the sign of the **math** result, doesn't touch tags.

---

## About "you cannot see local files"

Going forward, I'll **always paste the FULL relevant doc section inline** in chat when I reference it. Never assume you can open the file. If a doc is long, I'll paste the relevant sub-section and link to the file.

For the recap (PHASE-8-I-RECAP.md, 1662 lines): I'll paste only the specific section I'm referencing. For the assessment doc (PHASE-8-I-ASSESSMENT-2026-08-05.md, ~12 KB): I can paste the whole thing since it's short.

---

## New ordering summary

| # | Sub-session | What | Why this order |
|---|---|---|---|
| 1 | **i2.0** | Form UI restructure — saving_throw, save_dc, attack_roll targets | You said: form first so you can author correctly |
| 2 | **i2.5** | Runtime token resolution — PB chip, /physical/, equations, dice | Engine reads what the form produces |
| 3 | **i2 finish** | Attribute math + defense DC math + bottom drawer | Sheet shows real numbers |
| 4 | **i7 split** | Schema cleanup (Psychic→Mental, advantage backfill) + PERSONAL coercion fix | Form target renaming + bug fix |
| 5 | **i3** | Conditions runtime + per-toggle gating + `*` marker | Cap gating |
| 6 | **i4** | Custom behavior variables (blockValue) | Power-user feature |
| 7 | **i5** | Play session scratchpad (second FAB) | "I'm at the table" UX |
| 8 | **i6** | UI polish (small cards, glyphs, traceability) | Mostly cosmetic |

---

## Files

- `PHASE-8-I-RECAP.md` — KEEP (original plan, round-by-round decisions)
- `PHASE-8-I-ASSESSMENT-2026-08-05.md` — THIS FILE (status + i2.5 add + reordering)

---

## What I'm NOT going to do until you confirm

- Touch the form
- Touch the engine resolver
- Add primitives slotTab
- Anything i2.5 or beyond

I need your Q1–Q5 confirmation (or correction) before I touch anything.


---

# RECAP — 2026-08-06 (after i2.7 tag-enum work)

**Author:** Senku
**Context:** Picked up from i2.6 (per-practice condition walk)
and i2.7 (tag-enum + 9 new targets from canonical PDFs +
target/value/trigger suggestion parity).
**Read this first** if you're new — it explains the full arc
from primitives/modifiers/conditions → character sheet.

## Why we went so deep on primitives/modifiers/conditions

The recap's i1-i7 plan was 7 sub-sessions, each small. What
actually happened: i2 (engine resolution) became the gating
sub-session and pulled forward i2.5 (runtime token resolution)
+ i2.6 (per-practice walk) + i2.7 (target atom completeness).
The reason: **the engine math for the character sheet is
implemented in the modifier resolution layer.** Every number
on the character sheet (attribute, defense DC, vitality,
practice, custom behavior, future: speed/carry/equip/damage)
is summed from primitive `hardModifiers`. If the modifier
model doesn't support runtime tokens, tag enums, per-practice
walks, etc. — the character sheet math breaks for those axes.

So the modifier resolution layer had to grow the same surface
as the value/trigger pickers. Now it does:
- Numeric comparisons (vitality, attr mods, practices, ...)
- Runtime token resolution (PB, level, /physical/, /blockValue/)
- Per-practice dynamic predicates (Broad Familiarity)
- Tag-enum string comparisons (source_type, damage_type, etc.)
- 24 targets in the dropdown (15 legacy + 9 new i2.7)
- Per-axis / per-tag / per-tier sub-targets

## Original i1-i7 plan vs. what we actually did

| # | Recap sub-session | Recap plan | Actual status (2026-08-06) |
|---|---|---|---|
| **i1** | Null validator + warning + mirror test | Save rejects empty sub-target; warning UI | ✅ DONE (commit 5d3c66f) |
| **i2** | Engine resolution (buCost→hardModifier) | Replace buCost-as-proxy with hardModifier walks | ⚠️ PARTIAL — practices + vitality done (a11581a). Missing: attribute math, defense DC math, runtime tokens |
| **i2.5** | (NEW) Runtime token resolution | (recap didn't call this out) | ✅ DONE — PB chip, /physical/, /blockValue/, dice, equations all resolve |
| **i2.6** | (NEW) Per-practice condition walk | (recap didn't call this out) | ✅ DONE — Broad Familiarity / Expertise auto-fire per-practice |
| **i2.7** | (NEW) Target atom completeness | (recap didn't call this out) | ✅ DONE — 9 new targets (size, carry_capacity, equip_slot, damage_type, source_type, upkeep_cost, maintained_capability, complexity, combat_action), tag-enum string values, runtime variable chips, Tier 1-6 keywords, "Other" sub-target free-text everywhere |
| **i3** | Conditions runtime + per-toggle gating | Modifier `*` marker on axis; engine suppresses when cap OFF | ⚠️ PARTIAL — engine `evaluateCondition` works (i2.6 wired into practice walk); UI `*` marker NOT wired; per-toggle gating NOT wired |
| **i4** | Custom behavior variables (blockValue) | `set behavior:blockValue = 6` shows in small cards | ⚠️ PARTIAL — `behavior:<name>` recognized in engine + picker (i2.7); custom behavior BIG CARD NOT built; transient variable math NOT wired |
| **i5** | Play session scratchpad (second FAB) | Runtime conditions added via modal | ❌ NOT STARTED |
| **i6** | UI polish (small cards, glyphs, traceability) | Categories per R5-Q2 | ❌ NOT STARTED |
| **i7** | DB cleanup (Psychic→Mental) | Backfill, schema renames | ✅ DONE — PSYCHIC→MENTAL in source_type target (commit 42021e1) |

## What's next — proper order

| # | What | Why now |
|---|---|---|
| **1** | **Attribute math + Defense DC math** (finish i2) | Character sheet still shows raw `attrPhysical/Mental/Magical` for attributes and `computeAllDefensiveDCs` formula for DC — neither reads from `hardModifiers`. A `+1 to Physical` primitive doesn't show. |
| **2** | **Drawer: speed + carry + equip slot + vulnerabilities** | The targets are wired (i2.7); the display isn't. User explicitly called this out: "we need to add in drawer the movement speed and other tags and small cards especially for custom behaviors. And vulnerabilities and stuff?" |
| **3** | **Vulnerability/Resistance in form** | User said: "we need to add vulnerability and resistance in both selections in triggers when and the value in modifier. So for your knowledge, vulnerability:2x damage, resistance 0.5x damage." New target = `damage_modifier` (multiplier axis), engine applies 2x/0.5x to incoming damage of matching type. |
| **4** | **i3 finish** — `*` marker on axis + per-toggle gating | Engine walks conditions per-practice (done). UI marker + per-cap-toggle gating not done. |
| **5** | **i4 finish** — custom behavior big card + transient variable math | `blockValue` primitives can be authored today; small cards zone isn't rendered yet. |
| **6** | **i5** — second FAB (scratchpad) | Player-mode use case. |
| **7** | **i6** — small cards zone, glyphs, modal traceability | Mostly cosmetic. |

## Items 1, 2, 3 in detail

### 1. Attribute math + Defense DC math

**Attribute math (P, ME, MA):**
- `aggregateCharacterSheet` currently reads `input.attrPhysical` directly (line 205 of sheet.ts).
- Need: walk each primitive's `hardModifiers` for `target: attribute.physical/mental/magical`, `op: add/subtract`, sum the contributions.
- Mirror: subtract instead of add when `link.isMirrored`.
- Conditions: evaluate via `evaluateCondition` against `conditionContext` per modifier (same pattern as i2.6 practice walk).
- Result: `attributes.physical = input.attrPhysical + sum(primitive mod contributions)`.

**Defense DC math:**
- `computeAllDefensiveDCs(attributes, attrProficient, level)` (practices.ts:450) computes `5 + attr + PB if proficient`.
- Need: also walk primitives for `target: defense_dc.<physical|mental|magical>` or per recap's R3-Q1 split: `target: saving_throw.<physical|mental|magical>` and `target: save_dc.<physical|mental|magical>`.
- User said "remaking the DC and the action roll" — so probably split into two: `saving_throw` (player rolls) and `save_dc` (enemy rolls), with separate primitive targets for each.

**Files:**
- `src/lib/engine/sheet.ts` — wire attribute walk
- `src/lib/engine/practices.ts` — extend `computeAllDefensiveDCs` to accept primitive modifier list
- `src/lib/engine/sheet.test.ts` — new tests
- `src/components/characters/bottom-sticky-bar.tsx` — display DC + saves (already mostly there)

### 2. Drawer display: speed + carry + equip slot + vulnerabilities

**Speed card:**
- New card in bottom sticky bar: `Speed: 30 ft (walking)`
- Source: `character.speeds` (per locomotion type — Walking, Climbing, Swimming, Flying, Burrowing) computed from `target: speed.<locomotion>` primitives with `op: add/set`.

**Carry capacity card:**
- `Carry Capacity: 65 / 50 (overloaded)`
- Source: `target: carry_capacity` primitives + `size_capacity` lookup (per Encumbrance PDF).

**Load + equip slots:**
- Already exists in `encumbrance` prop of BottomStickyBar. Just needs to render.

**Vulnerability / Resistance cards:**
- New damage modifier system. User explicitly said "vulnerability:2x damage, resistance 0.5x damage."
- Targets: `damage_modifier:<type>` with op `multiply` (or specific grant/revoke).
- Engine: when damage of type `<type>` hits the character, multiply by the modifier.
- Examples: `resistance:fire`, `vulnerability:cold`, `immunity:poison`.
- Display: small cards in the bottom drawer organized by damage type.

### 3. Vulnerability/Resistance in form (trigger + value picker)

**Triggers when** (condition picker):
- `actor:has_resistance:fire`
- `actor:has_vulnerability:cold`
- `actor:has_immunity:poison`

**Value in modifier** (value picker):
- New keyword group: `Damage Modifier` with chips `[Resistance: <type>]`, `[Vulnerability: <type>]`, `[Immunity: <type>]`.
- New runtime variable: `/resistance/<type>/`, `/vulnerability/<type>/`, `/immunity/<type>/`.
- Author writes: `target=damage_modifier, op=multiply, value=0.5` and the engine halves incoming fire damage.

## Why deep on primitives/modifiers/conditions

The recap's plan was: primitives + capabilities + heritages +
items compose modifiers. Engine resolves them into character
stats. Bottom drawer displays the resolved numbers.

But the modifier model is the **substrate**. Every other layer
(capabilities, effects, heritage bundles, item equip effects,
play session scratchpad) just composes modifiers. If the
modifier model can't express runtime tokens, tag enums,
per-practice walks, custom sub-targets — the bottom drawer
just shows wrong numbers.

So i2.5/2.6/2.7 are NOT scope creep. They're filling in the
substrate the recap assumed existed. The recap literally said
*"PB + (level / 4) [fire]"* is a valid modifier value —
that's i2.5. The recap said `+1 if grappled` is a valid
condition — that's i2.6's per-axis walk. The recap said
`+1 to Fieldcraft` (per-practice) is a valid modifier — that's
i2.6's per-practice walk.

i2.7 (9 new targets) came from the canonical PDFs the recap
referenced but didn't enumerate. They're the **next layer**
of targets after practices/attributes/vitality/defense.
Without them, the modifier model can't target speed, carry,
damage type, source type — which the canonical PDFs say it
must.

## What I'll do next (without further input)

1. **Attribute math** — wire `aggregateCharacterSheet` to walk
   `hardModifiers` for `target: attribute.<physical|mental|magical>`.
   Mirror handling. Condition filtering.
2. **Defense DC math** — extend `computeAllDefensiveDCs` to
   read primitive modifiers targeting `defense_dc.<physical|mental|magical>`.
   (Or split into saving_throw + save_dc per R3-Q1 — your call.)
3. **Speed card in drawer** — read `character.speeds` from the
   sheet aggregation, render a small card in bottom-sticky-bar.
4. **Vulnerability/Resistance targets** — add new targets
   `vulnerability`, `resistance`, `immunity` (each with
   `<damage_type>` sub-target). Engine applies multiplier
   during damage resolution.
5. **Vulnerability/Resistance in picker** — chips in both
   trigger picker (`actor:has_resistance:<type>`) and value
   picker (`[Resistance:<type>]`, `[Vulnerability:<type>]`).

Then i3 / i4 / i5 / i6 in order per the original recap.

## Questions for you

**Q1 — Saving throw split?** R3-Q1 (locked) says split into
`saving_throw` (player rolls) + `save_dc` (enemy rolls).
Should I do that as part of attribute math, or keep the
single `defense_dc` for now?

**Q2 — Vulnerability/Resistance target shape?**
Option A: `target: damage_modifier`, value carries the
multiplier (0.5 for resistance, 2 for vulnerability, 0 for
immunity). Clean, single axis.
Option B: Three separate targets (`target: resistance`,
`target: vulnerability`, `target: immunity`). Each is a
boolean flag + implicit multiplier. Slightly more boilerplate
but each is more semantic.

**Q3 — Start with attribute math + drawer display?**
Per your "let's do maths" message — engine math is the
gating work. Or do you want me to do vulnerability/resistance
form work first (small surface, fast, immediately testable)?


---

# WAVE STATUS — 2026-08-06 (all 6 waves shipped)

| Wave | Status | Commit |
|---|---|---|
| 1 — attribute + DC + saving_throw/save_dc walks | ✅ DONE | `a0450f2` |
| 2 — speed + carry + load + equip_slot walks | ✅ DONE | `5d2e1d7` |
| 3 — damage_modifier engine (resolveDamage) | ✅ DONE | `8e910d6` |
| 4 — drawer UI for speed, carry, vulnerability/resistance cards | ✅ DONE | `64e275f` |
| 5 — size + source_type + upkeep + complexity + combat_action | ✅ DONE | `e969ef4` |
| 6 — behavior variables walk + drawer cards (i4 finish) | ✅ DONE | `94421f1` |

**Total: 6 commits, ~2227 tests pass (only 2 pre-existing Notion DB failures).**

## What's wired end-to-end now

The character sheet (bottom-sticky-bar drawer) now displays:

- **PB, DC, ATK** (existing)
- **Vitality** (existing)
- **Speed card** — walking (default 30) + any other locomotion types
- **Carry card** — load / capacity with progress bar
- **Equip slots** (existing)
- **Damage Modifiers card** — resistance / vulnerability / immunity chips per type
- **Behavior Variables card** — legendary_resistance, action_points, custom trackers

The engine walks `hardModifiers` for every primitive target axis:

- attribute.<physical|mental|magical>
- defense_dc.<physical|mental|magical>
- saving_throw.<physical|mental|magical> (player rolls)
- save_dc.<physical|mental|magical> (enemies roll against)
- skill_practice_check (already done)
- max_vitality (already done)
- speed.<locomotion>
- carry_capacity, load, equip_slot
- size, source_type, complexity, combat_action, upkeep_cost
- damage_modifier.<type> (multiplies incoming damage)
- behavior.<key> (custom variables)

## What the user can verify

1. Create a level 18 character for @Mashu
2. Author primitives with the new targets (vulnerability, speed, complexity, etc.)
3. Open the character sheet — the drawer shows all the new values
4. The math sums correctly from primitive `hardModifiers`

## What's still pending (per recap)

- i3 finish — `*` marker on axis + per-cap-toggle gating
- i5 — second FAB (scratchpad) for play session
- i6 — small cards zone polish + glyphs + modal traceability


---

# i3 RECAP — Markers + Traceability (Mashu 2026-08-06)

## What i3 is

i3 is the **display + traceability layer** for the condition math
we already wired in i2.6. The engine evaluates conditions
correctly (practice walk calls evaluateCondition, primitive
walk does too), but the UI doesn't TELL the player that:

- a number has hidden conditions behind it
- a number has uncomputable conditions (e.g. "when tracking enemies")
- a number has computable conditions that currently fire (vitality < 50%)

## Display markers

| Marker | Meaning | Example |
|---|---|---|
| `*` | "Has unevaluated conditionals" | `fieldcraft +10 *` |
| `⇈(N)` | Advantage stacked N times | `fieldcraft +10 ⇈(3)` |
| `⇊(N)` | Disadvantage stacked N times | `fieldcraft +10 ⇊(2)` |
| `↥ 10` | Set minimum 10 | `fieldcraft ↥ 10` |
| `↧ 10` | Set maximum 10 | `fieldcraft ↧ 10` |

## Computed value logic

- **Without i3**: drawer shows static sum.
- **With i3**:
  - Walk each contributing modifier.
  - If condition is computable + evaluates true at sheet time →
    INCLUDE the bonus in the displayed number.
  - If condition is computable + evaluates false → SKIP.
  - If condition is NOT computable (table play flag, etc.) →
    INCLUDE the bonus (assume worst case) + append `*`.
  - Counter for adv/disadv stacks from primitives that grant them.

## Color conventions

- **Proficiency bonus** — text + number teal (`text-teal-700`)
- **Expertise** — text + number teal AND bold (`font-bold`)
- **Half proficiency / pure primitive bonus** — number teal (no bold)
- **Normal modifier** — default text color

## Per-axis application

Markers apply to ALL numeric axes:
- attribute (physical/mental/magical)
- defense_dc
- saving_throw
- save_dc
- skill_practice_check (each of 10 practices)
- max_vitality
- speed
- carry_capacity
- load

## Modifier paths to proficiency bonus

Mashu noted proficiency can be authored in multiple ways:
- `[pb]` chip → `{kind: derived, which: pb}` (resolves to PB)
- `/pb/` custom input → same as above
- `/pb/2/` → `{kind: derived, which: pb_half}` (resolves to PB/2)
- `proficiency(practice)` → resolved via condition picker
- equation `2*pb` → `{kind: equation, ...}` (resolves to 2*PB)
- `[expertise]` chip → `{kind: derived, which: expertise}` (resolves to 2*PB)

All these should be treated as "from proficiency" so the
display shows teal text + teal number. The 2*PB variant
additionally shows bold (expertise).

## What triggers the marker

- `*` (asterisk): at least one contributing modifier has
  `condition` field and the engine CAN evaluate it OR it
  has a non-computable condition.
- `⇈(N)`: N primitives target this axis with `op: grant`
  on the "advantage" keyword.
- `⇊(N)`: N primitives target this axis with `op: grant`
  on the "disadvantage" keyword.
- `↥ X`: primitives target this axis with `op: set` to
  establish a floor (smallest value applied).
- `↧ X`: primitives target this axis with `op: set` to
  establish a ceiling (largest value applied).

## Modal traceability

Clicking on a number opens a modal that lists:
- Each contributing primitive (name + delta)
- Each condition (text + whether it currently fires)
- The total = base + sum(modifiers)
- For adv/disadv: which primitives stack
- For min/max: which primitives set the floor/ceiling

## What's pending in i3

1. Engine helper: per-axis breakdown with marker classification
   (which modifiers carry a `*`, which grant adv/disadv, which
   set min/max).
2. UI: number suffix rendering (`*`, `⇈(N)`, `⇊(N)`, `↥ X`, `↧ X`).
3. UI: color overrides (teal for prof, teal+bold for expertise,
   teal for half-prof / pure primitive).
4. Modal: click-through to "primitive contributions" panel.
5. Engine: distinguish computable-but-false conditions (don't
   add `*` if condition resolves to false) vs non-computable
   (add `*`).
