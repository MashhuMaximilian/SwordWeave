# Illustrated v0.1 alpha publication sources

The expanded Player's Handbook and Game Master's Guide teach the DIY framework through worked scenes, creation workshops, rulings, and table tools. The SRD is the complete digital mechanical reference. This directory extends the three original manuscripts; it does not replace their shared rules baseline.

## Source assembly

`scripts/build-books.py` assembles each book in this order:

| Book | Original manuscript | Expansion files, in reading order | Insertion point |
| --- | --- | --- | --- |
| PHB | `../manuscripts/players-handbook.md` | `player-workshops.md`, then `player-depth.md` | Before The primitive reference |
| GM Guide | `../manuscripts/game-masters-guide.md` | `gm-workshops.md`, then `gm-depth.md` | Before Public sample encounters |
| SRD | `../manuscripts/system-reference-document.md` | `srd-reference.md` | Before The primitive reference |

The build adds PHB and GM worksheets before their topic indexes. It asserts that the PHB/SRD primitive reference is identical and that all three books retain identical complete worked records. The creator's [rulings register](../creator-rulings-2026-10-10.md) remains the rule authority for clarifications; the [approved production plan](../full-edition-production-plan.md) describes the teaching and design goals.

The manuscript format supports second/third-level headings, paragraphs, lists, tables, blockquotes, links, and explicit `:::figure`, `:::art`, `:::map`, `:::worksheet`, and `:::index` markers. Use unique heading titles so generated section anchors remain unambiguous. Figures and maps need identifiers already defined by the renderer. Expansion files contain teaching text and examples, not an additional set of mandatory rules.

## Page families and visual system

`scripts/publication-layout.py` supplies illustrated teaching pages: narrative scenes, transparent spot artwork, construction diagrams, annotated location schematics, and full-page worksheets. The book renderer adds chapter openings, dialogue/ruling callouts, alternating reference tables, contents, hierarchical bookmarks, running headings, page numbers, and linked alphabetical indexes.

The renderer registers five local app fonts from `src/app/fonts`: Unica One for display headings, Aubrey for prose, Syne for emphasis, Oxanium for the italic role, and IBM Plex Mono for technical labels. The four faces used in these final PDFs are embedded. Their licenses remain separate from the game text. Gold, silver, teal, and teal-to-gold gradients reproduce the platform's material language. These are printed color simulations; actual metallic foil would require a separately specified manufacturing process.

One assembled manuscript generates light and dark PDFs. PHB and GM light interiors use a 6.5 × 9-inch trim, alternating 0.70-inch inner and 0.55-inch outer margins, white paper backgrounds, and contained illustrations without required bleed. The dark PDFs are screen-reading editions. The SRD's primary destination is its searchable web reader; its PDF exports are useful downloads and archives, with no illustrated-print length target.

Current output is RGB. A light interior is prepared for a digital-print workflow, subject to a chosen printer's requirements. That is not a claim of printer-specific PDF/X certification, approved CMYK conversion, or a finished wraparound cover.

## Artwork and provenance

`art-manifest.json` records each illustration's prompt or original source, generation provenance, pixel dimensions, transparency, local master path, web path, R2 object keys, and SHA-256 hashes. Seven illustrations are currently registered:

- Bridge, workshop, and camp are original narrative illustrations generated under Marius Ion's direction in the established SwordWeave graphic fantasy style.
- Tools and Canal Watcher are original transparent spot illustrations designed to sit alongside prose in either theme.
- Mossback Grazer and Counterweight Custodian reuse original system bestiary artwork.

The style uses angular drawn forms, engraved hatching, distressed print texture, antique gold, muted teal, midnight navy, and ivory/silver. Reuse does not mean enlarging a small web portrait to fill a page. PNG masters under `output/book-art/` feed the PDF renderer; optimized WebP versions under `public/books/art/` feed the website. The renderer caps native artwork placement at a minimum 300 effective pixels per inch rather than inventing resolution by upscaling. Vector instructional diagrams and route schematics remain vectors.

Keep the art provenance and separate asset rights notices when publishing. AI generation provenance alone is not a declaration that the artwork uses the text's CC BY license. Map captions explicitly describe schematics and measured route labels; readers should not infer distances from drawing scale.

## Rebuild locally

Use the bundled Codex Python runtime for ReportLab, pypdf, and Pillow. The current builder's font-conversion subprocess invokes `python3` on the shell path, which must provide fontTools and Brotli. In the preparation environment these are separate runtimes: bundled Python supplies PDF packages, while the local Python 3.12 supplies font conversion. Do not assume fontTools is included in the bundle.

From the repository root:

```sh
BOOK_PY=/Users/max/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
python3 -c 'import fontTools, brotli'
"$BOOK_PY" -c 'import reportlab, pypdf, PIL'
"$BOOK_PY" scripts/build-books.py
```

If the bundled runtime moves, obtain its current path through the workspace dependency loader. No terminal LaTeX installation is required. Converted font files are cached under `tmp/pdfs/books/`.

A normal build produces:

- Six PDFs under `output/pdf/`, copied to `public/books/v0.1-alpha/`.
- Website reader data under `src/lib/publications/`, including the assembled books, catalogue, artwork, figures, maps, and worksheets.
- Generated SVG figures under `public/books/figures/`.
- `../release-manifest.json`, containing PDF byte counts, hashes, page counts, link counts, and section-page maps.

The builder checks shared rule sections, duplicate headings, missing PDF heading anchors, and empty extracted pages. Those checks supplement visual inspection; they do not establish that every page is free of collisions or that a new player can learn unaided. Review actual-size representative pages and the complete rendered page set after changes. PDF producer timestamps can change hashes across rebuilds, so the release manifest must describe the actual final files.

## Isolated production proof

Run the shorter proof with:

```sh
"$BOOK_PY" scripts/build-books.py --proof
```

This assembles the original manuscripts with `player-workshops.md` and `gm-workshops.md`, excluding both depth files and the SRD reference expansion. It writes PDFs and reader data under `tmp/pdfs/full-edition-proof/`, with reader JSON in its `data/` directory. It does not overwrite the final static PDFs, published reader JSON, or release manifest. It still regenerates the shared SVG figure assets and can populate the shared converted-font cache.

The proof is a design sample, not the complete expanded books. It is useful for reviewing type, materials, gutters, tables, artwork, maps, and worksheet page families before a full rebuild.

## Restore absent PNG masters

PNG masters are production assets and may be absent from a source-only checkout. `art-manifest.json` records their destination in `printMaster`, exact R2 path in `r2MasterKey`, and required hash in `masterSha256`. The verified archive is the existing `swordweave-public-art` bucket, under `images/books/v0.1-alpha/`; no separate `art/` root is introduced.

After upload and public delivery have actually been verified, restore missing masters from the documented keys and verify their bytes before writing them. For example:

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib, json, urllib.request
manifest = json.loads(Path('docs/publications/expanded/art-manifest.json').read_text())
origin = 'https://swordweave-public-art.ionmariusc97.workers.dev/'
for asset in manifest['assets']:
    destination = Path(asset['printMaster'])
    if destination.exists():
        data = destination.read_bytes()
    else:
        with urllib.request.urlopen(origin + asset['r2MasterKey'], timeout=60) as response:
            if not response.headers.get_content_type() == 'image/png':
                raise ValueError('Unexpected master MIME type: ' + asset['key'])
            data = response.read()
    if hashlib.sha256(data).hexdigest() != asset['masterSha256']:
        raise ValueError('Master hash mismatch: ' + asset['key'])
    if not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
PY
```

A missing remote object or hash mismatch should stop restoration. Do not substitute a resized WebP as a print master. If the archive has not been uploaded, recover the original generated/source image listed in the manifest and verify it against the same hash instead.

`scripts/publish-books.mjs` validates all six final PDFs and both formats of all seven artwork assets in a dry run. Its `--apply` mode uploads them and deploys the read-only delivery worker; `--verify-existing` checks remote byte/hash/MIME results without uploading. PDF object keys use `documents/swordweave/v0.1-alpha/`; artwork keys use `images/books/v0.1-alpha/`. The presence of these scripts or keys does not prove that upload or deployment has completed. Use actual successful release verification for that claim.

## Remaining publication limits

- Additional damage-triggered Vitality upkeep remains explicitly unresolved, including threshold, damage-counter reset, and excess handling. Normal agreed continuation requirements remain usable; the books do not impose the deferred numerical scheme.
- No completed new-player human playtest is claimed. The integrated PHB and GM Guide still need evidence from people learning and preparing from the books alone.
- No physical printer proof has been inspected. Printer, binding, paper, color profile, and production specifications must be chosen before final press certification.
- No printer-specific PDF/X compliance, wraparound cover, or cover-spine width is claimed. A spine requires the final page count and the selected printer's paper and binding measurements.

The free alpha publication can be reviewed and corrected while those checks are completed. Selling manufactured copies is a later step after a physical proof, not a property inferred from a successful PDF build.
