# Phase 7.9.3d — Heavy Modifier Proposals (Metamorphosis + Agency Override)

**Scope:** 8 heavy primitives, batch 4 of verb-like.
**Pattern:** All 8 use `grant behavior:*` capability flags. The engine applies the effect (template swap, mind control, body modification) at cast time when the flag is present. This is the only pattern that fits the 1-modifier-per-primitive constraint for these conceptually multi-effect primitives.

## METAMORPHOSIS (4)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 183 | Composition Tuning | `grant behavior:composition_tuning` | Engine flag — at cast, applies cosmetic material changes (skin texture, surface calcification, biological camouflage). One-shot engine effect. |
| 184 | Volumetric Scale Shift | `grant behavior:volumetric_scale_shift` | Engine flag — at cast, shifts size category by ±1-2 steps. Engine derives movement/reach/mass adjustments from the size category change. |
| 185 | State Transmutation | `grant behavior:state_transmutation` | Engine flag — at cast, phase-shifts the entity's matter into Gaseous/Liquid/Crystalline/Energetic state. |
| 186 | Polymorphic Template Overwrite | `grant behavior:template_overwrite` | Engine flag — at cast, suppresses target's physical sheet and enforces a new physical template. Target retains original mind. |

## AGENCY_OVERRIDE (4)

| ID | Name | Modifier | Pattern |
|---|---|---|---|
| 179 | Impulse Nudge / Point Transmission | `grant behavior:impulse_injection` | Engine flag — at cast, injects a temporary emotional state OR transmits a single stream of thought. SEED — fork to specify which in a Capability. |
| 180 | Behavioral Directive / Data Trace Masking | `grant behavior:behavioral_directive` | Engine flag — at cast, compels a sustained course of action that doesn't violate survival protocols. OR conceals localized data traces. |
| 181 | Direct Executive Override / Matrix Redaction | `grant behavior:executive_override` | Engine flag — at cast, complete proxy control of target's mental/physical choices. OR permanently rewrites an isolated memory block. |
| 182 | Existential Allegiance Bind / Informational Absolutism | `grant behavior:allegiance_bind` | Engine flag — at cast, permanently rewrites baseline loyalty architecture. OR establishes total structural information blackout. |

## Dual-effect design notes

Each of these primitives has two mechanical outputs (e.g. "Impulse Nudge OR Point Transmission"). The 1-modifier constraint forces me to pick one as the seed, with the other documented in fork guidance. The choice rationale:

**Agency Override** (mental/social track):
- 179: "Inject state" chosen as primary (more combat-relevant than pure telepathy)
- 180: "Compel action" chosen (data-trace masking is more niche)
- 181: "Total hijack" chosen (memory edit is a sub-effect of full control)
- 182: "Loyalty bind" chosen (information blackout is environmental)

**Metamorphosis** (physical/somatic track):
- 183: Single effect (cosmetic). No choice.
- 184: Single conceptual effect (size change) — engine derives stats from flag.
- 185: Single conceptual effect (state phase) — engine derives form from flag.
- 186: Single conceptual effect (template swap) — engine handles the suppression + replacement at cast.

For each dual-effect primitive, fork guidance explains how to scope to the alternative via a Capability.

## Mirror semantics (the 8 now mirrorable)

| Pattern | Mirror | Use case |
|---|---|---|
| `grant behavior:composition_tuning` | `revoke` | No cosmetic material change capability |
| `grant behavior:volumetric_scale_shift` | `revoke` | No size shift capability (rigid form) |
| `grant behavior:state_transmutation` | `revoke` | No phase shift capability (fixed material) |
| `grant behavior:template_overwrite` | `revoke` | No template swap capability (the entity cannot body-swap others) |
| `grant behavior:impulse_injection` | `revoke` | No mind-injection capability |
| `grant behavior:behavioral_directive` | `revoke` | No compulsion capability |
| `grant behavior:executive_override` | `revoke` | No proxy control capability |
| `grant behavior:allegiance_bind` | `revoke` | No loyalty rewrite capability |

The "revoke" mirror is clean: a character with the **capability to do X** is mirrored to a character that **cannot do X**. From the target's perspective, that's the canonical "Vulnerability Inverse" — the antagonist can no longer apply this effect to you.

Note: target-side immunity (e.g. "this entity is immune to mind control") is a separate defensive primitive, NOT a mirror of the offensive primitive. The mirror only negates the OFFENSIVE capability. This matches the canonical model.

## Idempotency

Same as previous batches.
