# Phase 4 redo: fixes for the live UI 42P10 error

**Date:** 2026-07-08
**Author:** Senku (with Mashu's live UI report)
**Commits:** `c243bed` (fix), `9ef63ec` (Phase 4 redo), `e6eb396` (verification doc)

## What broke

Mashu tried to edit the fork "Strike (fork)" in the live sandbox
(`/sandbox/primitives/469/edit`). On clicking "Save", the dev
error overlay showed:

```
Failed query: insert into "primitive_versions"
  (id, primitive_id, version_number, is_latest, delta_kind, snapshot,
   published_by_user_id, published_at, superseded_at, created_at, updated_at)
  values ($1, ..., $8, default, default, default)
  on conflict (primitive_id, version_number)
  do update set is_latest = $9, snapshot = $10, published_by_user_id = $11,
              published_at = $12, updated_at = $13

cause: there is no unique or exclusion constraint matching
       the ON CONFLICT specification (SQLSTATE 42P10)
```

## Two distinct bugs found during the fix

### Bug 1: missing unique indexes on 3 of 5 version tables

Migration 0014 (`src/db/migrations/0014_phase6_effect_item_versions.sql`)
created the 5 `_versions` tables and added unique indexes on
`(effect_id, version_number)` and `(item_id, version_number)`.
The Drizzle schema in `src/db/schema/versions.ts` declares the
SAME shape (with matching unique index) for `primitive_versions`,
`capability_versions`, and `template_versions` — but the matching
`CREATE UNIQUE INDEX` statements were never written as a migration.

Result: `effect_versions` and `item_versions` had the index in
prod, but the other 3 did not. The Drizzle ORM generated the same
SQL for all 5 entity kinds, so the first 2 worked and the other 3
failed every save with `42P10`.

**Why I didn't catch this during the Phase 4 redo verification:**
the migration 0023 backfill used `ON CONFLICT (id) DO NOTHING` which
works on the primary key, so the backfill succeeded for all 5
tables. The runtime `recordVersion` uses `target: [ref.foreignKey,
ref.versionNumber]` which targets the **non-existent** unique index.
The 193 backfilled rows proved the SQL ran — but never proved a
**save** ran. The save path was completely unverified before
shipping.

**Fix:** migration 0024
(`src/db/migrations/0024_phase4_missing_version_indexes.sql`).
Adds the 9 missing indexes (3 unique + 6 regular lookups) using
`IF NOT EXISTS` for idempotency. Verified applied to prod via
`pg_indexes` query.

### Bug 2: Clerk ID vs UUID mismatch in `published_by_user_id`

If bug 1 hadn't fired first, every save would have hit a second
error: `22P02 invalid_text_representation` on the UUID column.

`published_by_user_id` is typed `uuid` (the internal `users.id`
value). But all 14 call sites in `src/app/api/*/route.ts` pass the
Clerk text ID directly (e.g. `"user_3GBKnmCEvgYSjfeFqmAQrzO7cyP"`).
The mismatch was silent because bug 1 always threw first.

**Fix:** centralized the resolution in `recordVersion` itself via
the existing `resolveUserIdByClerkId` helper. The 14 route files
don't have to change. If the Clerk ID isn't in the `users` table
yet (e.g. first save before profile sync), the publisher is
silently omitted rather than blocking the save.

## Verification

| Check | Method | Result |
|---|---|---|
| 9 new indexes in prod | `pg_indexes` query | ✅ All 5 tables have the required unique index |
| recordVersion inserts on primitive_versions | `scripts/verify-0024-fix.mts` | ✅ v2 created, then cleaned up |
| recordVersion inserts on all 5 entity kinds | `scripts/test-record-version-all-kinds.mts` (deleted) | ✅ All 5 succeed |
| `publishedByUserId: <Clerk text ID>` resolves correctly | `scripts/verify-0024-fix.mts` | ✅ Inserted row has a real uuid, not a Clerk text |
| 476 unit tests pass | `pnpm test` | ✅ |
| TypeScript compiles | `pnpm tsc` | ✅ |
| Commit on main | `git log` | ✅ `c243bed` |
| Vercel deploy | GitHub Actions → Vercel | ✅ Fresh deploy (`age: 0` on prod) |
| **Live UI save test** | `browser_navigate` + form submit | ⚠️ **Blocked by stale test account** — `.swordweave-test-account.local` references an email that no longer exists in Clerk. The fix is verified end-to-end against the prod DB via the `recordVersion` direct call, but I did not exercise the form-to-DB path in a real browser. |

## What still needs verification

The live UI form-to-DB path was not tested end-to-end in a real
browser session because the test account in
`.swordweave-test-account.local` is stale. To complete the
verification, either:

1. Mashu opens the editor in her own browser and tries to save
   "Strike (fork)" — should succeed with the dev error overlay
   no longer appearing. New `primitive_versions` row should appear
   in prod.
2. Create a new Clerk test account, update
   `.swordweave-test-account.local`, and re-test.

I recommend (1) — it's the real test and takes 30 seconds. If
Mashu is willing, I'll re-prompt with a checklist of what to look
for in the new version row.

## Future-proofing

The `verify-0024-fix.mts` script is kept in the repo. It can be
run any time to re-verify the fix is in place:

```bash
pnpm exec tsx scripts/verify-0024-fix.mts
```

It checks the 5 indexes, calls `recordVersion` end-to-end, and
cleans up. Safe to run in any environment that has `DATABASE_URL`.

The auto-snapshot.ts docstring now documents the migration 0024
context and the SQLSTATE 42P10 symptom, so future debugging
should be much faster.
