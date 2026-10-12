# Print revision 2: review and release record

Edition: **v0.1 alpha**, 12 October 2026. This record supersedes the print layout and artwork statistics in the earlier same-day release verification. The SRD remains the complete digital reference.

## Research and editorial work

Actual pages of the local D&D PHB/GM Guide and Tau codex were rendered and visually studied before composition. The research and direction file identifies pages and primary production references. Their illustrations, prose and distinctive ornaments are not reproduced.

Installed and read the community typography and Typst author skills. The renderer stays native ReportLab, with measured physical pages rather than browser printing. Three delegated specialists authored the two field atlases and reviewed artwork/source/print composition.

The prior manuscripts and complete worked records remain present. New material adds **28 player lessons (17,947 words) and 26 GM lessons (16,620 words)**, with concrete table dialogue, changed circumstances, practical preparation and explained exercises. These are worked examples, not unapproved new mechanics. All 54 modules occupy two pages each. Two-column composition consolidates the older material, so the extra teaching pages do not translate into the same net increase in total pages.

## Final exports

| Book | Pages per theme | Counted words | Section destinations | Internal/external PDF links |
| --- | ---: | ---: | ---: | ---: |
| players-handbook | 180 | 52,650 | 429 | 677 |
| game-masters-guide | 168 | 47,656 | 352 | 582 |
| srd | 114 | 20,912 | 132 | 530 |

PHB and GM trim: **7.75 × 10.5 inches**; mirrored **0.75-inch inner / 0.55-inch outer** margins. Aubrey reading text, Syne emphasis/data labels and Unica One display headings use embedded licensed fonts. Cream paper, quiet running headers, folios, contextual narrative plates, isolated figures and vector diagrams replace the web-derived composition. Light PDFs are paper editions; dark PDFs preserve the same pagination for screen reading.

Eight new original illustration assets comprise two covers and six genuinely transparent subject illustrations. Reviewed existing SwordWeave character, heritage and monster art is reused with its actual subject and teaching purpose. The generation/reuse manifests record original pixel dimensions, provenance and hashes. Opaque PDF images use JPEG storage at native pixel dimensions; transparent figures retain their PNG color stream and alpha soft mask. Original masters are intact.

Native cover resolution at its placed size is **149.79 effective PPI**. The artwork placement manifest records each illustration's actual resolution. No upscaling is used to claim 300 PPI, and no printer-specific CMYK/PDF/X or physical proof is claimed.

## Verification

- All PHB/GM reading pages were reviewed across complete light contact sheets. Full-size checks covered narrative openings, genuine cutouts, dense table cells, diagrams, worksheets, maps, headings and workshop continuations. Dark full-size samples checked contrast and transparency.
- Review found and corrected black backgrounds behind transparent PNGs, repeated same-page Tools art, a two-line workshop overflow page, an empty left-column transition, wide-table relocation, orphan headings and slash-joined practice-name wrapping. The final two table repairs were inspected at full size.
- `scripts/audit-books.py` passed on the exact six final exports: SHA-256, bytes, page count, physical trim, nonempty pages, glyph bounds, font embedding, native image resolution and exact section destination sets. `output/pdf/verification.json` records these results. No text extends outside the inspected trim bounds.
- Earlier source checks preserved all 1,494 substantive GM strings, while mechanical manuscript reviews and cross-book definition/record assertions remain in force. The only undecided rule remains additional Vitality-paid upkeep triggered by incoming damage; no threshold, counter or reset rule was introduced.
- All 12 focused asset/delivery tests passed (six Worker and six site-redirect tests). Typecheck and production build passed during this revision. Final PDF geometry repairs change the renderer and exported files, not TypeScript interfaces.
- The publication dry run validated 36 objects, with 20 new uploads: four illustrated PDFs and eight artwork assets in both WebP and original PNG form. The SRD and original book assets are retained.

## Storage and publication

PDF keys: `documents/swordweave/v0.1-alpha/print-r2/`. New art: `images/books/v0.1-alpha/print-r2/`. The existing R2 bucket and read-only Worker serve them. Stable website download links stay under `/books/v0.1-alpha/`; GitHub publishes source and redirects. No top-level `art/` tree is introduced. Binary publications remain out of GitHub deployment output.

Remote byte/MIME/hash verification and the exact GitHub production deployment are recorded in the generated `output/pdf/deployment.json` after release. The local character-editor experiments remain outside this publication change.

## Review limits

A chosen printer still needs to approve stock, binding, cover construction, color and a physical proof before a commercial print run. No independent new-player human playtest is claimed. The alpha upkeep decision remains pending.
