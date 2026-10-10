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
Cloudflare/Wrangler authentication is currently unavailable on this host; the
transfer has **not** been applied. Existing portrait URLs keep working from the
static deployment until the R2 transfer is verified.

The read-only Worker source now permits `art/monsters/*.webp` and `.png` alongside
the established catalog roots. Run `node scripts/migrate-monster-public-art.mjs`
for its local checksum dry run (100 new portraits plus 5 established portraits).
After signing into the existing Cloudflare account, use `--apply` to deploy the
Worker, upload to `swordweave-public-art`, verify every object's bytes/MIME through
the Worker, and update `data/public-art-catalog.json`. Then add the
`/art/monsters/:path*` redirect, exclude `public/art/monsters/` from Git/Vercel,
verify the complete catalog and publish. Never remove the static copies from the
deployment before the remote verification succeeds.
