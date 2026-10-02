# Lineage art integration

Thirty original lineage illustrations are available locally as `/images/lineages/<slug>-graphic-v1.webp`. Review them at `/lineage-art-review.html` on the local development site.

## Local display

`src/lib/heritage/lineage-art.ts` resolves presentation artwork using exact name, kind, and source origin. Six legacy curated identities retain their original `system` origin; eighteen main shelf entries use their exact v13 origin; six early bases use their exact v14 origin. Unrelated names, origins, and kinds do not receive guessed artwork. An explicit image URL always wins.

Library detail pages, shared entity previews (including character info previews), Atelier desktop composition previews, and mobile draft previews use this lookup. Existing image layout is retained. Atelier's URL input retains only its stored/user-entered value: derived local artwork is displayed without silently saving an undeployed path to the live database. Character lineage group cards remain unchanged; their full info previews show the art.

## Database attachment after deployment

`npx tsx scripts/attach-lineage-art-2026-10.ts` is a read-only dry run. It verifies all thirty local assets and exact public, system-owned database identities. The initial run found thirty pending attachments.

After asset deployment, `--apply` first fetches **every** artwork URL from `https://www.swordweave.quest`, requires a successful response, WebP MIME type, and RIFF/WEBP signature, and only then enters the database transaction. Existing explicit images are preserved; the write also rechecks identity and the original empty image value to avoid replacing a concurrently chosen image.

`imageUrl` is a preexisting presentation field excluded from heritage canonical content hashes. This pass does not change that contract: image attachment updates row presentation metadata without creating a mechanical content version or changing version snapshots. Old pinned mechanics are unchanged; their presentation may use the current curated fallback. No database image attachments or deployment were performed during local integration.

## Verification

- Exact whitelist, thirty unique paths, explicit override, and unrelated user/system identity rejection: three passing tests.
- Project TypeScript check passed.
- Database dry run verified all thirty identities and assets without writing.
- Browser visual review remains a local user/root check; automated lookup tests do not prove visual cropping or art quality.

## Item version audit correction

The saved item audit originally hashed JSONB snapshots directly. PostgreSQL reorders object keys, including primitive slot fields, while the content hash function stringifies canonical objects. The audit now rebuilds the canonical payload and explicitly restores primitive slot field order before hashing. It still verifies all saved recipe data and compares the actual version's canonical hash against the row hash; it does not discard version checks or normalize away differing ingredient values.
