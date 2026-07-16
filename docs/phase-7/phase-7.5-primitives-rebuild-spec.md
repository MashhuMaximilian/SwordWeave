# Phase 7.5 — Primitives Rebuild with Operation-Driven Chirality

**Status:** spec draft. Implementation after user sign-off.

## TL;DR — what changed from the old plan

Three architectural shifts crystallized from the Notion BU Market canon
and your Discord answers (2026-07-16):

1. **Chirality lives on the OPERATION, not on a `mirror_vector` enum.**
   Each modifier op has a built-in chiral pair (Add↔Subtract,
   Multiply↔Divide, Minimum↔Maximum, Grant↔Revoke). Some ops
   have no mirror (Set To) or are self-mirroring (Toggle).
   **NEW op:** `Advantage ↔ Disadvantage` (BU toll: 2, pick
   higher/lower die result).
2. **Mirror only mirrors the OPERATION. Conditions are independent.**
   To get a mirrored primitive with a different condition, the
   author writes a second modifier primitive with its own
   condition. The mirror button on a single primitive swaps the
   op (and possibly the value, depending on op semantics) — it
   does not duplicate the condition.
3. **The "13 chirality violations" are not violations.** They were
   primitives that were correctly flagged `is_mirrorable=true` but
   had no modifier defined. Now that we know chirality is on the
   op, we just author the modifier for each — every one of them
   resolves to a Variable Vector primitive per the Notion canon.

The recon's "150 primitives with zero modifiers" outcome is
expected: most primitives in the catalog are **structural
namespace** (verbs, domains, durations, range gates, targeting
formats, etc.) — those are Permission Vector primitives that
don't have a modifier at all. Only **Variable Vector primitives**
get a modifier definition.

## Definitions (from the Notion canon, condensed)

### Variable Vector (mirrorable)
"Components that modify the raw mathematical weight and numerical
outputs of the engine." Inverting one creates visible "structural
friction" that maps directly to a BU credit.

- **Numerical metrics** (sheet baseline) — Practice modifiers,
  Attribute Increments, Attack/Accuracy tracks, Character DCs.
- **Vitality blocks** — Vitality Core Augment I/II/III.
- **Probability bias tracks** — Positive/Negative Bias on a
  Practice or save.
- **Structural faults** — domain vulnerabilities (take double
  damage, auto-fail save).
- **Kinematic metrics** — Stride Extension.
- **Strain & cost buffers** — Heuristic Buffer, Vitality
  Shielding, Condition Insulation, Domain Lock Shield.

### Permission Vector (NOT mirrorable)
"Fundamental conceptual rights, semantic language permissions,
structural scaling limits, or spatial formatting frameworks."
Cannot be inverted — possessing "negative access" to a concept is
logically invalid.

- **Lexicon tiers** — Verbs (Strike, Create), Domains (Fire,
  Kinetic, Void).
- **Intensity blocks** — Damage/Healing dice (you can't roll
  "negative dice").
- **Spatial/targeting logic** — Range Gates, Sizing Templates
  (Cones, Radius), Selective Focus, Collateral Buffer.
- **Chronological & temporal paths** — Execution speeds, Duration
  licenses (you can't have "negative permanent").
- **System bypasses** — Flight, Darkvision, Phase Slip, extra
  Reaction Slots.
- **Runtime trigger hooks** — Reactive Guard, Causality
  Interdiction.
- **Semantic state tags** — Physical Interaction, Cognitive &
  Agency.

## Operation taxonomy (Phase 7.5 schema)

This is the operation enum that drives the modifier form. Each op
declares:

- Its **value type** (number, dice, bound, state, etc.).
- Its **mirror op** (`null` if non-mirrorable).
- Whether mirror **flips the sign** of the value or **collapses
  to a bound**.
- Whether it has a **BU toll** separate from the modifier's BU
  cost.

| Operation | Value Type | Mirror Op | Mirror Behavior | BU Toll | Variable Vector? |
|---|---|---|---|---|---|
| `add` | number | `subtract` | flip sign | — | yes |
| `subtract` | number | `add` | flip sign | — | yes |
| `multiply` | number | `divide` | flip: 2× ↔ ×0.5 | — | yes |
| `divide` | number | `multiply` | flip: ×0.5 ↔ 2× | — | yes |
| `set_to` | number | *none* | (permission-locked) | — | NO |
| `min` | number | `max` | collapse to more permissive | — | yes |
| `max` | number | `min` | collapse to more permissive | — | yes |
| `grant` | state-tag string | `revoke` | flip grant↔revoke | — | yes |
| `revoke` | state-tag string | `grant` | flip grant↔revoke | — | yes |
| `toggle` | boolean | `toggle` | self-mirror | — | yes |
| `advantage` | scope enum | `disadvantage` | flip adv↔dis | **2 BU** | yes |
| `disadvantage` | scope enum | `advantage` | flip adv↔dis | **2 BU** | yes |

### BU toll for advantage/disadvantage

These are special: they're **probability tracks**, not metric
adjustments. The Notion canon (Probability Bias Table) lists their
cost as 3 BU at Tier I (Narrative Focus), 6 BU at Tier II (Named
Metric), 12 BU at Tier III (Core Attribute), 20 BU at Tier IV
(Causal Override). For Phase 7.5 we adopt:

- **`advantage(scope: "narrative_focus")`** → 3 BU modifier cost,
  2 BU toll.
- **`advantage(scope: "named_metric")`** → 6 BU modifier cost,
  2 BU toll.
- **`advantage(scope: "core_attribute")`** → 12 BU modifier cost,
  2 BU toll.

The "BU toll" is a per-application cost the author pays to USE
the operation, separate from the modifier's BU (the structural
cost of having the operation in the primitive catalog).

The toll matters when stacking: a character with two different
advantage-granting primitives might cancel out, leaving one
effective advantage at half toll, or pay 2 BU twice for the
double-cost. Resolution TBD in the runtime layer.

### Implementation: `operationKind` is the operation's discriminator

The current schema has `operation: "add" | "subtract" | ...` as a
loose string union. Phase 7.5 formalizes this:

```ts
export type ModifierOperation =
  | "add" | "subtract"
  | "multiply" | "divide"
  | "set_to"
  | "min" | "max"
  | "grant" | "revoke"
  | "toggle"
  | "advantage" | "disadvantage";

export interface ModifierOpSpec {
  readonly kind: ModifierOperation;
  /** Human-readable label for the picker ("Add", "Subtract", "Set To"). */
  readonly label: string;
  /** Whether this op is mirrorable. */
  readonly mirrorable: boolean;
  /** The op that mirror button swaps to. */
  readonly mirrorOp: ModifierOperation | null;
  /** Whether the mirror op flips the value's sign. */
  readonly mirrorFlipsSign: boolean;
  /** Whether the mirror collapses to a permissive bound (min/max). */
  readonly mirrorCollapsesToBound: boolean;
  /** Whether this op self-mirrors (toggle). */
  readonly mirrorIsSelf: boolean;
  /** BU toll when this op is applied at runtime. */
  readonly buToll: number;
  /** The value's expected type. */
  readonly valueShape: "number" | "dice" | "bound" | "boolean" | "scope";
}

export const OP_SPECS: Record<ModifierOperation, ModifierOpSpec> = {
  add:         { kind: "add", label: "Add",         mirrorable: true,  mirrorOp: "subtract",   mirrorFlipsSign: true,  mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 0,  valueShape: "number" },
  subtract:    { kind: "subtract", label: "Subtract", mirrorable: true, mirrorOp: "add",       mirrorFlipsSign: true,  mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 0,  valueShape: "number" },
  multiply:    { kind: "multiply", label: "Multiply", mirrorable: true, mirrorOp: "divide",     mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 0,  valueShape: "number" },
  divide:      { kind: "divide", label: "Divide",     mirrorable: true, mirrorOp: "multiply",   mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 0,  valueShape: "number" },
  set_to:      { kind: "set_to", label: "Set To",     mirrorable: false, mirrorOp: null,        mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 0,  valueShape: "number" },
  min:         { kind: "min", label: "Minimum",      mirrorable: true,  mirrorOp: "max",        mirrorFlipsSign: false, mirrorCollapsesToBound: true,  mirrorIsSelf: false, buToll: 0,  valueShape: "bound" },
  max:         { kind: "max", label: "Maximum",      mirrorable: true,  mirrorOp: "min",        mirrorFlipsSign: false, mirrorCollapsesToBound: true,  mirrorIsSelf: false, buToll: 0,  valueShape: "bound" },
  grant:       { kind: "grant", label: "Grant",      mirrorable: true,  mirrorOp: "revoke",     mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 0,  valueShape: "boolean" },
  revoke:      { kind: "revoke", label: "Revoke",     mirrorable: true,  mirrorOp: "grant",      mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 0,  valueShape: "boolean" },
  toggle:      { kind: "toggle", label: "Toggle",    mirrorable: true,  mirrorOp: "toggle",     mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: true,  buToll: 0,  valueShape: "boolean" },
  advantage:   { kind: "advantage", label: "Advantage",   mirrorable: true, mirrorOp: "disadvantage", mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 2, valueShape: "scope" },
  disadvantage:{ kind: "disadvantage", label: "Disadvantage", mirrorable: true, mirrorOp: "advantage", mirrorFlipsSign: false, mirrorCollapsesToBound: false, mirrorIsSelf: false, buToll: 2, valueShape: "scope" },
};
```

## Schema migration: `mirror_vector` → `operationKind`

The current `primitives` table has a `mirror_vector` enum:
`STANDARD_ONLY` | `MAGNITUDE_ONLY` | `DURATION_ONLY` |
`BOOLEAN`. Phase 7.5 retires that column entirely. Chirality
now lives in the **modifier's operation**.

Migration:
1. `mirror_vector IS NULL` → keep null (primitive has no
   modifier; it's a Permission Vector primitive or namespace).
2. `mirror_vector IS NOT NULL` → derive chirality from the
   modifier's `operation`:
   - `add/subtract/multiply/divide/min/max/grant/revoke/
     toggle/advantage/disadvantage` → mirrorable.
   - `set_to` → not mirrorable.

**Net effect:** no rows change meaning. The 13 "violators" get
their modifier authored (Phase 7.5 scope) and their chirality
falls out of the op automatically.

## UI changes (primitive-form.tsx, Phase 7.5)

### Operation picker

Replace the current op select with a 12-row radio list (Add,
Subtract, Multiply, Divide, Set To, Minimum, Maximum, Grant,
Revoke, Toggle, Advantage, Disadvantage). See the screenshot
from your mobile UI — that's exactly the right layout.

- Selecting a mirrorable op lights up the **Mirror** toggle.
- Selecting a non-mirrorable op (Set To) greys out the Mirror
  toggle and shows a tooltip: "Set To is permission-locked;
  cannot be inverted."
- Toggling Mirror swaps the operation to its chiral pair
  (Add ↔ Subtract, etc.). For min/max, swap and snap value to
  the more permissive bound (max → min, value = current bound).
- The BU cost display dynamically reflects the toll: Advantage
  shows `+2 BU (toll) + 6 BU (modifier) = 8 BU total`.

### Variable vs Permission vector indicator

Show a small badge next to the primitive category:

- 🟢 **Variable** (mirrorable op present) — Mirror toggle
  enabled.
- ⚪ **Permission** (no modifier / permission-locked op) —
  Mirror toggle disabled.

### Modifier visibility rule

If the primitive is a Permission Vector (no modifier defined,
or modifier op is `set_to`), the mirror toggle and "BU debt
credit" copy all hide. They only show when there's a mirrorable
modifier.

## The 13 chirality "violators" — what each one actually IS

Each of these gets a modifier authored in Phase 7.5. The
modifier definition follows the Notion canon exactly.

| Primitive | Category | Operation | Value | Mirror Behavior | BU | Mirror Credit |
|---|---|---|---|---|---|---|
| Vitality Core Augment I | SHEET_AUGMENT | `add` | +5 (Max HP) | Subtract 5 Max HP | 4 | 4 |
| Vitality Core Augment II | SHEET_AUGMENT | `add` | +12 (Max HP) | Subtract 12 Max HP | 8 | 8 |
| Vitality Core Augment III | SHEET_AUGMENT | `add` | +20 (Max HP) | Subtract 20 Max HP | 12 | 12 |
| Attribute Increment | SHEET_AUGMENT | `add` | +1 (Attribute) | Subtract 1 Attribute | 12 | 12 |
| Attack Bonus Increment | SHEET_AUGMENT | `add` | +1 (Attack) | Subtract 1 Attack | 6 | 6 |
| Negative Bias I | PROBABILITY_BIAS | `disadvantage` | narrative_focus | flip to advantage | 3 (+2 toll) | 3 |
| Negative Bias II | PROBABILITY_BIAS | `disadvantage` | named_metric | flip to advantage | 6 (+2 toll) | 6 |
| Negative Bias III | PROBABILITY_BIAS | `disadvantage` | core_attribute | flip to advantage | 12 (+2 toll) | 12 |
| Vitality Shielding | EVALUATION_STRAIN | (special — see note) | halve vitality cost | "Metaphysical Debt" — pay 2× cost | 10 | 10 |
| Stride Extension | MOBILITY_LOCOMOTION | `add` | +10 ft land speed | Subtract 10 ft | 5 | 5 |
| Kinetic Hardening | DEFENSIVE | `add` | +1 Physical Def | Subtract 1 Physical Def | 6 | 6 |
| Psychic Firewall | DEFENSIVE | `add` | +1 Mental Def | Subtract 1 Mental Def | 6 | 6 |
| Warding Shell | DEFENSIVE | `add` | +1 Magical Def | Subtract 1 Magical Def | 6 | 6 |

**Note on Vitality Shielding:** the Notion canon describes this
as "Halve any upfront Vitality cost." That's not a simple
`add/subtract` op — it's a `multiply` with value `0.5`. The
mirror is `divide` with value `2.0` (pay 2× cost = "Metaphysical
Debt"). So:
- Operation: `multiply`, value: 0.5, target: `vitality_upfront_cost`.
- Mirror: `divide`, value: 2.0.

That's why the BU toll structure matters: the modifier value
(`0.5`) is fixed in the primitive definition. Mirror flips it to
`2.0` without re-asking the user.

**Note on Probability Bias:** the canon calls these `advantage`
(positive bias) and `disadvantage` (negative bias). Negative
Bias I/II/III are the *mirror* of Positive Bias I/II/III —
they're mirrorable *because* they're already on the
"disadvantage" side of the chiral pair. **When mirrored, they
flip to advantage** (giving the character Positive Bias, which
the Negative Bias was negating).

This is a powerful insight: the **2 with existing modifiers**
(Vector Split, Minor Die Block) and the **13 chirality
violators** are 15 primitives whose chirality becomes obvious
once their modifier is authored. No manual `is_mirrorable`
flipping needed.

## Implementation milestones

### Milestone 1 — Operation taxonomy + schema migration

- Add `ModifierOperation` enum + `OP_SPECS` to
  `src/types/modifier.ts` (or split from `condition.ts` if too
  long).
- Add `value_shape`, `mirror_op`, `mirror_behavior` columns to
  the `modifiers` table (or compute in code — TBD).
- Run a migration script to populate `mirror_op` from existing
  `operation` values.
- Verify no data loss. Existing `{kind: "modify", operation:
  "add", ...}` rows map cleanly to `OP_SPECS.add`.

Estimated: 2-3 hours.

### Milestone 2 — UI op picker

- Replace the operation `<select>` in `primitive-form.tsx` with
  the 12-row radio list (matching the mobile screenshot layout).
- Wire up chirality: selecting an op auto-sets
  `is_mirrorable` based on `OP_SPECS[op].mirrorable`.
- Wire up mirror behavior: mirror toggle swaps op to
  `OP_SPECS[op].mirrorOp` and adjusts value per
  `mirrorFlipsSign` / `mirrorCollapsesToBound`.
- BU cost display includes the toll for adv/dis operations.

Estimated: 2-3 hours.

### Milestone 3 — Seed modifier definitions for the 15 modifier-bearing primitives

- Walk through each of the 15 primitives in `primitive-form.tsx`.
- For each, fill in:
  - Operation (from the table above).
  - Value (the magnitude/scope from the canon).
  - Target stat (the column being modified).
  - Stacking behavior (`stack` per existing convention).
  - Condition (often null; only if the primitive has a specific
    trigger).
- Commit per primitive so the diff is reviewable.
- Re-run the recon script and verify 15/152 primitives now have
  modifiers (up from 2/152).

Estimated: 1-2 hours if you're the source of truth on the
magnitudes and targets; longer if you need to consult Notion
per primitive.

### Milestone 4 — Variable vs Permission vector UI indicator

- Add a small badge to the primitive form header showing
  Variable / Permission classification.
- Variable when modifier exists and `OP_SPECS[op].mirrorable`.
- Permission otherwise.
- Update the recon script to use this classification instead of
  `is_mirrorable=true, modifiers=[]` as the violation signal.

Estimated: 1 hour.

### Milestone 5 — Mirror simulation test

- For each of the 15 modifier-bearing primitives, write a test
  that:
  1. Defines the primitive + its modifier.
  2. Mirrors it (apply the chiral pair).
  3. Asserts the mirrored op, mirrored value, mirrored BU
     credit, and any collapse-to-bound behavior.
- This is the regression net for the chirality machinery. Any
  future change to `OP_SPECS` should cause failures if mirror
  semantics shift.

Estimated: 2 hours.

### Milestone 6 — Docs + bookkeeping update

- `docs/phase-7/phase-7.5-and-beyond-notes.md` — refresh with
  the operation-driven chirality model, retire the "13
  chirality violations" framing.
- Remove `mirror_vector` references in docs (it's gone from the
  schema).
- Update Notion link reference in the recon script.

Estimated: 30 minutes.

## Open questions

1. **The 150 zero-modifier primitives — do they need anything?**
   My read: no. They're structural namespace (verbs, domains,
   intensity dice, durations, etc.) — Permission Vector by
   construction. The form should let them be authored without a
   modifier definition and the Variable/Permission badge just
   says Permission. Confirm this matches your intent.

2. **What does "Advance / Disadvantage on a state tag" look like
   in the schema?** E.g. Advantage on "when target is prone."
   The Notion canon defines the **scope** (narrative_focus /
   named_metric / core_attribute) but the trigger condition is
   what we just built in Phase 7 Q-B-m4 (the compound AND/OR
   picker). Are scope + condition orthogonal, or is scope
   itself a special case of condition? My read: orthogonal.
   Scope defines *what* gets biased, condition defines *when*.

3. **Min/Max collapse-to-bound semantics:** the canon describes
   them as paired bounds ("Velocity Arrest" sets max speed to
   0; mirror would set min speed to 0 = no movement). For the
   mirror, do we just flip the op AND keep the value, or flip
   the op AND snap to a "more permissive" interpretation? My
   lean: flip op + keep value (max → min with same value means
   "at least N", which is more permissive than "at most N").

4. **Set To vs Add on Vitality:** could be either. Notion's
   Vitality Core Augment row says "Flat +5 Max Vitality" — so
   it's `add`, not `set_to`. Confirm: NO primitive uses
   `set_to` for vitality pools. (Set To is reserved for cases
   like "set character level to 10" or "set form to stone for
   1 round" — but those aren't primitives, those are
   capability-level effects.)

5. **Heuristic Buffer mirror ("Fragile Intent"):** Notion says
   mirror is "+1 additional Strain" — that's an `add` op with
   value 1 on the strain track. Confirming the primitive
   should be authored as: op=`add`, value=1, target=`strain`,
   with mirror = subtract 1 (cheaper) ↔ add 1 (Fragile Intent,
   +12 BU credit). 

## What I need from you to start

Sign-off on this spec, then answers to the 5 open questions
(1-line each is fine — most are confirmations of my leans).
Then I start with Milestone 1 (schema migration + OP_SPECS).