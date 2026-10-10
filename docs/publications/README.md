# SwordWeave publication review package

10 October 2026. Local editorial proposal; no site deployment or license change.

## Read in this order

Start with [Rights policy for the three free books](book-rights-policy.md): the confirmed free-book scope, sharing/support wording, CC BY text boundary and deferred adventure-sharing preference.

The original project roadmap is the private `.local-plans/next-phase.md`, updated with the latest decisions. The current publication sequence and future website bookstore/retail detail are in [Publication and commerce follow-up](../next-work.md). The creator has approved the proof's visual direction; the remaining rule gaps must be reconciled before a definitive core release.

Latest: [creator rulings after the audit](creator-rulings-2026-10-10.md). Use these accepted clarifications when writing; the audit preserves the prior source comparison.

Writing continues as **v0.1 alpha**: [manuscript drafts](manuscripts/README.md) contains all nine PHB teaching chapters, corresponding SRD procedures/construction foundations and the first GM chapter. The damage-triggered upkeep rule has an explicit deferred placeholder. These partial drafts are not a final book release or new typeset PDFs.

Scope clarification: [book content and shared coverage](book-content-scope.md) specifies complete PHB player rules, base primitive families/tiers and construction procedures in the SRD, with a few worked examples. The creator has excluded a required Monster Manual/100-monster appendix and large finished-heritage/fork catalogues. [Comparative publication research](comparative-publication-research.md) explains the differences across Pathfinder, Call of Cthulhu/BRP, Daggerheart, Fate and Cairn. Repeated mechanics across PHB/SRD are intentional; the current draft's uneven coverage is temporary.

1. [Publishing and rights](publishing-and-rights.md): shared web/PDF manuscripts, R2 storage, Figma access and the intended rights boundary compared with existing grants.
2. [Full-system rules audit](full-rules-audit-2026-10-10.md): current platform compared with 48 returned Notion pages and both older books; recovered procedures, historical corrections and remaining decisions. [Implementation status](implementation-status-2026-10-10.md) records delivered work and fresh regression checks. [Rules reconciliation](rules-reconciliation.md) retains the selected baseline and first-pass history.
3. [Book outlines](book-outlines.md): reader outcomes and chapter coverage for the PHB, GM guide and SRD.
4. Eight-page proof: [light PDF](../../output/pdf/swordweave-publication-proof.pdf) and [dark PDF](../../output/pdf/swordweave-publication-proof-dark.pdf), with the app fonts and gold/silver/teal materials.
5. [Responsive preview](../../output/publications/swordweave-publication-proof.html): self-contained HTML with light/dark and reading/page views. Open the file directly in a browser; no server is required. Its two PDF downloads use the adjacent output directory.
6. [Licensing and revenue, in plain language](licensing-and-revenue-options.md): product examples, permission boundaries and a staged monetization recommendation.

## Sources and reproducibility

- `proof-content.json` is the manuscript model for all three outputs.
- `current-guide-snapshot.json` captures all 15 current Rules Guide topics and their source revision.
- `rules-source-index-2026-10-10.json` records the second-pass platform, Notion and older-PDF source inventory, hashes and available snapshot metadata.
- `scripts/build-publication-proof.py` generates both PDF editions and the HTML reader and checks page count, bookmarks, text extraction, page fit and sample arithmetic.
- `output/publications/proof-verification.json` records output sizes, hashes and page-fit measurements.

Build with the Codex bundled Python runtime, which supplies ReportLab and pypdf. Font conversion uses system Python's fontTools/Brotli. All five publication fonts come from the app's repository assets: Unica One (titles), Oxanium (subheadings/decks), Aubrey (body), Syne (labels) and IBM Plex Mono (technical/footer text). The Syne variable font is instantiated at 600 for the PDFs. Review font and asset distribution permissions before a public release.

## Verification performed

- Each PDF edition has eight pages, eight bookmarks and selectable text; all used PDF fonts are embedded.
- All sixteen pages rendered and visually inspected; dense GM and creature-reference pages inspected at full page size.
- Sample budget and arithmetic checked; existing monster identity/art used without invented resolved stats.
- Responsive preview checked at desktop width 1280 and phone width 412; no horizontal overflow in either case.
- Phone light/dark and desktop reading/page controls checked. Aubrey body text and all five type roles verified in the browser. Mechanical rules use copper/orange in both themes.
- A temporary static preview server was used only for verification and stopped afterward.

The complete books are not written yet. The subsequent full-system audit recovered and compared both older PDFs from disk. Subsequent creator rulings settled rest/carryover, bias, targeting, slots, movement and continuous Extreme reach for the manuscripts. Damage-triggered Vitality upkeep remains explicitly deferred; full base definitions and final manuscript checks remain pending. Rule/default/example labels are now an editorial convention. Figma file access was verified read-only; the proof was built locally rather than adding frames to the Figma file.

## Material proof 0.2

The color authority is `src/app/arcane-materials.css`; the silver sheen comes from `src/app/fab-metal.css`, with typography from `src/app/layout.tsx`. Gradients are vector shading in the PDFs and CSS gradients in the reader. Gold bands have dark lettering in both themes; neutral content remains on themed teal/pale surfaces. Silver frames and teal-to-gold edge bands preserve the platform identity without putting long body text over reflective gold.

These PDFs are screen-oriented design proofs. Commercial print production will need printer-specific color/bleed specifications and a separate economical print treatment; neither current file is represented as a press-ready master.
