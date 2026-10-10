# System encounter starters · v0.1 alpha

30 original public preparations across ten environments. Every creature entry uses an existing public System monster and an explicit immutable version. These are scene starters, not difficulty-rated combat packages.

## Content and use

Each preparation includes a hook, objective, terrain, opening situation, practical tactics, alternate approaches, optional escalation and possible consequences. Scene advice grants no extra creature mechanics. Use pinned abilities as written and agree separate terrain hazards before applying them.

Party BU and Party Item BU are editable illustration values for four characters. Replace them with your actual party. Some casts contain creatures that can become allies or neutral objectives; remove friendly entries from opposition comparisons because the existing appraisal counts every listed creature in its enemy totals.

## Seed procedure

```sh
pnpm exec tsx scripts/seed-system-encounters-v0.1-alpha.ts
pnpm exec tsx scripts/seed-system-encounters-v0.1-alpha.ts --apply
```

The first command is read-only. Stable IDs and strict prior-content comparison prevent duplicate seeds and accidental overwrite. The apply transaction rechecks public template/dependency access, pins exact monster version IDs, inserts preparations and public collection memberships, and reads every preparation through the anonymous service before committing. It creates no encounter runs, play copies or linked party characters. Changed seed content requires an explicit reviewed migration; reruns do not silently edit existing scenes.

The compact public directory deliberately does not hydrate full creature mechanics. Separate resolved Item BU is verified in the full encounter preview/preparation API.

## Public collection

[Encounter starters · v0.1 alpha](https://www.swordweave.quest/collections/20bdea10-4878-5ffe-abff-37f9bdc1527e)

## Manifest

| Encounter | Environment | Creatures | Creature BU | Item BU |
|---|---|---:|---:|---:|
| [Caravan at the Rooted Ford](https://www.swordweave.quest/encounters/2aec9871-7900-59f4-a68f-7cd8b80af5a9) | Wilderness | 3 | 100 | 0 |
| [The Grove That Asks for Help](https://www.swordweave.quest/encounters/159fe523-29d8-5bd6-a853-c9e9f7c7ac8c) | Wilderness | 3 | 200 | 4 |
| [A Wall Across the Harvest](https://www.swordweave.quest/encounters/72e275b0-1e8d-5b35-a22d-3647cfa3e001) | Wilderness | 3 | 425 | 0 |
| [Supplies Under the Deeprail](https://www.swordweave.quest/encounters/79d424ab-8ba8-5ba8-a0f7-8d557b07f4fd) | Subterranean | 3 | 100 | 12 |
| [The Amber Door Hearing](https://www.swordweave.quest/encounters/40761e4a-3143-585c-a621-5dcfd2c4b07a) | Subterranean | 3 | 300 | 4 |
| [Voices Over the Sinkhole](https://www.swordweave.quest/encounters/24901117-f8d1-549e-a90f-744da477646c) | Subterranean | 3 | 400 | 0 |
| [The Courier and the Watch Hound](https://www.swordweave.quest/encounters/9253c9b5-c479-5202-a99f-4d757c737e44) | Urban | 3 | 100 | 28 |
| [Witness on the Roofline](https://www.swordweave.quest/encounters/3e67fc16-fa43-58a8-aaaa-e2b503bd2905) | Urban | 3 | 300 | 28 |
| [The Clockhouse Under Dispute](https://www.swordweave.quest/encounters/20bc45f8-66e2-58dd-a467-93a4fb5f24de) | Urban | 3 | 650 | 36 |
| [The Net at Siltwater Crossing](https://www.swordweave.quest/encounters/8e3da384-a9b5-5912-a89c-5f9b148fc67a) | Aquatic | 3 | 100 | 0 |
| [Breath Beneath the Tidegate](https://www.swordweave.quest/encounters/7c40b3b8-17b2-571e-af2d-af4c4b65e3ae) | Aquatic | 3 | 275 | 12 |
| [The Refuge and the Charged Channel](https://www.swordweave.quest/encounters/48a85377-c884-5fed-a51f-9ff8b345f330) | Aquatic | 3 | 650 | 4 |
| [Dispatch in the Updraft](https://www.swordweave.quest/encounters/b6b9f490-5ed7-53f9-afc0-af08a952d574) | Aerial | 2 | 100 | 0 |
| [The Broken Balloon Descent](https://www.swordweave.quest/encounters/2cc87ee2-6862-5530-a1f2-b805f823fba6) | Aerial | 3 | 340 | 8 |
| [Corsairs at the Storm Shelter](https://www.swordweave.quest/encounters/f925cce4-9e38-5ec5-a0b4-519dc78fd228) | Aerial | 3 | 650 | 14 |
| [The Undelivered Funeral Parcel](https://www.swordweave.quest/encounters/30a633d0-4843-5b4d-ade5-55fbaafe260a) | Undead | 3 | 100 | 0 |
| [Names at the Ossuary Door](https://www.swordweave.quest/encounters/ebd2ed04-7ee7-549f-aa50-f726f03c02f2) | Undead | 3 | 325 | 14 |
| [The Procession That Will Not Pass](https://www.swordweave.quest/encounters/7bdf20c6-123a-5c64-ac5b-d8fc4734dbe7) | Undead | 2 | 650 | 16 |
| [Wrong Order in the Workshop](https://www.swordweave.quest/encounters/483e1ed8-81f8-5c5a-a375-40c0413366c7) | Constructs | 3 | 100 | 8 |
| [Hinges Before the Gate Closes](https://www.swordweave.quest/encounters/a3c31e67-972b-501e-ab68-18371fed512e) | Constructs | 3 | 325 | 24 |
| [The Platform and the Visible Contract](https://www.swordweave.quest/encounters/f557c0ba-c695-56a4-ade6-df6cb89de32b) | Constructs | 2 | 650 | 20 |
| [Ink in the Wrong Margin](https://www.swordweave.quest/encounters/c3822fe5-e625-5540-aeac-6bdc4a20c12d) | Arcane anomalies | 3 | 100 | 0 |
| [Light Across the Containment Line](https://www.swordweave.quest/encounters/482f5678-9546-5f20-a45c-3bff9c70b790) | Arcane anomalies | 3 | 300 | 0 |
| [The Repeated Minute](https://www.swordweave.quest/encounters/76898a5e-70ee-53d5-adb0-73ac4b1514b9) | Arcane anomalies | 2 | 650 | 8 |
| [The Promise in the Furnace Road](https://www.swordweave.quest/encounters/57d5e5ec-27b3-52c2-ac22-44eb09fd922e) | Infernal | 2 | 100 | 4 |
| [Workers Behind the Ash Screen](https://www.swordweave.quest/encounters/8c432f9e-3c45-523c-a85f-88d398c66cf0) | Infernal | 3 | 350 | 12 |
| [A Debt Before the Last Gate](https://www.swordweave.quest/encounters/47e87281-825a-53e5-a394-9f38f327860d) | Infernal | 2 | 1150 | 10 |
| [Respect at the Seedling Threshold](https://www.swordweave.quest/encounters/8aa2e7d0-b045-50db-a0a9-cb3b488ee1c0) | Ancient guardians | 3 | 100 | 4 |
| [Patients on the Ceremonial Causeway](https://www.swordweave.quest/encounters/5f64e74f-8d7f-55e6-a3fd-c78bcd2b37c8) | Ancient guardians | 3 | 400 | 36 |
| [The Anchor at the First Horizon](https://www.swordweave.quest/encounters/e642995c-17c0-5e00-abd5-1fc716a61cfc) | Ancient guardians | 2 | 2125 | 80 |

## Verification

Verified on 2026-10-10: dry run passed; transactional apply inserted 30 preparations and 30 collection memberships; repeated apply reported 0 new, 30 unchanged and 0 new memberships. Every preparation passed anonymous visibility, dependency resolution, immutable version and exact separate BU checks. The public collection service returned exactly 30 encounter entries. No runs or play copies were created. ESLint passed for the manifest, seed script and directory attribution change. Final platform typecheck/build are performed with the publication release.
