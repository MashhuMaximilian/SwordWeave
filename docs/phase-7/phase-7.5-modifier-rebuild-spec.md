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

## Operation × Value Type constraint table (Phase 7.5 v2)

Refined after your message (2026-07-16). The exact rules:

| Operation | Allowed Value Types |
|---|---|
| Add | Number, Dice |
| Subtract | Number, Dice |
| Multiply | Number, Dice |
| Divide | Number, Dice |
| Minimum | Number, **Text/Keyword** |
| Maximum | Number, **Text/Keyword** |
| Set To | Number, Text/Keyword, Dice, Boolean |
| Grant | Number, Text/Keyword, Dice |
| Revoke | Number, Text/Keyword, Dice |
| Toggle | Boolean only (no Value Type dropdown — op is self-explanatory) |
| Bias | Text/Keyword only |

**Differences from v1:**

- **Text and Dice are now SEPARATE value types** (not combined).
  - "Text/Keyword" = free text OR custom pills (custom behaviors
    the author names — e.g. `darkvision`, `mana_pool`).
  - "Dice" = dice expressions only (`1d4`, `2d6+3`, `20d8`,
    custom). The chip-stack shows canonical dice sizes + a
    custom-dice input.
- **Number** accepts int/float literals AND runtime tokens
  (`+physical`, `+awareness`, `+PB`) — because those resolve to
  numbers on the character sheet.
- **Min/Max** accept Number OR Text/Keyword (e.g. "max target
  size = Large" is a Text/Keyword). NOT dice.
- **Grant/Revoke** accept all three (Number, Text/Keyword,
  Dice) — they're general-purpose state operations.
- **Bias** accepts only Text/Keyword (probability track
  declarations like "advantage on Awareness checks").
- **Toggle** has no Value Type field — the op is the entire
  semantic. Pick Toggle, the value field renders as a True/False
  toggle directly.
- **Set To** accepts everything (it's the universal setter).

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

## Value field — runtime-resolvable tokens (revised)

You corrected my "autocomplete = suggestions" reading. The
correct model is: **the Value field holds runtime-resolvable
tokens**, not raw text suggestions.

### Why

The author's intent: "this primitive adds my physical modifier
to my attack roll." They don't want to type `+4` manually. They
want to say `physical` and let the character sheet resolve it
to the character's actual Physical attribute modifier at slot
time.

### Token vocabulary (Phase 7.5 v1)

| Token | Resolves to | Example |
|---|---|---|
| `physical` | Physical attribute modifier | "add +physical to attack roll" |
| `mental` | Mental attribute modifier | "add +mental to Reason save" |
| `magic` | Magic/Abstract attribute modifier | "add +magic to spell DC" |
| `awareness` | Awareness Practice modifier | "add +awareness to tracking check" |
| `fieldcraft` | Fieldcraft Practice modifier | (and the other 8 Practices) |
| `pb` | Proficiency Bonus (full) | "add +pb to all saves" |
| `pb_half` | Proficiency Bonus / 2 (rounded down) | "add +pb_half to non-proficient checks" |
| `level` | Character level | (rare; allowed) |
| `<behavior:NAME>` | Free-form axis the author names | "set darkvision to 60 ft" |
| `NdM`, `NdM+K` | Dice expressions (1d4, 2d6+3) | "add 1d6 to damage" |
| `<raw number>` | Literal magnitude | "add 4 to defense" |

### Form UX

The Value field renders as a **token picker chip-stack** (not a
free text input):

```
Value
  [× physical]
  [+ add token]
```

Clicking `[+ add token]` opens a small popover with the
canonical token list. Each chip displays the token name and its
currently-resolved value (gray text underneath the token — "= 4
when slotted").

- Numeric tokens (`4`, `2d6+3`) are typed directly. Dice uses
  the canonical size abbreviations (`d4`, `d6`, `d8`, `d10`,
  `d12`, `d20`).
- Behavior tokens are typed as `behavior:<name>` where `<name>`
  is any non-empty string. No autocomplete for behavior names
  — author owns the namespace.
- Multiple tokens can stack in the same Value field. "add
  +physical +2" is two tokens (physical + 2).

### Resolution at slot time (Phase 8 work — Phase 7.5 doesn't
implement resolution, just the storage shape)

The token picker emits structured data:

```ts
type ValueToken =
  | { kind: "attribute"; attribute: "physical" | "mental" | "magic" }
  | { kind: "practice"; practice: PracticeKey }
  | { kind: "derived"; which: "pb" | "pb_half" | "level" }
  | { kind: "behavior"; name: string }
  | { kind: "dice"; expression: string }   // "1d4", "2d6+3"
  | { kind: "number"; value: number };      // literal magnitude
```

When the character sheets a primitive, the engine walks the
Value token list and replaces each token with the character's
actual value at that moment. Unresolved tokens (e.g. behavior
the character doesn't have) resolve to `0` with a soft warning.

### Why this matters for chirality

Token-based values also change how mirrors work:

- Add(physical) mirrors to Subtract(physical). Same token,
  flipped sign.
- Set To(physical) does NOT mirror — there's no "set to
  negative physical."
- Bias("advantage") mirrors to Bias("disadvantage"). The
  token value flips, not the op.

Phase 7.5 only handles the form + storage. The runtime
resolution is Phase 8.

## What changes (the "What changes?" field)

This is the **target engine axis** the modifier applies to. Per
your message it includes a `behavior` option that's a free-form
text escape hatch.

### Canonical options

- **Attribute** — one of Physical, Mental, Magic/Abstract.
- **Practice** — one of the 10 Practices (Awareness, Fieldcraft,
  Influence, Reason, Vitality, Lore, Magic, Combat, Movement,
  Social — TBD from the Notion canon).
- **Action Roll** — attack roll, save, check.
- **Vitality** — HP pool, healing, damage.
- **Defense** — physical/magical/mental defenses.
- **Movement** — speed, jump, climb, swim, etc.
- **Trigger Hook** — runtime reactive capability.
- **State Tag** — semantic permission tags (Physical Interaction,
  Cognitive & Agency, etc.).
- **Behavior** — free-form axis. The author types any name:
  `darkvision`, `mana_pool`, `mana_regen`, `stamina_drain`,
  `flight_speed`, etc. The behavior name becomes a runtime
  namespace the character sheet may or may not resolve. If the
  character doesn't have the behavior defined, the modifier
  contributes `0`.

### Form UX

```
What changes?
  [Attribute ▼]  or  [Practice ▼]  or  [Behavior ▼]
```

- For Attribute / Practice: dropdown shows the canonical list.
- For Behavior: an input that takes any non-empty string. No
  autocomplete.
- The "ATTRIBUTE — LEAVE EMPTY FOR 'ANY'" checkbox row in the
  screenshots (Physical / Mental / Magical) becomes a sub-filter
  visible when `What changes = Attribute`. The user picks one or
  more axes (or leaves all unchecked for "any attribute").

### Token semantics

When `What changes = Attribute` AND `Value = physical`, the
modifier says "this primitive adds/subtracts the Physical
attribute modifier to/from the targeted Attribute." The
character sheet resolves both the target and the value through
the same attribute system.

## What this means for the 13 "chirality violations"

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
## Open questions — fuller context this time

(I'm rewriting Q2 with more context. Q3, Q4, Q5 already answered
in your last message. Confirming in the section below.)

### Q1 (CONFIRMED) — Bias value field renders as binary dropdown

You said yes. The Value field for op=Bias renders an
Advantage/Disadvantage dropdown even though value_type is
"Text/Dice/Keyword." Storage shape: `value_type: "text", value:
"advantage" | "disadvantage"`.

### Q2 (NEW, fuller context) — What does "What changes" show by default?

Right now the form's "What changes?" dropdown shows whatever
options you implemented in the existing primitive form
(Attribute / Practice / Vitality / etc.). I want to confirm the
**canonical list of axes**:

1. **Attribute** — Physical, Mental, Magic/Abstract (3).
2. **Practice** — Awareness, Fieldcraft, Influence, Reason,
   Vitality, Lore, Magic, Combat, Movement, Social (10).
   (Confirm this is the right list — pulled from the Notion
   canon, but I haven't verified all 10 names against the
   canonical Practice page.)
3. **Action Roll** — attack roll, save, check.
4. **Vitality** — HP, healing, damage.
5. **Defense** — physical, magical, mental.
6. **Movement** — speed, jump, climb, swim, burrow, fly.
7. **Trigger Hook** — runtime reactive capability.
8. **State Tag** — semantic permission tag (Physical Interaction,
   Cognitive & Agency, etc.).
9. **Behavior** — free-form axis (the escape hatch).

**Question: is that list complete, or are there other engine
axes I'm missing?** (E.g. Strain, Complexity, Upkeep, Range
modifiers, Duration modifiers.)

### Q3 (CONFIRMED) — Grant grappled mirrors to Revoke grappled

You said yes. Mirror flips the op, value stays.

### Q4 (DROPPED — answered by your Q1 reply)

You already confirmed Bias's value is "advantage" / "disadvantage"
as a binary choice. No need to ask twice.

### Q5 (CONFIRMED) — Set To and Toggle stay separate, no True/False on Set To

You said keep separate. Set To does not mirror. And Set To only
takes Number or Text/Dice/Keyword — NOT True/False (Toggle
handles that).

### Q6 (CONFIRMED) — Custom tokens are open-ended

You said: "Well player custom tokens will they can write like they
can in conditions." Confirmed — token vocabulary is open-ended,
same model as custom pills in the compound condition picker
(Phase 7 Q-B m4).

The canonical list (3 attributes, 10 practices, 3 derived,
dice, numbers, behavior-prefix) is **autocomplete suggestions
only**. Players can type any custom name and it becomes a
custom token at runtime. The storage shape is open:

```ts
type ValueToken =
  | { kind: "attribute"; attribute: "physical" | "mental" | "magic" }
  | { kind: "practice"; practice: PracticeKey }
  | { kind: "derived"; which: "pb" | "pb_half" | "level" }
  | { kind: "behavior"; name: string }   // includes custom names
  | { kind: "dice"; expression: string }
  | { kind: "number"; value: number };
```

The form's autocomplete chip-list shows the canonical names
for quick-pick, plus a `[+ custom]` option that prompts for any
new name. Custom names get persisted as `behavior` tokens (the
`name` field carries the custom value).

### Q7 (CONFIRMED) — Unresolved tokens warn at character-creation phase only

You said:
- Treat bare `darkvision` as a behavior token (see Q8).
- Warning text shows up at character-creation phase when the
  engine actually resolves the modifier values. In the sandbox
  (Phase 7), there's no character base, so tokens don't resolve
  — they're stored as opaque references.
- Special case: `behavior:X = Y` is semantically equivalent to
  `grant X with magnitude Y` when Y is non-zero. The form
  doesn't enforce this — it stores what the author wrote.
  The runtime engine (Phase 8) does the Set↔Grant equivalence
  resolution.

Implementation note: in the sandbox, the Value field renders as
a token chip-stack with no resolved-value display (just
"unresolved at sandbox time"). When character creation lands
(Phase 8), the same chip-stack resolves to the character's
actual values.

### Q8 (CONFIRMED) — Bare single-word text is a behavior token

You said yes. `darkvision` (no prefix) → `{kind: "behavior",
name: "darkvision"}`. Multi-word or symbolic text (e.g. `2d6+3`,
`+4`) stays as dice/number. `behavior:` prefix is supported for
explicitness.

## What I need from you

Sign-off on the 11-op model + value-type constraint table +
token vocabulary. Implementation starts now.

Milestone 1: storage shape + token vocabulary map + custom
token registration. Milestone 2: form UI (token picker
chip-stack).