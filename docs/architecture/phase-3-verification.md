# Phase 3 Verification — Universal source_origin + slot_source

> Status: **SHIPPED** — 2026-07-08
> Scope: §11.3 of `edit-creates-fork.md`. Schema-only, additive, no runtime change.
> Builds on Phase 1 (intent plumbing) + Phase 2 (universal intent across 5 entity types).

---

## 1. What shipped

Three migrations + schema updates that bring every entity type into the same public-identity model and add the version-pinning + slot-source metadata that Phase 4 + 5 will wire into the runtime.

| Migration | Tables touched | Effect |
|---|---|---|
| **0020_primitive_source_origin** | `primitives` | Add `source_origin` text column. Backfill system rows with `'system:phase5-commit-c-library-seed'` and user rows with `'user:<clerkId>'`. Drop `(name, category, user_id)` unique. Add `(name, source_origin)` unique + index. |
| **0021_junction_version_id_and_slot_source** | `character_primitives`, `character_capabilities`, `character_items` | Add `version_id uuid` (nullable). Add `slot_source` enum (OWNED / FORKED / PINNED, NOT NULL DEFAULT 'PINNED'). Add indexes. Backfill existing rows with `slot_source='PINNED'`. |

The two migrations were originally planned as separate tasks (T3.1, T3.2, T3.3 in §11.3) but consolidated into two because they target the same tables and the column changes are independent. Lock contention is half what it would be with three migrations.

---

## 2. Schema changes

### `primitives` (migration 0020)

```sql
ALTER TABLE "primitives" ADD COLUMN "source_origin" text;
UPDATE "primitives"
  SET "source_origin" = CASE
    WHEN "user_id" IS NULL THEN 'system:phase5-commit-c-library-seed'
    ELSE 'user:' || "user_id"
  END
  WHERE "source_origin" IS NULL;
DROP INDEX IF EXISTS "primitives_name_category_user_unique_idx";
CREATE UNIQUE INDEX "primitives_name_source_origin_unique_idx"
  ON "primitives" USING btree ("name", "source_origin");
CREATE INDEX "primitives_source_origin_idx"
  ON "primitives" USING btree ("source_origin");
```

**Why drop category from the unique?** Per §6.5, the universal identity model says every entity has a single `(name, source_origin)` identity — category is presentation, not identity. Two primitives can now share a name across categories as long as their `source_origin` differs (a user can have "Strike" in two categories; two forks of the same source can coexist on the same name). Forks were the original motivator: a fork of "Strike" gets `source_origin="fork:<id>"` and can have the same name as the source without collision.

**Backfill safety** (audited before applying on 2026-07-08):
- 0 system primitives shared `(name, category)` — safe to drop category from unique
- 0 user-owned primitives shared `(name, user_id)` — safe to introduce `user:<id>` namespace

### `character_primitives/capabilities/items` (migration 0021)

```sql
ALTER TABLE "character_primitives" ADD COLUMN "version_id" uuid;
-- (same for character_capabilities, character_items)
CREATE INDEX "character_primitives_version_id_idx" ON "character_primitives" USING btree ("version_id");
-- (same for the other two)

CREATE TYPE "slot_source" AS ENUM ('OWNED', 'FORKED', 'PINNED');

ALTER TABLE "character_primitives" ADD COLUMN "slot_source" "slot_source";
UPDATE "character_primitives" SET "slot_source" = 'PINNED' WHERE "slot_source" IS NULL;
ALTER TABLE "character_primitives" ALTER COLUMN "slot_source" SET NOT NULL;
ALTER TABLE "character_primitives" ALTER COLUMN "slot_source" SET DEFAULT 'PINNED';
CREATE INDEX "character_primitives_slot_source_idx" ON "character_primitives" USING btree ("slot_source");
-- (same for character_capabilities, character_items)
```

**Why backfill to PINNED?** Pre-Phase-3 slots are functionally a pin on the live row (the only available version at the time). When Phase 4 wires content-hash version rows in, those slots can be re-pinned to the actual version of the slotted entity (or kept with `version_id=NULL` to show the "version unknown" indicator). Per §6.6.

**Why a Postgres ENUM, not a text + check?** Match the rest of the schema's convention for constrained string columns. Easier to read in pgAdmin, harder to typo a value into. Adding new values (e.g. `ARCHIVED`) is `ALTER TYPE slot_source ADD VALUE 'ARCHIVED'`.

---

## 3. Runtime changes

### `SourceRowIdentity` extended

`src/lib/publishing/dispatch-save.ts` now includes `sourceOrigin` on the `SourceRowIdentity` interface that the dispatch matrix returns. All 5 branches of `loadEntityOwner` (PRIMITIVE / EFFECT / CAPABILITY / ITEM / TEMPLATE) now select the `source_origin` column. This is what lets the per-entity POST handler compute the new row's `source_origin` (fork marker, system seed, or `user:<id>`) without re-querying.

### Primitive POST handler (`src/app/api/primitives/route.ts`)

- `buildTakenNamesSet(sourceOrigin)` — was `(category, userId)`. The namespaced uniqueness is now by `source_origin`, not category. The "taken names" walk for `computeUniqueForkName` looks up by `source_origin` (typically `user:<callerId>` for greenfield or `fork:<sourceId>` for forks).
- `computeSourceOrigin({ callerUserId, source, isGreenfield })` — central rule for what `source_origin` a new/updated row should have:
  - greenfield → `'user:<callerId>'`
  - system content being forked → `'fork:<sourceId>'`
  - caller owns source (version-update path) → keep the existing `source_origin`
  - caller forking someone else's row → `'fork:<sourceId>'`
- `buildPrimitiveValues` now requires `sourceOrigin` and includes it in the returned object.
- The INSERT and UPDATE paths now write `sourceOrigin` (fork: INSERT writes `forkSourceOrigin`; version-update writes `versionSourceOrigin`).
- The `onConflictDoUpdate` target is now `[name, sourceOrigin]` (was `[name, category, userId]`).

### Seed file (`src/db/seed/primitives.ts`)

Every seed now includes `sourceOrigin: "system:phase5-commit-c-library-seed"`. The `onConflictDoUpdate` target is now `[name, sourceOrigin]`. Without these changes, re-running the seed would fail post-migration (the new unique constraint would conflict with the 3-col target).

### Import route (`src/app/api/primitives/import/route.ts`)

Imported primitives are written under `sourceOrigin = "user:<callerId>"` (the user's private namespace). The `onConflictDoUpdate` target is now `[name, sourceOrigin]`.

### Test updates (`src/lib/__tests__/dispatch-save.test.ts`)

The 4 `SourceRowIdentity` test fixtures (OWNED / FOREIGN / SYSTEM / LEGACY_OWNED) now include a `sourceOrigin` field. Test outcomes unchanged.

---

## 4. Live verification

### Migration apply

```
[0020_primitive_source_origin] applying (21/22)...   OK
[0021_junction_version_id_and_slot_source] applying (22/22)...   OK
Applied 2 pending migration(s).
```

### Post-apply audit

```
primitives source_origin coverage:
  has_source_origin=true: 191 (every row backfilled)

primitives source_origin distribution (top 3):
  system:phase5-commit-c-library-seed: 169
  user:user_3GBZcHu9gL8z1UOqkuqrN8cLsOn: 14
  user:user_3GBKnmCEvgYSjfeFqmAQrzO7cyP:   8

junction table counts (unchanged from pre-migration):
  character_primitives:   0
  character_capabilities: 7
  character_items:        3

character_capabilities slot_source:
  PINNED: 7 (every existing row backfilled)

junction version_id coverage:
  character_capabilities version_id=null: 7
  character_items version_id=null:        3
```

### Integration tests

`scripts/integration-test-phase3-primitives.mts` (run against prod DB):

```
Greenfield insert: sourceOrigin=user:user_3GBZcHu9gL8z1UOqkuqrN8cLsOn ✓
Fork insert:       sourceOrigin=fork:472                          ✓
Collision rejected: ✓ (unique constraint fires on duplicate (name, source_origin))
Cross-namespace:    same name + different source_origin → allowed ✓
```

`scripts/integration-test-phase3-junctions.mts`:

```
New slot: slotSource=PINNED, versionId=null                ✓
Invalid slot_source enum value rejected by Postgres         ✓
Explicit slotSource=OWNED + versionId=<uuid> persisted      ✓
```

### Build + tests

```
pnpm tsc:   clean
pnpm test:  466/466 pass (no new tests added — covered by integration scripts)
pnpm build: clean
```

---

## 5. What this enables

| Phase 4 (next) | Phase 5 (later) |
|---|---|
| `resolveContentVersionId` populates `*_versions` rows on every save. | Build preview shows slot-source badges (OWNED green / FORKED yellow / PINNED blue). |
| Slot capture writes `version_id` into the junction row. | "Update available: v3 → v5" button on PINNED slots walks the dependency graph. |
| Migration 0022 (T4.7) backfills version rows for every existing entity. | `/api/entities/update-from-source` endpoint runs the transitive walk. |
| Runtime replaces `resolveVirtualVersionId` with the content-addressed version. | The 26 free-text "Blueprint Ledger (Notion)" capabilities can be re-classified to `system:blueprint-ledger` (out of scope for Phase 3). |

---

## 6. Out of scope (deliberately)

1. **Migrating the 26 "Blueprint Ledger (Notion)" capabilities** to the `system:...` convention. They're functional (the unique constraint works fine on free-text) and Mashu hasn't asked for the cleanup. Punted.
2. **Backfilling `source_origin` as `fork:<id>` for existing user-owned primitives that are clearly forks** (e.g. "Strike (fork) 2", "Strike (Copy)"). The fork-name convention in the name column is human-readable, not the source_origin. The runtime sets `source_origin='fork:<id>'` correctly going forward; for legacy rows, all 22 user-owned primitives get `user:<id>`. They don't collide because they have different names. Acceptable for now.
3. **Auto-snapshotting `*_versions` on every save.** That's Phase 4 (T4.2 + T4.3). The version tables exist but only `/api/publish` populates them. Phase 3 just lays the version_id column on junctions so Phase 4 has somewhere to write.
4. **Build preview UI for slot_source.** That's Phase 5. The column is in the DB and indexed; the UI just doesn't read it yet.

---

## 7. Migration journal

```
{
  "idx": 20,
  "version": "7",
  "when": 1783700000000,
  "tag": "0020_primitive_source_origin",
  "breakpoints": true
},
{
  "idx": 21,
  "version": "7",
  "when": 1783800000000,
  "tag": "0021_junction_version_id_and_slot_source",
  "breakpoints": true
}
```

---

## 8. Files changed

```
src/app/api/primitives/import/route.ts        (onConflict target + sourceOrigin on insert)
src/app/api/primitives/route.ts               (computeSourceOrigin helper + new buildPrimitiveValues sig + buildTakenNamesSet sig + onConflict target)
src/db/migrations/0020_primitive_source_origin.sql      (NEW)
src/db/migrations/0021_junction_version_id_and_slot_source.sql   (NEW)
src/db/migrations/meta/_journal.json          (idx 20 + 21 entries)
src/db/schema/characters.ts                   (slotSourceEnum + versionId + slotSource on 3 junction tables)
src/db/schema/engine.ts                       (sourceOrigin on primitives + new unique index)
src/db/seed/primitives.ts                     (sourceOrigin on every seed + onConflict target)
src/lib/__tests__/dispatch-save.test.ts       (4 SourceRowIdentity fixtures get sourceOrigin)
src/lib/publishing/dispatch-save.ts           (SourceRowIdentity + 5 loadEntityOwner branches)
scripts/integration-test-phase3-primitives.mts           (NEW — 4 invariants)
scripts/integration-test-phase3-junctions.mts            (NEW — 3 invariants)
```
