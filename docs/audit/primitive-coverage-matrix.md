# Primitive Coverage Matrix — Phase 7-B Audit

**Date:** 2026-07-14
**Sources:** 15 canonical Notion pages (see `docs/audit-sources/`).
**DB state:** 139 canonical primitive rows.
**Goal:** Map every game mechanic referenced by the canonical engine to
the primitive(s) that cover it, flagging any mechanics with no
representation.

## Reading the matrix

| Symbol | Meaning |
|---|---|
| ✅ | Fully covered by at least one primitive; usable as-is |
| ⚠️ | Partial coverage — primitive exists but the wording is ambiguous, missing a layer, or covers only one of several flavors |
| ❌ | Not covered — game mechanic referenced in canonical pages, no primitive rows in DB |
| 🔍 | Audit-deferred — needs human review or external reference to confirm |

Coverage levels for "modifier" rows are depth-checked against the
targetScope helper (`src/lib/primitives/target-scope.ts`) to make
sure they can actually be slotted into a capability with the right
scope.

---

## 1. Damage Resolution

System: `docs/audit-sources/11-damage-resistance.md`

# Source types are **Physical / Magical / Psychic** (one of three
# execution categories; the engine's canonical damage-source axis).

# Page 11 maps source types to attributes for resolution:
# - Physical damage → uses Physical modifier
# - Magical damage → uses Magical/Abstract modifier
# - Psychic damage → uses Mental modifier
# So Psychic source-type resistance checks against the Mental attribute.

# Mapping (Phase 7 + user's final clarification, 2026-07-14):
#   - "Mental"     = the **Attribute name** for cognition/awareness axis
#   - "Magical/Abstract" = the **Attribute name** for supernatural axis
#                     (either word correct; canonical defers to user)
#   - "Psychic"    = the **damage source / execution category** only
#   - "Physical"   = the **Attribute name AND the damage source**
#
# This means there's no inconsistency — Psychic Firewall (which
# targets Mental defense) is correctly named; Mental is the attribute
# the Psychic source-type attacks.

Source types: **Physical / Magical / Psychic** (canonical stays).
Attributes remain: **Physical / Mental / Magical-Abstract**.

| Mechanic | Coverage | Primitive(s) | Notes |
|---|---|---|---|
| Source Type (Physical / Magical / Psychic) | n/a | — | Runtime metadata, not a primitive |
| Single-domain damage | ✅ | `INTENSITY_DICE` (6 rows: 1d4 Minor → 1d20 Existential Tear) | Dice expression is the metric itself |
| Multi-domain damage | ✅ | `INTENSITY_DICE` + `DOMAIN` (4 tiers) | Already covered by combining |
| Resistance (½ damage) | ✅ | `DEFENSIVE`/Structural Hardening (Domain Resistance) | Mirrorable |
| Vulnerability (2× damage) | ✅ | Mirror of Resistance | Per Phase 7 mirror-vector architecture |
| Immunity (0 damage) | ✅ | `DEFENSIVE`/Absolute Insulation (Domain Immunity) | Mirrorable |
| Multiple resistances stack | 🔍 | — | Engine rule says no (canonical), no primitive needed |
| Resistance + Vulnerability cancel | 🔍 | — | Engine resolution rule, no primitive needed |
| Hybrid damage (split/dual per source) | 🔍 | — | Engine resolution rule; capability-level |

**Gaps:**
- The "Source Type" attribute is `Mental` or `Psychic` depending on which
  page you read. **Notion Page 11 (damage-resistance) uses `Psychic`.
  Page 7 (action economy) and several legacy rows still say `Mental`.**
  ⚠️ Naming inconsistency needs resolving before content expansion.
  **Recommend canonical rename: Mental → Psychic** in the BU Market
  page and the SHEET_AUGMENT scope vocabulary.

---

## 2. Defense & Saves

System: `11-damage-resistance.md` (light) + `06-combat-rhythm.md` +
`15-combat-engine-resolution-pipeline.md`

| Mechanic | Coverage | Primitive(s) | Notes |
|---|---|---|---|
| Saving throw (Defense roll) | ⚠️ | `DEFENSIVE` (Kinetic Hardening, Warding Shell, Psychic Firewall) | Sheath covers 3 named metrics; defense formula needs unified via `targetScope: METRIC/DEFENSE_ROLL` |
| Defensive Save Upgrade (proficiency in saves) | ✅ | `SHEET_AUGMENT`/Defensive Save Upgrade | `targetScope: ATTRIBUTE` |
| Cover bonus | ❌ | — | Tactical Subsystems page references this; no primitive exists yet. **Gap.** |
| Universal defense (+1 to all) | ✅ | `DEFENSIVE`/Universal Aegis | |
| Resistance-bonus when targeted | ✅ | `DEFENSIVE`/Reactive Bulwark | Reaction-triggered |
| Save order selection (which attribute is your save) | 🔍 | — | Engine rule, system-prop |

**Gaps:**
- ❌ **Cover bonus** is described in 5 pages but has no primitive.
  Recommend adding `TACTICAL` (or `TARGETING`) primitive "Cover Bonus (+N to Defense when in cover)". May want a tier range: Cover Tier I (Half-cover) / II (3/4-cover) / III (Full-cover) / IV (Total cover).

---

## 3. Action Economy

System: `07-action-economy.md`, `06-combat-rhythm.md`

| Mechanic | Coverage | Primitive(s) | Notes |
|---|---|---|---|
| Standard Action Window | 🔍 | — | Runtime concept; no BU cost |
| Bonus / Minor action | 🔍 | — | Engine concept |
| Reaction slot (+1) | ✅ | `ACTION_ECONOMY`/Reaction Pulse | `targetScope: REACTION_SLOT` |
| Reaction slot efficiency (+2 to Reaction Clash) | ✅ | `ACTION_ECONOMY`/Reaction Reflex | |
| Reaction Clash | ✅ | `ACTION_ECONOMY`/Clash Dominance | |
| Auto-win Reactions on ties | ✅ | `ACTION_ECONOMY`/Interceptive Priority | |
| Track displacement (off-turn demotion) | ✅ | `ACTION_ECONOMY`/Timeline Anchor | |
| Initiative shift | ✅ | `ACTION_ECONOMY`/Timeline Shift / Minor Window Grant | |
| Track acceleration (Heavy → Fast etc.) | ✅ | `ACTION_ECONOMY`/Track Acceleration | |
| Haste (extra Standard Action) | ✅ | `ACTION_ECONOMY`/Core Action Multiplication (Haste Vector) | |
| Stun (no actions, no reactions) | ✅ | `ACTION_ECONOMY`/Absolute Timeline Deprivation | |
| Slow track (delay Heavy to Measured) | ✅ | `ACTION_ECONOMY`/Heavy Compactor | |
| Multiple actions per turn (beyond Haste) | ❌ | — | No explicit "2-Action Turn" primitive. May be subsumed by Haste Vector stacking. **Verify.** |

**Gaps:**
- ❌ Continuous **action denial beyond Stun** — slow / paralyzed / petrified are usually `CONDITION` rows, not action-economy rows. Confirm with `CONDITION` chart.

---

## 4. Movement & Locomotion

System: `06-combat-rhythm.md`, `01-bu-market.md`

| Mechanic | Coverage | Primitive(s) | Notes |
|---|---|---|---|
| Stride Extension (+10 ft) | ✅ | `MOBILITY_LOCOMOTION`/Stride Extension | Mirrorable |
| Swim Speed | ✅ | `MOBILITY_LOCOMOTION`/Aquatic Unlock | |
| Burrow Speed | ✅ | `MOBILITY_LOCOMOTION`/Subterranean Bore | |
| Flight Speed | ✅ | `MOBILITY_LOCOMOTION`/Aero Unlock | |
| Climb Speed | ✅ | `MOBILITY_LOCOMOTION`/Hover Precision (interpretive) | |
| Phase-Shift (incorporeal movement) | ✅ | `MOBILITY_LOCOMOTION`/Phase Slip | |
| Teleport | ❌ | — | Not represented. **Gap.** |
| Forced movement (knockback) | 🔍 | — | Engine runtime, capability-level composition |
| Difficult terrain penalty | 🔍 | — | Engine runtime, scene-defined |

**Gaps:**
- ❌ **Teleport** — phase slip covers incorporeal movement but not intentional spatial jumps. May want a `MOBILITY_LOCOMOTION`/Teleport row.

---

## 5. Probability & Bias

System: `01-bu-market.md` (mirror-vector architecture).

All 7 PROBABILITY_BIAS rows exist. **No new rows needed.**

| Mechanic | Coverage | Tier | Mirrorable | Notes |
|---|---|---|---|---|
| Narrative Focus (ultra-narrow trigger) | ✅ | I | Yes (Neg) | `targetScope: NARROW_FOCUS` |
| Named Practice (single practice axis) | ✅ | II | Yes (Neg) | `targetScope: PRACTICE` |
| Core Attribute (whole axis) | ✅ | III | Yes (Neg) | `targetScope: ATTRIBUTE` |
| Causal Override (no roll, fixed value) | ✅ | IV | No | `targetScope: DICE/D20` |

**Gaps:** None.

---

## 6. Practice Progression

System: `03-practice-skill-system.md` (lines 666-783 are canonical
progression tiers).

All 5 PRACTICE_PROGRESSION_AUGMENT rows exist. **No new rows needed.**

| Mechanic | Coverage | Cost | Notes |
|---|---|---|---|
| Broad Familiarity (½ PB to all non-proficient checks) | ✅ | 8 BU | `targetScope: ALL` |
| Focused Edge (Narrow Advantage on a Narrative Focus) | ✅ | 3 BU | `targetScope: NARROW_FOCUS` |
| Practice Proficiency (+PB to one Practice) | ✅ | 4 BU | `targetScope: PRACTICE` |
| Expertise Upgrade (+2× PB on one Practice) | ✅ | 8 BU | `targetScope: PRACTICE` |
| Reliable Practice (d20 floor of 10) | ✅ | 12 BU | `targetScope: PRACTICE` |

**Gaps:** None.

---

## 7. Sheet Augments (Global Stats)

| Mechanic | Coverage | Cost | Notes |
|---|---|---|---|
| +5 Max HP | ✅ | 4 BU | `targetScope: METRIC/HP` |
| +12 Max HP | ✅ | 8 BU | `targetScope: METRIC/HP` |
| +20 Max HP | ✅ | 12 BU | `targetScope: METRIC/HP` |
| +1 Character DC | ✅ | 4 BU | `targetScope: METRIC/CHARACTER_DC` |
| +1 to all Attack Rolls | ✅ | 4 BU | `targetScope: METRIC/ATTACK_ROLL` |
| +1 to baseline Attack (max +1/level) | ✅ | 6 BU | `targetScope: METRIC/ATTACK_ROLL` |
| +1 Attribute Score | ✅ | 12 BU | `targetScope: ATTRIBUTE` |
| Defensive Save Proficiency | ✅ | 4 BU | `targetScope: ATTRIBUTE` |

**Gaps:** None.

---

## 8. Defensive Stats (Resistance/Immunity/Domain Lock)

| Mechanic | Coverage | Cost | Notes |
|---|---|---|---|
| +1 Physical Defense (stacks) | ✅ | 6 BU | Mirrorable |
| +1 Magical Defense (stacks) | ✅ | 6 BU | Mirrorable |
| +1 Mental/Psychic Defense (stacks) | ✅ | 6 BU | Mirrorable |
| +1 to ALL Defenses (Universal Aegis) | ✅ | 10 BU | |
| Reaction Shield (+2 Defense when targeted) | ✅ | 8 BU | |
| Domain Resistance (½ damage in domain) | ✅ | 8 BU | Mirrorable |
| Domain Immunity (0 damage) | ✅ | 20 BU | Mirrorable |

**Gaps:** None.

---

## 9. Conditions / Status Tags

System: `01-bu-market.md` (Semantic State Tags section) +
`10-tactical-subsystems.md` (Cover, Manifestation, Vitality Collapse)

All 4 CONDITION rows exist. ✅

| Mechanic | Coverage | Cost | Notes |
|---|---|---|---|
| Physical Interaction Tag | ✅ | 4 BU | |
| Sensory & Physiological Tag | ✅ | 8 BU | |
| Cognitive & Agency Tag | ✅ | 12 BU | |
| System & Identity Tag | ✅ | 16 BU | |

But the **sub-tags listed inside each tier** in the BU Market page
(e.g., Movement Restriction, Spatial Displacement, Form Instability,
Reality Banishment, Action Validity Constraints, Probability
Fracture, Terror Loop, Emotional Drift, etc.) are descriptive
labels only — they're applied at the table by the DM. **These are
not primitives**, they're examples of what fits the tag. No
primitive rows needed for sub-tags. ✅

---

## 10. Trigger Hooks (Reactive Capabilities)

System: `15-combat-engine-resolution-pipeline.md`,
`07-action-economy.md`

| Mechanic | Coverage | Notes |
|---|---|---|
| Passive reaction trigger (state-triggers) | ✅ (in seed) | `Conditional Informational Trigger`, `Direct Material Trigger`, `Dormant Trigger Hook`, `Interceptive Causal Trigger`, `Systemic Threshold Trigger` — need explicit review of each row's `target_scope`. Many should be `ATTRIBUTE` or `PRACTICE` not `NARROW_FOCUS`. |
| Causality Interdiction (override triggers) | ❌ | "Causality Interdiction" mentioned in BU Market page but no canonical primitive. **Gap.** |

**Gaps:**
- ❌ **Causality Interdiction** — listed in BU Market page line 161
  as a runtime trigger hook but has no DB row. Either intended as an
  example only (per "permission vector cannot be inverted" rule) or
  we need to add it. **Defer to user verification.**

---

## 11. Trigger Hooks — specific by source page

Trigger primitives in DB seed (`01-bu-market.md` pages 23, 32, 244, 263, 269):

| Primitive | Suggested scope | Notes |
|---|---|---|
| `Conditional Informational Trigger` | `NARROW_FOCUS` or `PRACTICE` | Fires on specified info-gathering state |
| `Direct Material Trigger` | `NARROW_FOCUS` | Material-trigger only |
| `Dormant Trigger Hook` | `NARROW_FOCUS` | Pre-configured reaction event |
| `Interceptive Causal Trigger` | `PRACTICE` or `ATTRIBUTE` | Intercept the causality chain |
| `Systemic Threshold Trigger` | `ALL` | Fires when system threshold crossed |

These are NOT marked with `targetScope` in the seed because they
weren't migrated yet. **Phase-7-B TODO** — apply scope to these 5
rows.

---

## 12. Vitality & Death

System: `09-vitality-system.md`, `10-tactical-subsystems.md`

| Mechanic | Coverage | Cost | Notes |
|---|---|---|---|
| Vitality Core Augment I (+5 max) | ✅ | 4 BU | Mirrorable |
| Vitality Core Augment II (+12 max) | ✅ | 8 BU | Mirrorable |
| Vitality Core Augment III (+20 max) | ✅ | 12 BU | Mirrorable |
| Vitality Shielding (pay HP to execute) | ✅ | in seed | `EVALUATION_STRAIN` |
| Healing (damage dice HEALING route) | ✅ | INTENSITY_DICE rows | Dice have "Damage/Healing" in narrative |
| Manifestation (death save tier) | ❌ | — | TACTICAL subsystem mentions Vitality Collapse. **Gap.** |
| Vitality Collapse (final death) | ❌ | — | TACTICAL subsystem. **Gap.** |
| Stabilization (death save recovery) | ❌ | — | TACTICAL subsystem. **Gap.** |

**Gaps:**
- ❌ **Manifestation, Vitality Collapse, Stabilization primitives** —
  these are death-state mechanics described in
  `10-tactical-subsystems.md` but have no DB rows. **Verify with
  user before adding — these may be intentional engine rules without
  primitives.**

---

## 13. Verbal Permissions (Lexicon Verbs)

All 4 tiers exist. **No new rows needed.**

| Tier | Coverage | Verb examples |
|---|---|---|
| Tier I (4 BU) | ✅ | move, strike, push, lift, drop, interact, sense, observe, touch, grab, throw, break, hold, release |
| Tier II (8 BU) | ✅ | alter, modify, combine, separate, enhance, weaken, suppress, extend, compress, reshape |
| Tier III (12 BU) | ✅ | restructure, invert, synchronize, entangle, fracture, merge, override local rules |
| Tier IV (16 BU) | ✅ | override rules, redefine logic, alter causality, rewrite constraints, suspend rules |

**Gaps:** None.

---

## 14. Domain Permissions (Lexicon Domains)

All 4 tiers exist.

| Tier | Coverage | Domain examples |
|---|---|---|
| Tier I (4 BU) | ✅ | fire, water, air, earth, metal, stone, wood, ice, lightning, light, darkness, gravity, motion, force, sound |
| Tier II (8 BU) | ✅ | life, decay, growth, memory (imprint), emotion (physiological), time (local), space (local), disease, entropy, magnetism |
| Tier III (12 BU) | ✅ | consciousness, identity, will, intent, thought, belief, information, probability (local), fate (limited), causality (bounded) |
| Tier IV (16 BU) | ✅ | existence, non-existence, reality, causality (global), time (absolute), space (global), narrative authority, rule-logic, paradox |

**Gaps:** None.

---

## 15. Structures (Shapes)

All 4 tiers exist.

| Tier | Coverage | Shape examples |
|---|---|---|
| Tier I (4 BU) | ✅ | single target, self target, touch, line-of-sight |
| Tier II (8 BU) | ✅ | multi-target, chain, cone, radius/AoE |
| Tier III (12 BU) | ✅ | expanding zones, moving fields, branching chains, layered |
| Tier IV (16 BU) | ✅ | global/scene-wide, rule-based targeting, exclusion logic |

Plus the narrative formats (Spiral Field, Star/Bloom, Fractured
Zone, Layered Zones, Organic/Freeform) — these are interpretive
descriptors applied at the table, not separate primitives. **No gap.**

---

## 16. Range

All 7 tiers exist: Touch (0 BU) → Close (2) → Near (4) → Far (8) → Very
Far (12) → Extreme (24) → World (48). ✅

---

## 17. Speed / Quickening

All 4 tiers exist: Standard (0) → Fast (8) → Instant (16) →
Reaction (16). ✅

---

## 18. Duration

All 6 tiers exist: Instant (0) → Short (4) → Medium (8) → Long (16)
→ Persistent (32) → Permanent (64). ✅

---

## 19. Magic vs Mundane

System: `02-capability-composition-map.md`, `11-damage-resistance.md`

Damage is differentiated by **SOURCE TYPE** (Physical/Magical/Psychic),
not by whether it's "magic" per se. Magical Capabilities work via
Domain access + verb permissions.

| Mechanic | Coverage | Notes |
|---|---|---|
| Casting cap (ritual vs quick) | 🔍 | Per page 2 — engine rule (not BU-bound) |
| Spell slot equivalents | ❌ | SwordWeave explicitly does NOT use spell slots (BU is the only currency) |
| Concentration mechanic | 🔍 | Maintenance page (08) |
| Antimagic field | ⚠️ | Domain Lock Shield exists. Doesn't have primitive scope yet. |

**Gaps:** None that need new primitives.

---

## 20. Backgrounds & Heritage

System: `04-character-creation-flow.md`

Backgrounds and heritage are **heritage** (not primitives) — they
slot primitive rows into a template ledger. No new primitive rows
needed.

Template categories: heritage, archetype, background, item, race.
**Phase-7-C scope** (rebuild templates).

---

## Summary of Audit Gaps

| # | Gap | Source page | Recommended action |
|---|---|---|---|
| 1 | ~~Mental vs Psychic source-type naming inconsistency~~ | (none — resolved) | Mental = attribute, Psychic = source. No rename needed. Matrix §1 documents this. |
| 2 | ~~Cover Bonus primitive missing~~ | 10-tactical-subsystems | **RESOLVED (Phase 7-B.1, 2026-07-14):** 4 Cover Tier rows added under new TACTICAL enum |
| 3 | ~~Teleport primitive missing~~ | (none — resolved) | Teleport is a capability built from primitives. No new primitive row. |
| 4 | ~~2nd-Action-Turn / Haste-vs-Haste Primitive missing~~ | (none — resolved) | Haste Vector already covers this. Verify no addition needed. |
| 5 | ~~Causality Interdiction primitive missing~~ | (none — resolved) | `Interceptive Causal Trigger` already exists in canonical; its narrative description is "Causality Interdiction." |
| 6 | ~~Manifestation / Vitality Collapse / Stabilization primitives~~ | 10-tactical-subsystems | **PARTIALLY RESOLVED:**<br>• Manifestation = engine/execution concept (page 10 §1.B), **no row needed**.<br>• Vitality Collapse = engine rule (page 10 §2), **no row needed**.<br>• Existential Shatter = engine rule (page 10 §3), **no row needed**.<br>• Stabilize / Last Breath / Tether of Being = 3 rows added under new VITALITY enum |
| 7 | ~~Trigger Hook primitives need targetScope~~ | (resolved 2026-07-14) | **RESOLVED (Phase-7-B.2, 2026-07-14):** 5 trigger primitives scoped as `NARROW_FOCUS` with descriptive values (Direct Material, Systemic Threshold, Conditional Informational, Interceptive Causal, Dormant Trigger Hook). DB went from 32→37 rows-with-targetScope. |

## Phase-7-B TODO (carry into code work)

1. (Done in B.1) ~~Add Cover Tier I-IV rows + Stabilize/Last Breath/Tether-of-Being rows + enum migration 0031.~~
2. (Done in B.2) ~~Apply `targetScope` to 5 trigger-hook primitive rows currently un-scoped.~~
3. After primitives locked, redo Capabilities/Effects heritage (Phase 7-C, then 7-D).
4. (Mirrored UI wiring) — see Q-B below; capability UIs must expose:
   - source-type selector (Physical / Magical / Psychic)
   - mirror toggle (mirrored/normal; budget-neutral at primitive level,
     budget-positive only in heritage)

---

## Phase-7 Corrections to Notion Canonical

These differences exist between the BU Market page (Notion canonical)
and the user's verbal corrections in this conversation. The audit
matrix locks in the **corrected** form. Update Notion when you have a chance.

### Volatility Ceiling (L1 = -4 BU, not -8 BU)

BU Market page table reads:

| Level | Accessible Lexicon Tier | Max Volatility Ceiling |
|---|---|---|
| Levels 1-4 | Tier I & II | -8 BU |
| Levels 5-10 | Tier III | -12 BU |
| Levels 11-15 | Tier IV | -16 BU |
| Levels 16+ | Tier IV+ | -24 BU |

**Canonical correction (Phase 7):**

| Level | Accessible Lexicon Tier | Max Volatility Ceiling |
|---|---|---|
| **Level 1** | Tier I & II | **-4 BU** (starting budget) |
| Levels 2-4 | Tier I & II | -8 BU |
| Levels 5-10 | Tier III | -12 BU |
| Levels 11-15 | Tier IV | -16 BU |
| Levels 16+ | Tier IV+ | -24 BU |

The "-4 BU at L1" reflects a "starting budget" framing — first-level
characters start at a constrained debt ceiling that opens up as they
progress. The "-8 BU" L1-4 in Notion may have been a copy from L2-4 that
got merged.

---

## Phase-7-B.1 — Added 2026-07-14

### New enum values (migration 0031)
- `TACTICAL` — Cover Tier I-IV and future spatial/tactical modifiers
- `VITALITY` — life-state primitives (Stabilize, Last Breath, Tether of Being)

### New canonical primitive rows

| Name | Category | BU | Cost Tier | Tier |
|---|---|---|---|---|
| Minor Obstruction (Cover Tier I) | TACTICAL | 4 | Tier 1 | Minor (4 BU anchor) |
| Half Cover (Cover Tier II) | TACTICAL | 6 | Tier 2 | Standard (6 BU anchor) |
| Total Cover (Cover Tier III) | TACTICAL | 12 | Tier 3 | Major (12 BU anchor) |
| Spatial Anchor Cover (Cover Tier IV) | TACTICAL | 24 | Tier 4 | Core Axis (24 BU anchor) |
| Stabilize (Fieldcraft Aid) | VITALITY | 4 | Tier 1 | Minor (4 BU anchor) |
| Last Breath (Tenacity Trigger) | VITALITY | 6 | Tier 2 | Standard (6 BU anchor) |
| Tether of Being (Sustained Tenacity) | VITALITY | 18 | Tier 4 | Core Axis (18 BU anchor) |

DB went from **139 → 146 primitives**. Migration 0031 ALTER TYPE both
enum values idempotent; the seeder wrote the 7 rows. User-owned and fork
rows untouched (still 5 + 1).

### Decisions (1-6 closed)
- (1) Cover Tiers: added.
- (2) Causality Interdiction: not a missing row — `Interceptive Causal Trigger` already exists; that's the canonical name.
- (3) Manifestation: pure execution concept — no row needed.
- (3 cont'd) Vitality Collapse + Existential Shatter: engine rules, no row.
- (3 cont'd) Stabilization: 3 rows added (Stabilize / Last Breath / Tether of Being).

### TODO follow-ups
- Phase-7-B.2: scope the 5 trigger-hook rows.
- Phase-7-C: heritage redo.
- Phase-7-D: capabilities/effects redo (with Q-B UI changes).

---

## Q-B UI — Spec (locked 2026-07-14)

Capability / Effect builder must expose at minimum one new control
beyond the existing primitive-slot list. Source-type selector is
pre-existing schema. Mirror toggle lives at character-slot, not
capability. See per-item analysis below.

### B.1 Source-type selector — ALREADY IN SCHEMA ✅
- Component: dropdown, single-select.
- Options: **PHYSICAL / MAGICAL / PSYCHIC** (per `source_type` enum).
- Column: `capabilities.source_type` (USER-DEFINED enum, NOT NULL, no default).
- Default: empty string `<select>` with placeholder "Auto (derive from primitives)" — engine fills.
- When set: drives the capability's `source_type` field; affects which
  attribute the engine uses for damage-source resistance checks (page 11).
- Storage: ✅ no migration needed. Existing capabilities already
  have `source_type` populated (NOT NULL enforced).

### B.2 Mirror toggle — LIVES ON CHARACTER-PRIMITIVE-SLOTS, NOT CAPABILITIES
**Architectural decision:** Mirror is **a character-acquisition state,
not a capability state.** A capability has mirror-eligible primitive
slots (`isMirrorable` on the primitive row + the acquisition char-slot's
`is_mirrored` boolean). The capability itself doesn't need a toggle —
it's a card, not a purchase.

**Where the UI change actually goes:**
- **Capability builder:** no change. (Capability is just a recipe.)
- **Character-slot picker ("acquire primitives"):** UI toggle per slot
  — labeled "Mirrored (Variable Vector)" — drives `is_mirrored` boolean
  on the character_primitive_slots row.
- **Template composer:** if a template composes character-side slots
  with mirroring, apply mirror surcharge using the primitive's
  `mirrorBuCredit` value (already in schema at line 45).

**Storage:** Schema already has `character_primitive_slots.is_mirrored`
(per `characters.ts:108 + :190`). No migration needed.

### Wiring plan
- (Optional polish, post-7-D) Re-verify capability builder exposes the
  existing `source_type` dropdown cleanly. Quick UI audit check.
- 7-C (Template composer): when generating slot suggestions, surface
  mirror-surcharge preview (BU debt against character's tier cap).
- Test coverage: unit test the BU-surcharge math
  (mirror surcharge = primitive.mirrorBuCredit; debt goes negative).
- UI smoke: dev-server manual check of source-type dropdown.
- Document mirror-acquisition state in player's handbook so GMs
  know toggling the option inverts polarity at the cost of budget.

### Reference: where the mirrors live
```
primitives                          # catalog (is_mirrorable flag)
  ↓
capability_primitive_slots          # recipe wiring
  ↓
character_primitive_slots           # ACQUISITION STATE — is_mirrored lives HERE
  ↓
templates                          # composed acquisition plans (uses mirrorBuCredit)
```

---

## Phase-7-E/UX2 — Modifier form polish (2026-07-14, revised)

### UX2a (initial) → UX2a-r (revert + radio)

**First attempt:** give each locomotion type its own
dropdown entry (walking_speed / climbing_speed / etc.).
**Problem:** cluttered the dropdown — every modifier card
had 5 speed rows the user had to scan past to find the right
one. *"Speed is one thing — pick the kind below"* was the
real user model.

**Second attempt (UX2a-r, current state):** one `speed` axis
in the dropdown; the Target Value widget renders a single-
choice **radio** with the five locomotion options. Buttons
read "Walking", "Climbing", "Swimming", "Flying",
"Burrowing" — not "WALKING_SPEED" etc. — so the labels are
English-friendly and the canonical METRIC values stay
machine-readable underneath.

The closed `STANDALONE_METRICS` list still carries
`WALKING_SPEED / CLIMBING_SPEED / SWIMMING_SPEED /
FLYING_SPEED / BURROWING_SPEED` because those are the values
stored in `target_scope.values[0]`.

A blank radio (targetValues=[]) defaults to `WALKING_SPEED`
in `scopeForSelection` so engine resolution always has a
concrete locus to apply the modifier (not "any" semantics).
A radio given more than one option truncates to the first.

### UX2b (initial) → UX2b-r (rename only)

The Shape + Size axis was renamed from `action_shape_size` →
`targeting`. Same behavior; just a player-facing verb. The
"Targeting" name reads as an action, not an analytics term.
Bridge entry `LEGACY_TARGET_MIGRATIONS.action_shape_size →
targeting` keeps data written under the old name readable.

### UX2-r bridge entries

- `walking_speed / climbing_speed / swimming_speed /
  flying_speed / burrowing_speed` (target strings, in case
  anything in `hard_modifiers` carries them despite the
  brief lifetime) → all route to `speed` with the matching
  METRIC value. **DB query confirms zero such rows exist
  today** (`scripts/_check-stale-speed-rows.ts`).
- `action_shape_size` (target string) → `targeting`. **Zero
  such rows currently exist.**

### Final dropdown entries (14)

`MODIFIER_TARGETS.length === 14` (was 22 before Phase-7-E,
→ 18 with the previous UX2 attempt, → 14 with the revert).

| # | Entry | Widget | Purpose |
|---|---|---|---|
| 1 | attribute | checklist | Physical/Mental/Magical |
| 2 | defense_dc | checklist | Defense DC by attribute |
| 3 | speed | radio | Walking/Climbing/Swimming/Flying/Burrowing |
| 4 | max_vitality | none | HP ceiling |
| 5 | current_vitality | none | HP current |
| 6 | proficiency_bonus | none | Stat |
| 7 | action_roll | none | The action's roll |
| 8 | skill_practice_check | radio-granularity | Practice focus (broad/narrow) |
| 9 | damage_healing_output | checklist | D6/D8/D10/D12/D20 |
| 10 | targeting | checklist-with-free-text | Shape + size of action |
| 11 | duration | checklist | Scene/combat/instant/etc. |
| 12 | strain | free-text | Narrative cost / strain |
| 13 | item_slot_cost | free-text | Item-slot cost |
| 14 | scene_pace | none | Scene pace |

### Both form surfaces updated

- `src/components/sandbox/primitive-form.tsx` — added
  `setRadioValue` setter; new `widget: "radio"` branch in the
  Target Value widget tree renders the locomotion radio.
- `src/components/workshops/primitive-registry.tsx` — same
  shape, prefixed with `…Registry` per the existing
  convention in that file (`setRadioValueRegistry`).

### Final state after UX2-r

- `MODIFIER_TARGETS`: **22 → 14** (-8 net)
- `STANDALONE_METRICS`: extended by 5 values (Walking/Climbing/
  Swimming/Flying/Burrowing), + `MOVEMENT_SPEED` legacy
- `LEGACY_TARGET_MIGRATIONS`: bridges for 5 old speed-target
  strings + 1 old action_shape_size string
- `MODIFIER_TARGET_SPEC.speed.widget`: `"checklist"` → `"radio"`
- `MODIFIER_TARGET_SPEC.targeting.label`: `"Action Shape & Size"`
  → `"Targeting"`

### Verification

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 598 / 598 passing |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm exec next build` | compiled successfully |
| `pnpm exec tsx scripts/_seed-vs-db.ts` | aligned 146 / 146 |
| `pnpm exec tsx scripts/_verify-phase7.ts` | Stride Extension still WALKING_SPEED |
| `pnpm exec tsx scripts/_check-stale-speed-rows.ts` | 0 stale rows (no migration needed) |

---

## Phase-7-Q-M — Mirror resolution (engine) (2026-07-14)

### Canonical source

Notion `'BU Market of Primitive components' §'Mirror-Vector
Architecture'` and §'Atomic Vector Toggle'. Two-class taxonomy:

**Variable Vector — mirrorable** (numerical metrics, vitality blocks,
probability bias tracks, structural defensive faults, kinematic
metrics, strain buffers). Inverting these yields a BU credit.

**Permission Vector — not mirrorable** (verbs, domains, dice,
range/sizing, durations, system bypasses like flight/reaction slot,
trigger hooks, semantic state tags).

User overrides applied in Q-M discussion:
- Practice Progression mirrorable (Practice Proficiency, Expertise
  Upgrade, Reliable Practice, Broad Familiarity). Focused Edge is a
  narrow permit, NOT mirrorable.
- Causal Override is exempt.
- Cover Tier I-IV (TACTICAL) not mirrorable.
- Vitality primitives (Stabilize, Last Breath, Tether, Vitality
  Shielding) not mirrorable (different primitives, not mirrors).

### Engine surface — `src/lib/engine/mirror.ts`

| Export | Purpose |
|---|---|
| `resolveMirrorEffect(vector, isMirrored, value)` | Per-vector effect application. VARIABLE_VECTOR sign-flips, STRUCTURAL_FAULT preserves magnitude for vuln/RESIST labeling, COST_INSTABILITY installs user-cost, STANDARD_ONLY pass-through. |
| `resolveEffectiveModifierValue(primitive, slot, value)` | Convenience wrapper pairing mirror_vector (DB) with is_mirrored (slot state). |
| `resolveResistanceMultiplier(strongestRes, strongestVuln)` | Canonical stacking rule: cancellation over stacking. |
| `isMirroredSlot(slot)` / `isUserCostVector(v)` | Type guards. |

### Engine wire-up — `src/lib/engine/stats.ts`

`modifierMatchesScope(mod, criteria)` is the new matcher. Resolution:

1. Legacy dotted-target string equality (Phase-7 data).
2. LEGACY_TARGET_MIGRATIONS routes dotted → short axis, also carrying
   the migration's `defaultScope.values[]` so cross-attribute false
   positives don't occur (e.g. `character.attribute.mental` does not
   match a `physical` resolve site).
3. New-format short axis + `metadata.targetScope.layer` + the
   value-array check (with `{layer, value}` legacy single-shape
   normalized in `resolveStoredScope` to `{layer, values: [value]}`).

`calculateAttributeScore`, `calculateMaxVitality`, `compileMovement`
now use the matcher. `compileDefenses` still routes via legacy dotted
strings (targetScope-aware rewrite deferred to Phase-7-D3).

### Verification

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 626 / 626 passing (added 6 mirror tests + 3 matcher tests + 8 helper tests) |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm exec next build` | compiled successfully |
| `pnpm exec tsx scripts/_mirror-taxonomy-draft.ts` | 47 mirror candidates (vs 12 currently) |

### Open follow-ups

- Wire `resolveEffectiveModifierValue` into `calculateDefenseDc` so
  mirrored structural-defensive primitives (Resistance → Vulnerability)
  flow through the canonical `resolveResistanceMultiplier` rule.
- Build a small `compileMirrorFromSlots(slotModifierPairs)` helper that
  takes character-acquisition state and returns resolved mirror effects
  for downstream damage / status calls.
- Mirror resolver needs a single canonical entry through `modifiers.ts`'s
  `evaluateModifiers` so the damage / status code paths get mirror
  semantics for free (Phase-7-Q-M-R2, to ship after a Condition UX
  pass per the user's order).

---

## Verification scripts (run alongside audit)

- `pnpm exec tsx scripts/_seed-vs-db.ts` — confirms seed ↔ DB alignment
- `pnpm exec tsx scripts/_verify-phase7.ts` — confirms target_scope populated
- `pnpm exec tsx scripts/_audit-source-origin.ts` — confirms source_origin taxonomy
- `pnpm exec tsx scripts/_check-stale-speed-rows.ts` — flags any primitive whose `hard_modifiers` carry the legacy 5-axis speed target strings or action_shape_size
- `pnpm exec tsx scripts/_apply-0032-speed-rename.ts` — migration that rewrites MOVEMENT_SPEED → WALKING_SPEED in target_scope JSONB (idempotent, already applied)
