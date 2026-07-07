# Edit-Creates-Fork Architecture

> Status: **READY FOR REVIEW — Round 6 final, OQ4/OQ5 closed 2026-07-08**
> Last updated: 2026-07-08
> Scope: 4–5 week sprint. Cross-cutting. Will touch DB schema, all 5 entity APIs, build composition, library queries, sandbox UX.
>
> **Next:** Mashu's final sign-off on §10 checklist + §11 task list before any code is written. Phased plan — Phase 1 ships standalone (intent plumbing + deferred fork UX, no schema).

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
- `POST /api/fork` creates a fork immediately and surfaces a "forked to sandbox" modal. This is round 4 behaviour; round 6 replaces it with deferred-fork.

### What Mashu wants

> "I see something, I load into build, I change things and I save → creates fork."
> "If visibility is private and I edit the fork or my created item to modify something, it updates and past versions pre-edit are reflected in version history but only I can see."
> "If another user added something I created to their build, and I edit/update that something, the user will not have the updated version, but the version he already used."
> "I click fork. No fork is created. Instead, it just loads into build and opens build modal. I do my modifications and save. Only then the fork is created and added to my creations."
> "Same things apply wether I use button load into build or the fork button anywhere they are in library, in sandbox, my creations, source page, modal preview, whatever."

In plain words:

1. **Opening the editor does NOT produce a side effect.** No fork is created on click. Cancel/back-out leaves no trace. The sandbox just loads the source entity pre-filled.
2. **Save is the moment of truth.** Two flags determine the outcome:
   - `intent` flag (`fork` vs `load`) — set by which button the user clicked to enter the sandbox.
   - `ownership` — did the caller create this entity?
   - Dispatch table:
     - `intent=load` + caller owns → UPDATE entity in place + new content-hash version row.
     - `intent=load` + caller does NOT own → INSERT new fork row + version #1.
     - `intent=fork` (any ownership) → INSERT new fork row + version #1.
   - Special case: if content hash is unchanged, no row is created. UI surfaces "You can't save something you're not the owner of. Try slotting it into another build instead." for non-owner, or "Nothing to save" for owner.
3. **Every save creates a content-addressed version snapshot** that lives in the row's version history. Visibility controls who can see which versions.
4. **Visibility IS the publish state** — no separate publish button. (Already shipped in round 5.)
5. **Builds pin the version they slotted.** Editing the source after the fact doesn't break anyone else's build.

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
| Deferred fork on save | `POST /api/primitives` UPDATEs in place with no fork logic. `/api/fork` exists but is called eagerly on click (round 4 behaviour). | Wire `intent` flag + ownership check into save handler. Fork is created at save time, not click time. Cancel/back-out leaves no trace. |
| Auto-versioning | `/api/publish` is the only entry point to `primitive_versions`. | Add `/api/primitives` → insert into `primitive_versions` automatically on every version-update and fork-on-save path. |
| Build slotting | `slotIntoBuild` just dispatches a `SlotEvent` with `(kind, id, label)`. No version capture. | Capture `(kind, id, versionId, label)` and pass to the build composition handler. |
| Fork-naming on save | `computeUniqueForkName(sourceName)` exists for fork-via-button. | Reuse for fork-on-save; the fork name derives from the source (e.g. `Strike (fork)` → `Strike (fork) 2` on second save of the same source). |

### Soft identity principle

Per the existing `characters.ts` doc-block:
> "All support soft identity: (name, user_id) is unique; (name, source_origin) is public identity."

This principle is half-implemented (only `source_origin` exists on capabilities/effects/items/templates, not on primitives). Edit-creates-fork needs it everywhere.

---

## 3. Design Decisions

### D1. What "edit" means

**Opening the editor is a navigation gesture, not a write.** No fork is created when you click Fork or Load into build. The sandbox loads the source entity pre-filled into the form; cancel/back-out/close leaves no trace.

There are three navigation behaviours, distinguished by what the user clicked:

1. **Click "Fork"** → URL is `/sandbox/<route>?build=<kind>&edit=<sourceId>&intent=fork`. Form pre-fills with source. `intent=fork` is recorded.
2. **Click "Load into build"** → URL is `/sandbox/<route>?build=<kind>&edit=<sourceId>&intent=load`. Form pre-fills with source. `intent=load` is recorded.
3. **Direct deep link** (someone shares `/sandbox/<route>?edit=<id>`) → URL has no `intent`. Form pre-fills. `intent=null` defaults to "load" semantics on save (i.e. owner=UPDATE, non-owner=INSERT new fork).

The build drawer auto-opens whenever `intent` is present (commit `4c7ac18`). Without `intent` (clean sandbox), the drawer stays closed and the user clicks the FAB to open it.

The sandbox form header shows a context chip that reflects the intent:
- `intent=fork`: blue chip "Forking <source name>".
- `intent=load`: gray chip "Working on <entity name>".
- `intent=null`: no chip.

The form has a "Discard" action in the header that clears `?edit=` and `?intent=` and navigates back to the originating surface — no side effects.

### D2. What "save" means

The form's save POST sends `targetType + targetId + content + intent` to the existing entity endpoint. The server dispatches based on `intent` + ownership + content hash:

```
function dispatchSave({ targetType, targetId, content, intent, caller }) {
  const source = loadRow(targetType, targetId);
  const newHash = resolveContentVersionId(targetType, content);
  
  // No-changes shortcut — applies to ALL matrix cells (per OQ5 closed 2026-07-08)
  if (source && source.contentHash === newHash) {
    return {
      kind: "no-op",
      reason: "content-unchanged",
      // Surfaced as the user-facing message below.
      userMessage:
        source.userId === caller.id
          ? "Nothing to save."
          : "You can't save something you're not the owner of. Try slotting it into another build instead.",
    };
  }
  
  const isOwner = source && source.userId === caller.id;
  
  // Dispatch matrix
  if (intent === "fork") return materializeAsFork({ source, content, caller });
  // intent === "load" or null
  if (isOwner) return materializeAsVersionUpdate({ source, content, caller });
  return materializeAsFork({ source, content, caller }); // non-owner load
}
```

Three concrete outcomes:

- **`materializeAsVersionUpdate`** — UPDATE entity row in place + INSERT new content-hash version row. Caller's row gets `version_number + 1`. The original source's `is_latest` flag flips; the new version is `is_latest=true`.
- **`materializeAsFork`** — INSERT new entity row with `source_origin = 'fork:<source_id>'`, `user_id = caller.id`, content = caller's payload. INSERT version row #1 with content hash. Return `{ entityId: <new fork id>, versionId: <v1 hash>, forkedFromId: <source_id> }`.
- **`no-op`** — return the appropriate message. Client shows it as a toast or inline error.

The server response includes `kind` so the client knows whether to swap URL params (fork path) or stay put (version-update path) and which post-save modal/toast to show.

**Special cases:**
- Greenfield save (`targetId` is null, intent=null, e.g. direct create in sandbox) → INSERT new row + version #1. No source to fork from. Caller is treated as owner for future saves.
- System content (`source.user_id IS NULL`) is treated as non-owner for the load path: save always forks.

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

Click "Fork" on a row that's already someone's fork → sandbox opens pre-filled with their fork as source, `intent=fork`. Save creates a new fork row with `source_origin = 'fork:<their_fork_id>'`. Fork lineage: source → their fork → your fork-of-fork. All preserved in `forks` table.

"Load into build" on someone else's fork → sandbox opens pre-filled, `intent=load`. Save: you don't own their fork, so it dispatches as `INSERT new fork row` (the non-owner + intent=load path) — same result as clicking Fork on it. The intent flag matters only for the **owner** path.

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

`src/db/migrations/meta/_journal.json` will get new entries (0018, 0019, 0020, 0021, 0022) automatically when we run `npx drizzle-kit generate`. The SQL files live alongside (`src/db/migrations/0018_*.sql` etc). The existing `scripts/sync-pending-migrations.mts` applies them to prod.

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

### Phase D: Intent flag plumbing + deferred fork (Day 6–10)
1. New sandbox client state: `intent: 'fork' | 'load' | null`, read from `?intent=<...>` on mount. Defaults to `null`.
2. `useGlobalControls` extended with `intent` so any surface can read intent.
3. **Fork button** (`LikeForkBar` + `FlagAndForkFooter` + `CreationPreview`): replace `handleFork`'s POST with `router.push('/sandbox/<route>?intent=fork&edit=<sourceId>')`. Remove the `setForkResult` / `ForkSuccessModal` mounting in the click path.
4. **Load into build button**: `router.push('/sandbox/<route>?intent=load&edit=<sourceId>')`. Existing flow already routes through this — just append `&intent=load`.
5. `grammar-form.tsx` / `blueprint-form.tsx`: thread `intent` from sandbox context into `submitForm()` body.
6. Server endpoints: each POST `/api/<entity>` reads `intent` from body:
   - No intent → existing behaviour (INSERT or UPDATE in place if owned).
   - `intent=load` + caller owns → UPDATE + new version row (skip if content hash unchanged).
       - `intent=load` + caller doesn't own → INSERT new fork row.
       - `intent=fork` (any ownership) → INSERT new row with `source_origin = 'fork:<source_id>'`, version #1. Return `{ entityId, versionId, sourceId }`.
   7. Sandbox post-save handler:
       - If response's `kind === "no-op"`: surface the server's `userMessage` as an inline error (non-owner) or toast (owner).
       - If response's `entityId !== sourceId`: replace URL `?edit=<source>` with `?edit=<new>` so subsequent operations target the fork. Open `ForkSuccessModal`.
       - If response's `entityId === sourceId`: it's a version-update. Show a toast `Saved version <N>`.
   8. Sandbox UX: form header chip ("Forking X" vs "Working on X") + "Discard" button in form header that clears `?edit` + `?intent` and navigates back.
9. Tests: each matrix cell × each entity type.

### Phase D-bis: schema pre-work deferred to D-completion
The full universal `source_origin` / `version_id` migration (0018–0020) can be split: **(D-part-1) source_origin + intent plumbing** (the UX work) ships independently. **(D-part-2) full content hashing + version rows** (the deeper schema work) ships after Mashu signs off on the UX. Rationale: Mashu is using the sandbox regularly; the deferred-fork UX is the high-priority ship.

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

System content is treated as **non-owner** by the dispatch (§D2): saving after clicking Fork or Load always creates a fork. The system primitive is never mutated. The editor's fork starts PRIVATE. If they flip to PUBLIC, their fork is publicly visible — but the system primitive is still untouched (still showing the original content in the canonical view).

### EC2. User edits their own published primitive

Two paths depending on which button they used to enter the sandbox:

- **intent=fork** → save creates a NEW fork row (the user's "second line" of this primitive). Original row + previous public version stay intact. Library continues to show the published version.
- **intent=load** (owner) → save updates the row in place + new content-hash version row. The "current canonical view" on the library page updates automatically — no separate publish step (visibility IS the publish state).

The two paths cover Mashu's description ("I created a capability and update it if the source things are updated") cleanly: intent=load is the "I'm iterating on my own published work" gesture; intent=fork is the "I'm starting a new lineage off of my own work" gesture.

### EC3. Build references version that's since been forked

Build slots Strike v1. Author edits Strike → Strike v2. Build still references v1. Build preview shows v1 content. Author forks Strike v2 → user does the same, gets v2 fork. Build slot moves to v2 if user re-slots. The slot flow should make it obvious which version is being slotted.

### EC4. Same content saved twice

If you save with no changes → content hash is identical → no new version row is inserted. The `version_number` does not advance. Server returns `kind: "no-op"` with the appropriate `userMessage`:

- **Owner + intent=load, no changes** → "Nothing to save." (silent toast)
- **Non-owner + intent=load, no changes** → "You can't save something you're not the owner of. Try slotting it into another build instead." (inline error)
- **Any + intent=fork, no changes** → "You can't save something you're not the owner of. Try slotting it into another build instead." (inline error) — saving an unchanged fork would be a useless row. (Closed OQ5, 2026-07-08.)

### EC5. Two users fork the same source simultaneously

Both POST `/api/<entity>` with `intent=fork` and `targetId=13`. Both compute `computeUniqueForkName` independently — they'll likely both pick `Strike (fork)`. One INSERT succeeds; the other hits the unique constraint and retries with `Strike (fork) 2`. This is the existing behavior — works fine.

### EC6. Fork lineage chain breaks (source deleted, your fork remains)

If you forked Strike and the original author deletes Strike, your fork stays. Its `sourceOrigin` is `"fork:13"` pointing at a now-deleted primitive_id. `forks.source_target_id` still references the deleted id. Fork history page shows "Forked from Strike (deleted)". Build pinning works — your build references your fork's version, not the source's.

### EC7. Visibility flip mid-edit

You're editing Strike (draft, PRIVATE). You flip visibility to PUBLIC in the sandbox. The save then creates a version row with `published_by_user_id` = you AND the publication row gets `visibility = PUBLIC`. Both happen in the same transaction. No partial state.

### EC8. Reaction aggregation after version change

Reaction aggregates key on `(target_type, target_id, version_id)`. When a row's content changes, the versionId changes. Reactions on the old versionId stay aggregated under the old versionId (the aggregate row already exists). The current versionId shows reactions = 0 until people react to it. **This is correct** — reactions are version-pinned, which matches the fork-lineage model.

---

## 6.5 Universal `source_origin` + `version_id` (Mashu, round 6)

> "We need version id for templates too like race and background and archetype. I can fork them too and add new things to them... So basically everything should have source origin and version id whether a primitive capability effect race background archetype item monster character/build whatever."

### Inventory by entity type

| Entity | `source_origin` today | `version_id` today | Needs | Plan |
|---|---|---|---|---|
| `primitives` | ❌ (uses `(name, category, user_id)` unique) | ❌ virtual only | Both | Migration 0018 — add `source_origin`, switch unique constraint to `(name, source_origin)`. |
| `capabilities` | ✅ | ❌ virtual only | Version | Migration 0021 — add content-hash versionId; existing rows get a virtual versionId backfilled from current content. |
| `effects` | ✅ | ❌ virtual only | Version | Same as capabilities. |
| `items` | ✅ | ❌ virtual only | Version | Same. |
| `templates` (race/background/archetype/build) | ✅ | ❌ virtual only | Version | Same. |
| `monsters` | — table doesn't exist in current schema | — | Skip | Add to backlog; no current code touches a monsters table. |
| `characters` | ❌ (no `source_origin`) | ❌ virtual only | Both | Migration 0022 — add `source_origin` to characters + character_versions table. |
| `builds` | ❌ (no `source_origin`; 0 rows today) | ❌ | Both | Migration 0023 — add `source_origin` + versionId; only kicks in once the build system actually starts saving builds. |

### Content-addressed versionId

`resolveContentVersionId(type, content)` is the unified function. For every entity type:
- The "content" is the row's full payload minus volatile fields (`id`, `user_id`, `created_at`, `updated_at`).
- Hash with `md5(json_canonicalize(content))`, formatted as UUID.
- `version_id` column on every `*_versions` table is `uuid NOT NULL`.
- Existing rows get backfilled in migration 0020.

### Why universal

Per Mashu: "everything should have source origin and version id." The point is consistency — every entity participates in the fork-lineage + version-history system the same way. A capability I authored behaves the same as a race template I authored from a UX standpoint. One mental model, one set of APIs.

### Visualized

```
[User clicks Fork on Race Template "Forestkind"]
  → /api/fork with targetType=RACE_TEMPLATE
    → INSERT templates (new row, user_id=me, source_origin="fork:<source_id>")
    → INSERT template_versions (version_number=1, content_hash=hash(source_content), is_latest=true, delta_kind=FULL)
    → INSERT forks (source_target_id=<source>, forked_target_id=<new fork>, source_version_id=<source's current>, forked_version_id=<new fork's v1>)
  → Modal: "Forestkind (fork) saved to sandbox. [Edit in sandbox] [View source page]"
```

---

## 6.6 Transitive Dependency Update Model (Mashu, round 6)

> "I can fork something and modify it, I shouldn't be able to update bc it's a new thing."
> "I can create a capability and update it if the source things are updated."
> "In a character I have 6 capabilities, but 2 are created by me, 1 is fork, and 3 are taken as they were in library. If those I took from the library have been updated (either directly or their children aka effects and primitives and primitives in effects) have been updated, I should be able to update it too."

### Three kinds of slots

Every capability (and primitive, effect, item, template) slot in a build has a **source relationship**:

1. **`OWNED`** — the slot's target is something the user authored themselves. Updateable from source dependencies.
2. **`FORKED`** — the slot's target is a fork (a clone). Frozen. Cannot be "updated from source" — that would defeat the fork's whole purpose.
3. **`PINNED`** — the slot's target is a library item, slotted with a `version_id`. Updateable: re-fetch the latest version AND transitively re-fetch its dependency tree.

### The update graph

For a `PINNED` capability with primitive_links `[P1, P2]` and effect_links `[E1]`:
- E1 has its own primitive_links `[P3, P4]`.
- "Update from source" for the capability walks:
  - Capability self → latest version of same name/source_origin.
  - For each primitive_link P_i → latest version of that primitive (preserve quantity, slotLabel, sortOrder, notes).
  - For each effect_link E_i → latest version of that effect (same).
  - For each effect's primitive_links → latest version of those primitives.

This is a depth-first walk on the dependency graph. Each step produces a new version snapshot, and the user's local copy gets a new `version_id` that aggregates the latest dependency versions.

### Implementation

```ts
// New endpoint: POST /api/entities/update-from-source
// Body: { targetType, targetId, versionId }
// Server walks the dependency graph and creates a new local version
// that re-references all transitive dependencies at their latest version.
async function updateFromSource(input: {
  targetType: PublishTargetType;
  targetId: string;
  userId: string;
}): Promise<UpdateResult> { ... }
```

For each entity in the dependency tree, the server:
1. Looks up the source row by `source_origin`.
2. Computes `newVersionId = resolveContentVersionId(...)`.
3. If `newVersionId` differs from the local copy's `version_id`, snapshot a new version row + bump the local copy's pointer.
4. Recurse into dependencies.

### What about FORKED slots?

No-op. The user explicitly forked, so the frozen copy is the canonical state. They can edit the fork in their sandbox if they want changes — but the fork is its own thing, not "updated from source."

### What about OWNED slots that are themselves forks of OTHER content?

Per Mashu: "I can fork something and modify it, I shouldn't be able to update bc it's a new thing." So even if the user authored the fork, the **fork relationship freezes it from source updates**. Only `OWNED` slots that aren't forks (i.e. the user authored them from scratch with `source_origin = 'manual'` or `source_origin = 'user:<clerk_id>'`) can be updated from source.

The check is: `source.source_origin IS NULL OR source.source_origin LIKE 'manual%' OR source.source_origin LIKE 'user:%'`.

### UI

In the build preview, each slot has a status badge:
- `OWNED` — green badge, "your work". Click to edit in sandbox.
- `FORKED` — yellow badge, "forked". Click to edit in sandbox (mutates the fork).
- `PINNED v3` — blue badge, "library version 3". Shows "Update available: v5 →" when a newer version exists. Click "Update" to walk the dependency graph.

### Migration 0024 — slot source relationship column

```sql
ALTER TABLE character_capabilities ADD COLUMN slot_source text
  CHECK (slot_source IN ('OWNED', 'FORKED', 'PINNED'));
-- Same for character_primitives, character_effects, character_items.
-- Backfill: existing rows get slot_source='PINNED' (pre-versioning slot = treated
-- as a pin on the latest version, with stale-version indicator until user
-- re-slots).
```

### Decision: schema- or app-level enforcement?

The check constraint is fine for the enum, but the actual update availability logic depends on walking the dependency graph and comparing version_ids — that's application logic. So:
- DB stores the enum (cheap, indexed).
- App computes "is update available" by comparing `local.version_id` to `source.latest_version_id`.

### Open question OQ3 (Mashu, round 6)

What happens when a `PINNED` capability's **direct content** hasn't changed but one of its **transitive dependencies** has? E.g. capability v3 → primitive P1 v5 (unchanged) + effect E1 v7 → P3 v9 (changed).

Two options:
- **(a) Capability's version_id doesn't change** (because the capability's direct content is identical). Build display shows "Capability v3, no update available" but "Capability has stale dependency: P3 v9."
- **(b) Capability's version_id bumps** because the *effective* content includes its dependencies. Build display shows "Update available: v3 → v4 (dependency refresh)."

(a) is simpler and matches "version is the content of THIS row." (b) matches the user's mental model: "if those I took from the library have been updated... I should be able to update it too."

Defaulting to (b) — when ANY transitive dependency has a newer version, the user's slot is "updateable." User confirms before pulling the update.

---

## 6.7 Deferred Fork Creation + Unified Intent Flag (Mashu, round 6 revision)

> "I click fork. No fork is created. Instead, it just loads into build and opens build modal. I do my modifications and save. Only then the fork is created and added to my creations. And I get a modal to view the source page or continue editing the fork i created."

The Round 5 model (click fork → server creates fork → modal → click "Edit in sandbox" → sandbox loads existing fork → save mutates fork) is **abandoned**. The Round 6 model is:

**Click Fork = navigate to sandbox pre-filled, no side effect yet. Save = materialize the fork.**

This avoids polluting Creations with empty forks, makes cancel/back-out leave no trace, and unifies the "fork" gesture with the "load" gesture — they're the same operation, distinguished only by an `intent` flag and ownership at save time.

### Behaviour matrix — applied at EVERY entry point

The following table applies **identically** at every entry point where these buttons appear: library/browse, /library/item/[id] detail page, /sandbox/* pages (grammar + blueprint), /creations, source page, modal preview, build drawer, sandbox menu, wherever. Mashu (round 7): "same things apply wether I use button load into build or the fork button anywhere they are in library, in sandbox, my creations, source page, modal preview, whatever."

| Entry | URL state | Save outcome (owner) | Save outcome (non-owner) | Save with NO changes |
|---|---|---|---|---|
| **Fork** button | `/sandbox/grammar?build=primitive&edit=<sourceId>&intent=fork` | **fork** (always — even owner) | **fork** | fork (intent=fork means "I'm declaring this line") |
| **Load into build** button | `/sandbox/grammar?build=primitive&edit=<sourceId>&intent=load` | **version-update** (in place) | **fork** | no-op (version_history untouched) |

Notes:
1. **Owner's intent=fork is the only path where owner-side save creates a new row.** Mashu: "if I use the fork button, even though I am the owner, it still creates the fork." This is the explicit UX signal "I'm starting my own line of this thing."
2. **Owner's intent=load save = version-row.** Mashu: "Load into build creates fork if I am not the owner. If I am the owner it just adds to version history." A version row may or may not have new content; if unchanged, it's a no-op skip.
3. **Non-owner's intent=save = fork-creating.** Whether they arrived via Fork button or Load button doesn't matter — `user_id != currentUser.id` always forks on save.
4. **System entities** (`user_id IS NULL`) treated as non-owner for save purposes.

### How the intent flag travels

```
┌─────────────────────────────┐
│  User clicks Fork button    │
│  in any surface             │
└─────────────┬───────────────┘
              │
              ▼
   router.push("/sandbox/<route>?
              &build=<kind>
              &edit=<sourceId>
              &intent=fork")
              │
              ▼
   Sandbox mounts.
   useEffect reads ?intent.
   Sets state { intent: 'fork' | 'load' | null }
              │
              ▼
   Sandbox pre-fills form from ?edit=<sourceId>.
   Build drawer auto-opens to "build" tab.
              │
              ▼
   User edits form. Hits Save.
              │
              ▼
   Form save handler reads `intent` from form context.
   POST /api/<entity> with body { ..., intent, sourceId }
              │
              ▼
   Server: ownership check + intent check:
     - caller owns source AND intent=load  → UPDATE entity + new version row
     - caller owns source AND intent=fork  → INSERT new entity row (fork) + version #1
     - caller !owns source AND intent=load → INSERT new entity row (fork) + version #1
     - caller !owns source AND intent=fork → INSERT new entity row (fork) + version #1
   Server returns: { entityId, versionId, forkedFromId? }
              │
              ▼
   Sandbox receives response. If new entity row was created,
   swap URL from ?edit=<source> to ?edit=<new_fork>.
   Open success modal: "Your fork is saved. [View source] [Continue editing]"
```

### Storage of the intent flag

The intent needs to survive between page-load and form-save. Two possible surfaces:

- **(a) URL search param**: `?intent=fork` is read by sandbox on mount, threaded into the form via React context. Surfaced on save as part of the request body. Lost if user navigates away then comes back.
- **(b) localStorage / sessionStorage**: persisted across navigation. Stale entries risk leaking old intents.

Recommended: **(a) URL search param**. It mirrors the existing `?edit=<id>` convention, is debuggable (visible in URL bar), and has no cleanup burden. Form save handles the no-intent case as "treat as load."

### Cancellation semantics

- User clicks Fork → sandbox loads with form pre-filled.
- User clicks browser Back, closes the tab, or hits "Discard" in the form → **nothing is created**. No fork row. No lineage mark. Source untouched.
- Sandbox exposes a "Cancel / discard" action in the form header that clears the `?edit=` and `?intent=` and navigates back to where the user came from.

### Sandbox UX details

- Build drawer auto-opens on mount when `?intent=<fork|load>` is present (already shipped in commit `4c7ac18`).
- Form header shows a context chip:
  - `intent=fork`: blue chip "Forking <source name>" — explains that save will create a new fork.
  - `intent=load`: gray chip "Working on <entity name>" — explains that save will update or fork depending on ownership.
- After save, sandbox swaps URL params so the page reflects the new entity (`?edit=<new_fork_id>` for fork path, stays the same for version-update path).
- For fork path: open `ForkSuccessModal` with options: "View source page" / "Continue editing fork". Source = the entity just forked from; new entity = current URL's edit id.
- For version-update path: open a small toast "Saved version <N+1>" — no modal, since the source page is unchanged.

### Round 6 bug fixes already shipped (commit `4c7ac18`)

Two pre-existing bugs were fixed while prototyping this model — they would block any deferred-fork flow:

1. **"Edit in sandbox" didn't navigate.** Modal's onClose called `router.refresh()` BEFORE the caller's `router.push`. The refresh re-rendered the library item detail page and dropped the queued navigation. Fix: navigation now happens FIRST, then close + refresh.
2. **Sandbox didn't auto-open build drawer on entry.** Loading the sandbox with `?edit=<id>` pre-filled the form but left the drawer closed. Fix: new `useEffect` in `grammar-sandbox-client.tsx` and `blueprint-sandbox-client.tsx` opens the drawer on mount when `initialEditing !== null`.

### Servers affected by the deferred-fork model

Every entity save endpoint (`POST /api/primitives`, `/api/effects`, `/api/capabilities`, `/api/items`, `/api/templates`) becomes dual-purpose:

- **No `intent` (legacy callers, e.g. /sandbox direct-create)**: behaves as INSERT (new from scratch) or UPDATE in place if `editingId` is owned by caller. Same as today.
- **`intent=load`**: caller-owns-editingId → UPDATE + new version row. Caller-doesn't-own → INSERT new fork row (same as intent=fork for non-owners — there's no "you tried to update someone else's row" 403 in the load path, since load is by definition an "I want to work with this" gesture).
- **`intent=fork`**: caller-owns-editingId → INSERT new row (fork with `source_origin = 'fork:<source_id>'`). Caller-doesn't-own → INSERT new row, same `source_origin`.
- **No-changes shortcut** (any path): if content hash matches source's content hash, return `kind: "no-op"` with the appropriate user-facing message instead of doing the dispatch.

The Phase 1 `dispatchSave` helper (§D2 pseudocode) lives at `src/lib/publishing/dispatch-save.ts` and is the single entry point for all five POST handlers.

### What stays the same

- **Like / dislike / follow** actions — unaffected.
- **`/api/fork` route** — kept for now, but its only client caller (LikeForkBar's Fork button) no longer hits it directly. The deferred-fork model moves fork creation from this route into the entity save routes via the `intent=fork` flag. `/api/fork` can be deleted in a follow-up once verified.
- **LikeForkBar's "Fork" button** — still rendered, still visible, still tracks fork counts — but click behaviour changes to `router.push('/sandbox/...?intent=fork&edit=<sourceId>')` instead of POST `/api/fork`. Fork count updates only after the user saves.

### Decision/Question summary

This supersedes the Round 5 "Edit = auto-fork" model. Two Open Questions resolved 2026-07-08:

- **OQ4 (closed 2026-07-08)**. Where does the `intent` flag live?
  - **Answer: URL `?intent=fork|load` query param.** Survives sandbox mount, debuggable in URL bar, matches the existing `?edit=<id>` convention, no cleanup burden. Both library surfaces and sandbox surfaces use the same param. Mashu: "url works fine I guess as you said."
- **OQ5 (closed 2026-07-08)**. Does a fork-path save with zero content changes still create a fork row?
  - **Answer: NO.** A no-change save returns `kind: "no-op"` with a user-facing message. Non-owner + intent=load gets "You can't save something you're not the owner of. Try slotting it into another build instead." Any + intent=fork gets the same message (saving an unchanged fork would just bloat the DB — Mashu: "it would not help anybody and bloat the db"). Owner + intent=load gets a softer "Nothing to save." toast.

---

---

## 7. What Does NOT Change

To keep this scope-bounded:

- **Library browse page** — still queries `is_latest=true` rows. The fork-on-save is invisible to the library view; the public library just shows the current canonical version of each lineage.
- `/library/item/[id] detail page` — gets a small "version history" sidebar. Otherwise unchanged.
- **Creations page modal** — round 5 changes (no Publish button, liveVisibility, canDelete) stay. Creations now lists forks AFTER they are saved (deferred fork creation); clicking a fork opens its detail page with "Edit in sandbox" / "View source page" actions.
- **Fork button UX** — changed to "navigate to sandbox with intent=fork" instead of POST `/api/fork`. §6.7.
- **ForkSuccessModal** — moved from pre-fork-creation to post-save-fork-creation. Same shape (View source / Continue editing) but triggered after save rather than after fork POST.
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
| 2026-07-07 | Edit = auto-fork (Mashu's answer to clarify #1) | Cleaner mental model; originals never get touched by editing. **SUPERSEDED 2026-07-08 by deferred-fork model.** |
| 2026-07-08 | Deferred fork creation (Mashu, round 6 revision) | Click Fork just navigates to sandbox pre-filled. No side effect. Save is the moment of truth: owner + intent=load → version-update; non-owner OR owner + intent=fork → fork-create. Avoids polluting Creations with empty forks; cancel/back-out leaves no trace. Supersedes the Round 5 "edit = auto-fork" model. |
| 2026-07-08 | Unified intent flag across every surface (Mashu, round 7) | Same intent + ownership matrix applies at every entry point: library, /library/item/[id], /sandbox/*, /creations, source page, modal preview, build drawer, sandbox menu, wherever. No per-surface special cases. |
| 2026-07-07 | Visibility IS publish state (no separate button) | Already shipped in round 5. |
| 2026-07-07 | Plan-first, not code-first | This is a multi-week cross-cutting change. Design doc prevents wasted code. |
| 2026-07-07 | Soft-delete (tombstone) for source row deletion (OQ1 answered by Mashu) | Deleted source rows stay as tombstones so forked descendants' version history still resolves. The version row is preserved; only the entity row is removed. |
| 2026-07-07 | Stale-version indicator in build preview (OQ2 answered by Mashu) | New builds don't hit this; only when looking at history. UI shows "version N of M" + "Update available: v5 →". |
| 2026-07-07 | Universal `source_origin` + `version_id` on ALL entity types (Mashu round 6) | Primitives, capabilities, effects, items, templates, characters, builds — same fork + version model everywhere. |
| 2026-07-07 | Three slot-source enum: OWNED / FORKED / PINNED (Mashu round 6) | "I can fork and modify, shouldn't update; I can author and update from source; library-taken can be updated transitively." One enum captures all three. |
| 2026-07-07 | Transitive dependency update walks capability → primitive_links + effect_links → effect.primitive_links | Mashu's example: "I took from library... updated (directly or children aka effects and primitives and primitives in effects)". |
| 2026-07-07 | FORKED slots are frozen; no source update | Mashu: "I can fork something and modify it, I shouldn't be able to update bc it's a new thing." |
| 2026-07-07 | Transitive version bumps (option b in OQ3) | Mashu's mental model is "if dependencies changed, I can update it" — capability version bumps when ANY transitive dep changes. |
| 2026-07-08 | **OQ4 closed** — `intent` flag lives in URL `?intent=fork\|load` (Mashu round 6) | "url works fine I guess as you said." Same param used by library + sandbox surfaces. Debug-visible, no cleanup. |
| 2026-07-08 | **OQ5 closed** — no-changes save returns `kind: "no-op"` with a user-facing message, not a fork (Mashu round 6) | "If I load into build or fork if I make no changes you get the message like you get now: you can't save something you are not the owner of. Try slotting it into another build instead. (Because it would make no sense, why would you do that? It would not help anybody and bloat the db.)" Non-owner + intent=load + any intent=fork + no changes → that error message. Owner + intent=load + no changes → silent "Nothing to save" toast. |
| TBD | Schema vs app-level enforcement of slot-source rules | DB stores the enum; app does the graph walk. Documented in §6.6. |
| TBD | Migration ordering (currently 0018–0024 across 7 migrations) | Likely to consolidate to 4–5 migrations after refinement. Phase D-bis separates schema work from UX work. |

---

## 10. Review Checklist for Mashu

Please review and either ✅ or ✏️ each section:

### Round 5 (initial draft)
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

### Round 6 (universal source_origin + transitive update)
- [ ] **§6.5 Inventory table** — primitives / capabilities / effects / items / templates / characters / builds all get source_origin + version_id. Monsters skipped because no DB table exists. Confirm?
- [ ] **§6.5 Content-addressed versionId** — md5(json_canonicalize(content)) formatted as UUID. Hash choice + serialization acceptable?
- [ ] **§6.6 Three slot-source enum (OWNED / FORKED / PINNED)** — captures your three examples correctly?
  - "I created a capability and update from source" = OWNED
  - "I forked something and modify, shouldn't update" = FORKED (frozen)
  - "I took from library, updated = update available" = PINNED
- [ ] **§6.6 Transitive walk** — capability → primitive_links + effect_links → effect.primitive_links. Right depth? Anything missing from the dependency tree?
- [ ] **§6.6 FORKED slots are frozen** — even if you authored the fork, you can't "update from source" because it's a fork. Confirm.
- [ ] **§6.6 UI badges (OWNED green, FORKED yellow, PINNED blue w/ version N of M)** — colour choices? Symbols instead?
- [ ] **§6.6 OQ3** — option (b) "transitive version bumps when ANY dep changes" — match your mental model?

### Round 6 revision (deferred fork creation + unified intent flag)
- [ ] **§6.7 Behaviour matrix** — Load button (owner=version, non-owner=fork) and Fork button (always fork, even owner). Right?
- [ ] **§6.7 Universal application** — same matrix applies at every entry point: library, /library/item/[id], /sandbox/*, /creations, source page, modal preview, build drawer, sandbox menu, wherever. Confirm?
- [ ] **§6.7 Cancellation semantics** — clicking Fork then browsing away without saving creates no trace. Confirm this is what you want?
- [ ] **§6.7 Save with no changes** — closed 2026-07-08. Server returns `kind: "no-op"` with the appropriate message (non-owner error, owner toast). No fork row created. Match?
- [x] **§6.7 OQ4 closed** — URL `?intent=fork|load` query param. Mashu: "url works fine I guess as you said." ✅
- [x] **§6.7 OQ5 closed** — no-op on no-change with user-facing message. Mashu: "you can't save something you are not the owner of. Try slotting it into another build instead." ✅
- [ ] **§6.7 Sandbox UX chips** — "Forking X" / "Working on X" / "Continue editing" buttons. Phrasing OK?
- [ ] **§6.7 Server endpoints** — every save endpoint reads `intent` from body. Five endpoints to refactor (`/api/primitives`, `/api/effects`, `/api/capabilities`, `/api/items`, `/api/templates`). OK with the cross-cutting refactor?
- [ ] **§6.7 Phase D-bis split** — ship UX first (Phase D: intent plumbing + deferred fork), then schema (Phase D-bis: full content hashing + version rows). Acceptable sequencing?
- [ ] **§D2 Dispatch pseudocode** — `dispatchSave({ intent, ownership, contentHash })` with the no-op shortcut — captures the matrix correctly?
- [ ] **§1 Problem statement** — opening editor is a navigation gesture, save is the moment of truth. Captures the new mental model?

### Implementation order adjustments needed?

The original plan (§5) covers primitives + junctions. With universal source_origin + slot-source enum, the plan needs:
- **New phase**: migrations 0021–0024 for capabilities/effects/items/templates/characters/builds + slot_source column.
- **New endpoint**: `/api/entities/update-from-source` (transitive walk).
- **New UI**: slot-source badge in build preview + "Update available →" action.

Estimated timeline: ~25 working days now (was ~17). Want me to revise the phase breakdown before any code starts?

---

## 11. Implementation Task List (Round 6 final)

The plan is split into **5 phases** that can ship semi-independently. Each phase ends with a working slice the user can play with.

### Phase 1 — Intent plumbing + deferred fork UX (Days 1–5)

The minimum-viable deferred-fork model. No new schema. No content hashing. Just URL params + dispatch in the existing routes.

| Task | Files | Days |
|---|---|---|
| T1.1 Add `intent` query-param parsing to grammar + blueprint sandbox routes | `src/app/sandbox/grammar/page.tsx`, `src/app/sandbox/blueprint/page.tsx` | 0.5 |
| T1.2 Add `intent` to `useGlobalControls` so all surfaces can read/write | `src/lib/controls/global-controls.tsx` | 0.5 |
| T1.3 Add `intent` to `editingTarget` context in grammar-form + blueprint-form | `src/components/sandbox/grammar-form.tsx`, `src/components/sandbox/blueprint-form.tsx` | 1 |
| T1.4 Update `LikeForkBar` Fork button: replace POST `/api/fork` with `router.push('/sandbox/...?intent=fork&edit=<id>')` | `src/components/engagement/like-fork-bar.tsx` | 0.5 |
| T1.5 Update `Load into build` button: append `&intent=load` to URL | `src/components/sandbox/grammar-library.tsx`, `src/components/sandbox/blueprint-library.tsx` | 0.5 |
| T1.6 Add `dispatchSave` helper that runs the no-op check + matrix | `src/lib/publishing/dispatch-save.ts` (NEW) | 1 |
| T1.7 Wire `dispatchSave` into `/api/primitives` POST handler | `src/app/api/primitives/route.ts` | 1 |
| T1.8 Update `ForkSuccessModal` — trigger after save (not after fork POST). Show "View source / Continue editing" for fork path, "Saved version N+1" toast for version-update path. Modal name stays `ForkSuccessModal` since it only ever appears after a fork-creating save. | `src/components/engagement/fork-success-modal.tsx`, `src/components/sandbox/grammar-sandbox-client.tsx` | 1 |

**Tests:** dispatch-save.test.ts covering all 5 matrix cells (owner × load/fork + non-owner × load/fork + no-changes × 3 cases).

**End-of-phase ship:** user clicks Fork → sandbox loads → save creates fork with the "you can't save something you are not the owner of" message when content unchanged; save with changes creates a fork.

### Phase 2 — Universal intent support across all entity types (Days 6–10)

Apply Phase 1's deferred-fork model to effects, capabilities, items, templates. Same dispatch logic.

| Task | Files | Days |
|---|---|---|
| T2.1 Wire `dispatchSave` into `/api/effects` POST | `src/app/api/effects/route.ts` | 0.5 |
| T2.2 Wire `dispatchSave` into `/api/capabilities` POST | `src/app/api/capabilities/route.ts` | 1 |
| T2.3 Wire `dispatchSave` into `/api/items` POST | `src/app/api/items/route.ts` | 1 |
| T2.4 Wire `dispatchSave` into `/api/templates` POST | `src/app/api/templates/route.ts` | 1 |
| T2.5 Update `FlagAndForkFooter` Fork button → same intent=fork URL pattern | `src/components/engagement/flag-and-fork-footer.tsx` | 0.5 |
| T2.6 Update `CreationPreview` Edit-in-sandbox button → append `&intent=load` | `src/components/creations/creations-client.tsx` | 0.5 |
| T2.7 Update `sandbox/grammar/menu` and `sandbox/blueprint/menu` to thread intent | `src/components/sandbox/*-menu.tsx` | 0.5 |

**End-of-phase ship:** Fork / Load works identically for every entity type.

### Phase 3 — Source origin + universal fork-lineage schema (Days 11–15)

Add `source_origin` to primitives (which lacks it), version_id columns to character junctions, slot-source enum.

| Task | Files | Days |
|---|---|---|
| T3.1 Migration 0018 — `ALTER TABLE primitives ADD COLUMN source_origin text` + backfill + drop 3-col unique + add `(name, source_origin)` unique | `src/db/migrations/0018_*.sql` + journal entry | 1 |
| T3.2 Migration 0019 — `ALTER TABLE character_primitives/capabilities/items/effects ADD COLUMN version_id uuid` | `src/db/migrations/0019_*.sql` + journal | 1 |
| T3.3 Migration 0020 — `ALTER TABLE character_* ADD COLUMN slot_source text CHECK (slot_source IN ('OWNED','FORKED','PINNED'))` + backfill 'PINNED' for existing rows | `src/db/migrations/0020_*.sql` + journal | 1 |
| T3.4 DB backup before prod migration apply | `scripts/backup-db.ts` (already exists, run it) | 0.5 |
| T3.5 Apply migrations to prod via `npx tsx scripts/sync-pending-migrations.mts` + smoke test | — | 1 |
| T3.6 Update `queryLibrary` to handle `(name, source_origin)` identity | `src/lib/library/query.ts` | 1 |

**End-of-phase ship:** All entities have source_origin; builds know what slot_source each entry is.

### Phase 4 — Content hashing + version snapshots (Days 16–22)

The big one. Auto-snapshot every save to a content-addressed version row.

| Task | Files | Days |
|---|---|---|
| T4.1 `resolveContentVersionId(type, content)` — md5(json_canonicalize(content)) → UUID | `src/lib/versions/content-hash.ts` (NEW) | 1 |
| T4.2 `recordVersion(targetType, row)` helper — inserts version row + flips is_latest | `src/lib/versions/auto-snapshot.ts` (NEW) | 1 |
| T4.3 Wire `recordVersion` into `dispatchSave` for both fork and version-update paths | `src/lib/publishing/dispatch-save.ts` | 1 |
| T4.4 Replace `resolveVirtualVersionId` callsites with `resolveContentVersionId` | `src/lib/engagement/version-helpers.ts` + all callers | 1 |
| T4.5 Build slot-version-capture: `slotIntoBuild` captures `versionId = resolveContentVersionId(...)` | `src/components/sandbox/grammar-library.tsx`, `blueprint-library.tsx` | 1 |
| T4.6 Build display queries prefer `version_id` lookup; null = fall back to current row | `src/components/build/build-preview*.tsx` | 1 |
| T4.7 Migration 0021 — backfill version rows for every existing entity | `src/db/migrations/0021_*.sql` + journal | 1 |

**End-of-phase ship:** Every save creates a content-addressed version row; every build slot pins that version.

### Phase 5 — Slot-source UI + transitive update (Days 23–28)

The build-preview badges + the "Update available" UI + transitive dependency walk.

| Task | Files | Days |
|---|---|---|
| T5.1 SlotSourceBadge component — green OWNED / yellow FORKED / blue PINNED v3 | `src/components/build/slot-source-badge.tsx` (NEW) | 1 |
| T5.2 Wire badge into build preview for primitives/effects/capabilities/items | `src/components/build/build-preview*.tsx` | 1 |
| T5.3 `updateFromSource(targetType, targetId, userId)` — walks dependency graph | `src/lib/versions/update-from-source.ts` (NEW) | 2 |
| T5.4 `POST /api/entities/update-from-source` endpoint | `src/app/api/entities/update-from-source/route.ts` (NEW) | 0.5 |
| T5.5 "Update available: v3 → v5" inline button on PINNED slots | `src/components/build/build-preview*.tsx` | 1 |
| T5.6 Migration 0022 — `*_versions.delta_kind` enum constraint + default 'FULL' | `src/db/migrations/0022_*.sql` + journal | 0.5 |
| T5.7 E2E test: capability → primitives + effects → primitive-links; pull update; assert new version_id aggregate | `tests/e2e/transitive-update.test.ts` (NEW) | 1 |

**End-of-phase ship:** User sees slot-source badges in their build; PINNED slots offer transitive updates.

### Total

**~28 working days.** That assumes no surprises and a clean schema. Realistic estimate with reviews + bug fixes: **4–5 weeks.**

### What can ship earlier

- **Phase 1** ships standalone — it's the high-priority UX Mashu asked for. Even without versioning, "click Fork, navigate to sandbox, save with intent decides fork-vs-version" is independently valuable. Recommend phasing review after Phase 1.
- **Phase 3** migrations can run before Phase 4 content-hashing is done — the schema changes are additive and the backfill is idempotent. Means Phase 4 doesn't start with migration stress.
- **Phase 5** can be cut into MVP (slot-source badges, no transitive walk) + enhancement (full graph walk) and shipped in two slices.

### Cut-list (if 28 days is too long)

- **T4.4** (replace `resolveVirtualVersionId`) — keep using virtual IDs in reaction aggregates for now; switch later. Saves 1 day.
- **T4.5/T4.6** (build slot-version-capture) — builds don't pin versions; just show latest. Loses the "edit doesn't break others" guarantee. Saves 2 days but defeats §1 problem statement item 5.
- **T5.3–T5.7** (full transitive update) — ship without transitive walks; user updates one entity at a time manually. Saves 4 days. Most acceptable cut.
