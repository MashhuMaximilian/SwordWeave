# Phase 7.9.3c — Time/Space Migration Report

**Date:** 2026-07-16
**Script:** `scripts/apply-phase79-003c.ts`
**Tests:** `src/db/__tests__/phase79-time-space.test.ts`
**Status:** Applied. 11 rows updated, 0 failures, 0 drift.

---

## Numbers

| Metric | Before 7.9.3c | After 7.9.3c |
|---|---|---|
| DONE | 80 | **91** (+11) |
| NEEDS_MOD | 37 | **26** (-11) |
| Chirality drift | 0 | **0** |
| Tests | 1344 | **1401** (+57) |

## The 11 applied

| Cat | Count | Pattern |
|---|---|---|
| KINETIC_CONTROL | 4 | 1 `add character.movement.land -15` (Minor Linear Displacement, persistent slow) + 3 `grant behavior:*` (kinetic lock/override capability flags) |
| TEMPORAL_CHRONOLOGICAL | 7 | 7 `grant behavior:*` (delayed_resolution, capability_dormant, chronological_immunity, duration_freeze, duration_persistent, kinetic_stasis_object, temporal_stasis_entity) |

## The "one-shot engine effect" pattern

A key design decision in this batch: most kinetic/temporal primitives describe **one-shot engine effects** (push, pull, lock, stasis) that don't fit cleanly into a persistent-state modifier model. The chosen solution is to model **capability availability** as a behavior flag, with the engine applying the one-shot at cast time when the flag is present.

For example, `behavior:velocity_lock` doesn't continuously set speed=0. It marks the entity as "able to apply a velocity lock at cast time." The engine reads the flag, and when the entity casts the velocity-lock capability, applies speed=0 to the target.

This sidesteps the multi-modifier constraint (1 modifier per primitive) and keeps the modifier model focused on **persistent state declarations**. The engine code (Phase 8+) interprets the flags.

## Notable individual decisions

**Minor Linear Displacement (id 175)** — the only `add` modifier in this batch. `add character.movement.land -15` is the persistent slow effect. The 10ft horizontal displacement (the other half of the OR) is a one-shot engine effect and is not modeled as a modifier. Its mirror (-15 → +15) is a Sprint effect — the canonical Vulnerability Inverse.

**Velocity Arrest (id 176)** — `behavior:velocity_lock`. Engine reads this at cast time, sets target speed=0 for the duration. The 20ft displacement alternative is also a one-shot.

**Advanced Vector Manipulation (id 177)** — `behavior:kinetic_lock_absolute`. Apex kinetic lock — entity can enforce absolute kinetic lock. 40ft complex displacement (with mid-travel trajectory shifts) is a one-shot.

**Systemic Kinetic Override (id 178)** — `behavior:kinetic_override_capable`. Apex kinetic control — "draw to focal point" and "invert momentum" are both one-shots at cast time.

**Chronological Echo (id 207)** — `behavior:delayed_resolution`. SEED — fork to specify the delay amount (up to 2 rounds) in a Capability.

**Dormant Trigger Hook (id 208)** — `behavior:capability_dormant`. Engine reads this and converts an instant capability into a dormant mine that wakes on contact. Distinct from the 4 trigger hook primitives (167-170) which describe how a TRIGGER fires; this describes a CAPABILITY that sits dormant.

**Timeline Tether (id 209)** — `behavior:chronological_immunity`. Immunity to forced delays. Mirror: revoke (vulnerable to delays). The canonical pattern from the BU Market doc for "your action can never be slowed."

**Duration Anchor (id 210)** — `behavior:duration_freeze`. SEED — fork to specify the target capability whose duration gets paused for 2 rounds.

**Perpetual Lock (id 211)** — `behavior:duration_persistent`. Converts Scene duration to Persistent. Mirror: revoke (Scene durations still expire normally).

**Kinetic Stasis (id 212)** — `behavior:kinetic_stasis_object`. Object-only stasis. Distinct from Temporal Isolate (id 213) which is entity stasis.

**Temporal Isolate (id 213)** — `behavior:temporal_stasis_entity`. Apex stasis. Target cannot act, move, or think, but is completely immune to damage until stasis shatters.

## Mirror semantics (the 11 now mirrorable)

| Pattern | Mirror | Use case |
|---|---|---|
| `add character.movement.land -15` | `add` +15 | Sprint — gain 15ft speed |
| `grant behavior:velocity_lock` | `revoke` | No velocity lock capability |
| `grant behavior:kinetic_lock_absolute` | `revoke` | No apex lock |
| `grant behavior:kinetic_override_capable` | `revoke` | No apex kinetic control |
| `grant behavior:delayed_resolution` | `revoke` | No delay capability |
| `grant behavior:capability_dormant` | `revoke` | No dormant conversion |
| `grant behavior:chronological_immunity` | `revoke` | Vulnerable to delays |
| `grant behavior:duration_freeze` | `revoke` | No duration freeze |
| `grant behavior:duration_persistent` | `revoke` | Scene durations still expire |
| `grant behavior:kinetic_stasis_object` | `revoke` | No object stasis |
| `grant behavior:temporal_stasis_entity` | `revoke` | No entity stasis |

The Minor Linear Displacement mirror (Slow → Sprint) is the strongest pattern in this batch. 4 BU of "minor displacement slow" mirrors to 4 BU of "Sprint +15ft." Clean Vulnerability Inverse.

## Test coverage

`src/db/__tests__/phase79-time-space.test.ts` — 57 new tests:

| Block | Tests | Purpose |
|---|---|---|
| DB shape per row | 11 | each row has exactly 1 modifier matching spec |
| Chirality | 11 | all 11 stored is_mirrorable=true |
| applyMirror round-trip | 11 | add involutive (1), grant→revoke (10) |
| Vulnerability Inverse | 1 | -15 speed → +15 Sprint flip |
| Content hash | 11 | 64-char hex |
| Target slot constraints | 11 | add ops target character.movement.land; grant ops target behavior:* |
| Hard constraint | 1 | all 11 rows have exactly 1 modifier |

**Total: 1401/1401 tests passing (was 1344, +57 new).**

## Idempotency

Verified: second run = `applied=0 skipped=11 failed=0`.

## What's next

**26 NEEDS_MOD remaining.** 3 batches:

- **7.9.3d** — METAMORPHOSIS (4) + AGENCY_OVERRIDE (4) = 8 rows. Heavy — template swaps, mind control. May need new target slots.
- **7.9.3e** — PROBABILITY_BIAS remaining (4) + EVALUATION_STRAIN (8) = 12 rows.
- **7.9.3f** — SHEET_AUGMENT remaining (3) = 3 rows. Straightforward.
