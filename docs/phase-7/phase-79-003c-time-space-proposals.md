# Phase 7.9.3c — Time/Space Modifier Proposals

**Scope:** 11 time/space primitives, batch 3 of verb-like.
**Pattern:** Mix of `add` (one persistent slot: `character.movement.land -15` for speed slow) and `grant behavior:*` for the rest. Most kinetic/temporal primitives are **one-shot engine effects** that the modifier model captures via a "this capability is available" flag — the engine reads the flag and applies the one-shot at cast time.

## KINETIC_CONTROL (4)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 175 | Minor Linear Displacement | `add character.movement.land -15` | Persistent slow effect. The 10ft displacement is a one-shot engine effect applied at cast time (not modeled as a modifier). |
| 176 | Velocity Arrest / Standard Vector | `grant behavior:velocity_lock` | Engine flag — applies speed=0 effect at cast. The 20ft displacement is one-shot. |
| 177 | Advanced Vector Manipulation | `grant behavior:kinetic_lock_absolute` | Engine flag — applies absolute kinetic lock at cast. The 40ft complex displacement is one-shot. |
| 178 | Systemic Kinetic Override | `grant behavior:kinetic_override_capable` | Engine flag — entity has apex kinetic control (draw to focal point, invert momentum — both one-shot at cast). |

## TEMPORAL_CHRONOLOGICAL (7)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 207 | Chronological Echo | `grant behavior:delayed_resolution` | Engine flag — the capability resolves up to 2 rounds after declaration. |
| 208 | Dormant Trigger Hook | `grant behavior:capability_dormant` | Engine flag — converts an instant capability into a dormant mine that wakes on contact. |
| 209 | Timeline Tether | `grant behavior:chronological_immunity` | Engine flag — immunity to forced chronological delays. |
| 210 | Duration Anchor | `grant behavior:duration_freeze` | Engine flag — pauses the duration countdown of a decaying zone/barrier/transformation. |
| 211 | Perpetual Lock | `grant behavior:duration_persistent` | Engine flag — converts a Scene duration into a Persistent effect. |
| 212 | Kinetic Stasis | `grant behavior:kinetic_stasis_object` | Engine flag — freezes inanimate object's momentum completely. |
| 213 | Temporal Isolate | `grant behavior:temporal_stasis_entity` | Engine flag — locks a single target entity in absolute timeline stasis for 1 round. |

## The "one-shot engine effect" pattern

A recurring design tension: many kinetic/temporal primitives describe **one-shot engine effects** (push, pull, stasis, lock) that don't fit cleanly into a persistent-state modifier model. The chosen solution is to model the **capability availability** as a behavior flag, with the engine applying the one-shot at cast time when the flag is present.

For example, `behavior:velocity_lock` doesn't continuously set speed=0. It marks the entity as "able to apply a velocity lock at cast time." The engine reads the flag, and when the entity casts the velocity-lock capability, applies speed=0 to the target.

This sidesteps the multi-modifier constraint and keeps the modifier model focused on **persistent state declarations**. The engine code (Phase 8+) interprets the flags.

## Mirror semantics (the 11 now mirrorable)

| Pattern | Mirror |
|---|---|
| `add character.movement.land -15` | `add` +15 (Sprint — gain 15ft speed) |
| `grant behavior:velocity_lock` | `revoke` (no velocity lock) |
| `grant behavior:kinetic_lock_absolute` | `revoke` (no apex lock) |
| `grant behavior:kinetic_override_capable` | `revoke` (no apex kinetic control) |
| `grant behavior:delayed_resolution` | `revoke` (no delay capability) |
| `grant behavior:capability_dormant` | `revoke` (no dormant conversion) |
| `grant behavior:chronological_immunity` | `revoke` (vulnerable to delays) |
| `grant behavior:duration_freeze` | `revoke` (no duration freeze) |
| `grant behavior:duration_persistent` | `revoke` (no perpetual conversion) |
| `grant behavior:kinetic_stasis_object` | `revoke` (no object stasis) |
| `grant behavior:temporal_stasis_entity` | `revoke` (no entity stasis) |

The Minor Linear Displacement mirror is interesting: `add character.movement.land -15` → `add +15` is a **Sprint** effect (15ft speed bonus), the canonical Vulnerability Inverse.

## Idempotency

Same as previous batches.

## What's next after 7.9.3c

- 7.9.3d — METAMORPHOSIS (4) + AGENCY_OVERRIDE (4) = 8 rows. Heavy — template swaps, mind control.
- 7.9.3e — PROBABILITY_BIAS remaining (4) + EVALUATION_STRAIN (8) = 12 rows.
- 7.9.3f — SHEET_AUGMENT remaining (3) = 3 rows.
