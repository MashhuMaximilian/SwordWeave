# Private characters at several budgets

Eight examples show modest starting builds and developed characters using the same library. They are owned by the account of reference character `462f9048-b0da-4185-98db-d18027132c82`, but that character is never changed. New examples are private and named `Demo · …`.

|Example|Level|Pool|Character BU spent|Unspent|
|---|---:|---:|---:|---:|
|Hearth Road Blade|1|25|24|1|
|Dusk Lantern Caller|1|25|20|5|
|Harbor Doorwatch|3|50|47|3|
|Orchard Surveyor|3|50|43|7|
|Ashlung Stitch Medic|8|100|86|14|
|Canopy Ground Scout|8|100|94|6|
|Iron Terrain Architect|16|200|191|9|
|Sky Signal Voyager|16|200|199|1|

Every character has 25 starting BU. The precise demonstration pools use the normal level table plus a stated DM bonus: level 3's 45 + 5 = 50; level 8's 99 + 1 = 100; level 16's 199 + 1 = 200. These bonus amounts are examples of the existing DM budget field, not a proposed progression change. Items have separate BU. Spare character BU deliberately remains available for development.

Recipe data lists all purchased heritages, capabilities, primitive package components and inventory. Components expand through the same `expandBundles` function used by character creation, deduplicating shared purchases and preserving their provenance. Each primitive, capability, heritage and item receives a current version pin and PINNED slot relationship. No separate weakness entries are introduced and none of these examples mirror a component.

The chosen proficient attribute drives the single DC. Preflight checks the canonical base formula `5 + PB + chosen attribute`, verifies that modified DC agrees between the real sheet aggregator and modifier resolver, and checks that three saving throw axes remain present. Conditions are evaluated with no manually declared scene flags active. Each capability retains its own authored condition and contextual interpretation. Healing and other outputs remain manually resolved as stated by their recipes.

Inventory uses the new item shelf: blades, shield, bow, staff, vest, route satchel, rescue line and repair roll. Equipping is explicit; the repair roll is carried. Preflight verifies Load ≤ carry capacity and equipped slot usage ≤ available slots, alongside exact character BU and version pins. The examples do not imply that every item capability is always active merely because its item is carried.

## Commands

First apply the early base, expansion and item shelves. This character script fails before writing if any required published dependency or version is missing.

```sh
npx tsx scripts/seed-library-demo-characters-2026-10.ts
npx tsx scripts/audit-library-demo-characters-2026-10.ts --planned
npx tsx scripts/seed-library-demo-characters-2026-10.ts --apply
npx tsx scripts/audit-library-demo-characters-2026-10.ts
```

The seed creates missing examples atomically. On a repeat it preserves existing demo characters so subsequent user edits are not silently erased. The saved audit then detects recipe drift rather than rewriting a character. It verifies private ownership, exact purchase links, provenance, pinned versions, attributes, budget and inventory. No publication is created for a demo character.

## Applied and verified

On 2026-10-02, dry-run and planned audits passed, then all eight private demos were created atomically. Saved audit passed exact costs, component/provenance links, pins, privacy, three saves, single DC, and legal inventory. A SHA-256 fingerprint of the original character row plus its primitive, capability, heritage and item junction rows was identical before and after (`ece441016214168a8d42d06004ba430acc367f2c169d822cbcab1024dbfc1f12`).

|Example|Private character ID|DC|Load|Equip|
|---|---|---:|---|---|
|Hearth Road Blade|aae2fea8-e17b-4887-afbe-a59bea94ad97|12|2/65|2/6|
|Dusk Lantern Caller|3dc39799-1494-4bda-ad5d-6be77c754dad|12|3/50|3/6|
|Harbor Doorwatch|1b0c24e4-3d37-46c5-b483-d45a887ecf29|13|4/65|4/6|
|Orchard Surveyor|bc6b699e-df72-49f0-bf70-4f78cf356c96|12|4/55|3/6|
|Ashlung Stitch Medic|1662962b-14c5-4433-994e-6273b3f7ca57|13|3/125|2/6|
|Canopy Ground Scout|92bb790c-0bf8-4696-bea0-c8a49959a719|13|4/65|4/6|
|Iron Terrain Architect|1da4e351-da76-4822-bf1f-632d2e657145|18|5/230|4/8|
|Sky Signal Voyager|4a17c742-101c-493e-b2c9-d4764a1d7c87|18|4/50|4/6|
