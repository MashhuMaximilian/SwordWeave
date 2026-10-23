# Character PDF runtime

`scripts/render-character-pdf.py` reads one JSON request from stdin and writes
one native PDF to `--output`. Its stdout is a single small JSON object containing
the output path/hash, page count, normalized options and selected density.
Failures go to stderr and exit nonzero; no snapshot is logged.

```json
{
  "character": {"name": "A character", "primitiveLinks": []},
  "options": {
    "style": "aegis",
    "density": "auto",
    "orientation": "portrait",
    "workbench": true,
    "color": false
  }
}
```

The character shape matches the existing public character snapshots, extended
with `pdfDerived` from the canonical game resolver. That block contains numeric
`attributes`, `saves`, `pb`, `dc`, `restCap`, `slotCapacity`, `carryCapacity`,
`movement` (`walk/climb/swim/fly/burrow`), and practices with explicit training.
Item links can supply canonical `load` and `equippedSlotCost`. The renderer does
not infer rules from a character's name, level, or example build.

Primitive occurrences retain separate P references, effective mirrored rule
text is consumed exactly once, and supporting rules preserve item ownership.
Capability/effect references distinguish source ID, pinned version, mirrored
state and effective authored content. Repeated acquisitions keep their own P
references; a composition points only to matching pins and mirrored state.
When membership is ambiguous, all actual matching references remain visible
rather than choosing whichever occurrence was encountered last. Item primitive
fallbacks read the workspace graph's `parent` / `child` edges.
`dmNotes` are excluded; player notes and full authored rules are retained. A
single long rule splits at line boundaries and carries its reference onto the
next region. No rule is ellipsized or rendered at a smaller fit-to-page size.
The front prints maximum Vitality/rest cap and leaves changing values writable.

The twelve approved v11 styles supply the connected frame and native interior
grammar. `design.py` compiles only definitions from the preserved v6-v11 source
files, avoiding their historical top-level temporary-font and example-character
work. Those source files are therefore explicit runtime dependencies. No
historical constructor or sample build is called. Fonts and selected original
rasters live in `assets/character-pdf`; PDFs embed grayscale images and the app
fonts. Body bold keeps Aubrey's metrics; Oxanium headings and Syne labels provide
hierarchy without a larger-looking inline face.

Optional `color: true` applies the established gold, teal, silver and pale-ivory
palette to the entire design. Frame recoloring preserves native dimensions and
alpha, using simulated metal relief rather than new artwork. Native cards,
rules, tables and display text use the same palette; source portraits and custom
artwork retain RGB. Default/explicit false output stays byte-identical monochrome.
`theme.py` is a runtime dependency, not a separate asset-generation step.

Portrait uses the approved full-page arrangements. Landscape is native A4 with
two independent portrait-shaped panels, 16 pt between their engraved outer
borders, and no content crossing the fold. Core values, owned access and declared scale share the left half;
the right half is a full-height ingredient ledger (two columns in both normal and
dense variants). Supporting records flow through separate
panels using the same 9.2 pt rule size rather than shrinking a portrait page.
The landscape core retains a compact Concept / Heritages line; complete identity
text continues in the full record. Short supporting sections balance intact
records across portrait columns, and spare lower space is explicitly ruled for
session notes, repairs or agreed changes.

`--manifest` records actual text/writing boxes, rule fragments, source records,
font and raster hashes, native image crop/transform intent, page roles, density
measurement and fold gutter. The final PDF still requires actual rendering and
PDF-operation verification before a publication claim. Landscape is a new local
review design; physical print-and-pencil review is pending.

Regression checks:

```sh
python -m unittest discover -s scripts/character_pdf -p 'test_*.py'
```

Hosted protection uses exact `@vercel/oidc` 3.8.5 to obtain the platform-issued
workload token for the matching environment and immutable deployment hostname.
HMAC still authorizes the native function. Configured automation credentials
and an exact-origin preview `_vercel_jwt` allowlist are fallbacks; no caller
OIDC header, Clerk cookie or authored content enters diagnostics. Deployment
protection stays enabled. The public route supplies its existing request URL
and cookie header only for this bounded preview fallback.
