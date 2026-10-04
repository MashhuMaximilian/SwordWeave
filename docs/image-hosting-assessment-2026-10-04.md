# Image hosting decision — 4 October 2026

## Recommendation

Keep the application on Vercel. For a growing public artwork catalog, use **Cloudflare R2 with a custom asset domain and pre-sized WebP files**. Keep private user uploads separate and preserve their access rules. Cloudflare Images is optional; the existing pre-generated artwork does not need a paid transformation service.

A smaller immediate option is to keep the optimized catalog on Vercel and exclude verified-unused original PNGs from future deployments, retaining originals in an archive. Image traffic currently leaves ample headroom. The resource already over its allowance is retained deployment storage, so moving originals out of the deployment bundle and reviewing retention would help even without a CDN migration.

This is a proposal. No hosting settings, retention, assets, accounts or paid plans have been changed.

## Your current Vercel account

Read from the open dashboard for **Mashu’s projects, Hobby** on 4 October. These are team totals, including other projects; they are not SwordWeave-only usage.

| Resource | Observed usage | Included allowance | Interpretation |
| --- | ---: | ---: | --- |
| Retained deployment storage | 10.71 GB | 10 GB | Already above the dashboard allowance |
| Fast Data Transfer | 2.2 GB | 100 GB | About 2.2% used |
| Fast Origin Transfer | 2.48 GB | 10 GB | About 24.8% used |
| Blob storage | 140.37 MB | 1 GB | About 14% used |
| Blob transfer | 1.83 MB | 10 GB | Very little current use |
| Fluid active CPU | 1 h 37 m | 4 h | About 40% used |
| Function invocations | 71,000 | 1,000,000 | About 7.1% used |
| CDN requests | 63,000 | — | Dashboard observation |

The usage page covered 4 September–4 October. The team overview showed instantaneous deployment storage at 10.71 GB, while the period usage overview displayed 0 B for that metric. They are different dashboard readings; the discrepancy was not resolved, so the 0 B period figure should not be treated as evidence that retained storage is empty. The overview also showed Sandbox active CPU at 5 h 42 m against 5 h; that is a separate resource from the app’s Fluid CPU.

Vercel documents a 10 GB Hobby deployment-storage cap and retention changes intended to free storage. [Deployment retention announcement](https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage).

## What SwordWeave currently ships

The tracked `public/images` directory contains 381 files totaling approximately **568 MiB**:

- PNGs: **528 MiB**.
- WebP: **39.9 MiB**.

Those files are part of application deployments. The figures are filesystem sizes, not billed usage, and do not predict Vercel’s deployment deduplication or compression. Before excluding originals, check source, database and local art-gallery references. They have not all been proved unused.

Catalog portraits use static public paths. User image uploads already use private Vercel Blob and an authenticated application proxy. Game icons are fetched and transformed by `/api/icons/game/...`, with immutable one-year caching keyed by the full versioned URL; they are not all pre-bundled local SVG files. Cache misses can consume function work and origin transfer.

There is a separate access issue to resolve during any upload redesign: the current private-upload proxy requires sign-in. An anonymous public-character visitor may therefore be unable to view a user-uploaded portrait, even though static catalog portraits are public. A public-image publishing path must explicitly distinguish public assets from private uploads; making the entire upload store public would not be an appropriate shortcut.

## Options

| Approach | Strength | Trade-off |
| --- | --- | --- |
| Vercel static optimized artwork | Simplest; existing URLs and CDN work | Artwork is shipped with deployments; contributes to deployment size and app CDN traffic |
| Vercel Blob | Existing upload integration; public files can be delivered directly | Smaller free storage allowance, separate transfer/operations limits; private proxy also uses application resources |
| Cloudflare R2 | Catalog is independent of deployments; larger free storage allowance; free egress | Requires bucket, custom-domain caching, upload integration and deliberate public/private separation |
| Cloudflare Images | Managed image delivery and transformations | Hosted Images requires a paid plan; likely unnecessary for the current pre-sized artwork |

Vercel Blob Hobby includes 1 GB average monthly storage, 10 GB Blob transfer, 10,000 simple operations and 2,000 advanced operations. Public Blob URLs deliver directly; private proxy delivery also uses application transfer. Hobby access can become unavailable when limits are exceeded. [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing).

R2 Standard includes 10 GB-month storage, one million Class A operations and ten million Class B operations monthly. Egress is free. Above the free tier, Standard storage is $0.015/GB-month, with operation charges. These are R2 allowances; extra Cloudflare products have their own prices. [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Cloudflare’s external-image transformation free tier includes 5,000 unique transformations monthly; storing images in Cloudflare Images requires the paid plan. Serving already-sized WebP from R2 avoids that transformation dependency. [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/).

## Proposed migration if you choose R2

1. Audit which PNG originals are actually required by live pages, database rows and local review files.
2. Archive source art outside the deployment bundle; retain exportable originals.
3. Upload optimized public catalog variants to R2 with stable, versioned keys and cache headers.
4. Add a custom asset domain; switch public catalog paths through one asset configuration.
5. Validate anonymous public portraits, authenticated private portraits, old saved URLs, icon provenance, both themes and mobile layouts before switching fully.
6. Preserve old paths during the transition. Do not rewrite character heritage pins as part of an image migration.

**Decision to make:** keep Vercel with a slimmer deployment bundle now, or adopt R2 for the public artwork catalog. I recommend R2 for the long-term catalog and a deliberate separate policy for private uploads.
