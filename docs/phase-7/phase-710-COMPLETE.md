# Phase 7.10 — Effects + Capabilities Re-Author

**Date:** 2026-07-16
**Scripts:** `scripts/apply-phase710-1.ts` (effects), `scripts/apply-phase710-2.ts` (capabilities)
**Tests:** `src/db/__tests__/phase710.test.ts`
**Status:** All 33 records re-authored. 0 failures. Idempotent.

---

## Numbers

| Metric | Before | After |
|---|---|---|
| Effects re-authored (4-section schema) | 0 | **8** |
| Capabilities re-authored (4-section schema) | 0 | **25** |
| Style A (Passive) capabilities | 0 tagged | **8** |
| Style B (Direct Resolution) capabilities | 0 tagged | **8** |
| Style C (Dynamic State) capabilities | 0 tagged | **9** |
| Capability → Effect nestings | 0 | **1** (Hypnotic Suggester → Compelled Focus) |
| Tests | 1536 | **1638** (+102) |

---

## The 4-Section Universal Ledger Schema (from the Capability Composition Map)

Every effect and Style B/C capability now follows:

```
**Composition:** [list of primitives + their roles]
**Spatial & Resolution Gate:** [range/target/save if applicable]
**Delivered Effect:** [Style C only — what the effect does to the target]
**Duration:** [how long the effect persists]
```

Style A (Passive) capabilities only require **Composition** (no Spatial, no Effect, no Duration — they modify the sheet directly).

## The 8 re-authored effects

| Effect | Style | Key behavior |
|---|---|---|
| Blind Stun | C | Reaction erase + standard action subtract |
| Compelled Focus | C | Negative Bias on non-caster attacks |
| Corrosive Decay | C | Structural erosion tick |
| Shattered Composure | C | Velocity Lock + reaction erase + defense penalty |
| Snared (Vine Bind) | C | Velocity Lock + 1d20 ticking damage |
| Staggered (Acid Corrosion) | C | -15ft movement + attack Negative Bias |
| System Freeze | C | Velocity Lock + reaction erase |
| Vertigo Spasms | C | Negative Bias on physical coordination |

## The 25 re-authored capabilities

| Style | Count | Examples |
|---|---|---|
| A (Passive) | 8 | Aegis Shield, Bloodhound Master, Heavy Tactical Cover, Vow of Enmity |
| B (Direct Resolution) | 8 | Strike, Rusting Strike, Tornado Blast, Medusa's Gaze, Time Stop |
| C (Dynamic State) | 9 | Hypnotic Suggester (nests Compelled Focus), Chronomantic Haste, Greater Invisibility, Temporal Stasis Trap |

## The demonstrative Style C wiring

**Hypnotic Suggester → Compelled Focus** is the first capability that nests an effect via the `capability_effects` junction table. This gives the engine a real Style C capability to chew on for Phase 8. The other 8 Style C capabilities are described as Style C in their narrative but don't nest a separate effect (their "Delivered Effect" is composed directly from primitives, e.g. Chronomantic Haste = Haste Vector + Timeline Tether).

## Key design decisions

**1. Effects are mini-capability wrappers.** Each of the 8 effects now has the 4-section schema in its narrative_description, which mirrors the capability schema. The Map's "Effect Template" says effects should be like miniature capabilities — the re-author aligns with that.

**2. Style classification in tags.** Every capability now has `style-a`, `style-b`, or `style-c` in its tags array. This makes Style filterable in the UI (Phase 8 work).

**3. Modifier language updated.** Where old narratives said "advantage" or "disadvantage", the new narratives use "Positive Bias / Negative Bias" (matches `behavior:positive_bias` / `behavior:disadvantage` flags from Phase 7.9).

**4. Fork scope explicit.** Where the original narrative was ambiguous (e.g. "on attacks" vs "on defenses"), the new narrative explicitly says "set via fork condition" — the seed primitive is engine-agnostic and the fork scopes the effect.

**5. No new effects needed.** All re-authored content uses the existing 8 effects and the existing 117 primitives. This is narrative + structure work, not data migration.

## Idempotency

Both scripts verified idempotent:
- `apply-phase710-1.ts`: second run = 0 applied, 8 skipped
- `apply-phase710-2.ts`: second run = 0 applied, 25 skipped, 0 failed

## What's next

Phase 7.10 done. Effects and capabilities are now in alignment with the Notion Capability Composition Map. Ready for:
- **Phase 8** (character sheet engine that consumes the modifiers + the effects)
- **System user design** (Q3 — future discussion, no action)

The data layer is now:
- 117 canonical primitives with modifiers (Phase 7.9)
- 8 canonical effects re-authored (Phase 7.10.1)
- 25 canonical capabilities re-authored + 1 effect-nesting demonstrated (Phase 7.10.2)

All with content_hash versioning, idempotent migrations, and 1638 tests passing.
