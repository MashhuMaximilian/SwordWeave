# Phase 7.10.2 — Capabilities Re-Author (Style A/B/C, 4-Section Schema)

**Date:** 2026-07-16
**Scope:** 25 canonical capabilities, classified by Style (A/B/C) per the Capability Composition Map.
**Goal:** Re-author verbose_description on each capability to follow the 4-section Universal Ledger Schema.

---

## Style classification (per the Map)

| Style | Count | Meaning |
|---|---|---|
| A: Passive | 8 | No active execution. Modifies sheet directly. No effects. |
| B: Direct Resolution | 8 | Instant resolution. No lingering states. No effects. |
| C: Dynamic State | 9 | Delivers a nested effect to target. |

The 8 effects are themselves Style C — they ARE the "mini-capability wrappers." Capabilities in Style C nest one or more of these 8 effects.

---

## The 4-Section Schema (canonical)

```
**Composition:** [list of primitives + their roles]
**Spatial & Resolution Gate:** [range/target/save if applicable — Style B/C only]
**Delivered Effect:** [Style C only — name of the nested effect]
**Duration:** [if applicable]
```

For Style A (Passive), only **Composition** is required (no Spatial, no Effect, no Duration — they modify the sheet directly).

---

## The 25 re-authored capabilities

### STYLE A: Passive (8)

#### Aegis Shield (PASSIVE)
**Composition:** Direct Material Trigger (on hit) + Reactive Bulwark (+2 Defense when triggered) + Reaction Pulse (+1 Independent Reaction Slot).

#### Archmage's Strain Redirection Plate (PASSIVE)
**Composition:** Hazard Transmutation + Condition Insulation + Perpetual Lock.

#### Aura Detective (PASSIVE)
**Composition:** Systemic Resonance (read capability trails) + Focused Edge (Awareness on magical concealment).

#### Blind Swordsman (PASSIVE)
**Composition:** Substrate Echo (Tremorsense 30ft) + Tactile Echo (Blindsight 30ft).

#### Bloodhound Master (PASSIVE)
**Composition:** Practice Proficiency (Awareness) + Focused Edge (Awareness through smell) + Expertise Upgrade on Awareness.

#### Ghost Walk (PASSIVE)
**Composition:** Stride Extension + Focused Edge (Finesse vs physical-detection).

#### Heavy Tactical Cover (PASSIVE)
**Composition:** Defensive Save Upgrade (Physical) + Kinetic Hardening (+1 Physical Defense).

#### Vow of Enmity (AUGMENT)
**Composition:** Focused Edge (narrow Narrative Focus on attacks vs sworn target).

---

### STYLE B: Direct Resolution (8)

These deal damage, knock back, or read state, then end immediately. No nested effects.

#### Cataclysmic Shockwave (ACTIVE)
**Composition:** Verb Access Tier I (strike) + Earth Domain + Touch Range + Structure Tier I (Single Target) + Standard Execution + Standard Die Block (1d6) + Physical Interaction Tag.
**Spatial & Resolution Gate:** Far Range (60ft). Kinetic Sphere template. Single save per target.
**Duration:** Instant.

#### Rusting Strike (ACTIVE)
**Composition:** Verb Access Tier I + Decay Domain + Touch Range + Structure Tier I (Single Target) + Standard Execution + Standard Die Block (1d6) + Physical Interaction Tag.
**Spatial & Resolution Gate:** Touch / Melee. Single target.
**Duration:** Instant.

#### Strike (ACTIVE)
**Composition:** Verb Access Tier I (strike) + Earth Domain + Touch Range + Structure Tier I (Single Target) + Standard Execution + Standard Die Block (1d6).
**Spatial & Resolution Gate:** Touch / Melee. Single target. The canonical "I swing my sword" capability built from atomic primitives.
**Duration:** Instant.

#### Tornado Blast (ACTIVE)
**Composition:** Verb Access Tier I + Wind Domain + Far Range (60ft) + Structural Wall (30×10) + Fast Execution + Minor Linear Displacement (10ft) + Standard Die Block (1d6).
**Spatial & Resolution Gate:** Far Range. Structural Wall template. Multiple targets along the column.
**Duration:** Instant.

#### Mind Scan (ACTIVE)
**Composition:** Verb Access Tier I + Thought Domain + Near Range (30ft) + Structure Tier I (Single Target) + Standard Execution + Non-Material Translation Qualifier.
**Spatial & Resolution Gate:** Near Range (30ft). Single target. No save — informational read.
**Duration:** Instant (one reading).

#### Spell Counter-Disruption Shield (ACTIVE)
**Composition:** Verb Access Tier II (negate) + Arcane Domain + Touch Range (Self) + Structure Tier I (Single-target counter) + Reaction Execution + Interceptive Causal Trigger.
**Spatial & Resolution Gate:** Self. Reaction-triggered. Counters one incoming capability.
**Duration:** Instant (one absorption).

#### Time Stop (ACTIVE)
**Composition:** Verb Access Tier IV (suspend rules) + Time Domain + Touch Range (Self — affects scene) + Structure Tier I (Single Target, scene-wide) + Instant Execution + System & Identity Tag.
**Spatial & Resolution Gate:** Self. Instant. Caster gains a Free Action Window during halt.
**Duration:** Instant window.

#### Medusa's Gaze (ACTIVE)
**Composition:** Verb Access Tier IV (rewrite identity) + Form/Petrification Domain + Very Far Range (120ft) + Structure Tier I (Single Target) + Instant Execution + System & Identity Tag.
**Spatial & Resolution Gate:** Very Far Range. Single target. Mental save vs. Caster's Mental DC.
**Duration:** Instant resolution (effect via parent capability if any).

---

### STYLE C: Dynamic State (9)

These deliver a nested effect to the target. The effect is one of the 8 re-authored effects above.

#### Aura of Total Enfeeblement (ACTIVE)
**Composition:** Verb Access Tier IV (weaken) + Force Domain Tier II + Touch Range (Self — emanation) + Mobile Aura (10ft) + Medium Duration + Negative Bias I (Narrative Focus on physical checks).
**Spatial & Resolution Gate:** Self — emanation that persists with caster. Mobile Aura 10ft radius.
**Delivered Effect:** *Inline Negative Bias on all physical checks* — the capability composes the Negative Bias directly (not as a nested effect, since the bias is a primitive modifier, not a condition). Creatures entering the aura receive Negative Bias on all physical checks.
**Duration:** Medium Duration (continues while caster maintains).

#### Chamber Blackout Matrix (ACTIVE)
**Composition:** Verb Access Tier I + Darkness Domain Tier II + Far Range (60ft) + Stationary Zone + Long Duration + System & Identity Tag.
**Spatial & Resolution Gate:** Far Range. Stationary Zone template.
**Delivered Effect:** *Blinded* (system-level sensory denial). Identities obscured from outside Awareness checks.
**Duration:** Long Duration.

#### Chronomantic Haste (ACTIVE)
**Composition:** Verb Access Tier IV (synchronize) + Time Domain Tier II + Close Range + Structure Tier I (Single Target) + Medium Duration + Core Action Multiplication (Haste Vector, +1 Standard Action) + Timeline Tether (immune to delays).
**Spatial & Resolution Gate:** Close. Single target (ally).
**Delivered Effect:** *Haste* — +1 Standard Action Window for the encounter. Immune to forced delays. The two primitives compose to give both the action bonus and the delay immunity.
**Duration:** Medium Duration (continues for the encounter).

#### Gravity Anchor Trap (ACTIVE)
**Composition:** Verb Access Tier I + Gravity Domain Tier II + Near Range (30ft) + Structure Tier I (Single Target) + Reaction Execution + Velocity Arrest / Standard Vector (Velocity Lock) + Direct Material Trigger.
**Spatial & Resolution Gate:** Near Range. Reaction-triggered.
**Delivered Effect:** *Velocity Lock* — gravity spike pins the target. Heavy kinetic slam on dismissal (engine applies damage when effect expires).
**Duration:** 1 round (velocity lock) + dismissal damage.

#### Greater Invisibility (ACTIVE)
**Composition:** Verb Access Tier II (phase/displace) + Light/Phase Domain Tier III + Close Range + Structure Tier I (Single Target) + Persistent Duration + System & Identity Tag.
**Spatial & Resolution Gate:** Close. Single target.
**Delivered Effect:** *Invisibility* (phase-shift out of visual spectrum). Positive Bias on Stealth. Immune to optical targeting.
**Duration:** Persistent.

#### Hypnotic Suggester (ACTIVE)
**Composition:** Verb Access Tier I + Emotion Domain Tier II + Near Range (30ft) + Structure Tier I (Single Target) + Long Duration + Behavioral Directive / Data Trace Masking.
**Spatial & Resolution Gate:** Near Range. Single target. Mental save vs. Caster's Mental DC.
**Delivered Effect:** *Compelled Focus* (nests the 8th effect: Negative Bias on all non-caster attacks). The primitive composition is the seed; the fork scopes the bias.
**Duration:** Long Duration.

#### Simulacrum (ACTIVE)
**Composition:** Verb Access Tier IV (rewrite identity) + Existence Domain Tier IV + Touch Range + Structure Tier I (Single Target) + Permanent Duration + System & Identity Tag.
**Spatial & Resolution Gate:** Touch. Single target. Permanent duplicate.
**Delivered Effect:** *Duplicate entity* — the target's identity and form are copied into a fully obedient simulacrum that retains all primitive licenses.
**Duration:** Permanent.

#### Spore Choke (ACTIVE)
**Composition:** Verb Access Tier I + Decay/Poison Domain Tier II + Near Range (30ft) + Linear / Conical Vector (15ft cone) + Standard Execution + Sensory & Physiological Tag.
**Spatial & Resolution Gate:** Near Range. 15ft cone. Standard save per caught target.
**Delivered Effect:** *Ticking damage + sensory-physiological interference* — engine applies persistent ticking damage and the Sensory & Physiological tag effect.
**Duration:** Ticking persists for capability duration.

#### Temporal Stasis Trap (ACTIVE)
**Composition:** Verb Access Tier IV (suspend) + Time Domain Tier III + Close Range + Structure Tier I (Single Target) + Reaction Execution + Temporal Isolate + Direct Material Trigger.
**Spatial & Resolution Gate:** Close. Reaction-triggered.
**Delivered Effect:** *Temporal Stasis* — target locked in timeline stasis for 1 round. Target invulnerable during lock (the engine reads the `behavior:temporal_stasis_entity` flag).
**Duration:** 1 round (auto-expires).

---

## Notes on the re-author

**1. Style C effects are described inline.** Where a capability composes one of the 8 canonical effects, the narrative names it and references the effect's narrative. Where a capability's "Delivered Effect" is just the result of a primitive composition (e.g. Haste = +1 Standard Action + Delay Immunity), it's described inline without referencing a separate effect.

**2. BU math unchanged.** All 25 capabilities keep their primitive compositions — the re-author is narrative-only.

**3. Verb/Domain/Range/Duration primitives unchanged.** Those are structural (category=VERB_TIER, DOMAIN, RANGE, DURATION, SIZING) and were SKIP in Phase 7.9.

**4. Tags updated.** A handful of capabilities have `tags` that need updating to match the new style classification (e.g. "passive", "active", "style-a", "style-b", "style-c"). This is a minor metadata update.

**5. The AUGMENT type.** Vow of Enmity is the only AUGMENT (a capability that augments another capability rather than being standalone). It's Style A (passive, no effect).
