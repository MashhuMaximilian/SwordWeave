# SRD publication and heritage artwork

Checkpoint before presentation work: `1b8166d`. No app deployment in this pass.

## Current status

| Work | Status |
| --- | --- |
| Separate research expansion | Saved: 43 primitives, 32 effects, 40 capabilities |
| Small heritage bases | Saved: 18, six of each heritage kind |
| Lineage portraits | 30 graphic, angular portraits ready locally |
| Upbringing / manifest portraits | 54 upbringing and 24 manifest portraits ready locally |
| Item library | 144 saved items; recipe, version, visibility and equipment audit passes |
| Characters at several budgets | Eight public SRD characters at 25, 50, 100 and 200 BU |
| Heritage upload / URL and portrait display | Implemented locally; images bypass metallic icons, cover circles with upper crop, larger 112px previews, unchanged character badges |
| Icon square frames | Removed at the shared image layer; circular ring remains |
| Better filters / sorting / endless search | Pending |
| Live artwork attachment / app deployment | Pending local review and deployment |

## Public metadata

The live metadata promotion covered 960 stable curated identities. 954 playable records are public, source `SRD`, owner null (System). Six previously retired or technical construction records remain private; their source/owner metadata was also normalized. QA and other users' content were excluded.

Public character names: Tarn Emberpost, Veyra Lanternwake, Korr Tidefast, Sill Underbough, Neris Cinderthread, Ivara Mossveil, Orren Vaultwright, and Aster Farwake. Character snapshots and publication records were updated. The duplicate primitive name on ID 22352 was versioned to **Verb Access Tier I — Standard Expression**; canonical ID 20 and existing pins remain intact.

The expected character-version uniqueness index was missing in the database. The migration checked for duplicate `(character_id, version_number)` pairs, found none, and added the index inside the transaction before capturing the eight character snapshots.

Legacy import identities are preserved separately in `scripts/srd-content-registry-2026-10.json`, allowing existing seed scripts to recognize promoted rows. They are not public source labels. Historical version snapshots are not rewritten; presentation normalizes legacy system source keys to SRD.

## Artwork

Generated with the built-in `image_gen` tool, one original image per heritage. Prompts and output provenance: `heritage-role-art-2026-10.json`. No named artists, franchise characters, or copied artwork were requested. The figures use obscured faces, gloves, masks and clothing to avoid assigning a lineage to an upbringing or manifest. All 78 were visually reviewed in three contact sheets.

Assets are stored in `public/images/heritages/upbringings/` and `public/images/heritages/manifests/`, original PNG plus 800px WEBP. Review gallery: `http://localhost:3000/heritage-role-art-review.html`. Exact curated identity mappings supply local artwork; explicit user images take precedence.

`scripts/attach-heritage-art-2026-10.ts` dry run resolves all 108 heritage identities and local assets. Its apply mode requires all production WEBPs to be available with the expected MIME type and signature before any DB image write. It has not been applied because these assets have not been deployed.

## Verification

- Metadata repeat dry run: zero pending changes.
- Before/after fingerprint: numerical primitive rules and character mechanics unchanged.
- Eight character audit: budgets, slots, load, component pins, deduplication and sheet/DC resolver pass.
- 144-item audit passes.
- Expansion repeat dry run: zero missing primitives, effects or capabilities.
- Portrait attachment dry run: 108 exact records, 108 pending image links, no explicit artwork overwritten.
- Focused source, classification, artwork and metallic SVG tests plus TypeScript checked after integration.
- Earlier local browser checks of upload, URL, 112px previews, unchanged 42px character badges and zero icon image borders are recorded in `heritage-portrait-display-2026-10-03.md`. A fresh browser check after SRD promotion could not complete because the IAB tab timed out on its focus command. No fresh browser verification is claimed for this pass.
- A historical phase-three seed dry run detects pre-existing content drift on Prowess Check +1; it was stopped without writes. No automatic overwrite was attempted.

Next: local visual review, deploy approved presentation/assets, attach the gated portrait URLs, then improve filtering and sorting.
