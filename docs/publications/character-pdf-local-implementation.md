# Local character PDF export / 23 October 2026

Status / 26 October: the previous export and guest Atelier work shipped to
main/production as `ef2ceb3f`; the static pack/gallery subsequently advanced
main to `ef3eccac`. The 26 October PDF refinements are recorded below.
Earlier pending-deployment statements in this historical record describe the
state before that release; current release receipts are kept with review evidence.

## Local refinement / 26 October 2026

- Practice annotations reuse the app's exact roll-marker projection: net
  advantage/disadvantage stacks, minimum/maximum result and conditional marks.
  Native vector symbols use the app's light emerald/red/amber palette in color
  editions and distinct shapes in monochrome. These never alter numeric totals.
- Domain names/references use bold body type and teal ink, with black emphasis
  in monochrome. Existing front layout and core text sizes are retained.
- Full authored scope now includes every character acquisition and item-bound
  ingredient. Each includes the complete mechanical text and all distinct
  verbose/narrative descriptions, with stable Pxx and Ixx.Pxx namespaces and
  pins preserved. Mechanical paragraphs use the app's `#904422` copper-orange
  and matching-weight body emphasis; monochrome retains the weight distinction.
- The front and advancement record include available BU, separate Item BU and
  debt used/available/max using the existing identity-drawer calculation.
- Folio/Folio-date writing fields were removed. The reminder rail is now
  “Active effects / end when”; it is a writing aid, not an additional rule.

Review PDFs and hash-bound verification live under
`output/pdf/character-pdf-oct26` and `output/publications/character-pdf-oct26`.
Canonical review reads used database READ ONLY transactions. Futoshi's pinned
definitions, behavior and character data were investigated without mutation;
the private investigation is kept in ignored local output, outside public
publication source.

The creator approved the connected v11 frames and commissioned local export.
The current implementation offers Download PDF and Print on character roster
cards and the character sheet identity drawer. It does not deploy this checkout.

## Player choices

Twelve styles: Aegis, Vesper, Orrery, Moire, Serein, Prism, Cipher, Helix,
Cinder, Nocturne, Tidal and Solstice. Each uses the approved frame and its own
interior card, heading and table grammar. Browser preferences remember style,
density, orientation, color and optional workbench. The picker shows all twelve styles
as a thumbnail grid. Desktop hover previews a style and clicking selects it;
the adjacent Portrait/Landscape and Automatic/Normal/Dense controls are the
actual export settings. Mobile tap opens a larger, zoomable preview with those
same controls. There are no duplicate layout/orientation fields below the
gallery; only the optional workbench and Download/Print actions remain. The shared preview controls include a Color PDF checkbox, off by default, with matching real previews for all twelve styles and four layouts.

Auto measures full rule height against the normal front's available regions;
players can also choose Normal or Dense. Signed attributes, practice training,
Tier 1–4, domains, range and output dice remain on the front. Every real
primitive acquisition retains a reference. Full rules continue at the same
physical text size, with repeated references. Supporting pages include the
compositions/effects, equipment and owned item rules, full authored primitive
scope, concept/heritages and story that the character actually has. Optional
blank workbench leaves support compositions and acquisitions during play.

Portrait is A4. Landscape is native A4 with two separately composed halves,
16 pt between engraved borders at the fold; cards, fields and text do not cross
it. The left half groups core values, owned access and all At the table choices;
the right half is dedicated to primitives/reusable effects, with two columns in both
normal and dense variants. Landscape is a new local review design. Physical pencil/print review is
pending printer access on Monday.

Download and Print use the same returned PDF bytes. Print prepares a viewer
from the initiating user gesture and asks that viewer to print when loaded;
browser PDF/print behavior varies, so the viewer's Print action remains
available. It never prints the website DOM.

## Data and access

POST `/api/characters/[id]/pdf` accepts presentation options only. The server
authorizes character access, reads the canonical pinned workspace and derived
sheet, then renders it. Anonymous public sheets follow existing publication
visibility; private/shared sheets require existing access. Personal notes are
limited to editors; private DM notes are excluded recursively. Export is read
only and response bytes are private/no-store. Malformed options, oversized
requests, busy renderer, cancellation and missing dependencies have safe errors.
Conflicting pinned definitions and mirrored rules remain distinct. Item-only
rules stay associated with items rather than becoming character purchases.

## Local runtime

The Next Node route invokes `scripts/render-character-pdf.py` without a shell.
Python 3 needs ReportLab, Pillow and pypdf; PDF verification additionally needs
pdfplumber and Poppler. For a reproducible local environment, install
`scripts/character_pdf/requirements.txt` into a virtual environment, then set
`SWORDWEAVE_PDF_PYTHON` to its absolute Python executable. Development can also
find the bundled Codex Python runtime on this computer.

Runtime dependencies include `scripts/character_pdf`, the preserved
`build-character-sheet-v6.py` through `v11.py` definitions, and
`assets/character-pdf`. The loader compiles definitions only; historical sample
builds do not run. Approved frames are grayscale plus unchanged alpha, at
native resolution. Aubrey, Syne, Unica One and Oxanium are compiled from the
existing app font files and embedded, with all four font notices attached.
`assets/character-pdf/manifest.json` records source and compiled hashes.
`prepare-character-pdf-assets.py` is the repeatable build tool; fontTools with
WOFF support is a build-time dependency only.

Authored Markdown is rendered with bounded headings, lists, emphasis, links,
quotes/code and compact table rows. Aubrey-derived bold/italic faces retain the
body metrics and use a distinct family name. Raw HTML is escaped. Character
portraits honor saved crop settings; the extended identity record includes the
full character and heritage artwork. Actual primitive/effect/capability/item
icons accompany their rules. The authorized media resolver produces bounded PNGs from project artwork, permitted private uploads and general public HTTPS raster URLs. Each external hop validates and pins public DNS addresses into TLS; private/reserved IPs, credentials, arbitrary SVG, excess bytes/pixels and excessive redirects are rejected. Existing private-upload authorization stays intact. Monochrome converts the artwork to gray; color preserves source RGB. No new artwork is generated. Source/author/license notices accompany used icons
and images in PDF attachments. A visible message reports actual missing artwork
without exposing source diagnostics.

The production package uses a native Vercel Python function, called only after
the Next route authorizes and resolves a canonical snapshot. The internal
request is signed, expires after two minutes, and retains bounded request/output
sizes, cancellation and a per-process concurrency guard. The server-side
`SWORDWEAVE_PDF_RENDER_SECRET` is required on the intended hosting environment.
Local development retains the subprocess renderer.

An isolated release export at `tmp/character-pdf-release` is reconciled with
`origin/main` at `bf5e5250aad693519de012cf3dba95eb3e837ac0`. It preserves the newer
account, CSS, discovery and publication work and contains only this feature's
changes. Do not deploy this older dirty root checkout. Hosting execution and
production deployment remains pending approval. No production deployment or R2 change
has been performed.

## Verification and review artifacts

Run the focused Vitest suites under `src/lib/character-pdf`, the API route, and
`character-pdf-actions.test.ts`, plus the Python tests under
`scripts/character_pdf`. The Python tests cover actual signed values, repeated
and conflicting pins, item graphs, long single rules, 80/120 primitive builds,
20 compositions, both orientations, writable fields and native body size.

`verify-character-pdf-runtime.py` reads closed PDF operators independently:
embedded grayscale/alpha bytes, crop rectangles, curved clipping paths,
mirrors/flips, image CTMs/native PPI, embedded app fonts, source text fragments,
actual glyph bounds, numeric values and fold clearance. Its report binds each
result to a final PDF hash. Final review PDFs and their manifests/overviews are
under `output/pdf/character-pdf-local` and
`output/publications/character-pdf-local`. All 24 style/orientation combinations
also receive full-page overview review, with normal front smoke coverage.


The current isolated release passes full TypeScript, 81 focused TypeScript tests,
30 native Python tests and frozen lockfile validation. The native Python source
allowlist retains 50 required files/assets (18.75 MB); the gallery contains 48
final previews (6.35 MB). Save/practice alignment has 144 actual-font front
cases across all styles, orientations, densities and signed/multi-digit values.

The four updated creator review PDFs are in `output/pdf/character-pdf-aligned`;
their manifests, reading renders, eight-page overviews and independent report
are in `output/publications/character-pdf-aligned`. They total 32 pages and pass
closed-file text, image/alpha, clip/transform, grayscale, font, value-cell and
fold checks. Minimum measured native image resolution is 366.24 PPI.
Superseded review PDFs and raster proofs were removed during the creator's
23 October cleanup. Their metadata remains; the approved v11 collection and
current corrected review PDFs are retained. Original frame/bridge artwork,
font sources and compiled runtime assets were hash-checked and preserved.

Actual local browser checks cover public exports, the signed-in owned roster,
the shared Futoshi roster and its identity-drawer picker. Shared export produced
a valid four-page PDF after the media changes. Desktop/mobile gallery evidence
is in `output/playwright/character-pdf-gallery`. Actual paper, pencil and fold
review remains pending printer access Monday; do not describe that as tested.

The reported "empty" Analytics QA download belonged to the separate small test
character. A direct export from Bartholomew's actual page produced a populated
nine-page Nocturne PDF, with his stats, rules, compositions and full story.
Prepared-PDF/request state is now keyed to character ID so a reused client
component cannot retain another character's ready download. Bartholomew's externally hosted portrait now passes the validated HTTPS loader and retains its full 450×900 source dimensions. A new canonical owner review contains all 21 actual primitive acquisitions, full current rules and the portrait; the historical pre-apply 8-primitive fixture is not a current character proof.

Cleanup receipts are under `output/maintenance/character-pdf-cleanup-2026-10-23`.
About 597 MB of obsolete proofs, duplicate release copies, temporary font-build
files, closed logs and three test downloads were removed. Current books,
approved v11 templates, current PDFs, source artwork, R2/iCloud, Git and running
development caches were preserved.

## Release follow-up

Save/practice alignment is implemented with measured adjacent labels and bounded,
centered value cells. The remaining review is physical printing, pencil updates,
landscape folding and native print-dialog behavior on the creator's browser.
After local approval, validate the isolated native Python package on hosting
and deploy the reviewed release. The itch.io addition is separately proposed in
`docs/marketing/character-sheet-itch-pack.md`; it has not been uploaded.

## Color review / guest Atelier wave

The optional color edition uses gold relief, teal inlays, silver/ivory highlights,
dark-teal body text and pale writable panels throughout all twelve styles. It
recolors the approved full-resolution frame pixels with their alpha unchanged;
no AI image generation or replacement frame artwork was needed. Large display
text uses a native dark-gold sweep. Default monochrome remains unchanged.
The gallery now has 96 real preview images: 48 monochrome and 48 color.

Final color reviews are Orren Aegis portrait and Aster Vesper foldable landscape
in `output/pdf/character-pdf-color`. Their manifests, all-page overviews, reading
renders and independent preflight are in `output/publications/character-pdf-color`.
The two color PDFs total 16 pages, remain below 3.1 MB each, and pass actual
embedded RGB/alpha, crop, transform, text, font, numeric and fold checks. Minimum
measured native image resolution is 366.24 PPI. Four additional color tests
cover every source frame, RGB preservation, contrast, exact geometry and
byte-identical implicit/explicit monochrome output.

The creator chose anonymous Atelier experiments with sign-in at Save. The local
implementation preserves bounded, versioned drafts in tab storage through the
sign-in redirect; it never saves or publishes automatically. Public catalog
graphs are visibility-pruned before serialization, historical payload merging
is blocked for guests, and monster calculations/shuffling use the same pure
resolver against available public pieces. APIs and private data remain protected.
Browser validation and preview hosting evidence are recorded separately; do not
claim a production release or a physical print proof from local tests.

Final combined wave verification: 164 focused TypeScript tests, full staged
TypeScript and 34 Python/HTTP/color tests pass on the latest-main release export.
The three current closed PDFs total 25 pages and pass the independent preflight.
The external-portrait proof uses Bartholomew's current authorized owner snapshot,
not the historical roster fixture. Desktop color-picker screenshot:
`output/playwright/character-pdf-color/desktop-picker.png`.

Guest browser checks cover valid-draft Save/upload interception without API POSTs,
independent main/secondary draft reloads, return from the sign-in route with both
drafts restored, mobile local monster shuffle/preview, and dialog focus recovery.
The test did not complete a new account login or create an account.

Removed only the obsolete duplicate release export after source/hash comparison,
freeing another 59,445,091 bytes. The source upload audit excludes tmp, output,
environment files, account test state, dependencies and local deployment metadata.

Hosting packaging correction: Vercel rejected nested requirements-file resolution
on the first preview build. Root `requirements.txt` now declares the same three
exact runtime pins explicitly; a comparison against the local runtime file
passes. See the [official Python runtime documentation](https://vercel.com/docs/functions/runtimes/python).
No runtime package versions or artwork changed for this repair.

Preview build is READY at
https://sword-weave-ln2by9l0m-mashus-projects-3b3cfec0.vercel.app
(deployment `dpl_3VPXHqSGem33kwNWFviqvbVp2Gmp`). The build compiled the
latest-main application, type checked and packaged the native Python function.
It retains the project's existing Vercel authentication protection. A browser
request to the public Orren sheet reaches “Log in to Vercel”; hosted export
and guest checks await a trusted Vercel session. No protection was disabled
and no production deployment was made. Evidence is under
`output/playwright/hosted-character-pdf/`.


## Compactness and table-use refinement / 23 October, evening

All twelve designs and both ink editions now share the tighter header geometry.
Removed repeated display headings; moved practice/access legends beside section
labels. Auto still measures actual full text at native body size. First-page
reading order is narrative-only primitives, other active rules, conditional
modifiers, then unconditional modifiers. Original P references never change.
Effects now name matching P/E ingredients, including item-owned Ixx.Pxx rules;
pins, mirrored rules and separate item ownership remain distinct.

The front and equipment totals now print canonical equipped-slot usage and Load
on writable lines. Full movement names include Walk, Climb, Swim, Burrow and
Flight, with current derived values. Character/concept and heritage images are
100 × 104 pt in the full record, backed by up to 512-pixel approved source art.
The media byte budget remains bounded; source images are never upscaled.

Both landscape densities use two primitive columns. Halves are 12 pt closer,
with 16 pt of protected fold clearance; content never crosses it. All 96 actual
front previews were regenerated from the same renderer and public Orren source.

Four current review PDFs live in `output/pdf/character-pdf-refined`, with
manifests, reading renders, all-page overviews and hash-bound preflight under
`output/publications/character-pdf-refined`. All 32 pages pass independent
closed-file text, font, color/gray, image/alpha, bounds, totals and fold checks.
Minimum native image resolution is 366.24 PPI. The 38 Python layout/transport
tests, 198 focused TypeScript tests, full staged TypeScript, scoped ESLint and
frozen root/stage pnpm locks pass. Actual paper, pencil and fold proof remains
pending; the four PDFs include the optional workbench for review.

The original preview's internal Python POST was blocked with HTTP 401 by
Vercel Deployment Protection. The runtime now reads Vercel's platform workload
identity through exact `@vercel/oidc` 3.8.5 per invocation and sends it only to
the validated immutable same-deployment renderer. HMAC signing, response limits,
cancellation and authorization remain in place. Existing configured automation
identity, then a strictly same-origin preview protection cookie, are fallbacks.
It never takes an OIDC token from the client. No credentials or protection
settings were created or changed. Official references are recorded in
`/private/tmp/swordweave-character-pdf-hosted-transport-fix.json`.

The refinement preview build is READY at
https://sword-weave-iy39nyeti-mashus-projects-3b3cfec0.vercel.app
(`dpl_5tb8Av38L3SkRAbqsCyo9ABmrYSF`), with Vercel authentication still enabled.
Browser control disconnected immediately before the final download retry:
Codex inventory reports no available browser and a closed transport. The creator
was asked to reopen the preview; no hosted-download success is claimed yet.
The deployment and verification receipt is
`output/publications/character-pdf-refined/release-review.json`. No production
promotion, R2 migration or itch.io replacement was performed in this wave.

Evening storage follow-up: removed 1,038,864,068 generated bytes in total. The managed Next server was stopped before its unopened Turbopack cache was cleared after disk exhaustion; source/PDF hashes were preserved. No Git, iCloud or R2 deletion was attempted.
