# Aegis printable character-sheet release / 23 October 2026

The founder authorized a complete Aegis ZIP and individual public templates on the website and itch.io. This is a static print-file release, separate from the unshipped interactive character-PDF generator. Existing styles, books, quick guides and fillable companions are retained.

## Access

- [Books: printable character sheets](https://www.swordweave.quest/books#character-sheets)
- [Creator kit: the same individual files and ZIP](https://www.swordweave.quest/press#character-sheets)
- [SwordWeave on itch.io](https://mashhul.itch.io/swordweave)
- Rules / Your first game / first-session preparation links directly to the Books section.

No account is needed for the static files. The sheets are printable for pencil, not interactive form PDFs. The separately published first-session and Neris companions remain fillable.

## Inventory

| PDF | Pages | Bytes | SHA-256 |
| --- | --- | --- | --- |
| Portrait - Normal | 1 | 1,765,983 | `af1b8c875c354b680484cf8a6343f95ae9248d0b92496fb80c1ab7b4e9fe30f0` |
| Portrait - Dense | 1 | 1,765,779 | `c68d4fe18cb6935e65f43b1eb3f9ec6569b3ef43832f4298da95161b2edecc2d` |
| Landscape - Normal | 1 | 1,765,303 | `bf6dd1aad546b151dc3da36a9ed0620c35ff7238e59f527cfc7ccc6995cfa693` |
| Landscape - Dense | 1 | 1,765,565 | `6f353c8432c47ab9047b5a6164b8ffc9724965fdfa9dca637f1c8366b857017a` |
| Blank supporting pages - portrait | 6 | 1,782,208 | `e02491836a7fa9dcf71d30fd26876a64f8d24d05279cc027813de6a0ff245426` |
| Blank supporting pages - landscape | 3 | 1,768,250 | `f76221da125d46ae5c277f5cdee2c22153778c13a620edecad10600adbb2a0e4` |
| Tarn Emberpost - level 1 example | 5 | 1,996,309 | `43b367b63c5c073b049c00251914e1ba5a04b147aa114c227729178562ba1a26` |
| Orren Vaultwright - level 16 example | 7 | 2,083,888 | `bbed40c3f6bdae3dbfe7f20bc87df74a91bc398f3337c92a897e8dce3a319ea4` |

Complete ZIP: **11,833,101 bytes**, SHA-256 `a5be94f3f95f335f95de3dbdfdc2b706268bd15dd45a530c355561d4817df3d2`. It contains all eight PDFs in blank-front, supporting-page and filled-example folders; a README, credits and four font notices. Individual files also carry their notices as attachments.

Portrait supports have six repeatable A4 leaves. Landscape supports have six separately composed panels across three foldable A4 sheets. Print one front and only the supporting pages needed. Use actual-size A4 printing; landscape has a protected central fold gutter. **Physical printer, pencil and fold proof remains pending**; digital checks do not substitute for it.

## Example provenance and review

Fresh, public-only snapshots were resolved in an enforced READ ONLY database transaction. The anonymous viewing permission was required; player/private DM notes were absent. No character, purchase, publication, database or generator state was changed.

- Tarn Emberpost: public `aae2fea8-e17b-4887-afbe-a59bea94ad97`, level 1; 24/25 Character BU, separate 20 Item BU. Portrait normal, five complete pages.
- Orren Vaultwright: public `1da4e351-da76-4822-bf1f-632d2e657145`, level 16; 191/200 Character BU, separate 32 Item BU. Landscape dense, seven complete pages.

These are existing demonstration records, not independent playtest results. Full authored rules, actual item ownership and repeated continuation references remain in the PDFs. The release inventory hashes bind to the closed-file verification. Source snapshots stay in local review storage and are not distributed as raw JSON.

## Checks before main push

- Eight final PDFs / 25 pages pass independent closed-file checks: complete source text, actual embedded fonts, actual image/grayscale/alpha bytes, transforms/clips, measured glyph and writing bounds, fold clearance and source values. Minimum measured native raster resolution: 366.24 PPI. All blank formats are unfilled; no interactive AcroForm is claimed. All pages were rendered for visual review.
- ZIP CRC and contained-PDF hashes match the standalone files. A real local browser ZIP download is 11,833,101 bytes and SHA-256 a5be94f3f95f335f95de3dbdfdc2b706268bd15dd45a530c355561d4817df3d2.
- The temporary local production server served all nine downloads with exact expected hashes. Candidate Books/Press HTML-to-Markdown conversion retains all nine absolute download URLs, including collapsed examples. Rules Markdown includes the new preparation link. The existing production-mode Markdown route deliberately reads the canonical production host, so the local .md endpoint is not used to claim candidate content.
- Desktop 1440px and phone 390px have no document overflow. The preview opens using the keyboard, the example section reveals both links, the Books final note remains reachable, and the creator-kit section uses the same files. Existing download styling is reused; homepage/account/editor styles are unchanged. The large files are download targets, not initial page payloads; the preview is lazy and collapsed initially.
- Production build/full TypeScript pass. 42 focused tests pass across static asset integrity, download-event allowlists, consent client, public Markdown, discovery and structured data. All 11 CSS budgets pass; Books is 68,182 gzip bytes against a 75,000 budget.
- New download-event values use the existing consent gate and closed allowlists. No arbitrary filenames, character/account identifiers or new tracking service enter the event contract.

## itch.io saved update

The existing free Public project retains downloads 01-09. Added 10 (full Aegis ZIP) and 11-18 (the eight individual PDFs), all as Book or Document, with readable blank/example labels. All additions showed upload Success. Copy and PDF/ZIP instructions distinguish blank printable sheets, the two existing fillable companions and the two filled examples. An actual four-format preview was added after the PHB cover; existing gallery assets and rights/AI disclosures remain.

## Reproduction and evidence

`scripts/build-aegis-print-pack.py --renderer-root <reviewed-character-PDF-source> --snapshots <public-only-snapshots> --output <folder> --review <folder>` uses the current renderer from the separate character-export work. It does not import that feature into the deployed application. Its current source was in `/Users/max/dev/SwordWeave`; the older dirty primary checkout was not deployed. The release script, public inventory and final static files are included here.

Native layout manifests, all-page renders and the closed-file report are in the primary checkout under `output/publications/aegis-print-pack/`. Current local delivery/browser evidence is in `/tmp/swordweave-aegis-print-pack-2026-10-23/`; no browser session, private token or credential is committed.
