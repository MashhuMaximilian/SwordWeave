# Library expansion and graphic lineage artwork

## Content saved

This pass adds 43 primitives (24 conditional numerical forks and 19 bounded narrative permissions), 32 effects, 40 capabilities, 18 inexpensive heritage bases, and 144 items. The bases comprise six lineages, six upbringings and six manifests. They complement the previously saved richer heritage collection.

Public library audit now finds 561 primitives, 55 effects, 106 capabilities, 110 heritages and 151 items: 983 public records. All have valid game-icons.net icons and current versions. This does not certify every historical community description: the recipient-contract report records older wording still needing focused review.

- [Expansion recipes](phase4-research-expansion-recipes-2026-10.md)
- [Small heritage bases](early-heritage-bases-2026-10.md)
- [144-item collection](item-library-144-2026-10.md)
- [Private example characters](private-demo-characters-2026-10.md)
- [Recipient resolution contract](effect-recipient-contract-2026-10.md)

## Art and local presentation

Thirty lineage portraits use the approved graphic, angular direction: bold contours, geometric silhouettes, cel shading, restrained arcane color, and visibly distinct anatomy. The first realistic samples are excluded. WEBP assets live in `public/images/lineages`; prompts and selected sources are recorded in `lineage-art-root-2026-10.json` and `lineage-art-subset-2026-10.json`.

The local app resolves curated lineage art by exact kind, name and system origin. An explicit custom image always takes precedence. The fallback only changes presentation; it does not rewrite component rules, purchase links or character version pins. Database image attachment is a separate gated step after deployment makes the assets reachable. This avoids saving live image URLs that currently return 404.

Icon glyphs now have ring clearance and sit to the left of the first name line. Metallic lighting follows a roughly 55-degree diagonal. Picked colors retain their hue through the metallic finish.

## Verification

- Expansion audit: 240 active, inactive, conditional, mirrored and compiled resolver cases at PB 3 and 5 passed.
- All 983 public records: zero missing or invalid icons, zero unversioned records.
- Item preflight: 144 recipes, twelve categories of twelve, zero missing dependencies; separate item BU, two-handed slot minimum and tiny-item pouch/load arithmetic checked.
- Item repeat dry run: zero new rows.
- Eight private examples saved at 25, 50, 100 and 200 BU; exact saved links, privacy, deduplicated costs, component provenance and version pins passed. The single DC formula, three saving throw axes, load and slot limits agree with the production engine. Repeat dry run preserves all eight.
- Original reference character and all four of its component junction tables have identical fingerprints before and after the demo writes.
- Local starter browser check: Vitality 17, DC 12, attack +8, physical/mental/magical saves +7/+3/+2, Load 2/65 and Equip 2/6. Hearthspark's portrait, prose and component summary render in its character info panel.
- Local 200 BU architect browser check: Physical 8 (base 5 plus purchased +3), PB 5, DC 18, attack +13, saves +13/+2/+3, Load 5/230 and Equip 4/8. DC provenance shows base 5 + PB 5 + current Physical 8; Held Passage's conditional +2 is inhibited until its authored stance is enabled.
- TypeScript typecheck and five focused icon/art tests passed.
- Local browser measured a 30px icon ring with an 18px glyph: 6px clearance on every side.

Target-directed action outputs remain manual as agreed. The three new numeric received penalties are absent from actor-owned new capability and item recipes. The existing resolver does not preserve recipient metadata through all composition paths; the dedicated report documents this instead of claiming automatic target execution.

## Release order

Review [the local portrait gallery](http://localhost:3000/lineage-art-review.html) and icon presentation, deploy the app/assets, then run the gated lineage image attachment. See [the art integration instructions](lineage-art-integration-2026-10.md). No deployment is included in this pass. Better filters, sorting, endless loading and the optional quick builder remain in [the later UX backlog](library-next-ux-backlog-2026-10.md).
