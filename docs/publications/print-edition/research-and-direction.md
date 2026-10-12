# Illustrated print edition, revision 2

## What the visual study showed

Reviewed actual rendered pages, not just extracted text: D&D Player's Handbook PDF pages 9–10, 18–19, 50–51, 176–177; Dungeon Master's Guide pages 8–9, 74–75, 102–103, 250–251; Tau codex pages 6–7, 20–21, 58–59, 100–101. Local reference copies remain outside this repository. Their wording, artwork and distinctive page ornaments are not reused.

The previous SwordWeave files passed technical checks but failed the editorial goal. The single narrow reading column, oversized condensed body text, repeated pale callout boxes, small isolated pictures and short tail pages made them feel like a web guide. PHB pages 66 and 90 have substantial uncomposed empty space. Page 23's generic container diagram says little about an actual character. The cover treats its illustration as an inset thumbnail.

The references demonstrate distinct jobs for imagery: a scene establishes a part's promise; a subject illustration explains the adjacent topic; a diagram shows a decision or spatial relation. Two-column prose, restrained heading scales, consistent folios and changing illustration proportions sustain a book's rhythm. Maps and worked examples are designed as teaching pages, not generic cards.

## Research sources

- [Affinity: editorial grids](https://www.affinity.studio/blog/grid-design-for-editorial-and-web-layouts): column, modular and baseline relationships; deliberate focal breaks.
- [Adobe: text frames](https://helpx.adobe.com/indesign/desktop/add-and-manage-text/add-and-manage-text-frames/create-position-text-frames.html): linked text frames and multiple columns in a print layout.
- [Typst: page setup](https://typst.app/docs/guides/page-setup/): physical pages, mirrored margins, running elements and columns.
- [Aubrey](https://github.com/google/fonts/tree/main/ofl/aubrey), [Syne](https://github.com/google/fonts/tree/main/ofl/syne), [Unica One](https://github.com/google/fonts/tree/main/ofl/unicaone): the platform's font families, with SIL Open Font License notices.

Installed `typography` from rhino-labs/skills and `typst-author` from apcamargo/typst-skills. Typography guidance informs this edition. The native PDF renderer uses ReportLab, already available and supported by the PDF skill; installing a skill is not a reason to change a working production dependency.

## New print system

- Physical trim: 7.75 × 10.5 inches. Mirrored 0.75-inch binding and 0.55-inch outer margins; comfortable head/foot clearance.
- Three platform faces, each with a role: Aubrey for reading, Syne for emphasis/data labels, Unica One for chapter display. Body size is designed in points, not taken from browser CSS.
- Cream, near-black reading pages; muted gold, silver and teal ornament. Dark edition uses the same page composition with light text. Metallic sheens are printed gradients, not physical foil.
- Illustrated covers; large narrative chapter entrances; contextual portrait plates; transparent spot figures; two-column reading; full-width reference tables; annotated construction and timing graphics; illustrated case-study spreads; usable writing sheets.
- Images are placed by subject and teaching purpose. Square bestiary art is not stretched into panoramic scenery. Existing heroes keep their identities. An illustration cannot grant unstated mechanics.
- Main manuscript remains intact. Additional field ateliers use complete examples, dialogue and changed circumstances. Rules, examples and optional advice remain visibly distinct.
- v0.1 alpha stays unchanged. Damage-triggered additional Vitality upkeep remains explicitly pending. Page expansion cannot invent a ruling.

## Production boundaries

Export searchable text and embedded licensed fonts. Check every page for overflow, orphan headings, dense tables, image placement and navigation. Record native image dimensions and effective resolution honestly; no raster upscaling is used to claim invented detail. Printer-specific color profiles, spine width, stock and cover finishing require the chosen printer. These PDF interiors are for print review and digital printing; a physical proof is still required before a commercial print run.
