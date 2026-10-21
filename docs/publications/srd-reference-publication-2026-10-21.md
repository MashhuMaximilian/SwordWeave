# SRD Reference publication · 21 October 2026

The founder explicitly identified the supplied SRD as ready and asked to put it on the website. This release publishes that exact existing PDF. No book, source artwork or primary-checkout file was edited or rebuilt.

## Selected source and existing checks

- Original source, read-only: `/Users/max/dev/SwordWeave/output/pdf/swordweave-system-reference-document-v0.1-alpha-reference-edition.pdf`.
- **14,522,400 bytes**, SHA-256 **f356c7bd603812781954a6fabe5cedff792f3f6ca97c446c81cc54425bca39a1**.
- Reopens as **78 pages**, 576 × 774 pt PDF media boxes, with **163 link annotations**. Title metadata identifies SwordWeave / System Reference Document / v0.1 alpha. The cover identifies a standalone reference dated 21 October 2026. No metadata was rewritten.

The existing `output/publications/srd-reference-edition/verification.json` is PASS and pins this exact PDF: 1,267 original source units, 479 included blocks, 315 complete table rows, 163 links and 152 outline destinations. The existing visual record covers all 78 pages and 38 facing pairs, with reading-size table/art inspection, no unresolved layout defects and two final changed pages reinspected. Both records explicitly distinguish technical/agent inspection from creator acceptance. Today's direct publication request selects the release; it does not rewrite those historical records or imply a fresh editorial reread.

`srd-reference-release-manifest.json` pins the PDF, byte count, exact one-file R2 key, founder instruction and both source-review record hashes. The publisher rejects changed inputs or a different file/key.

## Publication and remote proof

```sh
node scripts/publish-srd-reference.mjs --source-root /Users/max/dev/SwordWeave
node scripts/publish-srd-reference.mjs --source-root /Users/max/dev/SwordWeave --apply
node scripts/publish-srd-reference.mjs --source-root /Users/max/dev/SwordWeave --verify-existing
```

Default mode is a dry run. Apply uploads only the unchanged source to `documents/swordweave/v0.1-alpha/reference-2026-10-21/srd.pdf`, then deploys the existing GET/HEAD-only asset facade. The worker extends its allowlist by that exact key; it exposes no sibling drafts, new private folders, listing or write endpoints.

Worker version **1eaa1d47-b2a8-4766-89c3-880b97c8a29f** deployed successfully. At **13:55 Bucharest**, the [public SRD PDF](https://swordweave-public-art.ionmariusc97.workers.dev/documents/swordweave/v0.1-alpha/reference-2026-10-21/srd.pdf) was streamed through SHA-256 and matched all **14,522,400 bytes** exactly, with `application/pdf`, HEAD 200 and the expected Content-Length. No duplicate PDF was saved locally.

Evidence: `output/publications/srd-reference-release/remote-verification.json`; command log `/tmp/swordweave-srd-reference-publication.log`. Independent public HEAD checks retain the earlier SRD dark PDF and current organic GM Guide at 200/PDF. `srd-full.pdf` and `draft.pdf` under the new reference prefix return 404.

## Website and creator kit handoff

The stable `/books/v0.1-alpha/srd.pdf` route now targets the new versioned object in application configuration. Its download is **Reference PDF (14.5 MB)**, with **78 pages · Reference edition** detail; the previous dark file remains **Earlier dark PDF** at its existing object. Analytics uses `srd_reference` or `earlier_dark`, preserving the existing consent gate and closed event parameters.

The llms index, press source/README/fact sheet, Books/home copy, book-search description and Rules first-session preparation now describe the available standalone Reference edition. Online-reader/Markdown text may differ from revised PDFs; this publication is not a synchronized final three-book rules audit. The existing deferred incoming-damage extra-upkeep notice is unchanged.

The creator kit was rebuilt twice identically: **20 entries**, **3,255,537 bytes**, SHA-256 **ce3a499709122c411f22fc099a6f6afae644496c898978fee624cd7a09ee34fb**. Every archive entry matches its checked source. Both latest original companion PDFs and their previews remain unchanged, as do all image-asset hashes. The kit links to complete books rather than duplicating large book PDFs. Proof: `output/publications/srd-reference-release/kit-verification.json`.

## Validation and scope

- **9 worker tests** pass, including exact-key read/HEAD, sibling/malformed exclusion and unchanged write denial.
- **14 focused publication/analytics tests** pass for stable redirects, current/earlier edition display and the closed event contract.
- **28 Rules/discovery/Markdown tests** pass, including the retained online-reader/PDF qualification.
- Scoped ESLint and `git diff --check` pass.

The publication subtask verified the versioned Cloudflare PDF; the parent then pushed application commit `40a0536ce1c549e0b524e7a271fd034b5a88e16e` to `origin/main`. Vercel deployment `dpl_7WJFLEBcMTcP1dVHGBFebNk8oWeC` reached **Ready**, including compilation, TypeScript and static generation. No local app server was started.

At **11:05:26 UTC**, the canonical Books, SRD reader, Press, llms and Rules Markdown destinations returned 200 with current Reference-edition wording. The stable `/books/v0.1-alpha/srd.pdf` route returned 307 to the exact selected object; the complete followed GET matched the source bytes, hash and PDF MIME. The live kit matched its current hash and byte count above. Receipt: `output/marketing/srd-live-2026-10-21.json`. Browser disconnection prevented a new post-release visual screenshot; the recorded checks are HTTP/content/integrity proof.
