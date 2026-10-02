# Early heritage bases

Eighteen additional bundles complement the richer 90-entry shelf. They have small costs and no level requirement, and players can extend or rearrange them at any point. They do not replace the starting package or include an assumed weakness. All budgets count the unique underlying primitives once, including capability/effect contents.

|Kind|Base|BU|Richer source|
|---|---|---:|---|
|Lineage|Hearthspark|6|Flintskin|
|Lineage|Duskling|6|Nightpupil|
|Lineage|Griproot|6|Forestkind|
|Lineage|Whispercolony|7|Sporeveil|
|Lineage|Glidesprout|7|Hollowbone|
|Lineage|Reachling|6|Longreach|
|Upbringing|Roadside Errand Runner|4|Wanderer|
|Upbringing|Workshop Sweeper|6|Tinkerer|
|Upbringing|Lantern Stall Helper|4|Festival Lantern Tender|
|Upbringing|Orchard Neighbor|6|Orchard Tender|
|Upbringing|Agreement Recorder|6|Witness Scribe|
|Upbringing|Harbor Rope Hand|8|Quarry Rigger|
|Manifest|Steady Blade|8|Striker|
|Manifest|Doorwatch|7|Guardian|
|Manifest|Quickstep|9|Skirmisher|
|Manifest|Glimmer Caller|8|Mystic|
|Manifest|Stitchkeeper|6|Field Medic|
|Manifest|Patchwright|8|Artificer|

The source link records a reduced and recomposed bundle from the richer heritage. It is a real template fork edge attached to the source's current saved version. Original descriptions explain the identity, relevant permission, and practical limit without inventing a fixed meaning for conditions. Icons use validated game-icons.net keys and metallic gold as their chosen default color.

These bases reuse verified public primitives and capabilities. Hearthspark and Glidesprout add 5 maximum Vitality. Quickstep adds 10 walking speed through the existing Stride Extension; its 5 BU cost is not its speed magnitude. Practice, attack, and save modifiers use existing resolver bindings. Contextual permissions such as gripping, gliding, grafting, signaling, and patching remain described permissions. Stitchkeeper uses the existing treatment output, resolved at the table and entered with the Vitality control. It promises no automatic action or automatic healing.

Choosing three of these may use most or all of 25 BU before a domain/verb/range/output starting package. They are separately purchasable choices, not a promise that every combination fits a 25 BU character. A quick builder can later budget these choices against a character's actual package and development budget.

Data: `scripts/early-heritage-bases-data-2026-10.ts`.

Read-only preflight:

```sh
npx tsx scripts/seed-early-heritage-bases-2026-10.ts
npx tsx scripts/audit-early-heritage-bases-2026-10.ts --planned
```

Apply all 18 in a transaction, then audit the saved shelf:

```sh
npx tsx scripts/seed-early-heritage-bases-2026-10.ts --apply
npx tsx scripts/audit-early-heritage-bases-2026-10.ts
npx tsx scripts/seed-early-heritage-bases-2026-10.ts
```

The final dry run should report zero pending updates. New entries have full canonical versions, public publications, exact component links, and provenance fork edges. Updates preserve IDs and append versions. Deliberately hidden publications and name collisions cause a transaction rollback. Existing richer shelf entries are read-only inputs.
