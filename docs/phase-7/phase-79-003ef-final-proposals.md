# Phase 7.9.3e+f — Final Modifier Proposals (Probability + Strain + Sheet Augment)

**Scope:** 15 remaining NEEDS_MOD primitives. Completes Phase 7.9.
**Pattern:** Mix of `add` (numerical strain/score slots) and `grant behavior:*` (capability flags).

## PROBABILITY_BIAS (4 remaining)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 160 | Positive Bias I — Narrative Focus | `grant behavior:positive_bias` | Engine flag — Positive Bias (Advantage) on one ultra-specific narrative sub-trigger. SEED — fork to specify the focus. |
| 162 | Positive Bias II — Named Practice | `grant behavior:positive_bias` | Engine flag — Positive Bias on a single Named Practice. SEED — fork to specify the practice. |
| 164 | Positive Bias III — Core Attribute | `grant behavior:positive_bias` | Engine flag — Positive Bias across an entire primary Attribute axis. SEED — fork to specify the attribute. |
| 166 | Causal Override (Fate Replacement) | `grant behavior:causal_override` | Engine flag — bypass rolling entirely, replace an upcoming d20 with a fixed value. Apex probability. |

## EVALUATION_STRAIN (8)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 198 | Heuristic Buffer | `add action.strain -1` | Reduces the final Strain Score by 1 step (minimum 0) for one capability. |
| 199 | Systemic Sink | `add action.strain -2` | Reduces the final Strain Score by 2 steps (minimum 0). |
| 200 | Volatile Vent | `grant behavior:strain_vent` | Engine flag — once per scene, treat incoming Strain 1-2 as Strain 0. |
| 202 | Condition Insulation | `grant behavior:strain_condition_insulation` | Engine flag — negate one DM-imposed status condition from strain feedback. |
| 203 | Domain Lock Shield | `grant behavior:strain_domain_lock_shield` | Engine flag — immunity to strain-based Domain Burnouts / Locks. |
| 204 | Hazard Transmutation | `grant behavior:strain_hazard_transmutation` | Engine flag — convert personal Vitality loss into an Environmental Hazard. |
| 205 | Narrative Pivot | `grant behavior:strain_narrative_pivot` | Engine flag — convert all mechanical sheet costs into a severe Narrative Twist. |
| 206 | CV Matrix Trap | `grant behavior:strain_matrix_trap` | Engine flag — convert Strain 3+ casts into a temporary defensive threshold. |

## SHEET_AUGMENT (3 remaining)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 55 | Defensive Save Upgrade | `grant behavior:saving_throw_proficiency` | Engine flag — adds full Proficiency Bonus to defense/hazard saves for one chosen Attribute type. SEED — fork to specify attribute. |
| 64 | Focused Presence (Global DC Modifier) | `grant behavior:global_dc_modifier` | Engine flag — raises the global baseline check threshold by +1 for all saving throws forced by the character. |
| 65 | Precise Vector Alignment (Global Attack Modifier) | `add action.roll 1` | Flat +1 to all attack/accuracy resolution rolls regardless of source. |

## Design notes

**Heuristic Buffer / Systemic Sink** — modeled as `add action.strain -1 / -2` meaning the capability produces 1-2 less strain. This is semantically equivalent to "reduce the final Strain Score" because the strain is a per-capability output. SEED — fork to scope to a specific capability.

**Positive Bias I/II/III** — all three use the same `behavior:positive_bias` flag with different scopes. The engine reads the flag and the scope (from the fork's condition) to apply advantage at the right level. The flag itself is a single canonical primitive with three tier variants for BU pricing.

**Causal Override (166)** — the apex probability primitive. `behavior:causal_override` is a unique flag because it bypasses the d20 entirely. Mirror: revoke (cannot bypass rolls). The mirror is the canonical "you can no longer guarantee outcomes" effect.

**Strain vent/transmutation/pivot** — all behavior flags that change how strain resolves. The engine reads the flag at evaluation time and applies the appropriate transformation (treat as 0, convert to hazard, convert to narrative twist, convert to defensive threshold).

**Focused Presence (64)** — used a behavior flag (`behavior:global_dc_modifier`) rather than `add character.defense.physicalDc` because the existing slot is for the entity's OWN defense DC, not the DC the entity forces on others. The flag pattern lets the engine apply the +1 to all DCs the character forces.

**Precise Vector Alignment (65)** — `add action.roll 1` works because `action.roll` is the attack roll slot. A flat +1 to all attack rolls stacks with other attack bonuses.

## Mirror semantics (the 15 now mirrorable)

| Pattern | Mirror | Use case |
|---|---|---|
| `grant behavior:positive_bias` (×3) | `revoke` | No advantage |
| `grant behavior:causal_override` | `revoke` | Cannot bypass rolls |
| `add action.strain -1` | `add` +1 | Extra strain! |
| `add action.strain -2` | `add` +2 | Extra strain!! |
| `grant behavior:strain_vent` | `revoke` | No strain vent |
| `grant behavior:strain_condition_insulation` | `revoke` | Vulnerable to strain conditions |
| `grant behavior:strain_domain_lock_shield` | `revoke` | Vulnerable to domain burnouts |
| `grant behavior:strain_hazard_transmutation` | `revoke` | No hazard transmutation |
| `grant behavior:strain_narrative_pivot` | `revoke` | No narrative pivot |
| `grant behavior:strain_matrix_trap` | `revoke` | No matrix trap |
| `grant behavior:saving_throw_proficiency` | `revoke` | No save proficiency |
| `grant behavior:global_dc_modifier` | `revoke` | No global DC bonus |
| `add action.roll 1` | `subtract` 1 | -1 to all attack rolls |

The `add action.strain -1` mirror (`+1` strain) is the canonical Vulnerability Inverse: "the strain buffer you bought mirrors to a strain amplifier I can use against you." Same for `add action.roll 1` → `-1` to all attacks (Inaccuracy).

**Causal Override mirror (revoke)** — interesting: the mirror is "you no longer have the power to override causality." From the target's perspective, this is actually NOT a Vulnerability Inverse (they couldn't override your rolls anyway). It's a clean "offensive capability removed" effect. The actual "immunity to fate replacement" would be a separate defensive primitive.

## Idempotency

Same as previous batches.
