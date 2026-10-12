# Illustrated books release verification — 12 October 2026

Edition: **v0.1 alpha**. Expanded teaching manuscripts, a complete digital reference, responsive readers and six PDF exports replace the initial compact editions.

## Content and mechanical review

| Book | Pages per theme | Words | Section destinations | PDF links per theme |
| --- | --- | --- | --- | --- |
| Player's Handbook | 168 | 34,703 | 203 | 814 |
| Game Master's Guide | 163 | 31,040 | 194 | 783 |
| System Reference Document | 114 | 20,912 | 132 | 530 |

- PHB additions include three complete starting builds, three level-two adaptations, annotated scenes and multi-round play, construction lessons, targeting cases, noncombat play, recovery, advancement, exercises with answers and six table sheets.
- GM additions include creature workshops, cost and permission reviews, tactical scene design, multi-round adjudication, mechanical/restrictive/narrative consequences, two playable situations with location schematics and seven table sheets.
- SRD additions specify record schemas, acquisition identity, operations and recipients, conditions and stacking, character/creature/item construction, execution, recovery, encounters, mirrors and validation. All 29 principal primitive families remain available without a paid supplement.
- Three delegated manuscript audits checked current code and accepted creator rulings. A further cross-book audit independently recomputed 24 numerical assertions across the four PHB/GM expansion sources. Creature allocation, progression, proficiency, equipment, quantity-weighted encounter totals, odd-maximum rest carryover and resistance rounding passed.
- Two ingredient-reference wording mistakes were corrected: River Hand uses the three-ingredient Guided Water effect; Canal Impact adds d8. The four distinct purchases total 20, plus Knowledge 4, preserving Mira's 24-BU ledger. A capability does not need to reference every acquisition.
- Build assertions retain identical PHB/SRD family references and identical complete worked records across all three books. The single unresolved damage-triggered additional Vitality upkeep scheme remains explicitly pending; no threshold/counter/reset/excess rule was invented.

## PDF and artwork review

- Freshly rendered all **890 pages** across the six final files. A separate visual reviewer inspected 32 complete contact sheets and 14 larger critical pages: both schematics in both themes, worksheets, composition diagrams, dense family tables and dark upkeep notices. No concrete clipping, overlap or missing-art defect was found.
- `scripts/audit-books.py` reopens every file and verifies the release manifest's SHA-256, byte count, trim, page count, section count, font embedding, image resolution and text bounds. All checks passed; no replacement/null glyphs, empty pages or text outside the inspected bounds were found.
- PHB/GM artwork is at least **300 effective PPI** at its placed size. The SRD's cover illustration is above 465 PPI. Native PNG masters are used rather than enlarged WebP thumbnails.
- Unica One, Aubrey, Syne and IBM Plex Mono are embedded. Font notices remain separate. Instructional diagrams and route schematics are vectors; their labels also identify relationships without depending on color.
- The final trim is **6.5 × 9 inches**, with alternating **0.70-inch inner / 0.55-inch outer** margins. Light interiors use white paper backgrounds and contained illustrations; dark PDFs are screen editions. Both themes have identical pagination.
- Seven registered artworks comprise five new illustrations and two reused original bestiary illustrations. Two new spot illustrations have true transparent backgrounds. The art manifest records prompts/sources, provenance, dimensions, transparency and hashes.
- Final section maps, hierarchical outline destinations, internal annotation destinations and page footers were checked independently. Linked contents and alphabetical indexes use final page numbers.

## Reader and implementation checks

- Production-mode Firefox checked all three readers at 1440 × 900, 412 × 915 and 320 × 915 in both themes: 18 width/theme combinations, with no outer horizontal overflow and no page errors.
- Searching “upkeep” returns 15 PHB, 16 GM and 11 SRD sections. Mobile section selection follows the anchor and closes contents. Illustrations, map images and printable table sheets load in the narrow layouts; map route information is also available as readable text.
- All six production-mode PDF links return 307 redirects to the exact verified R2 document paths. No download requires Cloudflare dashboard authentication.
- Independent reader review corrections include forced light ink/diagrams when browser-printing a dark reader, accessible map descriptions and isolated `--proof` reader output. Proofs no longer overwrite full production reader JSON.
- Scoped ESLint, standalone `pnpm typecheck`, the full Next.js production build and `git diff --check` passed. The build generated 59 static pages; existing book entry links remain on the homepage and Rules pages.

## Storage and delivery

- Uploaded and remotely verified **20 objects** in the existing `swordweave-public-art` Cloudflare R2 bucket: six PDFs, seven WebP illustrations and seven PNG masters. Every remote byte count, SHA-256 and MIME matches the validated local record.
- PDF keys: `documents/swordweave/v0.1-alpha/`. Art keys: `images/books/v0.1-alpha/`. No replacement top-level `art/` folder was introduced.
- The existing read-only worker was deployed as version `4a628c4a-1301-4335-b10a-077e3f94cad0`. Exact allowlists expose only the named publication assets in those directories; existing catalogue delivery remains available.
- Five worker tests passed, covering read-only behavior, headers/cache/HEAD/ETag, public portrait access, exact PDF allowlisting and exact illustration allowlisting.
- Six website asset tests passed, including the thirteen stable PDF/art redirects, origin validation and existing catalogue path preservation. Download links retain `/books/v0.1-alpha/...`; reader artwork retains `/books/art/...`. The destinations resolve to the verified archive.
- Publication binaries remain available locally but are excluded from GitHub deployment output. GitHub publishes website/source changes; Wrangler uploads R2 objects and deploys the delivery worker.

## Remaining limits

- No independent new-player human playtest is claimed. Numerical/source audits and digital inspection do not substitute for people learning unaided from the books.
- No physical printer proof, printer-specific PDF/X certification, CMYK approval or wraparound cover is claimed. Digital-print interiors must be checked against the selected printer, paper and binding before manufactured copies are sold.
- Additional damage-triggered Vitality upkeep remains pending by the creator's instruction. Ordinary agreed continuation and other consequences remain usable.
- The rejected local character-editor proposal is excluded from this publication commit. No character state, encounter run or monster play copy is changed by the book release.
