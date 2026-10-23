# Aegis static download refresh / 23 October 2026

This release regenerates the nine original static downloads with the renderer
published at `ef2ceb3fe9d5ebc5fc6847fcde85bc57ecae419f`. The founder explicitly
selected gold/teal color as the static default, superseding the maintenance
checklist's monochrome-default recommendation. A separate monochrome ZIP is
provided for economical printing; the other eleven styles remain in the
personalized website generator. Generator behavior/preferences are unchanged.

## Inventory

| Default color PDF | Pages | Bytes | SHA-256 |
| --- | --- | --- | --- |
| Portrait - Normal | 1 | 2,211,082 | `6d27a657114a2c748bd51f35649e6481e0e9629d7cdb5d5b436d4f70381b98f6` |
| Portrait - Dense | 1 | 2,210,817 | `0f6b0a7a432635706c41c4d758a6422d995145e98c3335bf9dd2588eb6dfc91e` |
| Landscape - Normal | 1 | 2,210,695 | `a764d0bdb73ebb5c5be1a842a10d0dcdadda009473a91d941a3de1693f481503` |
| Landscape - Dense | 1 | 2,210,683 | `6b36f7dc95f4920057d5fa171a9f1115b41e15294e627e87d3f69d1575f1a50c` |
| Blank supporting pages - portrait | 6 | 2,232,953 | `af67625af2dbd0bd4d676487b3ebec6b65705b4f74fbbd4aab5d802b3334327d` |
| Blank supporting pages - landscape | 3 | 2,218,247 | `dd56cb44cb47959d3c84444ab9c025fa3e5e4e9342e30d7c9ef74607a8da035f` |
| Tarn Emberpost - level 1 example | 5 | 2,645,090 | `f11b3907cab33060217360caff8fecb56aecca748fd59ec743e11d24cd0a3042` |
| Orren Vaultwright - level 16 example | 7 | 2,887,065 | `aa9bb5bb6896bce110a723074520c9cc45da3e222dccfe0b29e882bb0fa9312c` |

Default color ZIP: **15,131,333 bytes**, SHA-256 `f8130e7bb5366741ec114e46361228907f6421a84c4f937ba0561ae2edd12cd1`.
Optional monochrome ZIP: **12,076,161 bytes**, SHA-256 `589b9123ed4fcf11b4b2a7f33141c67335e76d9ed2524b91490c900b86134bd0`.
Both contain eight PDFs / 25 pages, their actual contents/sizes in README,
credits and font notices. Aegis files remain printable pencil PDFs, not
interactive form PDFs. Existing fillable companions are separate.

## Website

Books#character-sheets and Press#character-sheets use one shared inventory.
The default eight individual PDFs and complete ZIP are gold/teal. The extra
monochrome ZIP uses the same updated layouts. New URLs use the `-r2` release
folder to avoid stale browser/CDN copies. Old URLs remain available for existing
links. The four-format preview is rendered from the new blank fronts.

Both landscape fronts use two primitive columns and retain protected 16 pt
fold clearance. Print at A4 actual size; only print supporting leaves needed.
Physical printer, pencil and fold proof is pending. No metallic-ink/foil claim.
Existing styles are reused; no CSS, account controls, generator or book files
are changed. Existing nine download event identifiers remain; only the extra
monochrome ZIP gets a new allowlisted edition. Consent behavior is unchanged.

## Source and verification

Fresh canonical Tarn and Orren snapshots were fetched anonymously in an
explicit READ ONLY transaction. Private/player/DM notes were absent. Artwork
was resolved with color enabled before the renderer produced the color and
monochrome editions; both snapshots reported no missing-media warning.
Tarn remains level 1 / 24 of 25 Character BU; Orren level 16 / 191 of 200.

- All 16 final PDFs / 50 pages pass independent closed-file font, source-rule,
  image/alpha byte, actual-glyph, native-color and protected-fold checks. Native
  raster resolution is at least 366.24 PPI. All pages were rendered for review.
- Both ZIPs pass CRC and contained-PDF hash checks. Their README counts/sizes
  are generated from the actual outputs; used notices are embedded as well.
- Production build with full TypeScript passes. 43 focused tests pass across
  static inventory/integrity, consent/allowlists, Markdown, discovery and schema.
- The local production server serves all ten files with exact SHA-256/bytes.
  Both pages contain all ten download anchors, the correct edition/size claims
  and parseable JSON-LD, with no current links to the old pack.
- Candidate Books/Press Markdown retains all ten absolute download links.
  All 11 CSS budgets pass. No CSS files are modified.

## itch.io replacement instructions / verification state

Replace existing downloads 10-18 by exact filename so their identities and
statistics are retained. Add only 19, the monochrome ZIP. Original books,
compact guides and fillable companions (01-09) remain. Refresh the four-format
preview and the character-sheet paragraphs/instructions; preserve pricing,
visibility, other descriptions and the existing rights/AI disclosures.

At this source-record checkpoint, the verified files are prepared and the
founder has signed in to itch.io. Safari's native picker is open at the exact
reviewed folder; automated selection is unresponsive, so the founder has been
asked to select the ten prepared files and click Upload. No successful itch
replacement is claimed here until the saved editor/public listing is checked.

The delivery proof and final website/itch status receipt belong in
`output/maintenance/aegis-static-refresh-2026-10-23/` in the primary checkout.
PDFs: `output/pdf/aegis-print-pack-refresh/color/` and `monochrome/`.
Native manifests/preflight/all-page renders:
`output/publications/aegis-print-pack-refresh/`.
