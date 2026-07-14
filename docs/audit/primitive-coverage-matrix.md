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

Source types are **Physical / Magical / Psychic** (the engine currently
calls this Mental in some legacy rows — see Phase-7-B TODO).

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
| 1 | Mental vs Psychic source-type naming inconsistency | 11-damage-resistance + 7-action-economy | **Rename `Mental` → `Psychic` in canonical page; update SHEET_AUGMENT scope vocabulary.** |
| 2 | Cover Bonus primitive missing | 10-tactical-subsystems + 13-system-mathematics | **Add `TACTICAL`/`DEFENSIVE` Cover Tier I-IV to seed** |
| 3 | Teleport primitive missing | (none — listed by user context as a likely gap) | **Defer; verify with user if tactical movement needs teleportation row** |
| 4 | 2nd-Action-Turn primitive missing | (none — implied by Haste Vector) | **Verify; Haste Vector may already cover this** |
| 5 | Causality Interdiction primitive missing | 01-bu-market (line 161) | **Verify; may be an example, not a row** |
| 6 | Manifestation / Vitality Collapse / Stabilization primitives | 10-tactical-subsystems | **Verify; may be death-state engine rules, not primitives** |
| 7 | Trigger Hook primitives need targetScope | (gap from Phase-7 audit) | **Phase-7-B TODO: scope 5 rows** |

## Phase-7-B TODO (carry into code work)

1. Resolve **Mental → Psychic** renaming in canonical.
2. Apply `targetScope` to 5 trigger-hook primitive rows currently un-scoped:
   - `Conditional Informational Trigger`
   - `Direct Material Trigger`
   - `Dormant Trigger Hook`
   - `Interceptive Causal Trigger`
   - `Systemic Threshold Trigger`
3. (After user sign-off) Add Cover Tier I-IV rows to `scripts/seed-bu-market.ts`.
4. Decide on Teleport / Causality Interdiction / Death-state primitives — present to user.
5. Probability Bias description pass is OPTIONAL — rows are structurally fine. Would just refine the language for clarity.

---

## Verification scripts (run alongside audit)

- `pnpm exec tsx scripts/_seed-vs-db.ts` — confirms seed ↔ DB alignment
- `pnpm exec tsx scripts/_verify-phase7.ts` — confirms target_scope populated
- `pnpm exec tsx scripts/_audit-source-origin.ts` — confirms source_origin taxonomy
