# Effect recipient contract · 2 October 2026

The three new contextual numeric penalties are intended for the receiving subject's sheet: **Salt-Wet Footing** subtracts 2 from its balancing Finesse checks; **Fevered Aim** subtracts 2 from Attack; **Cracked Plate** subtracts 1 from the one DC. Their authored conditions must match that subject and be switched off when the stated exposure ends. They are not universal condition definitions.

The 40 new capability recipes and all 144 new item recipes do **not** contain those three effects. This keeps their mirrored self-valued primitives out of an actor's owned attack or item recipe. A read-only audit checks this invariant against real saved capability/effect links and the exact item data before publication.

## Receiving a consequence versus owning its recipe

A subject receiving an effect needs its own numbers to change. Owning a capability that can place an effect on someone else should not change the owner's numbers merely because the recipe exists. The current primitive provenance does not explicitly encode that distinction. Therefore, a blanket rule that discards every target effect from a character sheet would incorrectly discard the intended receiving-subject effects too.

The accepted path for this shelf is manual target application or attachment to the receiving subject's sheet. There is no claim of automatic cross-character application, action resolution, healing, or damage transfer.

## Verified saved paths

`scripts/audit-effect-recipient-2026-10.ts` loads real public rows, their latest saved primitive/effect/capability versions, expands the real bundle IDs, resolves pinned primitive snapshots through `effectivePrimitiveLinks`, and calls both the number resolver and the sheet aggregator. It performs no database writes. Its condition context is omitted intentionally to exercise the resolver's documented condition-on mode; it is not a claim that a particular user's live condition is enabled.

At level 5, PB 3, with Physical 2 selected:

| Saved path | Baseline | Condition-on result |
|---|---:|---:|
| Salt-Wet Footing received directly | Finesse modifier contribution 0 | −2 |
| Fevered Aim received directly | Attack 5 | 3 |
| Cracked Plate received directly | DC 10 | 9 |
| Precision Bench → Steady Hands, owned self effect | Finesse modifier contribution 0 | +2 |
| Shielded Passage → Bound Passage Guard, owned self effect | DC 10 | 12 |

No fabricated origin IDs stand in for these saved links. The three target penalties currently have no saved capability memberships. Their direct application is a receiving-sheet reproduction; it does not prove that an actor owns an offending capability.

## Remaining contract gap

Per-link `targetWho` exists on both effect and capability primitive junctions. Current canonical version payloads omit it, bundle primitive inputs do not carry it, and the modifier resolver does not read `metadata.recipient` as a sheet-recipient gate. These are real limits, although the new content avoids the problematic actor-owned numeric-target composition.

A future targeted fix should preserve optional per-slot recipients through canonical hashes and pinned snapshots, carry effective recipients through bundle and workspace supply paths, and distinguish a prepared owned recipe from an applied received consequence. Only then should it suppress target/scene outputs on the actor's sheet while allowing explicitly applied consequences on a receiving sheet. Tests must cover self overrides, target overrides, scene outputs, independent direct ownership of the same primitive, mirrored values, pinned historical versions, and removal/ending of a received application. That fix must not silently reinterpret existing receiving-sheet effects.
