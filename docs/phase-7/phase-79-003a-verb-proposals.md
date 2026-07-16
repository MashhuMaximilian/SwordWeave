# Phase 7.9.3a — Verb-Like Modifier Proposals (Batch 1 of 3)

**Scope:** 24 verb-like primitives, the clean group.
**Pattern:** `add` to action/reaction counter targets, or `grant behavior:*` for engine flags.
**All 24 mirrorable** — none use `set` op.

## Per-row proposals

### ACTION_ECONOMY (11)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 187 | Timeline Shift / Minor Window Grant | `add` `action.bonus_action_window` +1 | Counter — grant one bonus action per round |
| 188 | Reactive Expansion (Guardian Vector) | `grant behavior:reactive_window_bonus` value=1 unique-by-primitive | Engine flag — +1 reaction per round for Trigger Hooks |
| 189 | Core Action Multiplication (Haste Vector) | `add` `action.standard_action_window` +1 | Counter — +1 standard action per turn |
| 190 | Absolute Timeline Deprivation (Stun Vector) | `add` `action.standard_action_window` -1; `add` `action.reaction_window` -1 | Counter suppression — both stack to fully erase action/reaction. SEED for stun/freeze mechanics. |
| 191 | Track Acceleration | `grant behavior:track_acceleration` value=1 unique-by-primitive | Engine flag — designate one capability's timing to step up one Track. |
| 192 | Heavy Compactor | `grant behavior:heavy_track_compress` value=1 unique-by-primitive | Engine flag — compress Heavy Track to Measured for one capability. |
| 193 | Timeline Anchor | `grant behavior:track_displacement_immunity` value=1 unique-by-primitive | Engine flag — immune to adverse Track Displacement. |
| 194 | Reaction Pulse | `add` `action.reaction_window` +1 | Counter — +1 independent reaction slot per round. |
| 195 | Reaction Reflex | `add` `action_roll.reaction_clash` +2 | Numeric — flat +2 to all Reaction Clash rolls. |
| 196 | Clash Dominance | `grant behavior:positive_bias` scope=`reaction_clash` | Engine flag — Positive Bias (Advantage) on Reaction Clashes. |
| 197 | Interceptive Priority | `grant behavior:win_ties` scope=`reaction_clash` | Engine flag — auto-win ties on Reaction Clashes. |

### BOSS_ECONOMY (5)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 394 | Legendary Cadence I | `add` `action.legendary_action_window` +1 | Counter — +1 legendary action per round. |
| 395 | Legendary Cadence II | `add` `action.legendary_action_window` +2 | Counter — +2 legendary actions per round. |
| 396 | Legendary Cadence III | `add` `action.legendary_action_window` +3 | Counter — +3 legendary actions per round, +stacks on behavior:legendary_pool_refresh. |
| 397 | Existential Imperative (Legendary Resistance 1x/Day) | `grant behavior:legendary_resistance` charges=1 | Engine flag — 1x/day, overwrite failed save. |
| 398 | Mythic Safeguard (Legendary Resistance 3x/Day) | `grant behavior:legendary_resistance` charges=3 | Engine flag — 3x/day, bypass catastrophic debuffs. |

### TRIGGER_HOOK (4)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 167 | Direct Material Trigger | `grant behavior:trigger_material` value=1 unique-by-primitive | Engine flag — wake on physical/kinetic interaction. |
| 168 | Systemic Threshold Trigger | `grant behavior:trigger_systemic` value=1 unique-by-primitive | Engine flag — wake on state transition. |
| 169 | Conditional Informational Trigger | `grant behavior:trigger_informational` value=1 unique-by-primitive | Engine flag — wake on remote/abstract condition. |
| 170 | Interceptive Causal Trigger | `grant behavior:trigger_interceptive` value=1 unique-by-primitive | Engine flag — wake on incoming event before resolution. |

### SPEED_QUICKENING (4)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 39 | Standard Execution | `grant behavior:timing_standard` value=1 unique-by-primitive | Engine flag — baseline timing reference. |
| 40 | Fast Execution | `grant behavior:timing_fast` value=1 unique-by-primitive | Engine flag — Fast Track priority. |
| 41 | Instant Execution | `grant behavior:timing_instant` value=1 unique-by-primitive | Engine flag — immediate resolution on declaration. |
| 42 | Reaction Execution | `grant behavior:timing_reaction` value=1 unique-by-primitive | Engine flag — interrupt-triggered execution. |

## Mirror semantics (the 24 now mirrorable)

| Pattern | Mirror |
|---|---|
| `add action.bonus_action_window +1` | `subtract` → forces -1 bonus action per round (Tactical Liability) |
| `add action.standard_action_window +1` | `subtract` → forces -1 standard action per turn (Haste reversal: Slow) |
| `add action.reaction_window +1` | `subtract` → forces -1 reaction per round (Reaction Liability) |
| `add action.legendary_action_window +N` | `subtract` → forces -N legendary actions (Minion) |
| `add action_roll.reaction_clash +2` | `subtract` → forces -2 reaction clash (Reflex Denial) |
| `grant behavior:positive_bias` (reaction clash) | `revoke` → no positive bias on reaction clash |
| `grant behavior:win_ties` (reaction clash) | `revoke` → no auto-win ties |
| `grant behavior:trigger_*` | `revoke` → trigger hook removed |
| `grant behavior:timing_*` | `revoke` → timing tag removed |

## Idempotency

Same as 7.9.1 / 7.9.2. Re-running = 0 changes, 24 "already applied" skips.

## What's next after 7.9.3a

- 7.9.3b: TACTICAL (4) + TARGETING_AOE (10) = 14 rows (spatial primitives)
- 7.9.3c: TEMPORAL_CHRONOLOGICAL (7) + KINETIC_CONTROL (4) = 11 rows (time/space)
- 7.9.3d: METAMORPHOSIS (4) + AGENCY_OVERRIDE (4) = 8 rows (heavy, template swaps)
- 7.9.3e: PROBABILITY_BIAS remaining (4) + EVALUATION_STRAIN (8) = 12 rows
- 7.9.3f: SHEET_AUGMENT remaining (3) = 3 rows
