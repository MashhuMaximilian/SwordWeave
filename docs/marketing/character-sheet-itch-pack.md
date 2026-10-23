# Proposed character-sheet addition for itch.io / 23 October 2026

## Published / 23 October 2026

The founder subsequently requested individual files as well as the complete ZIP.
That release is now live on [Books](https://www.swordweave.quest/books#character-sheets),
the [creator kit](https://www.swordweave.quest/press#character-sheets), and
[itch.io](https://mashhul.itch.io/swordweave). The original recommendation below
is retained as planning history; its "no files uploaded" statement is historical.

The complete ZIP is at
`/Users/max/dev/SwordWeave/output/pdf/aegis-print-pack/swordweave-aegis-character-sheets-v0.1-alpha.zip`.
It contains four blank fronts, two supporting-page PDFs, level-one Tarn and
level-sixteen Orren examples, instructions and notices. All eight PDFs can also
be downloaded separately. Existing itch downloads 01-09 remain; the additions
are 10-18. The website release is commit `bf5e5250` on main.

All nine live website files match their reviewed SHA-256 hashes; Books and Press
Markdown retain their download URLs. Production build, focused tests and
desktop/mobile layout checks pass. A physical printer, pencil and fold proof
is still pending. This static-file release does not publish the separate
interactive generator feature.

Release evidence: `output/marketing/aegis-print-pack-2026-10-23/`.

## Original proposal

The current public SwordWeave page already contains the three books, four
compact guides and two fillable companions. Keep those downloads. This is an
addition for printing and physical play, not another complete template library.
No files are uploaded to itch.io by this proposal.

## Recommended addition

One download: **Character Sheets — Print Pack (ZIP)**, using **Aegis** as the
single default aesthetic. Inside, use clear filenames for four blank fronts:

- Portrait — Normal
- Portrait — Dense
- Landscape — Normal (fold in half)
- Landscape — Dense (fold in half)

Include one matching set of reusable blank continuation/supporting leaves for
primitives, capabilities/effects, equipment, identity/story and the optional
workbench. Avoid duplicating all those leaves in each front file. A short
README should say: choose one front; print only the supporting pages needed;
print landscape at actual size and fold through its clear centre; changing
values are intended for pencil. Label these sheets **printable**, not fillable,
unless interactive form fields are separately added and tested.

Include **two filled examples in the same ZIP**, rather than two more prominent
downloads: one simple, ready-to-play low-level character and one advanced build
that demonstrates dense layout and continuation references. Orren or Aster is a
good advanced example. Public level-one Tarn or Veyra is a possible beginner
example, subject to the usual source/gameplay check. The two current level16 Orren/Aster
proofs are useful layout reviews, but both are advanced; they should not be
presented as beginner pregenerations.

Keep the other eleven styles available through the website generator. One
small gallery image on itch can show the four formats; a link can explain that
more styles and personalized sheets are available on SwordWeave. Do not require
an account to download or use the actual itch files.

## Release check

Finish current PDF Markdown, artwork/icon and alignment changes before staging
this pack. Generate the blank sheets from the corrected current renderer, not
by removing the words from the older proofs. Check low/high-content examples,
full descriptions, licenses/credits, monochrome output, and a real paper/fold
proof. Preserve the current nine itch downloads and their release labels.

itch supports multiple downloadable files and recommends directly hosted release
files; the choice of one ZIP here is an editorial recommendation to keep the
download list easy to understand, not an itch requirement.

Sources: https://itch.io/docs/creators/getting-started and
https://itch.io/docs/creators/quality-guidelines#prefer-uploading-your-files-directly-to-itchio
