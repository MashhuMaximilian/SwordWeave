# Session continuity, collections and monsters — rollout and storage audit

Implemented 2026-10-05. The detailed working plan and account-specific reports live in ignored `.local-plans/`; they must not be deployed or committed.

## Service boundaries and verified allowance

Keep Vercel for the app/authenticated APIs, Neon for relational content and compact state, Cloudflare for catalog artwork, and Clerk for account identity. The existing Vercel `fra1` / nearby Neon arrangement remains unchanged.

Dashboard checks on 2026-10-05:

| Service | Observed allowance / usage | Interpretation |
| --- | --- | --- |
| Neon, Vercel-managed Free installation | **1 GB per project**, 100 CU-hours per project, compute up to 2 CU / 8 GB RAM, maximum 100 projects | Verified on Vercel integration Settings, not inferred from Neon’s standalone pricing. |
| Neon project | 63.39 MB project storage, 3.27 MB restore history; 13.22 CU-hours, 926.36 MB network | Project storage and restore history differ from SQL database relation sizes. |
| SQL database | About 26.7 MiB including indexes after additive migrations | Read-only `pg_database_size`; tables/indexes and sampled row sizes are reported separately. |
| Vercel project, Sep 5–Oct 5 window | 62,336 / 1M function invocations; 42,749 / 1M CDN requests; 422.76 MB / 100 GB fast transfer; 442.99 MB / 10 GB origin transfer | Window counters, not stored database bytes. |
| Vercel compute/build | Active CPU 1h 6m / 4h; provisioned memory 9.8 / 360 GB-hours; build time 5h / 100h | Keep background API activity and builds bounded as well as stored bytes. |
| Vercel Blob | Window storage metric 140.37 MB / 1 GB; zero shown transfer/operations. CLI current linked **private** `game-icons-sw` store: 2 files, 785.53 KB; dashboard current size 804 kB | Both objects are under one user-upload owner folder, in `fra1`. No further Blob migration or deletion was performed; existing URLs and access checks are preserved. Billing/window metrics differ from current objects. |
| Vercel deployment storage | Project panel showed 0 B / 10 GB | Does **not** establish total team deployment usage. Prior complete team measurement was 10.71 GB; never claim cleanup from this project panel alone. |
| Cloudflare R2 Standard | 595.56 MB; 396 Class A / 673 Class B operations | Catalog bucket is delivered through the existing Worker. Public bucket access remains disabled. |
| Clerk | Hobby; 3 total users, one weekly active/retained user shown | Identity counters and database storage are separate. Current official Hobby allowance is 50,000 monthly retained users; recheck account billing as pricing evolves. |

General Cloudflare free allowances observed in official documentation: 10 GB-month R2 Standard, 1M Class A / 10M Class B requests; Workers Free 100,000 requests/day and 10 ms CPU/request. These are service allowances, not promises about this account’s future billing. No paid upgrade was enabled. Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Clerk plan change](https://clerk.com/changelog/2026-02-05-new-plans-more-value).

## Storage model and references

Current composition junctions already store references and relationship metadata. Expanded API objects were frequently mistaken for stored duplication. New published snapshots use canonical rows/relationship settings and exact dependency pins; forks reuse dependencies and artwork. Monster versions store compact pins, with frozen data only for truly unversioned dependencies. Play copies reference an immutable template version rather than duplicating its definition.

Historical FULL/DELTA formats, content-addressed IDs and snapshot payloads remain intact. New compatible readers respect explicit pins even when a version is marked latest. Returning to historical content changes latest flags; it never rewrites historical payloads. Gameplay state has a separate current-state table and cannot create authored versions. Identical authoring saves reuse the existing version.

Bookmarks, memberships, followed collections and source associations are references. Entries keep their own visibility; a public parent collection cannot disclose private entries, names or hidden counts. Source selection does not change authorship or fork provenance.

### 1,000-user benchmark

Per user: 10 characters, 50 primitives, 30 capabilities, 30 effects, 10 of each heritage type, 30 items. The report extrapolates measured row sizes and observed relationship density. It includes projected indexes (fixed pages separated from per-entry growth), 5 KiB current state per character, an allowance for new feature indexes, and a 25% reserve.

The initial model estimated approximately **1.01 GB / 1.65 GB / 2.28 GB** for **1 / 3 / 5 versions per entry**, respectively. Re-run the report for current numbers. This heavy scenario is close to or above the verified 1 GB allowance; it is not a claim that 1,000 users fit on Free. It excludes media, provider restore history, unlimited logs and arbitrary increases in authored description sizes. Sparse-table estimates and PostgreSQL row-count statistics introduce uncertainty.

### Monthly report

Run with a private local environment file; never commit credentials or raw private records:

```sh
pnpm usage:report --env /absolute/path/to/private.env --db-allowance-bytes 1000000000 --out .local-plans/usage-report.json
```

Use 1,000,000,000 bytes as a conservative threshold for the dashboard’s “1 GB” label until its byte definition is confirmed. The script reports table/index sizes, sampled row sizes, benchmark scenarios and review/action status. `--blob` additionally inventories object counts/bytes by broad pathname class when a valid Blob read-write token is available; it never prints object URLs or payloads.

Review at 50% of the verified allowance and take action before 75%. Recheck all four dashboards monthly, including Neon restore history/branches and Vercel’s team deployment total. No automatic deletions or background paid upgrades are scheduled. Historical payload archival to protected R2 remains a separate proposal.

## Request audit and changes

- A coordinated session client owns reads/writes for each open subject, merges tab queues, refreshes on focus/reconnect, backs off idle, and pauses network work while hidden. Component toggles do not each start polling.
- Compact absolute field mutations are capped at 64 changes / 128 KiB; state is capped at 1 MiB. Offline queues and downloaded backups stay on the device. Unchanged mutations do not increment revisions.
- Existing play-state reads now select the current row without issuing an insert on every poll. First-use initialization remains race safe.
- Current state retains field-revision tombstones. Expiring 30-day receipts cannot make an old changed-field mutation run twice. Expired receipts are removed for the affected subject when it next mutates. Inactive subjects can retain expired rows; a future maintenance job may delete only these explicitly disposable receipts.
- Workspace commands are **not** expired: they contain saved drafts, undo state and sharing roles.
- Workspace graph reads batch a frontier by kind, reuse loaded nodes within a request, propagate exact inherited version pins, prune obsolete dependencies, and bound traversal with cycle/convergence checks. A nested heritage/capability/primitive fixture requires three loader frontiers, with shared nodes loaded once; loader-frontier counts are not raw SQL query counts.
- Lists and bookmark status use bounded pages/batches; complete previews load on demand. Ordinary Library browse first loads metadata, then hydrates at most 100 selected entries. A 1,200-row regression fixture uses two entity SQL reads (metadata plus the two-row selected page); author/engagement queries are separate. Both ordinary and derived browse paths enforce a 5,000-candidate request budget with an explicit error rather than truncation. Read-only production comparisons preserved totals and order for all 1,008 existing entries, 561 primitives and 114 capabilities under Likes/Recent/Alphabetical sorting. Legacy complete-catalog callers remain compatible and should be measured separately from ordinary browse requests. Computed BU/search/facet paths require transitive calculation; they must reject excessive candidate graphs rather than silently truncate results.
- Private/follower responses use permission checks and are excluded from shared public caches. Public source GETs redact inaccessible expanded children. Engagement lookups cannot reveal private target counts.
- Blob artwork delivery validates actual attached artwork, including historical pinned-version artwork, against owner/follower/public/direct-share access. New user uploads retain private access; catalog Worker delivery remains public as before.

## Migrations and rollback

Only additive migrations **0069–0072** are in this release: play state/receipts and deletion cleanup; collections/relationships/source associations; monster templates/versions/play copies; MONSTER engagement enum.

```sh
pnpm exec tsx scripts/migrate-continuity-phase.mts --env /absolute/path/to/private.env
pnpm exec tsx scripts/migrate-continuity-phase.mts --env /absolute/path/to/private.env --apply
pnpm exec tsx scripts/verify-continuity-phase.mts --env /absolute/path/to/private.env
```

The migration script defaults to a rollback fixture check; apply is explicit and journal-scoped. Fixtures are removed or rolled back. Integration verification uses one transaction that is always rolled back. Never use a broad pending-migration runner as a substitute for this release’s scoped migration.

Rollback means redeploying the previous application while **keeping** additive tables, enum values, newly saved state and immutable versions. Do not drop tables or rewrite historical snapshots. Deploy readers compatible with both legacy and new snapshots before relying on new writers. Production migrations and rollback-only fixture checks succeeded on 2026-10-05.

## Verification evidence and known limits

Focused tests cover pinned nested components, publication idempotency, player resolver compatibility, receipts/retries/conflicts/offline queues, collection visibility/cycles/source associations, monster formulas/mirrors/items/Vitality overrides and private-copy independence. Real-database rollback checks also cover a second user’s pinned private copy after the source template and primitive become private. Public publishing refuses dependencies its audience cannot read.

The focused release run passed **1,156 tests in 99 files**, with 15 tests skipped. Production build and TypeScript validation passed. Eleven real-database integration checks passed with all fixture writes rolled back. Browser checks covered signed-in session status, bookmark selection, collections, creature calculation/preview, portrait/landscape/tablet widths and both themes. Automated tests cover two-client conflicts and offline queues; these are not a claim of testing two physical devices. The in-app browser did not report a download event for the session backup, so a real mobile download/import round trip remains a manual release check.

The preexisting full suite also contains failures tied to seeded catalog assumptions and older mocks/narrative expectations. Keep these distinct from focused phase results; a targeted passing run is not a claim that the complete suite passes. Final release test/build output is recorded privately under `.local-plans/` and temporary logs.

Deferred: DM workspace/encounters, general entity JSON interoperability, printed/digital handbooks, AI/MCP authoring, historical R2 archival and destructive cleanup.
