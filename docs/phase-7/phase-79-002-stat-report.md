# Phase 7.9.2 — Stat-Like Modifier Migration Report

**Date:** 2026-07-16
**Script:** `scripts/apply-phase79-002.ts`
**Tests:** `src/db/__tests__/phase79-stat-like.test.ts`
**Status:** Applied. 27 rows updated, 0 failures, 0 drift.

---

## Numbers

| Metric | Before 7.9.2 | After 7.9.2 |
|---|---|---|
| DONE | 15 | **42** (+27) |
| NEEDS_MOD | 102 | **75** (-27) |
| Chirality drift | 0 | **0** |
| Tests | 1041 | **1150** (+109) |

## The 27 applied

| Cat | Count | Examples |
|---|---|---|
| DEFENSIVE | 4 | Universal Aegis (add), Reactive Bulwark / Structural Hardening / Absolute Insulation (grant) |
| INTENSITY_DICE | 5 | Standard (1d6) → Existential Tear (1d20), all add |
| PRACTICE_PROGRESSION | 5 | Broad Familiarity / Focused Edge / Practice Proficiency / Expertise Upgrade / Reliable Practice, all grant |
| MOBILITY_LOCOMOTION | 5 | Aquatic / Subterranean / Aero / Phase Slip / Hover Precision, all grant |
| SENSORY_ARRAY | 4 | Umbral Sight I/II, Substrate Echo, Tactile Echo, all grant |
| PERCEPTION_QUALIFIER | 4 | Environmental / Systemic / Non-Material / Existential, all grant |

## Per-row changes

For each of the 27 rows:
- `hard_modifiers` set to a 1-element array with the proposed modifier
- `is_mirrorable` set to `true` (all 27 use non-`set` ops; 27 of 27 had `false` stored before)
- `mirror_vector` set to `VARIABLE_VECTOR`
- `mirror_bu_credit` set to `bu_cost`
- `narrative_rule` got a fork-guidance section appended
- `content_hash` recomputed
- `primitive_versions` got a new `FULL` snapshot with `is_latest=true`

## Mirror semantics (the 27 now mirrorable)

| Op | Mirror | Pattern |
|---|---|---|
| `add` to defense | `subtract` from defense | Vulnerability |
| `add` to damage (dice) | `subtract` from damage (dice) | Damage Reduction (canonical Vulnerability Inverse) |
| `grant behavior:darkvision_60ft` | `revoke` behavior | No darkvision |
| `grant behavior:swim_speed` | `revoke` | No swim |
| `grant behavior:practice_proficiency` | `revoke` | -PB on practice (Flaw) |

## Test results

`src/db/__tests__/phase79-stat-like.test.ts` — 109 new tests across 5 describe blocks:

| Block | Tests | Purpose |
|---|---|---|
| DB shape per row | 27 | each row has exactly 1 modifier matching spec |
| Chirality | 27 | all 27 stored is_mirrorable=true (op is non-set) |
| applyMirror round-trip | 10 | add involutive (5), grant→revoke (5) |
| Content hash present | 27 | each row has 64-char hex hash |
| Hard constraint | 1 | all 27 rows obey 1-modifier-per-primitive CHECK |

**Total: 1150/1150 tests passing (was 1041, +109 new).**

## Idempotency

Re-running the migration:
```
Done. applied=0 skipped=27 failed=0
```

No-op on second run. Safe.

## What's next

7.9.2 done. Remaining: **75 NEEDS_MOD** for 7.9.3 (verb-like group):

- ACTION_ECONOMY (11)
- BOSS_ECONOMY (5)
- TRIGGER_HOOK (4)
- SPEED_QUICKENING (4)
- KINETIC_CONTROL (4)
- AGENCY_OVERRIDE (4)
- METAMORPHOSIS (4)
- TEMPORAL_CHRONOLOGICAL (7)
- TARGETING_AOE (10, excluding Vector Split done in 7.9.1)
- TACTICAL (4)
- EVALUATION_STRAIN non-mirrorable (8, excluding Vitality Shielding done in 7.9.1)
- PROBABILITY_BIAS non-mirrorable (4, excluding Negative Bias I/II/III done in 7.9.1)
- DEFENSIVE non-mirrorable — already done in 7.9.2
- INTENSITY_DICE non-mirrorable — already done in 7.9.2

The verb-like group will need its own proposal doc — modifiers there are more complex (multi-target, runtime hooks, etc.). Ready when you say go.
