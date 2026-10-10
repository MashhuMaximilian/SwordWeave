# Core books release verification · 11 October 2026

Edition: **v0.1 alpha**. Three complete manuscripts, three responsive readers, six PDF editions and 30 public sample encounter preparations.

## Content and rules

- PHB: 42 pages per theme; player procedures, character construction, consequences, principal primitive families and complete worked records.
- GM Guide: 34 pages per theme; first session, rulings, creation review, creature construction, encounters, adventures and printable worksheets.
- SRD: 33 pages per theme; precise play and construction procedures and the 29 principal primitive families.
- The build asserts that the PHB/SRD base family reference and all three books' worked records remain identical.
- The worked character and creature use their separate progression formulas. Practice and saving throw examples apply the chosen attribute's proficiency exactly once. Items remain a separate BU ledger.
- Only the additional damage-triggered Vitality upkeep scheme remains explicitly pending, as requested by the creator. No threshold, excess handling or reset procedure was invented for it.

## PDF checks

- All light-edition pages rendered and inspected in contact sheets; tables, contents, examples, diagrams and representative dark pages inspected at larger size. The last typesetting adjustment keeps example titles with their opening text.
- Reopened all six files with pypdf and pdfplumber. Verified page counts, selectable text, valid bookmark destinations, section maps, embedded app fonts and no text outside page bounds or null glyphs.
- The 66 PHB, 59 GM Guide and 53 SRD heading destinations match their respective outlines. Linked contents and alphabetical topic indexes use the final page numbers.
- Final static website copies match the local deliverables and the SHA-256 hashes in `release-manifest.json`.
- Five app fonts are embedded; no proprietary Arial fallback is required. Instructional figures are original vectors, with app fonts embedded in the SVG editions too.

## Browser and implementation checks

- Production-mode Firefox at 320×740, 412×915, 768×1024, 915×412 and 1280×900: no outer horizontal overflow in the tested readers. Both themes checked on the narrow layouts.
- Desktop contents remain visible; mobile contents open and close with Escape. Searching “upkeep” returns eight PHB sections. Diagrams load and can scroll inside their own phone viewport.
- The six local HTTP PDF endpoints return 200, `application/pdf` and a valid PDF signature. These downloads do not depend on Cloudflare authentication.
- Homepage, Rules and Books hub contain book links and fit the phone viewport. Rules Guide “Source notes” disclaimers are replaced with actual book references. All 15 topic mappings and manuscript internal anchors resolve to existing headings.
- Scoped ESLint, TypeScript and the Next.js production build passed. `git diff --check` passed.
- Four public-art worker tests passed, including exact PDF allowlisting and denial of private/malformed keys. The R2 publication dry run validates all six final files.

## Public encounter preparations

See [sample encounter verification](../library/system-encounters-v0.1-alpha.md). The transactional seed inserted 30 public preparations and 30 collection memberships. A repeated apply created zero additional records. Anonymous access, pinned public dependencies, resolved Vitality and separate creature/item budgets passed for all 30. No runs or play copies were created.

## Delivery limits and next review

- PDFs are delivered as versioned static website files. The audited R2 upload under `documents/swordweave/v0.1-alpha/` is prepared but **not applied**: the Cloudflare authorization request timed out. Existing `images/*` objects are unchanged. Do not describe these PDFs as stored in R2 until upload and remote byte/hash checks succeed.
- These are complete **alpha digital editions**. They do not claim completed human playtests or commercial print/prepress certification.
- Next: table feedback, errata and the creator's single deferred upkeep ruling; renew Cloudflare authorization before transferring the PDFs to R2.
