# Quickbuild and lineage size rollout — 3 October 2026

## Creation flow

- Character creation begins with Complete character or Quickbuild.
- Complete character retains the existing five-step authoring flow.
- Quickbuild asks for a name and offers portrait, one backstory, attribute presets, level or custom BU, and optional lineage/upbringing/manifest selections.
- Individual and combined heritage shuffles use the existing bundle expansion and cost rules, including shared primitive deduplication and independent direct/mirrored occurrences.
- Packages, mirrored weaknesses, items, and further story details are optional disclosures. Items remain outside character BU.
- Quickbuild has no size picker or heritage story prompts. The selected lineage supplies size; no lineage defaults to Medium. Characters open in Play mode.
- The server reloads selected public roots, computes purchased BU, validates primitive availability and mirror limits, derives lineage size, and uses existing version pinning and occurrence creation.

## Lineage authoring and database

- Added nullable `heritage.default_size` using the existing character size enum, with a Default size field in lineage authoring.
- Save, clone, fork, formalization, canonical hashing, and version restoration carry the size value.
- Old payloads without a size retain their canonical hash and default to Medium when used for new Quickbuild characters.
- Applied migrations 0067 (the previously pending open-ended progression constraints) and 0068 (lineage size) individually and recorded their journal entries. No broad historical migration sweep was run.
- Backfilled all 34 existing lineages through the versioning system: 9 Small, 22 Medium, 3 Large. The Large assignments follow existing giant/Large descriptions; Small assignments reflect the compact lineage concepts. Other lineages use Medium.
- Backfill writes new current snapshots and hashes; existing character sizes and version pins remain unchanged. A second dry run reports zero pending defaults.
- The reference character `462f9048-b0da-4185-98db-d18027132c82` remains Medium with its pre-existing budget unchanged.

## Approved artwork

- Attached all 108 approved heritage portraits: 30 lineages, 54 upbringings, 24 manifests.
- Assets are tracked WEBP files in the deployed application. The attachment gate checked their signatures and tracked paths against commit `29e4b8b` and the Ready production deployment manifest.
- Attachments fill empty portrait fields and preserve mechanical rules, hashes, and pins.

## Verification

- TypeScript passes.
- Scoped lint has no errors; the author-supplied portrait thumbnail uses a native image and produces one image optimization warning.
- 146 focused tests pass across Quickbuild, character creation, lineage authoring, canonical hashes, bundle expansion, mirrors, encumbrance, version pins, and package suggestions.
- Ran 160 shuffles against the actual catalog at levels 1, 3, 10, and 42. All stayed within budget and mirror limits.
- Created a private verification character, Tavi Embertrail (`1ce45787-86bc-4903-93db-614b23db30e8`), through the UI with Hearthspark, Lantern Stall Helper, and Stitchkeeper.
- Saved character: level 1, Small, 16/25 BU, 3 heritage roots, 7 pinned primitives, no optional package/weakness/items.
- Actual sheet resolver: attributes 4/3/3, DC 11, Vitality 17 including the +5 primitive, carry capacity 40, 6 equipment slots, walking 25, swimming/climbing 13. The browser sheet shows 17/17 Vitality, DC 11, attack +6 and 16/25 BU.
- Local cold compilation caused slow navigation; it is recorded separately from database save or resolver correctness.

## Release

Earlier library/filter/art changes reached Ready production at commit `29e4b8b`. Quickbuild code and the above rollout are the subsequent release. Check its production status before reporting it deployed.
