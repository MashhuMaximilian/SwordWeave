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

Backgrounds and heritage are **templates** (not primitives) — they
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
3. After primitives locked, redo Capabilities/Effects templates (Phase 7-C, then 7-D).
4. (Mirrored UI wiring) — see Q-B below; capability UIs must expose:
   - source-type selector (Physical / Magical / Psychic)
   - mirror toggle (mirrored/normal; budget-neutral at primitive level,
     budget-positive only in templates)

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
- Phase-7-C: templates redo.
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

## Phase-7-E/UX2 — Modifier form polish (2026-07-14)

### UX2a — Speed split

**Decision:** Each locomotion type deserves its own canonical modifier
target instead of multi-selecting on a single axis. Different buff
sources affect different locomotion types independently.

| Old (legacy) | New (canonical) |
|---|---|
| `speed` axis with checkbox list `LAND_SPEED / FLY_SPEED / SWIM_SPEED` | `walking_speed`, `climbing_speed`, `swimming_speed`, `flying_speed`, `burrowing_speed` (5 separate axes) |

- **`STANDALONE_METRICS`** closed list extended: added
  `WALKING_SPEED / CLIMBING_SPEED / SWIMMING_SPEED / FLYING_SPEED /
  BURROWING_SPEED`. `MOVEMENT_SPEED` kept for legacy round-trip.
- **`LEGACY_TARGET_MIGRATIONS`** rewritten:
  - `character.movement.land` → `walking_speed` (was `speed` + `LAND_SPEED`)
  - `character.movement.fly` → `flying_speed`
  - `character.movement.swim` → `swimming_speed`
  - NEW: `character.movement.climb` → `climbing_speed`
  - NEW: `character.movement.burrow` → `burrowing_speed`
- **DB migration 0032** applied: 1 row updated
  (`Stride Extension` `MOVEMENT_SPEED` → `WALKING_SPEED`).
- **Target shape**: each speed target uses `widget: "none"` —
  a single-axis metric where the existing `Operation + Value` fields
  carry the magnitude. No checkbox needed; "Affects all Walking Speed
  instances by default" info banner shown.

### UX2b — Shape + Size collapses three axes

**Decision:** The three positional axes (Range / Target Count / Area
Size) collapse into one unified `action_shape_size` axis. Shape is
the scope (single / multiple / cone / cube / line / sphere /
cylinder / wall / star / custom). Magnitude lives in the existing
`Operation + Value` fields.

| Old | New |
|---|---|
| `action_range` (Self / Touch / Near / Far / LOS / Global) | merged |
| `target_count` (Single / 2 / 4 / 8 / AoE / All) | merged |
| `area_size` (5/15/30/60ft / Room / Scene) | merged |
| → | `action_shape_size` (Single Target / Multiple Targets / Cone / Cube / Line / Sphere / Cylinder / Wall / Star / Custom + free-text) |

- **`LEGACY_TARGET_MIGRATIONS`**: `action.range`, `action.targetCount`,
  `action.areaSize` all now route to `action_shape_size`.
- **Target shape**: `widget: "checklist-with-free-text"` — user picks
  a shape from the checklist OR enters a custom shape string, then
  uses the existing `Operation + Value` fields to set magnitude
  (e.g. `operation: set`, `value: 20` → "20-ft Cone").

### Both applied to both surfaces

Both `src/components/sandbox/primitive-form.tsx` (Phase-7-E/B1-B3
drop) AND `src/components/workshops/primitive-registry.tsx` (the
parallel workshops form) updated to:
- use the same `MODIFIER_TARGETS / MODIFIER_TARGET_SPEC` dropdown source
- render the same dynamic Target Value widget
- round-trip `metadata.targetScope` via the same `selectionForModifier
  / scopeForSelection` helpers
- expose `toggleTargetValue` and `setModifierGranularity` typed setters
  (named with `Registry` suffix in the workshops form to keep them
  distinguishable)

### Counts after UX2

`MODIFIER_TARGETS`: **22 → 18** (consolidated)
- lost 3 (the 3 positional axes collapsed into 1)
- gained 4 net speed axes (5 new − 1 legacy `speed`)
- net change: −4

### Verification

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 595 / 595 passing |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm exec next build` | compiled successfully |
| `pnpm exec tsx scripts/_seed-vs-db.ts` | aligned 146 / 146 |
| `pnpm exec tsx scripts/_verify-phase7.ts` | `Stride Extension` now reads `WALKING_SPEED` |
| `pnpm exec tsx scripts/_apply-0032-speed-rename.ts` | 1 row rewritten idempotently |

---

## Verification scripts (run alongside audit)

## Verification scripts (run alongside audit)

- `pnpm exec tsx scripts/_seed-vs-db.ts` — confirms seed ↔ DB alignment
- `pnpm exec tsx scripts/_verify-phase7.ts` — confirms target_scope populated
- `pnpm exec tsx scripts/_audit-source-origin.ts` — confirms source_origin taxonomy
