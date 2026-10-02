# Research expansion recipes — 2 October 2026

This separate pass retains the earlier heritage shelf and adds **43 primitives, 32 effects and 40 capabilities**. It follows the original adaptation ideas in [the inspiration catalog](phase4-inspiration-catalog-2026-10.md) and [the depth/buildability review](phase4-depth-and-buildability-2026-10.md), with new SwordWeave wording and explicit composition limits. No source prose, named spells, branded species, items, artwork or game statistics are copied.

The database has been read for ingredient availability. The seed is **dry run by default** and has not been applied by this authoring pass. Every recipe resolves to existing public primitives or one of the proposed forks, with no unresolved ingredient. All icon keys exist in the local game-icons.net index and use metallic gold.

## Primitive families

**24 numerical forks** retain the source parent's exact target scope and bind a specific authored condition. They cover save, DC, Attack, Practice checks, walking, swimming and climbing. Full PB variants read PB rather than a fixed level assumption. Each condition is saved as the same `actor:manual:<authored situation>` flag emitted by the builder. The sheet's condition switch applies it when the described situation holds; it is never inferred from a universal status name. Mirroring reverses its numerical operator and provides budget credit on direct acquisition.

**19 bounded narrative permissions** fork the existing private Bounded Practical Permission family. They are complete prose rules without unnecessary numerical modifiers. They include a loose-object pull, willing guard handoff, manually tracked two-action sequence, return trajectory, split delivery, limited deflection, flame dampening, echo placement, scent marking, partial object impression, noncombat messenger, prepared dose, temporary cover, mechanism quieting, brittle surface alteration, material joining, heat screening, rhythm interruption and contextual soot obscuration.

## Resolver evidence

The candidate audit runs **240 cases** across all 24 numeric forks at odd PB 3 and 5: active, inactive, condition true/false, mirrored and compiled origins. The selected displayed resolver total changes by the exact authored amount; false conditions and inactive cards suppress it; compiled origins preserve the same total. DC forks affect the one DC while leaving the three saves and Attack bonus alone. Narrative permissions are checked for absence of numerical operators and mirroring.

Targets and scenes are intentionally resolved in their actual contexts. Damage and healing output are rolled and entered through manual Vitality changes; the d4 primitive specifies the purchased die and is not presented as an automatic action resolver. The three negative contextual effects store **mirrored ingredient links in both the link table and canonical version snapshot**. No separate weakness primitives are created.

## Useful composition groups

| Group | Published recipe candidates | Actual boundary |
| --- | --- | --- |
| Field work | Measured Survey, Shared Route Crossing, Precision Bench, Stone Counterbrace | Tool, route, fine-task and rig conditions are on the relevant primitive; materials and setup are required. |
| Rescue and movement | Float Lash, Fin-Assisted Ferry, Dry Wall Traverse, Belayed Descent, Anchored Stand | Bought locomotion and a rated physical line or float; no free flight, teleport or unsupported bridge. |
| Care | Field Diagnosis, Gentle Treatment, Dose and Release | Knowledge/Influence conditions plus once-per-dose manual 1d4 Vitality; normal limits and consent. |
| Defense | Shielded Passage, Pocket Barricade, Relay Guard | Single DC when appropriate; scene cover adjudicated; manual willing handoff ends original effect. |
| Senses and communications | Smoke Reading, Scent Pursuit, Groundline Scout, Voice Relay, Messenger Route, Impression Reading | Explicit sense ranges, clear signal paths, partial information, existing noncombat creature. |
| Material craft | Handle Wrap, Quiet the Gear, Improvised Span, Fuel Quenching, Cooling Interpose | Available compatible materials, setup, stated load and failure ending. |
| Action variety | Drawback Pulse, Deflecting Blow, Forking Lumen, Return-Catch Throw, Third Beat, Glassfall Spray, Rhythm Breaker | Ordinary resolved actions and purchased domains/ranges/tier; manual position/output/counter; no free attack or automatic turn loss. |

These are adaptations of broad design patterns from the earlier research, not one-to-one recreations: a role-specialized tool, a sensed path, temporary material work, consent-based support, or a prepared action. Their boundaries intentionally avoid promising unsupported autonomous combat, remote truth, duplicate output, automatic healing, or new universal conditions.

## Commands

```sh
npx tsx scripts/seed-phase4-expansion-2026-10.ts
npx tsx scripts/audit-phase4-expansion-2026-10.ts
# Authorized DB author applies transactionally:
npx tsx scripts/seed-phase4-expansion-2026-10.ts --apply
npx tsx scripts/audit-phase4-expansion-2026-10.ts --saved
```

The seed writes full canonical versions, content hashes, game-icons metadata, market classifications and source-version fork edges. It inserts absent research-expansion entries and leaves other content untouched. Ingredient links are real DB links, not only descriptions. Complete role/character play checks remain part of the later character-budget pass.
