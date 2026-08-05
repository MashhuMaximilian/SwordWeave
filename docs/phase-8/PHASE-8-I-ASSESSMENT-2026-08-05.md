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
