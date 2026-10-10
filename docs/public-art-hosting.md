# Public artwork hosting

Updated 2026-10-04. The public catalog lives in the Standard R2 bucket
`swordweave-public-art`. A dedicated read-only Worker serves it at
`https://swordweave-public-art.ionmariusc97.workers.dev`.

## Migration evidence

- 381 catalog objects (567.96 MiB), including source PNG and optimized WebP,
  uploaded without changing their keys. Every object's byte count, SHA-256 and
  content type verified by `node scripts/verify-public-art.mjs` (381/381).
- Production audit of 56 tables found 117 distinct references in the catalog
  roots, all included. No production database rewrite or heritage pin changes.
- The application retains `/images/{characters,lineages,heritages}/...` paths.
  Production redirects these paths to the Worker. Override the origin with
  `SW_PUBLIC_ART_ORIGIN` when attaching a custom domain later.
- Local originals and `public/heritage-art-review.html` remain on this computer.
  A fresh checkout can restore originals from commit
  `4fa016af4aa9d8e26a11fa059cbe56c503dfcc32`, or retrieve the R2 objects using
  the paths/checksums in `data/public-art-catalog.json`.
- Catalog folders are ignored by Git and Vercel. New deployments no longer
  include this artwork. Private uploads remain on the authenticated Blob proxy;
  game icon provenance and transformations retain their existing API.

## Worker

Source and configuration: `infrastructure/public-art/`. The `ART` binding points
only to this public-art bucket. It supports GET/HEAD, ETag revalidation, MIME
headers, public image CORS, and 24-hour browser caching. It exposes no listing,
write endpoints, or private upload store. The bucket's own public URL is disabled.

The domain is not on Cloudflare DNS, so the user chose a workers.dev endpoint.
No DNS changes or paid plan upgrades were made. Workers Free currently permits
100,000 requests/day; R2 has separate free storage and operation allowances.
Browser caching reduces repeated requests; an edge cache is not assumed for this
initial workers.dev implementation. Review usage before traffic approaches that
Worker limit. Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Future artwork

1. Export optimized WebP for application use; use a new versioned filename when
   changing art so existing saved portraits remain stable.
2. Upload the public files to the same R2 keys with correct image content types.
   Preserve source originals separately/in R2; keep private uploads separate.
3. Add keys, sizes and SHA-256 hashes to `data/public-art-catalog.json`.
4. Run the verifier before publishing references to the new files.
5. Deploy Worker changes through the Cloudflare editor or Wrangler using the
   checked-in configuration. Tests: `node --test infrastructure/public-art/worker.test.mjs`.

## Vercel storage

Removing artwork reduces output per future deployment. Retained releases remain
stored separately; deleting obsolete READY deployments preserves Vercel's 30-day
recovery window. Keep the current live release and the previous release for
rollback. Storage is measured in GB-months using daily maximums, so the dashboard
may not immediately reflect cleanup. [Deployment storage](https://vercel.com/docs/deployment-storage),
[retention](https://vercel.com/docs/deployment-retention).

## Monster portraits — 2026-10-10 follow-up

The 100 new system portraits were initially shipped as Vercel static WebP assets,
not R2 objects. Their originals remain in `output/monster-art-2026-10/`.
All 105 optimized WebP portraits (100 new and 5 established) are now uploaded to
`swordweave-public-art/images/monsters/`, alongside the existing image folders.
Total bytes: 35,004,554. Every portrait passed byte count, SHA-256 and MIME checks
through the read-only Worker with `--verify-existing`. Uploads and Worker deployment
used the signed-in Cloudflare dashboard; no new API token or OAuth grant was needed.
Worker version `fc8d02e2` permits the monsters root while retaining the existing
GET/HEAD-only access and folder allowlist.

Existing `/art/monsters/:path*` URLs redirect to the Worker's `/images/monsters/:path*`
objects. `/images/monsters/:path*` URLs are supported too. Saved references and database
pins remain unchanged. Local optimized portraits and originals are preserved, while
the optimized folder is excluded from future Git/Vercel deployments. All object
keys/checksums are recorded in `data/public-art-catalog.json`.
The complete catalog audit passed after the Worker update: 486/486 objects,
including all 381 previous objects, with no checksum or content-type failures.

Run `node scripts/migrate-monster-public-art.mjs` for the local checksum dry run,
`--verify-existing` to verify dashboard uploads and update the catalog, or `--apply`
for an authenticated Wrangler deployment/upload followed by verification.
