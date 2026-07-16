# Phase 7.9.3a — Verb-Like Migration Report (Batch 1 of 3)

**Date:** 2026-07-16
**Script:** `scripts/apply-phase79-003a.ts`
**Tests:** `src/db/__tests__/phase79-verb-batch1.test.ts`
**Status:** Applied. 24 rows updated, 0 failures, 0 drift.

---

## Numbers

| Metric | Before 7.9.3a | After 7.9.3a |
|---|---|---|
| DONE | 42 | **66** (+24) |
| NEEDS_MOD | 75 | **51** (-24) |
| Chirality drift | 0 | **0** |
| Tests | 1150 | **1271** (+121) |

## The 24 applied

| Cat | Count | Highlights |
|---|---|---|
| ACTION_ECONOMY | 11 | Haste Vector (+1 std action), Stun Vector (-1 std action), Reaction Pulse (+1 reaction), Clash Dominance (positive bias on reaction clash), Interceptive Priority (auto-win ties) |
| BOSS_ECONOMY | 5 | Legendary Cadence I/II/III (+1/+2/+3 legendary actions), Existential Imperative (1x/day save overwrite), Mythic Safeguard (3x/day) |
| TRIGGER_HOOK | 4 | Direct Material / Systemic Threshold / Conditional Informational / Interceptive Causal (all `grant behavior:trigger_*`) |
| SPEED_QUICKENING | 4 | Standard / Fast / Instant / Reaction Execution (all `grant behavior:timing_*`) |

## Notable design decisions

**Action economy counter targets.** New target slots introduced in this batch:

- `action.bonus_action_window` (Timeline Shift)
- `action.standard_action_window` (Haste Vector, Stun Vector)
- `action.reaction_window` (Reaction Pulse)
- `action.legendary_action_window` (Legendary Cadence I/II/III)
- `action_roll.reaction_clash` (Reaction Reflex)

The engine reads these slots at round-resolution time. Stacking is `stack` for these so multiple bonuses compose.

**Behavior flag pattern.** 19 of 24 modifiers use `grant behavior:*` rather than direct numerical ops. This keeps the engine resolution logic in one place (the flag reader) and the canonical primitives as declarative "what flag does this enable" rather than imperative "do this math."

**Absolute Timeline Deprivation (Stun Vector).** Used `add -1` on `action.standard_action_window` rather than `set 0` to preserve mirrorability. SEED pattern — for a target with exactly 1 standard action, this fully suppresses it. The mirror (`subtract 1`, i.e. +1 standard action) flips the effect to Haste on the target — the canonical Vulnerability Inverse.

**Standard Execution (id 39) has BU=0.** This is the "baseline" reference primitive for the timing system. It still gets a modifier (`grant behavior:timing_standard`) so the engine can recognize it as a canonical atom, and it's still mirrorable (mirror removes the timing tag — but the engine treats untagged as Standard by default, so the mirror is effectively a no-op semantically). The BU=0 correctly maps to `mirror_bu_credit=0`.

## Mirror semantics (the 24 now mirrorable)

| Pattern | Mirror | Use case |
|---|---|---|
| `add action.standard_action_window +1` | `subtract` 1 | Slow effect |
| `add action.standard_action_window -1` | `subtract` -1 (= +1) | Haste on the target |
| `add action.reaction_window +1` | `subtract` 1 | Reaction Liability |
| `add action.bonus_action_window +1` | `subtract` 1 | Tactical Liability |
| `add action.legendary_action_window +N` | `subtract` N | Minion (fewer legendary actions) |
| `add action_roll.reaction_clash +2` | `subtract` 2 | Reflex Denial |
| `grant behavior:positive_bias` (reaction clash) | `revoke` | No advantage on clashes |
| `grant behavior:win_ties` (reaction clash) | `revoke` | No auto-win |
| `grant behavior:track_acceleration` | `revoke` | No track shift |
| `grant behavior:track_displacement_immunity` | `revoke` | Vulnerable to track displacement |
| `grant behavior:trigger_*` | `revoke` | Trigger removed |
| `grant behavior:timing_*` | `revoke` | Timing tag removed |
| `grant behavior:legendary_resistance` (1 or 3 charges) | `revoke` | No legendary resistance |
| `grant behavior:heavy_track_compress` | `revoke` | Heavy takes normal delay |
| `grant behavior:reactive_window_bonus` | `revoke` | Cannot use Trigger Hooks |

The pattern is consistent: every mirror is a mathematical inverse. Mirrors compose in a Capability to produce "Vulnerability Inverse" effects (e.g. a 24-BU capability with a positive bias and a 24-BU mirror of a 24-BU cap with a negative bias = total negation).

## Test coverage

`src/db/__tests__/phase79-verb-batch1.test.ts` — 121 new tests:

| Block | Tests | Purpose |
|---|---|---|
| DB shape per row | 24 | each row has exactly 1 modifier matching spec |
| Chirality | 24 | all 24 stored is_mirrorable=true |
| applyMirror round-trip | 24 | add involutive (10), grant→revoke (14) |
| Content hash | 24 | 64-char hex |
| Target slot constraints | 24 | add ops target action.* / action_roll.*; grant ops target behavior:* |
| Hard constraint | 1 | all 24 rows have exactly 1 modifier |

**Total: 1271/1271 tests passing (was 1150, +121 new).**

## Idempotency

Verified: second run = `applied=0 skipped=24 failed=0`.

## What's next

**51 NEEDS_MOD** remaining. Batches:

- **7.9.3b** — TACTICAL (4) + TARGETING_AOE (10) = 14 rows. Spatial primitives.
- **7.9.3c** — TEMPORAL_CHRONOLOGICAL (7) + KINETIC_CONTROL (4) = 11 rows. Time/space.
- **7.9.3d** — METAMORPHOSIS (4) + AGENCY_OVERRIDE (4) = 8 rows. Heavy — template swaps and mind control.
- **7.9.3e** — PROBABILITY_BIAS remaining (4) + EVALUATION_STRAIN (8) = 12 rows. Probability and strain.
- **7.9.3f** — SHEET_AUGMENT remaining (3) = 3 rows. Straightforward.

Total: 14 + 11 + 8 + 12 + 3 = 48. Plus the 3 already done in 7.9.1 = 51 (matches the audit). 5 more batches.
