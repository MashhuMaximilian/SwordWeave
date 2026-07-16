# Phase 7.5 — Modifier Rebuild (draft 3)

**Status:** revised after your 2026-07-16 message. Implementation
blocked on the 4-field model below being correct.

## TL;DR — what just changed

I was over-engineering. Looking at your screenshots and message,
the **real** model is much simpler than what I wrote in the
previous spec:

- **4 fields define a modifier:**
  1. **What changes** — which engine axis the modifier targets
     (Attribute, Action Roll, Vitality, Practice, etc.). NOT
     relevant to chirality.
  2. **Operation** — Add/Subtract/Multiply/Divide/Set To/Minimum/
     Maximum/Grant/Revoke/Toggle/**Bias**. The chiral pair comes
     from the operation in most cases.
  3. **Value Type** — Number / Text / Dice / Keyword / True / False.
     Some ops only accept some value types. Value type ALSO
     affects mirrorability.
  4. **Value** — the actual magnitude. Mixed-type input (number,
     text/dice/keyword, true/false, or Bias-specific
     "advantage"/"disadvantage"). Supports pre-existing condition
     keys like `+strength` or `+proficiency_bonus`.
  5. **Stacking Rule** — stack / highest / lowest / unique by
     primitive / unique by target.

## Operation × Value Type constraint table (from your message)

This is the **canonical constraint matrix**. The form UI
must enforce these — when the user picks an op, the Value Type
dropdown only shows the allowed types.

| Operation | Allowed Value Types | Mirrorable? | Mirror Behavior |
|---|---|---|---|
| Add | Number | YES | flip to Subtract, value sign flips |
| Subtract | Number | YES | flip to Add, value sign flips |
| Multiply | Number | YES | flip to Divide, value becomes reciprocal |
| Divide | Number | YES | flip to Multiply, value becomes reciprocal |
| Minimum | Number | YES | flip to Maximum, same value |
| Maximum | Number | YES | flip to Minimum, same value |
| Set To | Number, Text/Dice/Keyword, True/False | NO | (permission-locked) |
| Grant | Text/Dice/Keyword | YES | flip to Revoke |
| Revoke | Text/Dice/Keyword | YES | flip to Grant |
| Toggle | True/False | YES | flip the value (T→F, F→T) |
| **Bias** | Text/Dice/Keyword | YES | flip "advantage"↔"disadvantage" |

**Notes from your message:**

- "Set to is not mirrorable" — confirmed.
- "Toggle is not self-mirrorable per se, but its mirror is given
  by value field" — confirmed. Mirror of Toggle (True) is
  Toggle (False), same op.
- **Bias** replaces what I called `advantage`/`disadvantage` as
  separate ops. Single op, value flips on mirror.

## Mirrorability is NOT just about the operation

Re-reading your message: "**value type (number and text are not
mirrorable, but true/false is)**" — this is a refinement.

Wait — Number IS mirrorable for Add/Subtract/Multiply/Divide/Min/Max.
The mirror flips the op AND adjusts the value. So "Number is
not mirrorable" in isolation is false; it's "Number is mirrorable
when paired with the right op."

Let me re-read: "**Value type** (number and text are not
mirrorable, but true/false is.)" — I think you meant this in the
context of Set To. Set To with Number is not mirrorable (no
subtract-from-a-set-value). Set To with True/False is mirrorable
(Toggle). That maps cleanly:

- **Set To + Number** → not mirrorable.
- **Set To + Text** → not mirrorable (no "negative text").
- **Set To + True/False** → behaves like Toggle, mirrorable.

So the **real mirrorability rule** is:
- Add/Subtract/Multiply/Divide/Min/Max + Number → mirrorable.
- Grant/Revoke + Text/Dice/Keyword → mirrorable.
- Toggle + True/False → mirrorable.
- Bias + Text/Dice/Keyword → mirrorable.
- **Set To + anything → not mirrorable.**

The form enforces this by hiding the Mirror toggle when the
op/value-type combo is non-mirrorable.

## BU cost (clarified)

"**BU cost is only per primitive not per modifier.**"

So my "2 BU toll on Advantage/Disadvantage" was wrong. The BU
cost is fixed per primitive (the canonical table from the Notion
doc, e.g. Negative Bias I = 3 BU, Vitality Core Augment I = 4 BU,
Stride Extension = 5 BU). The mirror credit is the same value
(3 BU for Negative Bias I, etc.).

When a primitive is mirrored, the player gets a BU credit equal
to the primitive's BU cost. That's it. No toll stacking math
needed at the modifier level — that's runtime/character-sheet
level work.

## Stacking rules (refined)

"if they stack, only the highest or lowest, if it's unique by
primitive or target (in these 2 it doesn't really interfere I
guess?)"

Five stacking rules:
- **stack** — multiple instances all apply (sum/aggregate).
- **highest** — only the largest magnitude applies.
- **lowest** — only the smallest magnitude applies.
- **unique by primitive** — only one instance of this primitive
  can apply at a time.
- **unique by target** — only one modifier per target stat can
  apply at a time.

The last two don't interact because they're already "unique"
by construction — but they're listed for completeness.

## Value field — pre-existing condition keys

You mentioned wanting to type `+strength` or `+proficiency`
directly in the value field. That's a request for an autocomplete
on the Value input that knows about pre-existing condition keys:

- **+strength, +agility, +finesse, +physique, +willpower,
  +intelligence, +presence** (the 7 core attributes from the
  canon)
- **+proficiency_bonus** (PB shorthand)
- **+level**, **+attribute_modifier**, **+proficiency** (more
  derived values)
- **dice expressions** (`1d4`, `1d6`, `2d8+3`)
- **keywords** (`grappled`, `prone`, `stunned`, `silenced`,
  `deafened` — the standard condition set)
- **plain numbers** (for set_to / add / subtract)

The form's Value input should autocomplete against this list. The
user can also type a raw number — that's the simple case.

## What changes per the screenshots

I see 4 fields visible in the current UI:
- What changes? (dropdown) — engine axis target.
- ATTRIBUTE — LEAVE EMPTY FOR "ANY" — multi-checkbox for
  Physical/Mental/Magical axes.
- Operation + Value Type (paired).
- Value + Stacking Rule (paired).

The 3rd screenshot shows the Value Type dropdown expanded:
**Number / Text / Dice / Keyword / True / False.** Currently
"Text / Dice / Keyword" appears as ONE option in the dropdown,
not three separate ones. (Or maybe it's a misread — let me
default to keeping it as 3 separate types per your message.)

The 4th screenshot shows the Operation dropdown: **Add / Subtract /
Multiply / Divide / Set To / Minimum / Maximum / Grant / Revoke /
Toggle.** No Bias yet. We add Bias.

## What this means for the 13 "chirality violations"

Reframing (you said "they are made by system, but otherwise I
don't know what you mean by authoring"):

The 13 primitives were flagged `is_mirrorable=true` but have no
modifier. **We don't manually author modifier definitions for
them.** The system generates the modifier from the primitive's
canonical metadata (its name, its category, the BU table in
Notion). When a primitive has a modifier:
- Its `is_mirrorable` flag is set automatically based on the op.
- Its mirror op is derived from `OP_SPECS`.
- Its BU credit on mirror is the primitive's own BU cost.

The 150 zero-modifier primitives stay zero. They're namespace
(verbs, domains, durations, etc.) and don't have modifier
mechanics. They're not "chirality violations" — they're just
empty. The "chirality violation" framing in my old spec was
wrong.

**Net effect of Phase 7.5:** we just need the form to handle
the 11-op model correctly (op/value-type constraints, mirror
button visibility, mirror toggle behavior). We don't have to
backfill modifier definitions for the 150 empty primitives.

## Implementation milestones (revised)

### Milestone 1 — OP_SPECS and value-type constraint map

- Add `ModifierOperation` type (11 ops, including Bias).
- Add `ValueType` type (Number / Text / Dice / Keyword /
  True/False).
- Add `OP_VALUE_TYPE_MATRIX`: a Record<Operation, ValueType[]>
  enforcing the constraint table.
- Add `OP_SPECS` (mirror op, mirror behavior, mirrorable flag).
- Update `src/types/modifier.ts` (or split out if too long).

Estimated: 1-2 hours.

### Milestone 2 — Form UI updates

- `primitive-form.tsx`: replace the operation `<select>` with a
  proper dropdown matching the screenshots.
- Wire Operation → Value Type options (only show allowed types).
- Wire Value input to switch render-mode based on Value Type:
  - Number → `<input type="number">`.
  - Text/Dice/Keyword → `<input>` with autocomplete dropdown.
  - True/False → `<select>` with True/False options.
  - Bias → `<select>` with Advantage/Disadvantage options.
- Add autocomplete vocabulary: 7 attributes, PB, level,
  attribute_modifier, proficiency, dice patterns, standard
  conditions (grappled, prone, stunned, silenced, deafened,
  etc.), plain numbers.
- Wire Mirror toggle:
  - Hide entirely when op/value-type combo is non-mirrorable.
  - When clicked, swap op to mirror op and adjust value per
    `OP_SPECS[op].mirrorBehavior`.

Estimated: 3-4 hours.

### Milestone 3 — Chirality indicator

- Small badge on the primitive form showing "Mirrorable" /
  "Non-mirrorable" / "Self-mirroring" status, derived live from
  the current op/value-type combo.
- Tooltip explains why: e.g. "Set To with Number is
  permission-locked; cannot be inverted."

Estimated: 1 hour.

### Milestone 4 — Tests

- Constraint matrix: for each (op, value_type) pair, assert
  whether it's allowed.
- Mirror behavior: for each mirrorable op, assert that
  mirroring swaps op correctly and adjusts value per behavior.
- Value field autocomplete: assert all 7 attributes + PB +
  level + attribute_modifier + proficiency resolve.
- Non-mirrorable combos: assert Mirror toggle is hidden.

Estimated: 2-3 hours.

### Milestone 5 — Docs + recon refresh

- Refresh `phase-7.5-and-beyond-notes.md` to retire the
  "chirality violation" framing.
- Update the recon script to flag actual problems (broken
  primitives) instead of "missing modifiers."
- Remove `mirror_vector` references in docs.

Estimated: 30 minutes.

## Open questions — simpler this time

### Q1. Bias op value type — Text/Dice/Keyword?

Your message says "Bias value type only text / dice / keyword
and values only Advantage / Disadvantage." But the Bias op's
VALUE is just the literal string "advantage" or "disadvantage" —
not a user-typed text. So why is Bias's value type Text/Dice/
Keyword?

My read: the form's value-type dropdown for Bias shows
Text/Dice/Keyword because Bias shares the constraint bucket with
Grant/Revoke. The actual rendered Value input for Bias is a
binary dropdown (Advantage/Disadvantage), not a text input.

**Confirm:** Bias renders as a binary dropdown in the Value
field, regardless of value_type being "Text/Dice/Keyword."

### Q2. Autocomplete vocabulary

For the Value field's autocomplete, I listed:
- 7 attributes
- PB, level, attribute_modifier, proficiency
- dice patterns
- standard conditions (grappled, prone, stunned, silenced,
  deafened)
- plain numbers

**Is the condition keyword set fixed, or is there a Notion
table I should pull from?** (I see there's a "Lexicon — State
Tags" table in the Notion hub I haven't fully read yet.)

### Q3. Mirror behavior for Grant/Revoke

If a modifier says "Grant grappled" (op=grant, value=grappled),
what does mirror produce?
- (a) Revoke grappled (op flips, value stays).
- (b) Grant un-grappled (impossible — no "un-grappled" state).

My read: (a). Mirror flips the op. The author's intent is "this
primitive grants grappled; mirror revokes grappled." Same value,
opposite operation.

**Confirm.**

### Q4. Bias value type — could it be a custom enum?

"advantage" and "disadvantage" are an enum, not free text. The
form renders them as a binary select. But under the hood, is
the storage:
- (a) `value_type: "text"`, `value: "advantage"` (free text,
  validated against enum)?
- (b) `value_type: "bias"`, `value: "advantage" | "disadvantage"`
  (typed enum)?

My lean: (a) — keeps the value_type matrix simple. Validation
happens on save, not in the storage shape.

**Confirm or correct.**

### Q5. Set To + True/False: same as Toggle?

"Set To + True/False" behaves identically to "Toggle." Do we
collapse them in the form? My read: no — keep Set To and
Toggle as separate ops because semantically Set To is
"assert this state is true" while Toggle is "flip this state."
But functionally identical.

**Confirm: keep separate, OR collapse to one op.**

## What I need from you

Sign-off on the 11-op model + value-type constraint table.
Answers to the 5 questions above (1-line each is fine).
Then I start with Milestone 1.

If you want to drop into the form and play with the current
state before I change anything, the dev server is on port 3015
(`pnpm dev`) — the primitive form is at
`/dashboard/sandbox/primitives/[id]`.