# SwordWeave core publications — v0.1 alpha

The three complete alpha manuscripts, responsive readers and six PDF editions are prepared for the 11 October 2026 release. The approved platform fonts, metallic gold/silver/teal materials and separate light/dark PDFs are used throughout. The historical eight-page proof remains a design record, not the current books.

## Read and download

- Player's Handbook: `/books/players-handbook` — all player procedures, DIY construction, consequences, base family reference and complete worked records.
- Game Master's Guide: `/books/game-masters-guide` — first-session situation, adjudication, creation review, shared rounds, creatures, encounters, adventures and worksheets.
- System Reference Document: `/books/srd` — the open rules and construction reference, all 29 principal primitive families and checked examples.
- Book hub and all PDF editions: `/books`.
- Versioned PDF delivery: `/books/v0.1-alpha/{players-handbook,game-masters-guide,srd}[-dark].pdf`.

Only **damage-triggered additional Vitality upkeep**, including threshold/counter/reset/excess handling, remains explicitly undecided. The creator requested completion with this placeholder. Ordinary agreed mechanical, restrictive and narrative upkeep remains usable. No second unresolved procedure is presented as settled.

## Authoritative source and reproducibility

The three files under `manuscripts/` are the book sources. `scripts/build-books.py` parses their small Markdown grammar, generates accessible vector figures and reader JSON, and typesets both themes using ReportLab. It verifies shared family/record text against cross-book drift. `release-manifest.json` records PDF bytes, hashes, page counts and section-page maps. The website renders text through React, without injecting manuscript HTML.

Python dependencies: ReportLab, pypdf; font conversion requires fontTools/Brotli. The current build uses the bundled Codex PDF runtime. Five app fonts are embedded: Unica One, Aubrey, Syne, Oxanium and IBM Plex Mono. In PDF prose the few unsupported mathematical/arrows symbols are written as words; the vector diagrams retain drawn arrows. Font metadata records the SIL OFL notices for the app fonts. Original vector diagrams use no external monster art or maps.

The PDFs include linked contents, hierarchical bookmarks, an alphabetical topic index with page numbers, metadata, selectable text, repeated table headers and page numbers. These are digital/table-use editions; commercial press specifications and print sales remain a future phase.

## Storage and publication

The versioned PDFs are included as static website files so every download works without another service's login. Preferred R2 publication is prepared in `scripts/publish-books.mjs`, dry-run first, using the existing `swordweave-public-art` bucket under `documents/swordweave/v0.1-alpha/`. The readonly worker permits only the six named PDF files; `images/*` remains unchanged. R2 upload requires renewed Cloudflare authorization; do not label site-served files as uploaded to R2.

Run `node scripts/publish-books.mjs` for the audited dry run. After authentication, `node scripts/publish-books.mjs --apply` uploads the six PDFs, deploys the existing readonly worker and verifies every remote byte/hash/MIME before any download redirects are enabled.

## Release evidence and next review

See `release-verification-2026-10-11.md` for the actual checks and remaining limits. Source history, Notion/older-PDF comparisons and creator decisions remain in `full-rules-audit-2026-10-10.md`, `rules-source-index-2026-10-10.json` and `creator-rulings-2026-10-10.md`. These research records are not front-facing source-note disclaimers.

The 30 original public sample preparations and repeat-seed validation are documented in `../library/system-encounters-v0.1-alpha.md`. No encounter runs or monster play copies were created for the public examples.

Follow up with real table feedback and the single deferred upkeep ruling. No completed human playtest is claimed by this release.
