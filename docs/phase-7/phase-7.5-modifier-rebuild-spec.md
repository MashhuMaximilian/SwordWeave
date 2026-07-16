# Phase 7.5 — Modifier Rebuild Spec (v3 — FINAL)

> Locked 2026-07-16 after the "primitives are the base of everything"
> discussion. This supersedes v1 (chiral-pairs) and v2 (per-op value-type
> matrix). The v3 model: **primitives are flat building blocks, modifiers
> describe how they compose, the resolver soft-warns at character-sheet
> render time.**

---

## The Primitive Model

A **primitive** is a single building block. The same shape serves every
kind of primitive — number stat, boolean flag, tag, verb, mechanic, or
just flavor text. The category is emergent from the composition, not a
stored field.

A primitive carries:

- **Identity**: name, icon, lexicon tier, BU cost, visibility
- **Description**: mechanical text (short), verbose narrative rule
- **Modifiers** (optional): the list of (target × op × value-type × value
  × stack-rule) tuples that describe what this primitive does
- **Conditions** (optional): triggers-when — the conditions under which
  the modifiers fire

**Modifiers are optional.** Many primitives are just flavor and exist so
capabilities/effects/character sheets can reference them by name. The
primitive form must handle the empty-modifiers case gracefully.

### What a Primitive Is Not

- Not a "type" — there's no stat-vs-flag-vs-tag enum. The same JSON shape
  is used for all of them.
- Not tied to a category. A primitive can be a number (`Block = 12`), a
  boolean (`is_blind`), a tag (`darkvision`), a verb (`dodge`), or a
  mechanic that references other primitives (`subtract block from
  damage when holding shield`).
- Not mirrored. Mirror logic lives in the **capability/affect** that
  invokes the primitive, not in the primitive itself.

---

## Operations (9 total)

The op list is the canonical vocabulary for "how does this modifier
change the world."

| Op | Meaning | Example |
|---|---|---|
| `add` | Add the value to the target | Add 2 to Physical |
| `subtract` | Subtract the value from the target | Subtract 1d4 from damage |
| `multiply` | Multiply the target by the value | Multiply damage by 2 |
| `divide` | Divide the target by the value | Divide speed by 2 |
| `min` | The target cannot go below this value | Min speed = 0 |
| `max` | The target cannot exceed this value | Max size = Huge |
| `set` | Set the target to the value | Set is_blind = true |
| `grant` | Add a behavior/tag/state | Grant darkvision 60ft |
| `revoke` | Remove a behavior/tag/state | Revoke darkvision |

**Removed from v2:** `bias` and `toggle`.
- `bias` (advantage/disadvantage): replaced by `grant`/`revoke` on the
  canonical `behavior:advantage` and `behavior:disadvantage` chips.
- `toggle`: replaced by `set` to true/false. No need for a dedicated op.

---

## Value Types (4 total)

Value Type declares the **author's intent** for the value. The chip-stack
picker is filtered by Value Type to keep the picker manageable.

| Value Type | Accepts Token Kinds | Examples |
|---|---|---|
| `number` | `number`, `attribute`, `practice`, `derived` | `2`, `+physical`, `+PB`, `+1` |
| `text` | `behavior` (with free-text values), `text` | `"60 ft"`, `"walking"`, `darkvision range` |
| `dice` | `dice` | `1d4`, `6d12`, `2d6+3` |
| `boolean` | `boolean` | `true`, `false` |

### Why Token Kinds Cross Over

- `+physical` is a `attribute` token, but it resolves to a number at
  character-sheet time. So Number Value Type accepts attribute tokens.
- `+block` (referencing a user-created primitive) is a `behavior` token,
  but it can resolve to a number OR text. So both Number and Text Value
  Types accept behavior tokens (the resolver determines context at slot
  time).

The chip picker shows the right tokens for the chosen Value Type, but
the resolver is the source of truth for what the token actually does.

---

## Operation × Value Type Constraint Matrix

| Op | Allowed Value Types |
|---|---|
| `add` | number, dice |
| `subtract` | number, dice |
| `multiply` | number, dice |
| `divide` | number, dice |
| `min` | number, text |
| `max` | number, text |
| `set` | number, text, dice, boolean |
| `grant` | number, text, dice |
| `revoke` | number, text, dice |

**Notes:**
- Add/Subtract/Multiply/Divide: numeric only. No text (text has no
  numeric meaning).
- Min/Max: numeric or text bounds. Min speed = 0 (number); Max size =
  Huge (text).
- Set To: universal setter. Accepts anything including boolean.
- Grant/Revoke: anything except boolean. Boolean grant/revoke is just
  `set` to true/false.

---

## Chip Catalog (scoped per target axis)

When the user picks a target axis, the chip picker shows chips relevant
to that axis first, with attribute/practice/derived chips always
available as cross-references.

### Per-axis canonical chips

| Target axis | Canonical chips |
|---|---|
| `attribute` | `physical`, `mental`, `magic-abstract` |
| `practice` | `awareness`, `fieldcraft`, `medicine`, `survival`, `intimidation`, `performance`, `lore`, `crafting`, `stealth`, `athletics` |
| `defense_dc` | `physical_defense`, `mental_defense`, `magical_defense` |
| `speed` | `walk`, `burrow`, `climb`, `fly`, `swim` |
| `max_vitality` | `base`, `temp`, `max_bonus` |
| `current_vitality` | `current`, `temp_hp`, `lost` |
| `proficiency_bonus` | `PB`, `PB_half`, `PB_double` |
| `action_roll` | `attack_bonus`, `save_dc`, `check_bonus` |
| `skill_practice_check` | one chip per practice (mirrors `practice` chips) |
| `damage_healing_output` | `slashing`, `piercing`, `bludgeoning`, `fire`, `cold`, `lightning`, `acid`, `poison`, `psychic`, `necrotic`, `radiant` |
| `targeting` | `range`, `aoe`, `shape`, `size` |
| `duration` | `rounds`, `minutes`, `hours`, `concentration` |
| `strain` | `current_strain`, `max_strain` |
| `item_slot_cost` | `hands`, `slots` |
| `scene_pace` | `round`, `scene`, `day`, `session` |
| `behavior` | free-form: `darkvision`, `mana_pool`, `block`, `advantage`, `disadvantage`, `is_blind`, `is_stunned`, `is_prone`, `is_grappled`, `is_poisoned`, `invisible`, `concentrating`, etc. |

### Always-available cross-references

- `attribute` tokens: `physical`, `mental`, `magic-abstract`
- `practice` tokens: 10 canonical practices
- `derived` tokens: `PB`, `PB_half`, `PB_double`, `level`
- `number` tokens: literal ints/floats
- `dice` tokens: canonical dice sizes + custom expressions
- `behavior` tokens: every user-created primitive (loaded from DB) +
  ad-hoc custom names

### Custom ad-hoc chips

The picker always allows the user to type a custom name that isn't in
any list. This creates a new chip on the fly. The chip carries
`kind: "behavior"` (the most general kind for free-form references)
unless the user explicitly picks a different kind.

This is the **flexibility** you asked for: any primitive can reference
any other primitive by name, including ones the user just invented.

---

## Stack Rules (6 total)

| Rule | Meaning |
|---|---|
| `stack` | Accumulate all instances of this primitive. (Default) |
| `highest-only` | Keep only the instance with the highest numeric value. |
| `lowest-only` | Keep only the instance with the lowest numeric value. |
| `unique-by-primitive` | Multiple primitives of the same name don't stack — the latest one wins. |
| `unique-by-target` | Multiple primitives targeting the same axis don't stack — the latest one wins. |
| `replace` | This primitive's value fully replaces whatever was there, no merging. Explicit override. |

`replace` is the new addition (v3). It's similar to `unique-by-primitive`
but more explicit: "I hard-override." Use this when you want the
character sheet to show exactly the new value with no ambiguity.

---

## Mirroring (moved to capability/affect layer)

The primitive form has **no mirror UI**. The Mirror Vector card is gone.

Mirror logic lives in the capability/affect that **uses** the primitive:
- A capability declares "I am mirrorable."
- When the capability is invoked in a mirrored context, the capability
  chooses which of its primitive's modifiers to mirror (and how).
- The primitive doesn't know or care whether it's being mirrored.

This is Phase 8 work (capability/affect layer). For now, primitives
just describe their effect without mirror metadata.

---

## Resolver Semantics (soft-warning at character-sheet render time)

The character sheet has a template that pre-loads canonical primitives
(system-provided). The character's own authored primitives are added on
top. Capabilities and affects contribute their primitives when active.

Composition order:
1. Start with template primitives (system-provided).
2. Apply character-level overrides (race, class, background primitives).
3. Apply capability/affect primitives (active effects).
4. Resolve stack rules per modifier.
5. Resolve cross-references (`+behavior:block` → look up the resolved
   value of the `block` primitive).
6. Compute final values for numeric targets.
7. **Soft-warn** on anything that couldn't resolve or looked weird.

### Soft-warning examples

| Scenario | Warning |
|---|---|
| `+physical` but the character has no Physical attribute defined | "Physical modifier is 0 (attribute not set)" |
| `+block` references a primitive that doesn't exist on the character | "Block reference not found — using 0" |
| `min speed = -5` (negative speed) | "Min speed is negative — likely an authoring error" |
| Grant `darkvision 60ft` and another primitive tries to grant `darkvision 120ft` with `stack: replace` | "Darkvision 60ft replaced by Darkvision 120ft" (informational) |
| `multiply damage by 0` | "Damage multiplier is 0 — this attack deals no damage" |

Warnings are surfaced as yellow badges on the character sheet, never
red errors. The character sheet always renders something.

---

## Form Structure

The primitive form has these sections (in order):

1. **Identity**: name, icon, lexicon tier, BU cost, visibility
2. **Descriptions**: mechanical text (short), verbose narrative rule
3. **Modifiers**: list of (target × op × value-type × value × stack-rule) tuples. Empty list is allowed.
4. **Conditions**: triggers-when. The "when does this modifier fire" section.
5. **Stack Rule** (per modifier): one of the 6 rules.

The Mirror Vector card from v1/v2 is **gone**.

### Modifiers subsection UX

Each modifier row has:
- **What changes?** — target axis dropdown (15 options including behavior)
- **Operation** — op dropdown (9 options, no bias/toggle)
- **Value Type** — dropdown filtered by op (number/text/dice/boolean)
- **Value** — chip-stack, filtered by Value Type, scoped to target axis
- **Stack Rule** — 6 options

The chip-stack picker is grouped:
- **Common** — the most-used chips for the current target axis
- **Canonical** — all chips for the current target axis
- **Cross-references** — attribute/practice/derived/number/dice tokens
  (always available)
- **User primitives** — primitives the user has created (loaded from DB)
- **Custom** — text input for an ad-hoc chip name

Each chip has a tooltip explaining what it resolves to.

---

## Out of Scope for Phase 7.5

- Capability/Affect layer (Phase 8) — mirror logic, invocation
- Character sheet template system — what primitives get pre-loaded
- Resolver implementation details — the soft-warning hooks exist but the
  full resolver is Phase 8
- Visual character sheet rendering — Phase 8+
- BU calculation engine — already exists, no changes

---

## Decisions Locked

- **9 ops** (no bias, no toggle)
- **4 value types** (number/text/dice/boolean)
- **6 stack rules** (stack/highest/lowest/unique-by-primitive/unique-by-target/replace)
- **15 target axes** including `behavior`
- **No mirror in primitive** (moved to capability/affect layer)
- **Chip catalog scoped per target axis** with cross-references always available
- **Custom ad-hoc chips allowed** (free-form text input)
- **Soft-warn at character-sheet render time** (never hard-error)
- **Modifiers are optional** (primitives can be just flavor)
- **Primitives are composed JSON** (no stored category enum)