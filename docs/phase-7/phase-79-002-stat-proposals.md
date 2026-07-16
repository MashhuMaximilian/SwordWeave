# Phase 7.9.2 — Stat-Like Modifier Proposals

**Status:** Awaiting Mashu sign-off. 27 proposed modifiers.

The "stat-like" group: direct numerical/behavioral changes, easier to
author than the verb-like group. 6 categories:

- DEFENSIVE (4) — non-mirrorable, but most use `add`/`grant` so will
  become mirrorable per the new model
- INTENSITY_DICE (5) — dice damage/healing, all use `add` (mirrorable)
- PRACTICE_PROGRESSION_AUGMENT (5) — practice/PB modifiers, behavior grants
- MOBILITY_LOCOMOTION (5, excluding Stride Extension done in 7.9.1) —
  speed unlocks, behavior grants
- SENSORY_ARRAY (4) — sensory unlocks, behavior grants
- PERCEPTION_QUALIFIER (4) — perception tier unlocks, behavior grants

**Pattern:** Most use `op=grant` with a behavior target. The engine
reads the behavior flag at resolution time and applies the mechanic.
This sidesteps the "multiply-out" outstanding work in the spec —
the engine implements the behavior at runtime.

**Note on mirrorability:** Per the new model, mirrorability is derived
from op. `add` and `grant` are both mirrorable. The original canonical
flags had `is_mirrorable=false` for some of these — that was the
old stored model. After 7.9.2, the stored flag will be updated to
match derived. The fork guidance explains the mirror semantics where
relevant (e.g. "+1d6 damage mirrored = -1d6, which is damage reduction").

---

## DEFENSIVE (4)

| ID | Name | Op | Target | Value | Stack | Mirror | Notes |
|---|---|---|---|---|---|---|---|
| 385 | Universal Aegis | `add` | `defense_dc.physical` | 1 | `stack` | yes (drift: was false, derived true) | SEED — fork to apply to specific defense. Mirror = "vulnerability across all defenses" |
| 386 | Reactive Bulwark | `grant` | `behavior:reactive_bulwark` | 1 | `unique-by-primitive` | yes | Engine adds +2 to defenses when target uses a reaction |
| 387 | Structural Hardening | `grant` | `behavior:domain_resistance` | 1 | `unique-by-target` | yes | Engine halves damage from one domain. Fork to specify the domain in a condition |
| 388 | Absolute Insulation | `grant` | `behavior:domain_immunity` | 1 | `unique-by-target` | yes | Engine zeroes damage from one domain. Fork to specify the domain in a condition |

**Design decision: Universal Aegis target = `defense_dc.physical`.**
The seed applies +1 to physical defense. To apply to magical or
mental, fork and change the target. To apply to all 3 (the "true"
Universal Aegis), the user creates 3 separate primitives (one per
defense) and composes them in a capability. Or, the engine can be
extended later to support a multi-target modifier.

---

## INTENSITY_DICE (5, excluding Minor Die Block done in 7.9.1)

| ID | Name | Op | Target | Value | Stack | Mirror |
|---|---|---|---|---|---|---|
| 389 | Standard Die Block (1d6) | `add` | `action.damage` | `"1d6"` | `stack` | yes (drift: was false, derived true) |
| 390 | Heavy Die Block (1d8) | `add` | `action.damage` | `"1d8"` | `stack` | yes (drift: was false, derived true) |
| 391 | Impact Die Block (1d10) | `add` | `action.damage` | `"1d10"` | `stack` | yes (drift: was false, derived true) |
| 392 | Calamity Die Block (1d12) | `add` | `action.damage` | `"1d12"` | `stack` | yes (drift: was false, derived true) |
| 393 | Existential Tear (1d20) | `add` | `action.damage` | `"1d20"` | `stack` | yes (drift: was false, derived true) |

**Mirror semantics:** Mirror of `add 1d6` = `subtract 1d6` = "1d6
damage reduction." This is the canonical "Vulnerability Inverse"
pattern — accepting a structural fault for BU credit (per BU Market
doc §"Vulnerability Inverse").

---

## PRACTICE_PROGRESSION_AUGMENT (5)

All behavior grants. The engine reads the behavior flag and applies
the practice modifier mechanic.

| ID | Name | Op | Target | Value | Stack | Notes |
|---|---|---|---|---|---|---|
| 56 | Broad Familiarity | `grant` | `behavior:broad_familiarity` | 1 | `unique-by-primitive` | Engine adds half PB (rounded down) to all non-proficient checks |
| 57 | Focused Edge | `grant` | `behavior:focused_edge` | 1 | `unique-by-primitive` | Engine adds Narrow Advantage on one Narrative Focus. Fork to specify the focus in a condition |
| 58 | Practice Proficiency | `grant` | `behavior:practice_proficiency` | 1 | `unique-by-primitive` | Engine adds full PB to one Named Practice. Fork to specify the practice in a condition |
| 59 | Expertise Upgrade | `grant` | `behavior:expertise_upgrade` | 1 | `unique-by-primitive` | Engine doubles PB for one Named Practice. Fork to specify the practice. Prereq: Practice Proficiency |
| 60 | Reliable Practice | `grant` | `behavior:reliable_practice` | 1 | `unique-by-primitive` | Engine establishes d20 floor of 10 for one Named Practice. Fork to specify the practice. Prereq: Expertise Upgrade |

All 5 are **seeds**. The specific practice is picked at fork time
via the modifier's condition.

---

## MOBILITY_LOCOMOTION (5, excluding Stride Extension done in 7.9.1)

| ID | Name | Op | Target | Value | Stack | Notes |
|---|---|---|---|---|---|---|
| 219 | Aquatic Unlock | `grant` | `behavior:swim_speed` | 1 | `unique-by-primitive` | Engine grants swim speed = baseline land speed |
| 220 | Subterranean Bore | `grant` | `behavior:burrow_speed_15ft` | 1 | `unique-by-primitive` | Engine grants 15 ft burrow speed through soft earth/sand |
| 221 | Aero Unlock | `grant` | `behavior:fly_speed` | 1 | `unique-by-primitive` | Engine grants fly speed = baseline land speed |
| 222 | Phase Slip | `grant` | `behavior:incorporeal_movement` | 1 | `unique-by-primitive` | Engine treats solid barriers as difficult terrain |
| 223 | Hover Precision | `grant` | `behavior:hover_precision` | 1 | `unique-by-primitive` | Engine grants 60 ft fly speed + hover state |

All use `unique-by-primitive` stack rule — you only need one swim
speed grant, multiple stack into one.

---

## SENSORY_ARRAY (4)

| ID | Name | Op | Target | Value | Stack |
|---|---|---|---|---|---|
| 214 | Umbral Sight I (Darkvision 60ft) | `grant` | `behavior:darkvision_60ft` | 1 | `unique-by-primitive` |
| 215 | Substrate Echo (Tremorsense 30ft) | `grant` | `behavior:tremorsense_30ft` | 1 | `unique-by-primitive` |
| 216 | Umbral Sight II (Darkvision 120ft) | `grant` | `behavior:darkvision_120ft` | 1 | `unique-by-primitive` |
| 217 | Tactile Echo (Blindsight 30ft) | `grant` | `behavior:blindsight_30ft` | 1 | `unique-by-primitive` |

---

## PERCEPTION_QUALIFIER (4)

| ID | Name | Op | Target | Value | Stack |
|---|---|---|---|---|---|
| 171 | Environmental Translation | `grant` | `behavior:perception_environmental` | 1 | `unique-by-primitive` |
| 172 | Systemic Resonance | `grant` | `behavior:perception_systemic` | 1 | `unique-by-primitive` |
| 173 | Non-Material Translation | `grant` | `behavior:perception_non_material` | 1 | `unique-by-primitive` |
| 174 | Existential Clarity | `grant` | `behavior:perception_existential` | 1 | `unique-by-primitive` |

---

## Summary of the 27

- **4 `add` modifiers** (3 Defensive that I changed from `grant` to `add` for the +N pattern, but actually only Universal Aegis is `add`; the others are `grant`) — wait, recount:
  - **1 `add`** (Universal Aegis)
  - **5 `add`** (5 Intensity Dice)
  - **21 `grant`** (everything else: 3 Defensive + 5 Practice + 5 Mobility + 4 Sensory + 4 Perception)

- **All non-`set`** → all 27 are mirrorable per the new model.
  - Of the 27, all have `is_mirrorable=false` stored currently.
  - The migration flips all 27 to `true`. **This is a real behavior
    change** — these primitives were non-mirrorable, now they're
    mirrorable. The fork guidance will explain the mirror semantics.
  - If you want any of them to stay non-mirrorable, we'd need a
    different op (e.g. `set` instead of `add`). That would change
    the semantics. Confirm if you want any of them flipped to non-mirrorable.

## Drift count after 7.9.2

- BEFORE 7.9.2: 0 chirality drift on 15 DONE rows
- AFTER 7.9.2: 0 drift (the 27 new rows have stored=true matching derived=true)

## Mirrorability flip — what it means in practice

For each of the 27, the mirror produces a "Vulnerability Inverse":
- Universal Aegis mirrored = -1 to all 3 defenses (Vulnerability)
- Standard Die Block mirrored = -1d6 damage (Damage Reduction)
- Practice Proficiency mirrored = -PB on the practice (Flaw)
- Darkvision mirrored = no darkvision (revoke — but `grant` mirror is `revoke` which is correct)

The 5 Intensity Dice mirrors are particularly powerful — they let a
character "purchase" damage reduction at the cost of BU. That's the
canonical Vulnerability Inverse pattern from the BU Market doc.

**Confirm or correct:**
1. All 27 modifiers as proposed (specific op/target/value)?
2. The 27 stored `is_mirrorable=false → true` flip — is that the right call?
3. Universal Aegis SEED pattern (`defense_dc.physical` only, fork for others) — OK?
4. Practice Progression as 5 behavior grants — OK, or want me to model some as `add` to `proficiency_bonus.PB`?
5. Reliable Practice as `grant behavior:reliable_practice` + condition for the practice — OK?
