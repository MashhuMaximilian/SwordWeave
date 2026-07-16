# Phase 7.10.1 — Effects Re-Author (Style C, 4-Section Schema)

**Date:** 2026-07-16
**Scope:** 8 canonical effects, all Style C (lingering conditions)
**Goal:** Re-author narratives to follow the 4-section Universal Ledger Schema from the Capability Composition Map (Notion `37fed8479ccd810dbd98e4c942a98553`).

---

## The 4-Section Schema (canonical)

Every effect narrative follows this structure:

```
**Composition:** [list of primitives + their roles]
**Spatial & Resolution Gate:** [range/target/save if applicable]
**Delivered Effect:** [what the effect does to the target]
**Duration:** [how long the effect persists]
```

Effects are Style C — they always have a **Delivered Effect** section. The rest depends on the effect.

---

## The 8 re-authored effects

### 1. Blind Stun
**Composition:** Sensory & Physiological Tag + Absolute Timeline Deprivation (Stun Vector) + Core Action Multiplication inverse (Stun Vector mirrors to -1 std action).
**Spatial & Resolution Gate:** Delivered via parent capability's range/target.
**Delivered Effect:** Target's reaction window is erased for 1 round AND standard action window is subtracted by 1. Combined: total sensory denial + reaction lockdown + standard action erasure. (Note: the engine reads the Stun Vector's `add action.standard_action_window -1` modifier; for an entity with 1 standard action baseline, this fully suppresses action.)
**Duration:** 1 round.

### 2. Compelled Focus
**Composition:** Negative Bias II (Named Practice) + Cognitive & Agency Tag + Persistent Duration.
**Spatial & Resolution Gate:** Delivered via parent capability's range/target. Mental Defensive Save vs. Caster's Mental DC.
**Delivered Effect:** Target rolls with Negative Bias (Disadvantage) on all offensive tracks that do NOT target the caster. The "Practices that do target the caster" exclusion is set via fork condition. The system is the clean translation of an MMO-style Taunt/Aggro mechanic — restricting mathematical options rather than rigid behavioral mind-control.
**Duration:** Persistent (until removed by capability or condition-clearing effect).

### 3. Corrosive Decay
**Composition:** Structural Hardening (Domain Resistance) + Sensory & Physiological Tag + Persistent Duration.
**Spatial & Resolution Gate:** Delivered via parent capability's range/target.
**Delivered Effect:** Target's defenses are progressively degraded — the engine applies a structural erosion tick. Reads as: the target's armor/defenses erode over time, making them a vulnerable target for the rest of the squad. (The actual damage application is one-shot at cast time; the persistence is the engine tracking the "Domain Resistance erosion" flag.)
**Duration:** Persistent (multi-scene).

### 4. Shattered Composure
**Composition:** Velocity Arrest / Standard Vector (Velocity Lock) + Absolute Timeline Deprivation (Stun Vector) + Negative Bias II (Named Practice, on defenses) + System & Identity Tag.
**Spatial & Resolution Gate:** Delivered via parent capability's range/target.
**Delivered Effect:** Total hysterical breakdown. Movement speed forced to 0 (Velocity Lock flag), reaction window erased, and defense rolls receive Negative Bias. The compound effect mimics a complete psychological break.
**Duration:** 1 round (cast-time triggered; the negative bias lingers via Persistent if parent specifies).

### 5. Snared (Vine Bind)
**Composition:** Velocity Arrest / Standard Vector (Velocity Lock) + Existential Tear (1d20 ticking damage) + Physical Interaction Tag.
**Spatial & Resolution Gate:** Delivered via parent capability's range/target. Physical Defensive Save vs. Caster's Physical DC.
**Delivered Effect:** Living vines bind the target. Movement speed = 0 (Velocity Lock flag), and the target takes 1d20 Existential Tear damage at the start of each of their turns (ticking damage while bound).
**Duration:** Persistent until the target breaks free (strength check) or the duration expires.

### 6. Staggered (Acid Corrosion)
**Composition:** Minor Linear Displacement (movement halved) + Negative Bias II (Named Practice, on attacks) + Sensory & Physiological Tag + Persistent Duration.
**Spatial & Resolution Gate:** Delivered via parent capability's range/target.
**Delivered Effect:** Acid-corrosion staggered state. Movement speed reduced by 15ft (Minor Linear Displacement modifier: `add character.movement.land -15`), attack rolls receive Negative Bias, and the engine tracks the persistence flag for ticking damage application by the parent capability.
**Duration:** Persistent (until removed).

### 7. System Freeze
**Composition:** Velocity Arrest / Standard Vector (Velocity Lock) + Absolute Timeline Deprivation (Stun Vector) + Cognitive & Agency Tag.
**Spatial & Resolution Gate:** Delivered via parent capability's range/target.
**Delivered Effect:** Target's mechanical apparatus or nervous system locks down completely. Movement speed = 0 (Velocity Lock) + reaction window erased. Isolates a high-threat enemy by removing their action options. Built for Technology/Technomancy or Ice Domain contexts.
**Duration:** 1 round (Stun Vector duration).

### 8. Vertigo Spasms
**Composition:** Negative Bias I (Narrative Focus) + Cognitive & Agency Tag.
**Spatial & Resolution Gate:** Delivered via parent capability's range/target.
**Delivered Effect:** Inner-ear or mental coordination disruption. Target rolls with Negative Bias on a specific narrative sub-trigger (e.g. "physical coordination checks"). The narrow scope is set via fork condition. Built for Psychic/Sensory or Magical/Air Domain contexts.
**Duration:** Persistent (until removed).

---

## Notes on the re-author

**1. Notes field preserved.** Each effect's `effect_primitives.notes` value (e.g. "Erase reactions 1 round", "Velocity Lock") stays the same — it's the per-slot engine hint. The narrative is the higher-level description that ties the notes together.

**2. Modifier language updated.** Where the old narrative said "advantage" or "disadvantage", the new narrative uses the canonical terminology: "Positive Bias / Negative Bias" (matches the `behavior:positive_bias` / `behavior:disadvantage` flags).

**3. Duration semantics.** Persistent = `behavior:duration_persistent` flag triggers (engine treats the effect as not expiring at combat end). 1 round = engine reads the modifier's duration slot directly.

**4. Fork scope.** Where the original narrative was ambiguous (e.g. "on attacks" vs "on defenses"), the new narrative explicitly says "set via fork condition" — the seed primitive is engine-agnostic and the fork scopes the effect.

**5. No new primitives needed.** All 8 effects compose from primitives that already have modifiers from Phase 7.9. This is a narrative update, not a data migration.
