# Edit-Creates-Fork Architecture

> Status: **DRAFT — awaiting Mashu's review and sign-off before implementation**
> Last updated: 2026-07-07
> Scope: 2–3 week sprint. Cross-cutting. Will touch DB schema, all 5 entity APIs, build composition, library queries, sandbox UX.

---

## 1. Problem Statement

### Today

A primitive's row is mutable. `POST /api/primitives` with `editingId=N` does:

```sql
UPDATE primitives SET name=..., isPublic=..., buCost=..., ... WHERE id=N AND (user_id = caller OR user_id IS NULL)
```

- The row mutates in place. There is no automatic version snapshot.
- Builds reference `primitive_id` directly (`character_primitives.primitive_id`). If the author edits the primitive, every build that has slotted it silently sees the new version.
- The "Publish to library" button (round 4) is the only way to create a real `primitive_versions` row. Until you publish, edits stay as an unversioned live row.
- `resolveVirtualVersionId(type, id)` hashes `(type, id)` — not content. Two primitives with identical content but different IDs get different virtual versions; one primitive with changing content gets the same virtual version forever.

### What Mashu wants

> "I see something, I load into build, I change things and I save → creates fork."
> "If visibility is private and I edit the fork or my created item to modify something, it updates and past versions pre-edit are reflected in version history but only I can see."
> "If another user added something I created to their build, and I edit/update that something, the user will not have the updated version, but the version he already used."

In plain words:

1. **The act of opening the editor produces a working fork of the row.** The original is untouched. Editing only ever touches your fork.
2. **Every save creates a new content-addressed version snapshot** that lives in the row's version history. Visibility controls who can see which versions.
3. **Visibility IS the publish state** — no separate publish button. (Already shipped in round 5.)
4. **Builds pin the version they slotted.** Editing the source after the fact doesn't break anyone else's build.

---

## 2. Current State Inventory

### Schema gaps (what's not in the DB today)

| Need | Today | What's missing |
|---|---|---|
| Source-row identity for primitives | `(name, category, user_id)` unique. NULL user_id = distinct (so system + user can collide on name). | `primitives.source_origin` column (capabilities/effects/items/templates already have it). Need to add for consistency. |
| Version rows | `primitive_versions`, `capability_versions`, `effect_versions`, `item_versions`, `character_versions`, `template_versions` exist. Populated only by `/api/publish`. | Auto-populated on save. |
| Version pinning in builds | `character_primitives`, `character_capabilities`, `character_items` reference entity IDs only. | Add `version_id` column to each. Update slot flow to capture. |
| Content addressing | `resolveVirtualVersionId(type, id)` hashes `(type, id)`. | `resolveContentVersionId(type, content)` hashes the actual content payload. |

### Code gaps

| Need | Today | What's missing |
|---|---|---|
| Edit creates fork | `POST /api/primitives` UPDATEs in place. | Refactor to INSERT a new fork row on edit, keep old row as a version. |
| Auto-versioning | `/api/publish` is the only entry point to `primitive_versions`. | Add `/api/primitives` → insert into `primitive_versions` automatically. |
| Build slotting | `slotIntoBuild` just dispatches a `SlotEvent` with `(kind, id, label)`. No version capture. | Capture `(kind, id, versionId, label)` and pass to the build composition handler. |
| Fork-naming on edit | `computeUniqueForkName(sourceName)` exists for fork-via-button. | Reuse for edit-creates-fork; the fork name should be derived from the original (e.g. `Strike (draft)` → `Strike (draft 2)` on save). |

### Soft identity principle

Per the existing `characters.ts` doc-block:
> "All support soft identity: (name, user_id) is unique; (name, source_origin) is public identity."

This principle is half-implemented (only `source_origin` exists on capabilities/effects/items/templates, not on primitives). Edit-creates-fork needs it everywhere.

---

## 3. Design Decisions

### D1. What "edit" means

**When you click "Edit in sandbox" on a row you don't own (or don't have a working fork of):**
- The form pre-fills with a **fork** of the row, freshly created. Name = `${source.name} (draft)`. The form's editing target is the **fork**, not the source.
- Save mutates the fork. Source is untouched.

**When you click "Edit in sandbox" on a row you DO own:**
- Same behavior — opens a fork. The original stays untouched. (Per Mashu's answer: "click 'Edit in sandbox' → auto-creates a fork of your row, form pre-fills with the fork. Save mutates the fork. Original is preserved untouched in version history.")
- This means owning a primitive doesn't let you "edit it directly." You always fork first. The "current" version is just the most recent fork in the lineage.

**When you click "Edit in sandbox" on an existing fork of yours:**
- The form opens with that fork. Save mutates it. No new fork is created.
- "Save = mutate the fork you're editing" — until you explicitly "fork again" or "branch" (future feature).

**Implication:** there are three click → form pre-fill behaviors:
1. Edit source (or someone else's row) → fresh fork created, form pre-fills with the fork.
2. Edit your own fork → form pre-fills with that fork.
3. Edit system content (user_id IS NULL) → fresh fork created, form pre-fills with the fork.

### D2. What "save" means

- The form's save POST goes to a route that accepts a `targetType + targetId`.
- If `targetId` belongs to a fork of yours → UPDATE the row. Snapshot a new version row.
- If `targetId` doesn't exist yet (e.g. greenfield new entry from scratch) → INSERT. Snapshot version #1.
- If `targetId` belongs to someone else → 403.

The versionId on each save is computed from the **content hash** of the new state. If two saves produce identical content (no actual change), they're deduped — no new version row.

### D3. Version chain

Every entity has a chain of `*_versions` rows:
- `primitive_versions(primitive_id, version_number, is_latest, delta_kind, snapshot, ...)`
- Each save increments `version_number` and inserts a new row. `is_latest=true` on the new row, `is_latest=false` on the previous latest.
- Delta chain: first version is FULL snapshot. Subsequent versions are DELTA from the previous full snapshot. Reading any version reconstructs by applying deltas in order.
- The "current row" is a denormalized convenience — it always reflects `is_latest=true`. We don't *need* a separate row but it makes reads cheap. The version rows are the immutable history.

### D4. Content-addressed versionId

`resolveContentVersionId(type, content)` = `md5(json_canonicalize(content))` formatted as UUID.

- Two rows with identical content get the same versionId.
- A row that changes content gets a new versionId.
- Used by: build pinning, fork lineage, reactions/forks aggregation keys (currently use virtual versionId — switch to content versionId so aggregation actually means "people who reacted to this exact version").

### D5. Build pinning

Add nullable `version_id` columns to all character junction tables:

```sql
ALTER TABLE character_primitives  ADD COLUMN version_id uuid;
ALTER TABLE character_capabilities ADD COLUMN version_id uuid;
ALTER TABLE character_items      ADD COLUMN version_id uuid;
ALTER TABLE character_effects    ADD COLUMN version_id uuid;
-- If character_effects exists; check
```

When you slot a primitive into a build, capture its current versionId:

```ts
// Slot event now carries version
const event: SlotEvent = {
  kind: "primitive",
  id: row.id,
  versionId: resolveContentVersionId("PRIMITIVE", row.content),
  label: row.name,
};
```

Build composition endpoint persists both `primitive_id` AND `version_id`. If a future edit changes the primitive, the build still references the version that was slotted.

**Backfill:** existing builds (without versionId) keep working — `version_id` is nullable, queries fall back to the current row's `is_latest=true` version. New slots must capture versionId. Old slots display a "version unknown" badge in the build preview.

### D6. What about deleting?

Per the current API, deleting a row is blocked when there's an active publication (`/api/creations/delete` returns 409).

With edit-creates-fork, delete semantics change:
- Deleting the fork row is fine — it's a draft. Cascade deletes its versions.
- Deleting a "current" row (one with active publications) → mark all `publications.unpublishedAt = NOW()` and delete the row + versions.
- Builds that pinned a version of the deleted row → their `version_id` references a now-deleted version. The build display should show "(deleted)" instead of the content.

### D7. Fork-of-fork

Click "Fork" on a row that's already someone's fork. Currently: creates another fork of the source. With edit-creates-fork, this stays the same. The fork lineage (`forks.source_*` → `forks.forked_*`) chains.

Click "Edit in sandbox" on someone else's fork. Creates a fork of their fork. Fork lineage: source → their fork → your fork-of-fork. All preserved in `forks` table.

---

## 4. Schema Migration

### Migration 0018 — `primitives.source_origin`

Bring primitives in line with the rest of the system:

```sql
ALTER TABLE primitives ADD COLUMN source_origin text;
-- Backfill: existing rows get source_origin = NULL (system content) or "manual:<user_id>"
-- for user-owned rows.
UPDATE primitives
SET source_origin = CASE
  WHEN user_id IS NULL THEN NULL
  WHEN name LIKE '% (fork)' OR name LIKE '% (fork) %' THEN 'fork:' || user_id
  ELSE 'manual:' || COALESCE(user_id, '')
END;
-- Add index
CREATE INDEX primitives_source_origin_idx ON primitives (source_origin);
-- Drop the 3-col unique constraint (now redundant — source_origin provides identity)
ALTER TABLE primitives DROP CONSTRAINT primitives_name_category_user_unique_idx;
-- Add new identity constraint
ALTER TABLE primitives ADD CONSTRAINT primitives_name_source_origin_unique UNIQUE (name, source_origin);
```

### Migration 0019 — `version_id` on character junctions

```sql
ALTER TABLE character_primitives  ADD COLUMN version_id uuid;
ALTER TABLE character_capabilities ADD COLUMN version_id uuid;
ALTER TABLE character_items      ADD COLUMN version_id uuid;
-- (check if character_effects exists; if so, same migration)
```

`version_id` is nullable. NULL means "pre-versioning build" — display as "version unknown" until the user re-slots.

### Migration 0020 — version row backfill

For existing primitives, capabilities, etc., backfill a version #1 row from the current content:

```sql
-- For each existing primitive, compute content_version_id and insert version #1
INSERT INTO primitive_versions (primitive_id, version_number, is_latest, delta_kind, snapshot, published_by_user_id, ...)
SELECT id, 1, true, 'FULL', jsonb_build_object(...), user_id, ...
FROM primitives;
```

### Migration journal entry

`scripts/migration-journal/0018_*.md`, `0019_*.md`, `0020_*.md`.

---

## 5. Implementation Order

### Phase A: Schema (Day 1–2)
1. Write migrations 0018, 0019, 0020.
2. Apply to local + production DB.
3. Migration journal entries.
4. DB backup before prod apply.

### Phase B: Content hashing (Day 2–3)
1. New `src/lib/versions/content-hash.ts` — `resolveContentVersionId(type, content)`.
2. Update `src/lib/engagement/version-helpers.ts` to add `resolveContentVersionId` while keeping `resolveVirtualVersionId` as a fallback for migration.
3. Unit tests for hash stability (same content → same hash; different content → different hash; deterministic JSON serialization).

### Phase C: Auto-versioning on save (Day 3–6)
1. Refactor `POST /api/primitives`:
   - If `editingId` belongs to caller → UPDATE row, snapshot new version, bump version_number.
   - Else if `editingId` belongs to someone else → 403.
   - Else → INSERT new row, snapshot version #1.
2. Same refactor for `/api/capabilities`, `/api/effects`, `/api/items`, `/api/templates`.
3. Helper `src/lib/versions/auto-snapshot.ts` — `recordVersion(targetType, row)` to be called from each save handler.
4. Tests: same content twice = one version row; different content = two version rows; version_number increments; is_latest is correctly toggled.

### Phase D: Edit = fork UX (Day 6–9)
1. New route `POST /api/entities/fork-on-edit` (or fold into existing API):
   - If the user clicks "Edit in sandbox" on a row they don't have a working fork of → server creates a fork row, returns its id. Sandbox loads that.
2. `grammar-sandbox-client.tsx` and `blueprint-sandbox-client.tsx`: change initial-load behavior — if `?edit=<id>` and `<id>` isn't a fork owned by the caller, call fork-on-edit and redirect to `?edit=<new_fork_id>`.
3. Sandbox form: save mutates the fork. Fork's `isPublic` defaults to false (PRIVATE). User flips visibility in the modal after save.
4. Tests: edit someone else's primitive → fork created → form pre-fills with fork → save mutates fork → source untouched.

### Phase E: Build pinning (Day 9–13)
1. `slotIntoBuild` in `grammar-library.tsx` + `blueprint-library.tsx` — capture `(kind, id, versionId, label)`.
2. Build composition endpoint (whichever receives `SlotEvent`) — persist both `*_id` and `version_id`.
3. Build display queries: when fetching a slotted primitive, prefer `version_id` lookup over `id` lookup. If version doesn't exist (deleted), display "(deleted — version no longer available)".
4. Backfill: existing character_primitives rows without version_id keep working, display "version unknown" badge in build preview.
5. Tests: slot version A, edit source to version B, build still shows version A. Delete source, build shows "(deleted)".

### Phase F: Library / browse / Creations updates (Day 13–15)
1. `queryLibrary` filters by `is_latest=true` content version for "current" rows, but renders past versions via `/library/item/[id]/versions`.
2. Creations page (`/creations`) lists "current forks" of each lineage — so editing Strike shows ONE row (the most recent fork) plus a "view history" link.
3. Or: list ALL forks in a lineage as separate rows with a "view lineage" link. Pick one and go.

### Phase G: Delete + cleanup (Day 15–16)
1. `/api/creations/delete` updated to handle "current row" semantics — unpublish all active publications, delete the row + all versions.
2. Fork lineage cleanup — orphaned forks (whose source row was deleted) show as "(source deleted)" in fork history.

### Phase H: Migration + deploy (Day 16–17)
1. Final migration journal entries.
2. Run all migrations against prod.
3. Deploy. Smoke test.
4. Monitor for one week before declaring success.

---

## 6. Edge Cases

### EC1. System content (user_id IS NULL)

Editing a system primitive creates a fork owned by the editor. The system primitive is never mutated. The editor's fork starts PRIVATE. If they flip to PUBLIC, their fork is publicly visible — but the system primitive is still untouched (still showing the original content in the canonical view).

### EC2. User edits their own published primitive

Per D1 — even though you own it, editing creates a fresh fork. The previous public version stays in history. The "current canonical view" on the library page can either:
- (a) Continue pointing at the most recent fork (auto-update when you save).
- (b) Stay pinned at the version that was published; new forks only visible in your Creations.
- Mashu's description suggests (a) — editing creates a fork, the fork becomes the current state.

Pick (a). This means: every save of a public row changes what's shown on the public library page. There's no "publish again" step.

### EC3. Build references version that's since been forked

Build slots Strike v1. Author edits Strike → Strike v2. Build still references v1. Build preview shows v1 content. Author forks Strike v2 → user does the same, gets v2 fork. Build slot moves to v2 if user re-slots. The slot flow should make it obvious which version is being slotted.

### EC4. Same content saved twice

If you save with no changes → content hash is identical → no new version row is inserted. The `version_number` does not advance. (Implementation: pre-save, compute the would-be content hash; check if it equals the current row's content hash; if so, return the current versionId and skip the insert.)

### EC5. Two users fork the same source simultaneously

Both POST `/api/fork` with `targetId=13`. Both compute `computeUniqueForkName` independently — they'll likely both pick `Strike (fork)`. One INSERT succeeds; the other hits the unique constraint and retries with `Strike (fork) 2`. This is the existing behavior — works fine.

### EC6. Fork lineage chain breaks (source deleted, your fork remains)

If you forked Strike and the original author deletes Strike, your fork stays. Its `sourceOrigin` is `"fork:13"` pointing at a now-deleted primitive_id. `forks.source_target_id` still references the deleted id. Fork history page shows "Forked from Strike (deleted)". Build pinning works — your build references your fork's version, not the source's.

### EC7. Visibility flip mid-edit

You're editing Strike (draft, PRIVATE). You flip visibility to PUBLIC in the sandbox. The save then creates a version row with `published_by_user_id` = you AND the publication row gets `visibility = PUBLIC`. Both happen in the same transaction. No partial state.

### EC8. Reaction aggregation after version change

Reaction aggregates key on `(target_type, target_id, version_id)`. When a row's content changes, the versionId changes. Reactions on the old versionId stay aggregated under the old versionId (the aggregate row already exists). The current versionId shows reactions = 0 until people react to it. **This is correct** — reactions are version-pinned, which matches the fork-lineage model.

---

## 7. What Does NOT Change

To keep this scope-bounded:

- **Library browse page** — still queries `is_latest=true` rows. The fork-on-edit is invisible to the library view; the public library just shows the current canonical version of each lineage.
- **/library/item/[id] detail page** — gets a small "version history" sidebar. Otherwise unchanged.
- **Creations page modal** — round 5 changes (no Publish button, liveVisibility, canDelete) stay.
- **Fork button + ForkSuccessModal** — unchanged from round 4.
- **Schema for characters** — characters still don't auto-fork; they reference versions directly.

---

## 8. Risks & Open Questions

### Risk 1. Migration data loss

Migration 0018 backfills `source_origin` from `name` heuristics. If a user has `Strike (fork)` AS a manually-authored row (not from the fork flow), it'll get `source_origin = 'manual:<user_id>'` and may collide with a real fork's `source_origin = 'fork:13'`. Mitigation: dry-run the backfill in staging, inspect collisions, manual fix any.

### Risk 2. Performance

Every save now does:
- One UPDATE/INSERT on the entity table.
- One SELECT on the latest version row (to determine next version_number).
- One UPDATE to mark previous latest as `is_latest=false`.
- One INSERT into the version table.
- One optional INSERT into publications table (if visibility is non-PRIVATE).

For a TTRPG with maybe 100 saves per user per day, this is fine. The writes are cheap.

### Risk 3. Existing data without version rows

Migration 0020 creates version #1 for every existing row. After migration, every row has at least one version. Older rows (no `version_id` on character_primitives junctions) display "version unknown" in the build preview but otherwise work.

### Open Question OQ1. Should deleting a row delete its fork tree?

If user A forks Strike. User B forks Strike. User A deletes their Strike fork. User B's fork is unaffected (it's a fork of the SOURCE, not of A's fork).

If user A is the original author and deletes the source Strike → user B's fork stays (orphaned but intact). User B's fork is no longer findable via "Forked from Strike" because Strike is gone.

**Question for Mashu:** is "deletion" of a source row actually a "tombstone" (soft delete, kept for lineage resolution) or "purge" (hard delete, breaks lineage for forks)? Defaulting to soft-delete + tombstone row for now.

### Open Question OQ2. Build display when a slotted version is older than current

Build slots Strike v1. Library page shows Strike v3 (latest). Build preview shows v1 (correct, pinned). Should there be a "stale" indicator? Like "You're using an older version of Strike. [Update to v3 →]"?

**Default:** yes, show a "version N of M" indicator on each slotted item in the build preview. Mashu — confirm or override.

---

## 9. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-07 | Edit = auto-fork (Mashu's answer to clarify #1) | Cleaner mental model; originals never get touched by editing. |
| 2026-07-07 | Visibility IS publish state (no separate button) | Already shipped in round 5. |
| 2026-07-07 | Plan-first, not code-first | This is a multi-week cross-cutting change. Design doc prevents wasted code. |
| TBD | Soft-delete (tombstone) vs hard-delete for source rows | See OQ1. |
| TBD | "You're using an older version" indicator in build preview | See OQ2. |

---

## 10. Review Checklist for Mashu

Please review and either ✅ or ✏️ each section:

- [ ] **§1 Problem Statement** — captures the goal correctly?
- [ ] **§2 Current State Inventory** — anything missing from the gap list?
- [ ] **§3 D1** — agree that editing your OWN row also auto-forks? (per clarify #1)
- [ ] **§3 D2** — agree that save = mutate the fork + auto-snapshot?
- [ ] **§3 D4** — content-addressed versionId via md5(json_canonicalize) — acceptable hash choice?
- [ ] **§3 D5** — nullable `version_id` on character junctions, fall back to "version unknown" for backfilled rows — acceptable?
- [ ] **§3 D6** — delete semantics — anything I missed?
- [ ] **§3 D7** — fork-of-fork behaves like fork-of-source — OK?
- [ ] **§4 Schema migrations** — three migrations (source_origin, version_id on junctions, version backfill). Right shape?
- [ ] **§5 Implementation order** — 8 phases, ~17 days. Right order? Right pacing?
- [ ] **§6 Edge cases** — any I'm missing?
- [ ] **§8 OQ1** — soft-delete vs hard-delete for source row deletion. Which?
- [ ] **§8 OQ2** — "you're using an older version" indicator in build preview. Yes / no?
- [ ] **§9 Decision log** — anything else worth recording before code starts?
