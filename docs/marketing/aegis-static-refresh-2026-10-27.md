# Aegis static print-pack refresh / 27 October 2026

The creator approved replacing the downloadable Aegis sheets on Books, the
creator kit and itch.io with the current character-PDF renderer. This does not
change Futoshi, training primitive definitions, or the deferred upkeep ruling.

## Release contents

Both editions contain eight PDFs / 27 pages: four one-page blank fronts,
six portrait supporting pages, three landscape supporting sheets, Tarn's
five-page public level-one example, and Orren's nine-sheet public level-sixteen
example. The default remains gold/teal; the separate monochrome ZIP contains
the same formats. Printing instructions, credits and embedded font notices
remain included. Physical print/pencil/fold testing is still pending with the
creator.

The refreshed examples include the current complete mechanical/narrative rule
scope, stable primitive/effect references, source portraits and icons, current
equipment/load values, visible domains, signed and fitted attribute modifiers,
adjacent save/practice values and inline roll annotations. Blank front attribute
seals have writable fields, and unused Folio/Date headings are removed.

Fresh public snapshots were loaded through an anonymous VIEWER in a read-only
database transaction; no private notes or creator records are published.
Renderer source: `c89b051e4bf765ea658f7a5ea9cb31c7b238d402`.

## Files and verification

- Website release directory: `public/character-sheets/aegis-v0.1-alpha-2026-10-27-r3/`.
- Color ZIP: 15,138,516 bytes; SHA-256 `a900e5c26cf3d3cbf444f56fc41ad44becc23a9c38575c0085ff092ab17fe3bb`.
- Monochrome ZIP: 12,083,349 bytes; see the release manifest for its SHA-256.
- Exact file counts, pages, hashes and source-snapshot hashes are recorded in
  `docs/publications/aegis-print-pack-release.json`.
- Closed-file preflight passed all 16 PDFs / 54 pages: painted full rules,
  embedded app fonts/notices, decoded image and alpha bytes, transforms/clips,
  color versus monochrome output, actual glyph bounds, fold clearance and
  metric/annotation geometry. Minimum native raster resolution: 366.24 PPI.
- Every page was rendered and reviewed in overview; changed fronts and authored
  scope/support pages were also checked at reading size. Evidence:
  `output/publications/aegis-print-pack-2026-10-27/`.

## Publishing checkpoint

Website tests/build, deployment verification, itch.io save and downloaded-file
verification are recorded here after completion. itch.io entries 10–19 are
replaced by exact filename; 01–09, prices, visibility, display names and download
counts are preserved. No book or guide release is replaced by this refresh.

## Decisions still deferred

Futoshi needs three definition/version reconciliations, not a rebuild: Intuition
minimum 10 (Innate instinct), the creator's intended melee attack Expertise
scope (Cornered combatant), and an enemy Exposed neurotoxin consequence whose
DC reduction is agreed at the table (Enfeebling Envenom). The latter must not
be a fixed -1 to the attacker's own SaveDC. No definition or character pin was
edited in this release.

Older proficiency/expertise definitions that each add PB need a separate
semantic training review. Already-trained practices must not gain PB again
merely from another proficiency grant. In the audited test case, Physical 15
and PB 6 plus three PB additions currently produce Fieldcraft 33; ordinary
expertise alone would be 15 + 2×6 = 27 before other authored bonuses. Review
definitions and affected version pins explicitly; no bulk migration is
authorized by this static-publication refresh.

PUB-01 remains open only for damage-triggered Vitality upkeep repayment and
its counter window, reset/excess, large-hit and concurrent-capability policy.
Keep other forms of upkeep and multiple maintained capabilities available.
Private creator distribution, shop/print distribution, the broader GM workspace
and ChatGPT/MCP remain later work.
