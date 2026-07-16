# Phase 7.9.4 — Mirrorable Carryover Migration Report

**Date:** 2026-07-16
**Script:** `scripts/apply-phase79-001.ts`
**Tests:** `src/db/__tests__/phase79-mirrorable.test.ts`
**Status:** Applied. 15 rows updated, 0 failures, 0 drift.

---

## What landed

| ID | Name | Category | BU | Op | Target | Value | Stack | Notes |
|---|---|---|---|---|---|---|---|---|
| 61 | Vitality Core Augment I | SHEET_AUGMENT | 4 | `add` | `max_vitality` | 5 | `stack` | new modifier |
| 62 | Vitality Core Augment II | SHEET_AUGMENT | 8 | `add` | `max_vitality` | 12 | `stack` | new modifier |
| 63 | Vitality Core Augment III | SHEET_AUGMENT | 12 | `add` | `max_vitality` | 20 | `stack` | new modifier |
| 53 | Attribute Increment | SHEET_AUGMENT | 12 | `add` | `attribute` | 1 | `stack` | new modifier (SEED) |
| 54 | Attack Bonus Increment | SHEET_AUGMENT | 6 | `add` | `action_roll.attack_bonus` | 1 | `stack` | new modifier (SEED) |
| 382 | Kinetic Hardening | DEFENSIVE | 6 | `add` | `defense_dc.physical` | 1 | `stack` | new modifier |
| 383 | Warding Shell | DEFENSIVE | 6 | `add` | `defense_dc.magical` | 1 | `stack` | new modifier |
| 384 | Psychic Firewall | DEFENSIVE | 6 | `add` | `defense_dc.mental` | 1 | `stack` | new modifier |
| 201 | Vitality Shielding | EVALUATION_STRAIN | 10 | `grant` | `behavior:vitality_shielding` | 1 | `unique-by-primitive` | new modifier (behavior grant) |
| 218 | Stride Extension | MOBILITY_LOCOMOTION | 5 | `add` | `speed.walk` | 10 | `stack` | new modifier |
| 161 | Negative Bias I — Narrative Focus | PROBABILITY_BIAS | 3 | `grant` | `behavior:disadvantage` | 1 | `unique-by-target` | new modifier (SEED) |
| 163 | Negative Bias II — Named Practice | PROBABILITY_BIAS | 6 | `grant` | `behavior:disadvantage` | 1 | `unique-by-target` | new modifier (SEED) |
| 165 | Negative Bias III — Core Attribute | PROBABILITY_BIAS | 12 | `grant` | `behavior:disadvantage` | 1 | `unique-by-target` | new modifier (SEED) |
| 18 | Vector Split | TARGETING | 4 | `add` | `action.targetCount` | 1 | `stack` | **chirality fix** (modifier unchanged) |
| 19 | Minor Die Block | INTENSITY_DICE | 1 | `add` | `action.damage` | `"1d4"` | `stack` | **chirality fix** (modifier unchanged) |

## Per-row changes

For each of the 15 rows:
- `hard_modifiers` set to a 1-element array with the proposed modifier (or kept as-is for chirality-fix rows)
- `is_mirrorable` set to `true` for `add`/`grant` ops, `false` for `set` ops (derived from op)
- `mirror_vector` set to `VARIABLE_VECTOR` for mirrorable, `STANDARD_ONLY` for non-mirrorable
- `mirror_bu_credit` set to `bu_cost` for mirrorable, `0` for non-mirrorable
- `narrative_rule` got a `**Fork guidance:** …` section appended (skipped if already present)
- `content_hash` recomputed via `buildCanonicalPrimitivePayload` + `hashPrimitiveContent`
- `primitive_versions` got a new `FULL` snapshot with `is_latest=true`; any prior `is_latest=true` row was demoted

## Test results

`src/db/__tests__/phase79-mirrorable.test.ts` — 61 new tests across 5 describe blocks:

| Block | Tests | Purpose |
|---|---|---|
| DB shape per row | 15 | each row has exactly 1 modifier matching spec |
| Chirality — stored is_mirrorable matches derived | 15 | no drift between op and stored flag |
| applyMirror round-trip | 15 | mirror involutive on `add`/`grant` ops |
| Hard constraint — at most 1 modifier | 1 | all 15 rows obey DB CHECK |
| Content hash present | 15 | each row has a 64-char hex hash |

**Total: 1041/1041 tests passing (was 980, +61 new).**

## Audit re-run

After the migration, the re-audit script shows:
- DONE: 2 → **15** (+13)
- NEEDS_MOD: 115 → **102** (-13)
- Chirality drift: 2 → **0**

```
PHASE 7.9 RE-AUDIT (new primitive model)
================================================================================
Total canonical primitives: 146
  SKIP      (structural atom):  29
  DONE      (modifier exists):  15
  NEEDS_MOD (modifier pending): 102
  Chirality drift on DONE rows: 0
```

## Idempotency

Re-running `scripts/apply-phase79-001.ts`:
```
[61] Vitality Core Augment I — already applied, skip
[62] Vitality Core Augment II — already applied, skip
... (15 lines)
Done. applied=0 skipped=15 failed=0
```

No-op on second run. Safe to re-run.

## What's next

7.9.4 (this delivery) handles the 13 mirrorable + 2 chirality fix. Remaining:

- **7.9.2** — Author ~28 stat-like modifiers (DEFENSIVE non-mirrorable, VITALITY, INTENSITY_DICE, PRACTICE_PROGRESSION, MOBILITY non-mirrorable, SENSORY_ARRAY, PERCEPTION_QUALIFIER)
- **7.9.3** — Author ~74 verb-like modifiers (ACTION_ECONOMY, PROBABILITY_BIAS non-mirrorable, BOSS_ECONOMY, TRIGGER_HOOK, SPEED_QUICKENING, KINETIC_CONTROL, AGENCY_OVERRIDE, EVALUATION_STRAIN non-mirrorable, METAMORPHOSIS, TEMPORAL_CHRONOLOGICAL, TARGETING_AOE, TACTICAL)

Each batch will go through the same review-and-migrate cycle: proposed modifier in audit doc, your sign-off, migration script, tests, push.
