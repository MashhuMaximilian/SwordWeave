# Phase 7.9.3b — Spatial Migration Report

**Date:** 2026-07-16
**Script:** `scripts/apply-phase79-003b.ts`
**Tests:** `src/db/__tests__/phase79-spatial.test.ts`
**Status:** Applied. 14 rows updated, 0 failures, 0 drift.

---

## Numbers

| Metric | Before 7.9.3b | After 7.9.3b |
|---|---|---|
| DONE | 66 | **80** (+14) |
| NEEDS_MOD | 51 | **37** (-14) |
| Chirality drift | 0 | **0** |
| Tests | 1271 | **1344** (+73) |

## The 14 applied

| Cat | Count | Pattern |
|---|---|---|
| TACTICAL | 4 | 2 `add` (Cover I/II accuracy penalty) + 2 `grant behavior:cover_*` (Cover III/IV total/anchor) |
| TARGETING_AOE | 10 | 9 `grant behavior:*` (chain, filter, focus, shapes, zones, global) + 1 `add action.areaSize` (Volume Scaling) |

## Notable design points

**Cover tier progression.** The four cover tiers model escalation:
- Cover I (4 BU) → `add action.roll -2` (numerical penalty)
- Cover II (6 BU) → `add action.roll -4` (numerical penalty)
- Cover III (12 BU) → `grant behavior:cover_total` (engine flag)
- Cover IV (24 BU) → `grant behavior:cover_spatial_anchor` (engine flag, subsumes III)

The numerical→flag switch at Tier III reflects a qualitative jump: partial penalties compose but total cover is a binary state. The engine reads the flag and applies the appropriate block logic.

**Cover mirrors = EXPOSED.** A 4-BU capability granting Cover I to an ally can be mirrored to a 4-BU capability removing cover from an enemy (EXPOSED, +2 attack bonus vs the coord). The Vulnerability Inverse. This is the canonical pattern from the BU Market doc.

**AoE shape patterns.** All 5 AoE shape primitives (Linear/Conical, Kinetic Sphere, Structural Wall, Mobile Aura, Stationary Zone) use `grant behavior:shape_*` flags rather than numerical targets. The engine reads the shape flag and renders the appropriate template at resolution time. Volume Scaling I is the only one that uses `add action.areaSize` because "bigger" is a quantitative upgrade on an existing shape.

**Stationary vs Mobile zones.** Two flags, two behaviors. Both create a 10ft-radius field, but stationary zones persist at a fixed coordinate while mobile auras track the user. Engine reads the flag to determine movement logic.

**Global Field.** Single behavior flag (`behavior:field_global`) that drops all localized boundaries. Apex AoE primitive — the entire combat map is the template.

## Mirror semantics (the 14 now mirrorable)

| Pattern | Mirror | Use case |
|---|---|---|
| `add action.roll -2` (Cover I) | `add` +2 | EXPOSED — attacker bonus |
| `add action.roll -4` (Cover II) | `add` +4 | EXPOSED — attacker bonus |
| `add action.areaSize 1` (Volume I) | `subtract` 1 | Volume Down — shrinks AoE |
| `grant behavior:cover_total` | `revoke` | No total cover |
| `grant behavior:cover_spatial_anchor` | `revoke` | Apex protection removed |
| `grant behavior:bouncing_vector` | `revoke` | No chain |
| `grant behavior:collateral_filter` | `revoke` | Friendly fire returns |
| `grant behavior:selective_focus` | `revoke` | No entity exclusion |
| `grant behavior:shape_*` | `revoke` | Shape tag removed |
| `grant behavior:zone_stationary` / `zone_mobile` | `revoke` | Zone tag removed |
| `grant behavior:field_global` | `revoke` | Effect reverts to local scope |

The cover mirrors are the most powerful pattern: a 12-BU capability with Cover III can be mirrored to a 12-BU capability with no total cover — total negation of defensive geometry at the cost of BU.

## Test coverage

`src/db/__tests__/phase79-spatial.test.ts` — 73 new tests:

| Block | Tests | Purpose |
|---|---|---|
| DB shape per row | 14 | each row has exactly 1 modifier matching spec |
| Chirality | 14 | all 14 stored is_mirrorable=true |
| applyMirror round-trip | 14 | add involutive (3), grant→revoke (11) |
| Cover-tier mirror | 2 | -2→+2 and -4→+4 EXPOSED flip |
| Content hash | 14 | 64-char hex |
| Target slot constraints | 14 | add ops target action.*; grant ops target behavior:* |
| Hard constraint | 1 | all 14 rows have exactly 1 modifier |

**Total: 1344/1344 tests passing (was 1271, +73 new).**

## Idempotency

Verified: second run = `applied=0 skipped=14 failed=0`.

## What's next

**37 NEEDS_MOD remaining.** Batches:

- **7.9.3c** — TEMPORAL_CHRONOLOGICAL (7) + KINETIC_CONTROL (4) = 11 rows. Time/space primitives — delays, stasis, displacement.
- **7.9.3d** — METAMORPHOSIS (4) + AGENCY_OVERRIDE (4) = 8 rows. Heavy — template swaps, mind control.
- **7.9.3e** — PROBABILITY_BIAS remaining (4) + EVALUATION_STRAIN (8) = 12 rows. Probability + strain mitigation.
- **7.9.3f** — SHEET_AUGMENT remaining (3) = 3 rows. Straightforward `add` ops.

11 + 8 + 12 + 3 = 34, plus the 3 already done in 7.9.1 = 37 (matches the audit). 4 more batches.
