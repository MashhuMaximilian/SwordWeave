# GM Guide publication · 21 October 2026

The founder identified the two supplied organic-edges PDFs as the current DMG. This publishes those unchanged files; it does not rebuild the book, repeat an editorial review, or replace the primary publication's artistic-review history.

## Pinned inputs

| Role | Original source | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Reading/default | `output/pdf/swordweave-game-masters-guide-v0.1-alpha-organic-edges-compressed.pdf` | 76,525,806 | `2e039d0193d87235cebdc693acc3dbc8adf685fb44bd34977a54f8581b1651c7` |
| Full resolution | `output/pdf/swordweave-game-masters-guide-v0.1-alpha-organic-edges.pdf` | 309,136,538 | `80ccaed3aa3fc40f4fd317ec54271fff88940bbb58468411ff317cdce6940f44` |

Sources remain read-only in `/Users/max/dev/SwordWeave`. Both reopen as 268 pages, 576 × 774 pt, with 117 link annotations and 15 top-level outline entries. Extracted page text matches between reading and full copies. Title metadata identifies the Game Master's Guide, v0.1 alpha; the cover says Interwoven edition. The public label distinguishes this **organic-edge revision**. The existing PDF Subject metadata says “Local review edition”; it is preserved with every other byte rather than silently edited.

The source `gm-organic-edges/preservation-checks.json` passes and pins these exact master/reading hashes. It confirms unchanged native operators/fonts, text/layout, links/bookmarks and original JPEG color data against its preceding baseline. The existing `visual-review-final.json` records its actual inspection scope, no known blockers and `creator_accepted=false`, explicitly not a fresh editorial reread. Today's publication instruction identifies the selected delivery; it does not rewrite that prior artistic-acceptance field. No new artwork or PDF generation occurred.

## Release flow

`gm-organic-release-manifest.json` pins both PDF hashes and both source-review record hashes. `scripts/publish-gm-organic.mjs` checks them before doing anything remote. It accepts exactly the two filenames and the versioned `documents/swordweave/v0.1-alpha/organic-2026-10-20/` prefix. Default mode is a dry run.

```sh
node scripts/publish-gm-organic.mjs --source-root /Users/max/dev/SwordWeave
node scripts/publish-gm-organic.mjs --source-root /Users/max/dev/SwordWeave --apply
node scripts/publish-gm-organic.mjs --source-root /Users/max/dev/SwordWeave --verify-existing
```

The script uploads only the two existing files, deploys the existing read-only facade with an exact two-file extension, then streams public bytes through SHA-256 without saving duplicate PDFs. It checks MIME, byte count and HEAD length. No bucket listing, uploads endpoint or private folder is opened; GET/HEAD-only behavior remains.

Stable application links are `/books/v0.1-alpha/game-masters-guide.pdf` and `/books/v0.1-alpha/game-masters-guide-full.pdf`. The earlier dark link retains its print-r2 target. Analytics uses `gm_organic`, `gm_organic_full` and `earlier_dark`, never reading/full = light/dark.

## Verification status

The dry run and 8 worker tests, 12 focused application tests and 24 discovery/Markdown tests pass; scoped application lint passes. Both R2 uploads completed. Worker activation initially hit local ENOSPC; after the parent removed only generated development cache, the worker-only retry succeeded. Worker version **158908f3-d5c5-41f2-b36f-d44b4c2ef952** is deployed.

At **13:18 Bucharest on 21 October**, streamed public downloads of both objects matched their complete pinned byte counts and SHA-256 hashes, with `application/pdf` and successful HEAD/length checks. No duplicate PDFs were written locally. Machine evidence is `output/publications/gm-organic-release/remote-verification.json`; command logs are `/tmp/swordweave-gm-organic-publication.log`, `/tmp/swordweave-gm-organic-worker-retry.log` and `/tmp/swordweave-gm-organic-remote-verify.log`.

- [Reading PDF](https://swordweave-public-art.ionmariusc97.workers.dev/documents/swordweave/v0.1-alpha/organic-2026-10-20/game-masters-guide.pdf)
- [Full-resolution PDF](https://swordweave-public-art.ionmariusc97.workers.dev/documents/swordweave/v0.1-alpha/organic-2026-10-20/game-masters-guide-full.pdf)

Independent public HEAD checks also retain the earlier GM dark PDF and current PHB at 200/PDF. An arbitrary draft and SRD under the new organic prefix return 404. This publication doesn't open extra revisions or folders.

The creator-kit source, README/fact sheet, llms index, stale “all light and dark” public copy and download metadata now describe PHB/GM current-alpha PDFs and the pending SRD revision. The kit still includes the exact two companion PDFs rather than duplicating large books. The parent owns the application build, Git push and canonical website verification; the versioned Cloudflare PDF objects are already publicly verified.

Online readers and their Markdown remain their existing text sources, which may differ from revised PDF editions. The SRD revision is still pending; this is not a synchronized final three-book set.
