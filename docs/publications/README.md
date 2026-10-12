# SwordWeave core publications — v0.1 alpha

Updated 12 October 2026. The expanded PHB, GM Guide and digital SRD replace the initial compact editions. One assembled source per book produces the responsive reader and separate light/dark PDF editions, using the approved platform typography and metallic gold, silver and teal materials.

## Read and download

| Book | Reader | Pages per PDF theme | Manuscript words |
| --- | --- | --- | --- |
| Player's Handbook | `/books/players-handbook` | 168 | 34,703 |
| Game Master's Guide | `/books/game-masters-guide` | 163 | 31,040 |
| System Reference Document | `/books/srd` | 114 | 20,912 |

The hub at `/books` offers all six editions. Stable downloads use `/books/v0.1-alpha/{players-handbook,game-masters-guide,srd}[-dark].pdf`.

The PHB teaches character and ability construction, player procedures, consequences and recovery through worked builds, annotated play and exercises. The GM Guide teaches rulings, costs, creature design, encounters and adventures, with two playable situations and reusable worksheets. The SRD states the mechanical procedures and schemas precisely, including all 29 principal primitive families. The SRD's primary presentation is its searchable digital reader; it has no print-length target.

Only **damage-triggered additional Vitality upkeep**, including threshold/counter/reset/excess handling, remains explicitly undecided. The creator requested completion with this placeholder. Ordinary agreed mechanical, restrictive and narrative upkeep remains usable.

## Sources and reproducibility

The three original sources under `manuscripts/` share the established rules baseline. The teaching and reference expansions under `expanded/` are assembled at documented insertion points. See [expanded source and production instructions](expanded/README.md) for the assembly, page families, artwork provenance, rebuilding and restoring masters from R2.

`scripts/build-books.py` parses the deliberately small Markdown grammar, generates reader JSON and SVG diagrams/maps, and typesets the six PDFs through ReportLab. It asserts matching PHB/SRD family references and matching complete worked records across all three books. `scripts/publication-layout.py` supplies illustrated pages, vector schematics and worksheets. React renders manuscript text without injecting HTML.

The app's Unica One, Aubrey, Syne and IBM Plex Mono fonts are embedded in the final PDFs. Oxanium is also registered for the renderer's italic role; font notices remain separate. Artwork uses native PNG masters at a minimum 300 effective PPI in the illustrated books. Instructional diagrams and schematics remain vectors. Linked contents, hierarchical bookmarks, section anchors, running headings, page numbers and alphabetical topic indexes support lookup.

`release-manifest.json` records the actual final PDF bytes, hashes, page counts, link counts and section-page maps. `scripts/audit-books.py` reopens the PDFs to verify these records, font embedding, image resolution and text bounds. The historical eight-page design proof and compact 11 October release remain research records.

## Storage and publication

All six PDFs, seven optimized WebP illustrations and seven original PNG masters were uploaded and verified by byte count, SHA-256 and MIME on 12 October 2026 in the existing `swordweave-public-art` R2 bucket:

- PDFs: `documents/swordweave/v0.1-alpha/`.
- Illustrations and print masters: `images/books/v0.1-alpha/`.
- Read-only delivery: `https://swordweave-public-art.ionmariusc97.workers.dev`.

Exact allowlists in `infrastructure/public-art/worker.mjs` expose the six named PDFs and fourteen named book-art assets. The existing catalogue routes remain available. Website redirects preserve existing PDF/art links; large binaries are excluded from GitHub deployment output. Local rebuilds still write PDF copies under `output/pdf/` and `public/books/v0.1-alpha/`.

GitHub deploys the website. Wrangler performs the R2 object upload and read-only worker deployment. Run `node scripts/publish-books.mjs` for a dry run; `--apply` uploads after authorization and verifies all remote objects; `--verify-existing` checks the archive without uploading. Stable redirects are enabled only after a successful remote verification.

## Release evidence and further review

See [12 October release verification](release-verification-2026-10-12.md). Rule history and decisions remain in `full-rules-audit-2026-10-10.md`, `rules-source-index-2026-10-10.json` and `creator-rulings-2026-10-10.md`. These records are editorial evidence rather than front-facing source-note disclaimers.

The 30 public sample encounter preparations and repeat-seed validation are documented in [the encounter seed record](../library/system-encounters-v0.1-alpha.md). This book expansion creates no additional runs or monster play copies.

The PHB/GM light interiors use a 6.5 × 9-inch trim, mirrored binding margins and white page backgrounds for digital printing. The dark exports are screen editions. No physical printer proof, printer-specific PDF/X certification, wraparound cover or independent new-player human playtest is claimed. Those checks and the deferred upkeep ruling remain the next publication review.
