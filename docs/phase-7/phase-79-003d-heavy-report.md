# Phase 7.9.3d — Heavy Migration Report (Metamorphosis + Agency Override)

**Date:** 2026-07-16
**Script:** `scripts/apply-phase79-003d.ts`
**Tests:** `src/db/__tests__/phase79-heavy.test.ts`
**Status:** Applied. 8 rows updated, 0 failures, 0 drift.

---

## Numbers

| Metric | Before 7.9.3d | After 7.9.3d |
|---|---|---|
| DONE | 91 | **99** (+8) |
| NEEDS_MOD | 26 | **18** (-8) |
| Chirality drift | 0 | **0** |
| Tests | 1401 | **1442** (+41) |

## The 8 applied

| Cat | Count | Pattern |
|---|---|---|
| METAMORPHOSIS | 4 | 4 `grant behavior:*` (composition_tuning, volumetric_scale_shift, state_transmutation, template_overwrite) |
| AGENCY_OVERRIDE | 4 | 4 `grant behavior:*` (impulse_injection, behavioral_directive, executive_override, allegiance_bind) |

## The "capability available" flag pattern (extends 7.9.3c)

The kinetic/temporal batch introduced the "one-shot engine effect" pattern: model capability availability as a behavior flag, engine applies the one-shot at cast time. The heavy batch extends this to its natural conclusion: **every conceptually multi-effect primitive in METAMORPHOSIS and AGENCY_OVERRIDE** follows the same pattern. The flag marks "this entity can do X" and the engine's cast-time handler applies the multi-step effect.

For example, `behavior:executive_override` doesn't continuously take over a target. It marks the entity as "able to apply proxy control." When the entity casts the override capability, the engine takes complete execution control of the target's actions.

## Dual-effect design notes

Each of the 4 AGENCY_OVERRIDE primitives has two mechanical outputs (e.g. "Impulse Nudge OR Point Transmission"). The 1-modifier constraint forces picking one as the seed:

| ID | Seed chosen | Alternative (fork scope) |
|---|---|---|
| 179 | impulse_injection (inject state) | point_transmission (telepathy) |
| 180 | behavioral_directive (compel action) | data_trace_masking (conceal data) |
| 181 | executive_override (proxy control) | matrix_redaction (memory edit) |
| 182 | allegiance_bind (loyalty rewrite) | informational_absolutism (data blackout) |

Fork guidance in each narrative explains how to scope to the alternative via a Capability.

## Mirror semantics (the 8 now mirrorable)

| Pattern | Mirror | Use case |
|---|---|---|
| `grant behavior:composition_tuning` | `revoke` | No cosmetic material change capability |
| `grant behavior:volumetric_scale_shift` | `revoke` | No size shift (rigid form) |
| `grant behavior:state_transmutation` | `revoke` | No phase shift (fixed material state) |
| `grant behavior:template_overwrite` | `revoke` | Entity cannot body-swap others |
| `grant behavior:impulse_injection` | `revoke` | No mind-injection capability |
| `grant behavior:behavioral_directive` | `revoke` | No compulsion capability |
| `grant behavior:executive_override` | `revoke` | No proxy control capability |
| `grant behavior:allegiance_bind` | `revoke` | No loyalty rewrite capability |

All 8 mirror as `revoke` (capability removed). From the **target's perspective**, this is the canonical Vulnerability Inverse: "the antagonist can no longer apply this effect to you."

**Important distinction:** target-side immunity (e.g. "this entity is immune to mind control") is a separate defensive primitive, NOT a mirror of the offensive primitive. The mirror only negates the OFFENSIVE capability. This matches the canonical model — defensive immunity is its own seed/fork universe.

## Test coverage

`src/db/__tests__/phase79-heavy.test.ts` — 41 new tests:

| Block | Tests | Purpose |
|---|---|---|
| DB shape per row | 8 | each row has exactly 1 modifier matching spec |
| Chirality | 8 | all 8 stored is_mirrorable=true |
| applyMirror round-trip | 8 | all 8 grant→revoke (Vulnerability Inverse) |
| Content hash | 8 | 64-char hex |
| Target slot constraints | 8 | all 8 target behavior:* |
| Hard constraint | 1 | all 8 rows have exactly 1 modifier |

**Total: 1442/1442 tests passing (was 1401, +41 new).**

## Idempotency

Verified: second run = `applied=0 skipped=8 failed=0`.

## What's next

**18 NEEDS_MOD remaining.** 2 batches:

- **7.9.3e** — PROBABILITY_BIAS remaining (4) + EVALUATION_STRAIN (8) = 12 rows. Probability (positive biases + causal override) and strain mitigation. Mix of `grant` and `add`.
- **7.9.3f** — SHEET_AUGMENT remaining (3) = 3 rows. Defensive Save Upgrade, Focused Presence, Precise Vector. Straightforward `add`.

After 7.9.3f completes, Phase 7.9 will be done. All 146 canonical primitives will have modifiers (or be marked SKIP as structural atoms).

## Architectural insight from this batch

The "capability available" flag pattern has now been applied to:
- 7.9.3c: kinetic lock, velocity lock, kinetic override, stasis, delayed resolution, dormant conversion
- 7.9.3d: body modification, mind control, identity control, behavioral compulsion

This pattern cleanly separates **declarative primitive state** (the modifier says "this entity has the capability") from **imperative engine effects** (the engine's cast-time handler applies the multi-step effect when the capability is invoked). The modifier model stays focused on persistent state; the engine handles one-shot and multi-step effects.

This is the right architecture for the seed/fork model: the canonical primitive declares a capability, forks scope it, and the engine interprets at cast time.
