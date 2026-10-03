# Library discovery and role art — local review

## Implemented locally

- Public Library and Codex share one discovery implementation. Filters update the URL without forcing a server navigation on each keystroke.
- Contextual filters cover type, market family, source, tier, BU range, all-required tags, author, publication date, popularity, forks, primitive base/expression, authored condition, recipient, mirrorability, changed result, and signed fixed numeric values.
- Sorts: name in both directions, BU in both directions, newest, likes, forks, and combined popularity. Stable name/ID tie breaks prevent unstable batch boundaries.
- Library, Atelier mechanics/heritages, and character library pickers render incremental result blocks, with measured spacers for offscreen blocks. Automatic loading has a manual fallback and retry state. Search is deferred/debounced and stale network requests are aborted.
- Removed the silent 500-row cutoff. Family ladders refresh when the category changes. Later batches preserve the viewer's likes and follow state. Flag counts are loaded in a batch instead of one request per card.
- Atelier uses the existing authorized local corpus, including authored entries. Save events now map raw rows before adding them to discovery results. Existing purchase, attach, version pin, mirror, and resolver mutation paths remain unchanged.
- Existing nonpaginated private collection and legacy inline primitive picker retain their authorized corpus. Version-history pagination is intentionally unchanged.

## Verification

- 39 focused tests pass: incremental merging/request keys, filters, scoped targets, stable ordering, classification, source labels, visibility/enrichment, flag batches, and viewer state.
- `npx tsc --noEmit` and `git diff --check` pass.
- Local browser: Physical + fixed numeric value at least 3 returns the +3/+5 attribute and Physical saving-throw entries in BU order. This caught and fixed an initial facet bug: attribute/practice scope values live in modifier metadata, rather than only in the generic target name.
- Browser incremental loading reached five result blocks, three measured spacers and two mounted blocks. Atelier search retained an unsaved author name after changing the search. The test draft was cleared without saving.
- Character-page browser verification remains incomplete: local compilation/navigation stalled. No character purchase or save was performed.
- Warm read-only query measurements before engagement hydration: approximately 408 ms for the next primitive chunk, 598 ms for items, 266 ms for lineages; first primitive query was 2322 ms including connection warmup. These are local observations, not a production performance guarantee. Server discovery still enriches the authorized corpus before slicing; very large catalogs will need further query/index work.

## Art review

The user approved the three full-canvas samples. All 78 role portraits now have the revised `*-graphic-v3` artwork in the local gallery and presentation mappings. See `heritage-role-art-revision-2026-10-03.md` for the complete revision and checks. Database attachment remains pending asset deployment.

## Release state

Local changes only. No deployment or database writes in this pass. Quick builder is a later task.
