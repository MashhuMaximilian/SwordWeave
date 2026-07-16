# Phase 7.9.3b — Spatial Modifier Proposals

**Scope:** 14 spatial primitives, batch 2 of verb-like.
**Pattern:** `add` for numerical penalties, `grant behavior:*` for engine flags (cover tiers, AoE templates, persistence modes).

## TACTICAL (4) — cover tier primitives

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 849 | Minor Obstruction (Cover Tier I) | `add action.roll -2` | Flat -2 to attack rolls against the covered coord. |
| 850 | Half Cover (Cover Tier II) | `add action.roll -4` | Flat -4 to attack rolls against the covered coord. |
| 851 | Total Cover (Cover Tier III) | `grant behavior:cover_total` | Engine flag — vectors cannot target, line of sight severed. Direct manifestations still pass. |
| 852 | Spatial Anchor Cover (Cover Tier IV) | `grant behavior:cover_spatial_anchor` | Engine flag — total + dispositional protection (warps the local frame). Apex cover. |

## TARGETING_AOE (10) — area effect primitives

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 224 | Bouncing Vector | `grant behavior:bouncing_vector` | Engine flag — chain-hop on successful resolution, leap to new target within 15ft. |
| 225 | Collateral Buffer | `grant behavior:collateral_filter` | Engine flag — friendly fire immunity inside AoE template. |
| 226 | Selective Focus | `grant behavior:selective_focus` | Engine flag — precise entity exclusion within AoE. |
| 227 | Linear / Conical Vector | `grant behavior:shape_linear_conical` | Engine flag — 15ft cone OR 30ft line template. |
| 228 | Kinetic Sphere | `grant behavior:shape_sphere_burst` | Engine flag — 10ft radius burst template. |
| 229 | Stationary Zone | `grant behavior:zone_stationary` | Engine flag — persisting field at fixed coordinate. |
| 230 | Mobile Aura | `grant behavior:zone_mobile` | Engine flag — moving 10ft radius field anchored to user. |
| 231 | Structural Wall | `grant behavior:shape_wall` | Engine flag — 30ft long × 10ft tall linear barrier. |
| 232 | Volume Scaling I | `add action.areaSize 1` | +1 size tier upgrade (e.g. 10ft sphere → 20ft sphere). |
| 233 | Global Field | `grant behavior:field_global` | Engine flag — scene-wide blanket effect. |

## Mirror semantics (the 14 now mirrorable)

| Pattern | Mirror |
|---|---|
| `add action.roll -2` (Cover I) | `add` +2 (EXPOSED — attacker gains +2 vs this coord, the inverse vulnerability) |
| `add action.roll -4` (Cover II) | `add` +4 (EXPOSED) |
| `grant behavior:cover_total` | `revoke` (no total cover, vectors pass) |
| `grant behavior:cover_spatial_anchor` | `revoke` (apex protection removed) |
| `grant behavior:bouncing_vector` | `revoke` (no chain) |
| `grant behavior:collateral_filter` | `revoke` (friendly fire now hits) |
| `grant behavior:selective_focus` | `revoke` (no entity exclusion) |
| `grant behavior:shape_*` | `revoke` (shape tag removed) |
| `grant behavior:zone_stationary` / `zone_mobile` | `revoke` (zone tag removed) |
| `add action.areaSize 1` | `subtract` 1 (Volume Down — shrinks AoE) |
| `grant behavior:field_global` | `revoke` (no global field) |

The cover mirrors are particularly powerful: a character that buys a 4-BU capability granting cover I to an ally can mirror it to a 4-BU capability removing cover (EXPOSED) from an enemy — a canonical Vulnerability Inverse. The engine reads `add action.roll -2` (cover) vs `add action.roll +2` (exposed) and the two compose cleanly.

## Idempotency

Same as 7.9.3a. Re-running = 0 changes, 14 "already applied" skips.

## What's next after 7.9.3b

- 7.9.3c — TEMPORAL_CHRONOLOGICAL (7) + KINETIC_CONTROL (4) = 11 rows.
- 7.9.3d — METAMORPHOSIS (4) + AGENCY_OVERRIDE (4) = 8 rows.
- 7.9.3e — PROBABILITY_BIAS remaining (4) + EVALUATION_STRAIN (8) = 12 rows.
- 7.9.3f — SHEET_AUGMENT remaining (3) = 3 rows.
