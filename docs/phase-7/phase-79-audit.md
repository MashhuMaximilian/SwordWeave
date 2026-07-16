# Phase 7.9 — Primitive Modifier Rewrite (Re-Audit)

**Created:** 2026-07-16, mid Phase 7.9 kickoff.
**Status:** 7.9.0 complete (this audit). 7.9.1+ pending.
**Audit script:** `scripts/_audit-phase79-new.ts` (run with `pnpm exec tsx`).
**Source of truth for primitive model:** `docs/phase-7/phase-7.5-modifier-rebuild-spec.md`.

---

## TL;DR

The 146 canonical primitives in the DB break down as:

| Class | Count | Meaning |
|---|---|---|
| **SKIP** | 29 | Structural atom — no mechanical payload, exists for tier/permission reference. No modifier needed. |
| **DONE** | 2 | Modifier already authored. Both have **chirality drift** to fix. |
| **NEEDS_MOD** | 115 | Has a meaningful mechanical payload. Needs 1 modifier authored (op + target + value + condition + stack-rule). |

**Net work:** author **115 modifier definitions** + **fix 2 chirality drifts** + **deprecate the `is_mirrorable` field as stored data** (make it derived from modifier op).

Of the 115 NEEDS_MOD, **13 are flagged `is_mirrorable=true`** in the DB today (the "13 carryover" from Phase 7.5). These get a non-`set` op and the mirrorability is auto-derived.

---

## The new model (locked 2026-07-16)

Confirmed in round-3 discussion:

1. **A primitive is a thing.** It can be a stat, flag, tag, verb-permission, mechanic, or pure flavor. The category is descriptive, not gating.
2. **At most 1 modifier per primitive** (DB CHECK constraint from migration `0033_phase7_mirror_one_modifier`).
3. **A primitive without a modifier is pure flavor** — exists so a capability can reference it by name, but produces no mechanical effect.
4. **Mirrorability is op-driven** — `set` is the only non-mirrorable op; everything else (add, subtract, multiply, divide, min, max, grant, revoke) has a chiral pair per `OP_SPECS`. The stored `is_mirrorable` field is a hint; the derived value (from op) is the source of truth.
5. **Mirror is at the capability/affect layer, not the primitive layer.** The primitive's form has no mirror UI. The capability that *uses* a mirrorable primitive is itself mirrorable; the capability chooses which of its primitive's modifiers to mirror at use time.

**Verbs (Strike, Dodge, etc.) are not primitives.** The 4 VERB_TIER rows are permission unlocks — buying Verb Tier I lets you use any Tier I verb. The specific verb is named in the capability description, not as a separate primitive. (Adding individual verbs as primitive tags is over-engineering per Mashu; skipped for now.)

**Domain licenses are not primitives either.** The 4 DOMAIN tier rows are access markers. Specific domains (Fire, Water, Storm, etc.) are user-authored via the fork/version system.

---

## The 29 SKIP rows (structural atoms)

These exist for tier/permission reference, not as mechanical payloads. They do not get modifier definitions. They are reference points for capabilities to point at.

| Category | Count | Examples |
|---|---|---|
| `VERB_TIER` | 4 | Verb Access Tier I-IV (permission unlocks) |
| `DOMAIN` | 4 | Domain Access Tier I-IV (license unlocks) |
| `RANGE` | 7 | Close, Near, Far, Very Far, Extreme, World, Self/Touch (distance gates) |
| `DURATION` | 6 | Instant, Short, Medium, Long, Persistent, Permanent (time gates) |
| `SIZING` | 4 | Linear, Cone, Sphere, Wall (geometric shape templates) |
| `CONDITION` | 4 | Physical Interaction, Sensory, Cognitive, System (semantic state tags) |

**Total: 29 rows. No modifier, no mirror.**

If a user needs a more specific version of any of these (e.g. a specific domain like "Storm" or a specific range gate like "60ft exactly"), they fork the tier primitive via the version system. The fork inherits the tier structure and can add a modifier payload for the specific case.

---

## The 2 DONE rows (with chirality drift)

| ID | Name | Category | BU | Current op | Current target | Current value | Chirality |
|---|---|---|---|---|---|---|---|
| 19 | Minor Die Block | INTENSITY_DICE | 1 | `add` | `action.damage` | `"1d4"` | drift: stored=false, derived=true |
| 18 | Vector Split | TARGETING | 4 | `add` | `action.targetCount` | `1` | drift: stored=false, derived=true |

Both use `op=add` which per `OP_SPECS` IS mirrorable (chiral pair = `subtract`). The stored `is_mirrorable=false` is stale. **Fix in 7.9.1:** set stored `is_mirrorable=true` to match derived.

**Why did the drift happen?** Pre-Phase-7.5, the `is_mirrorable` column was a manually-curated boolean. The op-driven model replaced it, but the existing 2 rows didn't get their `is_mirrorable` flag updated. The migration `0033` only backfilled `mirror_bu_credit`, not `is_mirrorable`.

---

## The 115 NEEDS_MOD rows

These all need 1 modifier authored. Each modifier has:
- **Operation** (`add`/`subtract`/`multiply`/`divide`/`set`/`min`/`max`/`grant`/`revoke`)
- **Target** (one of 15 axes: `attribute`, `practice`, `defense_dc`, `speed`, `max_vitality`, `current_vitality`, `proficiency_bonus`, `action_roll`, `skill_practice_check`, `damage_healing_output`, `targeting`, `duration`, `strain`, `item_slot_cost`, `scene_pace`, `behavior`)
- **Value** (a `ValueToken[]` — number, dice, behavior-key, or runtime token like `+PB`)
- **Condition** (optional — a v1 `ConditionAuthoring` describing when the modifier fires)
- **Stack rule** (one of 6: `stack`, `highest-only`, `lowest-only`, `unique-by-primitive`, `unique-by-target`, `replace`)

Of the 115, **13 are flagged `is_mirrorable=true`** in the DB today. These are the Phase-7.5 carryover. They get a non-`set` op, and mirrorability is auto-derived from the op.

### Breakdown by category

| Category | Count | Of which is_mirrorable=true |
|---|---|---|
| ACTION_ECONOMY | 11 | 0 |
| AGENCY_OVERRIDE | 4 | 0 |
| BOSS_ECONOMY | 5 | 0 |
| DEFENSIVE | 7 | 3 (Kinetic Hardening, Warding Shell, Psychic Firewall) |
| EVALUATION_STRAIN | 9 | 1 (Vitality Shielding) |
| INTENSITY_DICE | 6 | 0 |
| KINETIC_CONTROL | 4 | 0 |
| METAMORPHOSIS | 4 | 0 |
| MOBILITY_LOCOMOTION | 6 | 1 (Stride Extension) |
| PERCEPTION_QUALIFIER | 4 | 0 |
| PRACTICE_PROGRESSION_AUGMENT | 5 | 0 |
| PROBABILITY_BIAS | 7 | 3 (Negative Bias I, II, III) |
| SENSORY_ARRAY | 4 | 0 |
| SHEET_AUGMENT | 8 | 5 (Attribute Increment, Attack Bonus Increment, Vitality Core Augment I/II/III) |
| SPEED_QUICKENING | 4 | 0 |
| TACTICAL | 4 | 0 |
| TARGETING_AOE | 10 | 0 |
| TEMPORAL_CHRONOLOGICAL | 7 | 0 |
| TRIGGER_HOOK | 4 | 0 |
| VITALITY | 3 | 0 |

---

## Execution plan (in order)

### 7.9.1 — Author the 13 mirrorable carryover (Priority 1)

**Design decision (Mashu, round 4): Option A — keep the 3 Negative Bias rows as 3 distinct seeds.**

The canonical primitives are *seeds*, not specifics. Forks inherit the
seed's scope and add specifics (which focus, which practice, which
attribute). The 3 Negative Bias rows are 3 different BU-priced seeds
for 3 different scope tiers — kept as-is.

**Fork guidance goes in `narrative_rule`** (the long-form description)
as a disclaimer: "This is a seed. Fork it to specify [scope]. For
example, fork 'Attribute Increment' into '+1 to Physical' for a 12 BU
primitive that targets the Physical attribute specifically."

We will **NOT** add a structured "how to fork" field. The disclaimer
is free text in `narrative_rule`. This keeps the schema simple and
lets the author describe the fork path in their own words.

These are the explicit Phase-7.5 commitment. Each gets 1 modifier with a non-`set` op so mirrorability is auto-derived.

**The 13:**

1. **Attribute Increment** (SHEET_AUGMENT, 12 BU) — op=`add`, target=`attribute`, value=`1` (the author picks which of physical/mental/magical-abstract via the value token)
2. **Attack Bonus Increment** (SHEET_AUGMENT, 6 BU) — op=`add`, target=`action_roll.attack_bonus`, value=`1`
3. **Vitality Core Augment I** (SHEET_AUGMENT, 4 BU) — op=`add`, target=`max_vitality`, value=`5`
4. **Vitality Core Augment II** (SHEET_AUGMENT, 8 BU) — op=`add`, target=`max_vitality`, value=`12`
5. **Vitality Core Augment III** (SHEET_AUGMENT, 12 BU) — op=`add`, target=`max_vitality`, value=`20`
6. **Kinetic Hardening** (DEFENSIVE, 6 BU) — op=`add`, target=`defense_dc.physical`, value=`1`
7. **Warding Shell** (DEFENSIVE, 6 BU) — op=`add`, target=`defense_dc.magical`, value=`1`
8. **Psychic Firewall** (DEFENSIVE, 6 BU) — op=`add`, target=`defense_dc.mental`, value=`1`
9. **Vitality Shielding** (EVALUATION_STRAIN, 10 BU) — op=`grant`, target=`behavior:vitality_shielding` (the behavior is a flag, not a number — see design note below)
10. **Stride Extension** (MOBILITY_LOCOMOTION, 5 BU) — op=`add`, target=`speed.walk`, value=`10` (ft)
11. **Negative Bias I — Narrative Focus** (PROBABILITY_BIAS, 3 BU) — op=`grant`, target=`behavior:disadvantage` + condition
12. **Negative Bias II — Named Practice** (PROBABILITY_BIAS, 6 BU) — op=`grant`, target=`behavior:disadvantage` + condition
13. **Negative Bias III — Core Attribute** (PROBABILITY_BIAS, 12 BU) — op=`grant`, target=`behavior:disadvantage` + condition

**Plus the 2 DONE row chirality fixes** — set `is_mirrorable=true` on Vector Split and Minor Die Block to match the derived value (they already use `op=add`).

**Design notes for the tricky 4:**

- **Vitality Shielding (9):** This is a *behavior grant*, not a numerical modifier. The modifier grants `behavior:vitality_shielding` to the entity; at runtime the engine checks if the entity has the behavior and applies halving when upfront Vitality cost is taken. No condition needed (the runtime check is part of the engine's behavior resolution, not the modifier's condition).
- **Negative Bias I/II/III (11-13):** These need a **condition** on the modifier — the bias applies only in the specific scope (Narrative Focus / Named Practice / Core Attribute). The v1 condition shape handles this with categories and pills.
- **Stride Extension (10):** The value is in feet; the target is `speed.walk`. The engine resolves this to a character-sheet speed value at runtime.
- **Attribute Increment (1):** The author needs to choose which attribute (physical/mental/magic-abstract) at write time. The "Attribute Increment" primitive is the base; specific attributes are forks.

### 7.9.2 — Author the ~50 stat-like group (1-2 days)

Stat-like = direct numerical/behavioral stat changes, easiest to author because the modifier is a simple op on a clear target.

Categories in this group:
- **DEFENSIVE** (7, minus the 3 mirrorable done in 7.9.1 = 4 more): Universal Aegis (+1 all defenses), Absolute Insulation (domain immunity grant), Reactive Bulwark (reaction shield grant), Structural Hardening (resistance grant)
- **VITALITY** (3): Vitality Augments I/II/III (mirrorable — these are the 3 from 7.9.1) + 1-2 more variants
- **INTENSITY_DICE** (5 more, excluding Minor Die Block): Standard Die Block, Heavy Die Block, Impact Die Block, Calamity Die Block, Existential Tear
- **PRACTICE_PROGRESSION_AUGMENT** (5): Focused Edge, Practice Proficiency, Expertise Upgrade, Reliable Practice, Broad Familiarity
- **MOBILITY_LOCOMOTION** (5 more, excluding Stride Extension): Aquatic Unlock, Subterranean Bore, Aero Unlock, Phase Slip, Hover Precision
- **SENSORY_ARRAY** (4): Umbral Sight I, Substrate Echo, Umbral Sight II, Tactile Echo
- **PERCEPTION_QUALIFIER** (4): Environmental Translation, Systemic Resonance, Non-Material Translation, Existential Clarity

**Total: ~28 in this group. Add the 13 from 7.9.1 = 41. Remaining ~74 for 7.9.3.**

### 7.9.3 — Author the ~50 verb-like group (2-3 days)

Verb-like = complex system overrides, harder because they touch multiple engine tracks.

Categories in this group:
- **ACTION_ECONOMY** (11): timeline / reaction / window primitives
- **PROBABILITY_BIAS** (4 more, excluding the 3 Negative Bias from 7.9.1): Positive Bias I/II/III, Causal Override
- **BOSS_ECONOMY** (5): Legendary Cadence I/II/III, Existential Imperative, Mythic Safeguard
- **TRIGGER_HOOK** (4): Direct Material, Systemic Threshold, Conditional Informational, Interceptive Causal
- **SPEED_QUICKENING** (4): Standard, Fast, Instant, Reaction
- **KINETIC_CONTROL** (4): Minor Linear Displacement, Velocity Arrest, Advanced Vector, Systemic Kinetic Override
- **AGENCY_OVERRIDE** (4): Impulse Nudge, Behavioral Directive, Direct Executive Override, Existential Allegiance Bind
- **EVALUATION_STRAIN** (8 more, excluding Vitality Shielding from 7.9.1): Heuristic Buffer, Systemic Sink, Volatile Vent, Condition Insulation, Domain Lock Shield, Hazard Transmutation, Narrative Pivot, CV Matrix Trap
- **METAMORPHOSIS** (4): Composition Tuning, Volumetric Scale Shift, State Transmutation, Polymorphic Overwrite
- **TEMPORAL_CHRONOLOGICAL** (7): Chronological Echo, Dormant Trigger Hook, Timeline Tether, Duration Anchor, Perpetual Lock, Kinetic Stasis, Temporal Isolate
- **TARGETING_AOE** (10): Vector Split (DONE), Bouncing Vector, Collateral Buffer, Selective Focus, Linear/Conical Vector, Kinetic Sphere, Stationary Zone, Mobile Aura, Structural Wall, Volume Scaling I, Global Field
- **TACTICAL** (4): TBD category — needs investigation

**Total: ~74 in this group.**

### 7.9.4 — Migration script (2-3 hours)

A TypeScript script that:
1. Reads modifier definitions from `docs/phase-7/phase-79-modifier-proposals.md` (a single source of truth doc)
2. Applies to the 117 rows (115 NEEDS_MOD + 2 DONE chirality fix)
3. Recomputes `content_hash` for each row
4. Creates new `primitive_versions` rows for each update
5. Verifies all 117 have a valid 1-modifier shape and that `is_mirrorable` matches derived

Idempotent: re-running against an already-updated DB is a no-op.

### 7.9.5 — Tests (3-4 hours)

- For each of the 117 modifier-bearing rows: an `applyMirror` round-trip test (mirror in, mirror out, should equal original for non-`set` ops)
- For condition-bearing modifiers (the 3 Negative Bias): a condition evaluation test (v1 condition shape)
- For the migration: an idempotency test (run twice, second time is no-op)
- For the 2 DONE rows: chirality drift regression test

---

## The 4 design questions (resolved in round 3)

1. **The verb case:** Verbs (Strike, Dodge, etc.) are not separate primitives. The 4 VERB_TIER rows are permission unlocks. The specific verb is named in the capability description, not as a separate primitive row.
2. **The mechanic case (Block example from screenshot):** Compound rules flatten into a single op + a condition. The Block mechanic = (a) a primitive that grants `behavior:block` with a value (e.g. "Block = 12"), (b) a primitive that does `subtract value from damage when condition [actor is blocking]`. The runtime token reference (`+block`) carries the cross-primitive link; the v1 condition carries the trigger. No compound-rule machinery needed in the engine.
3. **The 13 mirrorable classification:** Confirmed as 13 of the 115 NEEDS_MOD. The remaining 102 NEEDS_MOD are not mirrorable per the new model (their modifier op will be `set` for the permission ones, or `add`/`grant` for stats that don't have a meaningful inverted form).
4. **The target axis:** The 15 target axes from the closeout spec are the canonical target vocabulary. The audit's `target_scope` field in the DB (when present) gives a hint of which axis is intended.

---

## Open question for round 4

For the 102 non-mirrorable NEEDS_MOD, which op should each one use? Some are obvious:
- **Stat changes** (Vitality augments, Defensive) → `add`
- **Behavior grants** (Darkvision, Tremorsense) → `grant`
- **Flag sets** (is_blind, is_stunned) → `set` (boolean value, makes them non-mirrorable)

But the verb-like group (Action Economy, Boss Economy, etc.) is less clear. Some candidates:

- **Timeline Shift / Minor Window Grant** (ACTION_ECONOMY) — op=`add` to `action_roll.action_window`? Or `grant` to a `behavior:minor_window` flag?
- **Legendary Resistance 1x/Day** (BOSS_ECONOMY) — op=`grant` to `behavior:legendary_resistance` with stack-rule `unique-by-target`?
- **Clash Dominance** (ACTION_ECONOMY) — op=`add` to `action_roll.reaction_clash` with value `2` (advantage)?

**My recommendation:** for 7.9.1 (the 13 mirrorable), I'll propose a default modifier for each and you review. For 7.9.2 and 7.9.3, I'll do the same per-category batch and you review before I write to the DB.

**Confirm or correct, Mashu:**
1. The 29 SKIP / 2 DONE / 115 NEEDS_MOD classification is right?
2. The 7.9.1-7.9.5 sequence is right?
3. The 13 mirrorable carryover (7.9.1) is the right starting point?
4. I should propose default modifiers for review (not write directly to DB)?
