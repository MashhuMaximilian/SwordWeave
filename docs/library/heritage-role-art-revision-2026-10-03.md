# Full-canvas role portrait revision

Completed the approved revision for all 78 curated role heritages: 54 upbringings and 24 manifests. The three approved samples (Courtier, Orchard Tender, Elemental Shaper) are retained; 75 other portraits were generated with the built-in `image_gen` tool.

## Direction

Square scenes extend to every canvas edge, with no drawn circular frames, medallions, or borders. Angular graphic shapes, printed texture, navy, parchment gold, rust, and teal match the approved examples. Clothing, headwear, props, poses, and environments distinguish the roles. Faces remain in featureless shadow or opaque fabric; no visible skin, ears, or traits assign a lineage. No named artists or franchise characters were requested.

Every portrait was visually reviewed, primarily through inspection sheets. Original PNGs and compressed 800×800 WEBPs are saved in `public/images/heritages/upbringings/` and `public/images/heritages/manifests/`, with the suffix `-graphic-v3`. Previous revisions are retained.

## Integration and checks

- `src/lib/heritage/heritage-role-art.json` maps all 78 exact curated identities to the new WEBPs. Explicit user artwork continues to take precedence.
- `public/heritage-role-art-review.html` shows the full revised set.
- Asset checks confirm 78 existing, distinct square WEBPs and no missing references.
- Six heritage presentation tests pass, including SRD identity matching, kind isolation, and preservation of explicit user images. TypeScript passes.
- Prompts and generated-file provenance are recorded in `docs/library/heritage-role-art-v3-2026-10.json`.
- Reinstall the complete set with `node scripts/install-heritage-role-art-2026-10.mjs --v3`.

Local integration only. No deployment, database updates, mechanical changes, or version-pin changes were performed. Database attachment remains a separate step after assets are deployed.
