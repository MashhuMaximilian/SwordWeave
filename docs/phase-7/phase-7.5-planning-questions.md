# Phase 7.5 — Primitives Rebuild (planning notes, draft)

**Status:** awaiting your answers to the question set below.

## DB recon (already done)

Against the production Neon DB (`scripts/phase-7.5-recon.ts`):

- **152 primitives total** across 27 categories
- **150 / 152** primitives have **zero modifiers** (no `hard_modifiers`)
- **2 / 152** have 1 modifier each:
  - `TARGETING / Vector Split` — `{kind: modify, target: action.targetCount, value: 1, op: add, stacking: stack}` — `is_mirrorable: false`
  - `INTENSITY_DICE / Minor Die Block` — `{kind: modify, target: action.damage, value: 1d4, op: add, stacking: stack}` — `is_mirrorable: false`
- **13 / 152** marked `is_mirrorable=true` but have **no modifier** (chirality violations per your rule "only primitives with a modifier should be mirrorable"):
  - `SHEET_AUGMENT`: Attack Bonus Increment, Attribute Increment, Vitality Core Augment I/II/III
  - `PROBABILITY_BIAS`: Negative Bias I/II/III
  - `EVALUATION_STRAIN`: Vitality Shielding
  - `MOBILITY_LOCOMOTION`: Stride Extension
  - `DEFENSIVE`: Kinetic Hardening, Psychic Firewall, Warding Shell

**Implication:** 137 primitives are pure namespace (no mirror, no modifier, no condition knobs). They will keep working as-is. Only the 15 primitives with knobs (the 2 with modifiers + the 13 chirality violations to either fix or downgrade) need actual rebuild work.

## Question set (please answer in order)

### Q1. Scope of the rebuild

The user's proposed scope says "rebuild primitive / capability / effect / template systems" — but the recon shows the work is concentrated in primitives. What level of fidelity do you want?

1. **All 152 primitives, full rebuild** — walk through every primitive one by one in the UI; rebuild its modifier + condition + mirror flag. 8-12 hours of focused work.
2. **Only the 15 with knobs** — modifier-bearing (2) + chirality-violating (13). Confirm each one's correct mirrorability, add modifier where missing, set conditions. ~2-3 hours.
3. **Schema + UI for chirality first** — build the tooling so the *system* enforces the rule (mirror flag only visible when primitive has modifier, etc.). Don't manually rebuild any data. ~4-5 hours. Then data comes incrementally as primitives get new modifiers in normal authoring flow.

**My recommendation:** (3) first, then (2) as a one-shot pass once the tooling enforces the rule. (1) is overkill given how few primitives actually have knobs.

### Q2. What does "rebuild" mean for primitives WITH knobs?

The 2 currently-with-modifiers and the 13 chirality violators need:
- For each, what's its canonical mechanic? (e.g. "Velocity Arrest" obviously needs a target stat to slow.)
- What's its trigger condition? (When does this modifier apply?)
- What's its mirror vector? (What gets mirrored — the whole effect? just the magnitude?)

**Are you the source of truth for all of these, or do you want to look up canon from Notion / docs first?**

### Q3. Capabilities / effects / templates

The user said "rebuild primitive / capability / effect / template systems" but capabilities, effects, and templates are *compositions* of primitives — they don't carry conditions or chirality themselves. Did you mean:

1. Rebuild only **primitives** — capabilities/effects/templates already work via primitive modifiers.
2. Rebuild all four — capabilities and templates should also gain some new affordance (e.g. templates carry a "this template enforces these triggers" rule that overrides primitive-level conditions).
3. Rebuild primitives first; revisit capability/effect/template scope after primitives are clean.

**My recommendation:** (1) or (3). The chirality rule is explicit on this.

### Q4. Chirality violations — fix or accept?

13 primitives have `is_mirrorable=true` but no modifier. Three options:

1. **Add the missing modifier** to each, so they're truly mirrorable. 13 small modifier definitions to author.
2. **Flip `is_mirrorable` to false** on all 13 — they're structural primitives (Vitality Core Augment, Attack Bonus Increment, Negative Bias, etc.) that don't need mirroring.
3. **Hybrid** — author the modifier for the ones where it makes semantic sense (e.g. Negative Bias might map to a Probability Bias stat), flip the others.

**My lean:** (3) hybrid. Negative Bias and similar probability-modifying primitives likely DO have a mechanic — they're just unmodeled. The Sheet_Augment "Vitality Core Augment" trio probably shouldn't be mirrorable in the chiral sense (they're just buff primitives).

### Q5. New condition authoring on rebuilt primitives

Each rebuilt primitive with a modifier gets a condition (the "Triggers when..." picker we just built). For each of the 15 with knobs, do you want to author conditions now as part of the rebuild, or leave the condition blank (always-true) for now and fill in over time?

**My lean:** Author conditions for the 2 currently-with-modifiers immediately (Vector Split + Minor Die Block — easy wins, probably "Target is something" / "Always on hit"). Leave the 13 chirality-violators blank until they have real modifiers.

### Q6. Mirror vector — `STANDARD_ONLY` default is fine?

Looking at the schema, every primitive already has a `mirror_vector` column defaulting to `'STANDARD_ONLY'`. The Phase 7 Q-M architecture specified a few vectors:
- `STANDARD_ONLY` (default — mirror just doubles the effect)
- `MAGNITUDE_ONLY` (mirror increases magnitude, not count)
- `DURATION_ONLY` (mirror extends duration)
- `BOOLEAN` (mirror applies the whole effect twice — for non-stackable things)

For the 2 currently-with-modifiers, are they all `STANDARD_ONLY`? Should the 13 chirality-violators that we DO add modifiers to be `STANDARD_ONLY` too, or do any need a different vector?

**My lean:** All 15 are `STANDARD_ONLY` to start. Revisit when modifiers are richer.

### Q7. UI workflow

The current primitive-form already has the new picker wired in. Once the schema/UI enforces the chirality rule (option 3 in Q1), the manual rebuild work happens through that form. Are you comfortable with the form as the rebuild tool, or do you want a dedicated "rebuild primitive" wizard with checklist-style guidance (e.g. "Pick its trigger condition → Pick its mirror vector → Pick its target stat → Done")?

**My lean:** Form is fine for now. Wizard is a v2 polish.

---

## What I need from you to start

Answer Q1-Q7 (or say "go with your lean on all of them"). Once I have your answers I'll write a Phase 7.5 spec doc with concrete milestones and start the first one.