# Filter presentation revision and artwork publishing status

## Local filter revision

- Shared Library and Atelier toolbar: compact Browse/Sort selections, Source/Tier, BU bounds, searchable rule families, and expandable mechanical, tag, and publication filters.
- Character workspace discovery controls use the same inset fields, gold labels, spacing, and expandable details.
- Drawer is 620px on desktop and full width on phones. Columns respond to the actual container width, avoiding the narrow three-column layout shown in the user's screenshots.
- Removed duplicate phone filter forms from the drawer. Filtering, infinite loading, query contracts, purchasing, and resolver mechanics remain unchanged.

## Verification

- TypeScript: `npx tsc --noEmit` passed.
- 22 tests passed across filter-library-items, discovery-ordering, infinite-library, and lineage-art.
- Scoped ESLint passed for the rewritten toolbar, phone adapter, sort control, and character discovery controls. Integration files retain existing effect/setState lint errors present before this revision.
- Browser: desktop drawer reviewed; searchable family list narrowed to Spatial Mobility when searching `mobility`; BU ascending selection accepted; clearing filters preserved sorting as intended.
- Phone: 390px drawer width, no horizontal overflow, single-column fields. Temporary viewport restored.
- Desktop screenshot: `output/filter-review/desktop.png` (local review output, not committed).
- Both gallery tabs are open and retained: `/lineage-art-review.html` and `/heritage-role-art-review.html`.

## Artwork upload remains incomplete

108 approved WebP portraits are available locally: 30 lineages and 78 role heritages. No database image references were changed in this pass.

The existing Vercel Blob store rejects upload using the available local OIDC credential: OIDC is enabled for this project, but not for the development environment. Pulling production environment variables and refreshing the project credential still issued a development token. Upload attempts failed. The store's access configuration was not changed.

Publishing requires a credential already authorized for the production store, or deploying the artwork files followed by the existing `scripts/attach-heritage-art-2026-10.ts` deployment gate. The redesigned filters have not been deployed.
