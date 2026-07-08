# Phase 2 Verification Checklist

> **Scope**: Apply Phase 1's deferred-fork model to **effects**,
> **capabilities**, **items**, **templates** (race/background/archetype).
> The same 4-cell matrix that governed primitives in Phase 1 now
> governs every entity type.
>
> **Architecture source of truth**: `docs/architecture/edit-creates-fork.md` §6.7.
> Phase 2 = §11 tasks T2.1–T2.7.

This document is the verification surface for Phase 2. Walk it top
to bottom. Each test is one user-observable behaviour; each is bound
to a specific code path so failures are easy to localise.

The matrix cell you're verifying is called out per-test. Don't judge
later-phase behaviours — they ship in Phases 3–5.

---

## Pre-flight (30 seconds)

1. Visit `https://www.swordweave.quest/library/browse`.
2. Sign in if you aren't already.
3. Open `/creations` and note the **per-entity-type** counts. **This
   is your baseline — don't be alarmed if there are several of each.**
4. Verify Phase 1 is still working: pick any primitive, click Fork,
   land on sandbox, see blue chip, hit Discard, URL clears, no row
   added. (If this fails, Phase 2 is blocked — fix Phase 1 first.)

---

## The 4-cell matrix (applies to every entity type)

Per §6.7 of `edit-creates-fork.md`:

| Entry point                              | URL state                                              | Save outcome (owner) | Save outcome (non-owner) | Save with NO changes          |
|------------------------------------------|--------------------------------------------------------|----------------------|--------------------------|-------------------------------|
| **Fork** button (anywhere)               | `/sandbox/<route>?build=<kind>&edit=<id>&intent=fork`  | **fork** (always)    | **fork**                 | inline error (no row)         |
| **Load into build** button (anywhere)    | `/sandbox/<route>?build=<kind>&edit=<id>&intent=load`  | **version-update**   | **fork**                 | owner toast / non-owner error |
| **Direct deep link** (URL with no `?intent=`) | `/sandbox/<route>?build=<kind>&edit=<id>`        | version-update       | fork                     | same as Load into build       |

**Tests 1–5 walk one entity type (effects) through the matrix in full.**
**Tests 6–8 cross-check the same matrix on the other 3 types in a
single pass each.** If Tests 1–5 pass, Tests 6–8 should be a formality
— they exist so you catch a regression on a single entity type.

---

## Test 1: Fork effect (non-owner) — deferred fork creation

Proves the most important Phase 2 case on effects: clicking Fork
navigates, no row created, save = fork.

### Steps

1. On `/library/browse`, filter to `Type: Effect`, find an effect
   that **isn't owned by you**. System content is fine.
2. Click **Fork** (the GitFork icon).
3. **Verify**: URL is `/sandbox/grammar?build=effect&edit=<id>&intent=fork`.
4. **Verify**: form opens pre-filled with the source's content.
5. **Verify**: form header shows a **blue chip** "Forking <name>".
6. **Verify**: Build & Preview drawer auto-opens with the source
   pre-filled.
7. **Verify**: `/creations` **Effects** count is **unchanged** from baseline.
8. **Verify**: the source effect's fork count on its library card is
   **unchanged**.

### Expected matrix cell

> intent=fork + non-owner → no row on click, fork materialized at save.

### If it fails

- **Still creates a fork on click?** → effect Fork button still uses
  the old `POST /api/fork` path. Check
  `src/components/engagement/like-fork-bar.tsx` for
  `targetType === "EFFECT"` handling — the URL push must use
  `build=effect`.
- **URL has `build=primitive` instead of `build=effect`?** → the
  Fork button's targetType→build mapping is missing the effect branch.
  Check `src/lib/publishing/fork-target.ts` `resolveForkTarget` /
  `buildTypeFromTarget`.
- **No chip?** → the sandbox route didn't thread `intent` into the
  form. Check `src/app/sandbox/grammar/page.tsx` parses `?intent=`
  and passes it to `GrammarSandboxClient`.

---

## Test 2: Fork effect via save — fork row appears

Save is the moment of truth.

### Steps

1. Continuing from Test 1 (URL has `?intent=fork&edit=<id>`).
2. Change one field. Form goes dirty.
3. Click **Save**.
4. **Verify**: success message "Saved to your account." (or
   equivalent — the exact text may differ from primitives; the
   point is the save succeeded).
5. **Verify**: URL bar shows `?edit=<NEW_ID>&intent=fork` (the
   `edit` param swapped from source to new fork).
6. **Verify**: the blue chip is **still** "Forking <name>" (intent
   unchanged).
7. **Verify**: `/creations` **Effects** count went **up by 1**.
8. **Verify**: the new row's name has a "(fork)" suffix.
9. **Verify**: the source effect's fork count is incremented by 1.
10. **Verify**: the **primitive** count (in `/creations`) did **not**
    go up — the save didn't accidentally create a primitive row.

### Expected matrix cell

> intent=fork + non-owner → fork-create. URL swaps. **Only the
> effect row is created** — no spurious primitive/capability/etc.

### If it fails

- **Primitive count also went up?** → server wrote to the wrong
  table. Check `/api/effects` route's dispatch path uses
  `decideSaveOutcome({ targetType: "EFFECT", ... })`, not
  `PRIMITIVE`. (Likely culprit: copy-pasted from `/api/primitives`.)
- **No URL swap?** → `onSaved` callback in
  `grammar-sandbox-client.tsx` or `blueprint-sandbox-client.tsx`
  didn't run `router.replace`. Check the response's `kind ===
  "forked"` and the `newRowId` field.
- **Fork count not incremented?** → the source row's
  `fork_aggregates` row wasn't touched. Check the
  `materializeAsFork` branch in `decideSaveOutcome` /
  `dispatch-save.ts` updates the aggregate for `targetType`.

---

## Test 3: Discard on effect — no trace

Cancellation is a first-class flow.

### Steps

1. On `/library/browse`, find a non-owned effect, click Fork.
2. Land on `/sandbox/grammar?build=effect&edit=<id>&intent=fork`.
3. Change a few fields.
4. Click **Discard**.
5. **Verify**: URL returns to `/sandbox/grammar` (no `?edit=` or
   `?intent=`).
6. **Verify**: `/creations` **Effects** count is **unchanged** from
   baseline.
7. **Verify**: the source effect's fork count is **unchanged**.
8. **Verify**: refresh — same.

### Expected behaviour

> Cancel/back-out → no fork row. No DB write.

### If it fails

- **URL params not cleared?** → `discard-edit-button` testid
  handler didn't run. Check the form's discard button is wired for
  `build=effect` (not just `build=primitive`).

---

## Test 4: Load into build on effect — owner gets version-update

Owner + intent=load = update in place. No new row.

### Steps

1. On `/creations` find an effect you own.
2. Click **Load into build** (NOT Fork).
3. **Verify**: URL is `?build=effect&edit=<id>&intent=load`.
4. **Verify**: gray chip "Working on <name>".
5. Change one field, save.
6. **Verify**: URL stays on the **same** `?edit=<id>` (no swap).
7. **Verify**: `/creations` **Effects** count is **unchanged**.
8. **Verify**: the original effect was updated in place (re-fetch
   and confirm the changed field is persisted).

### Expected matrix cell

> intent=load + caller owns → UPDATE in place. URL doesn't swap.

### If it fails

- **URL swapped?** → `decideSaveOutcome` returned `kind: "forked"`
  instead of `kind: "version-update"`. Ownership check failed —
  verify the source row's `userId` matches your Clerk id.
- **No row updated but row count unchanged?** → `version-update`
  branch ran but no UPDATE happened. Check `/api/effects` route's
  UPDATE statement executes.

---

## Test 5: Load into build on effect — non-owner gets fork

Non-owner + intent=load = fork (same result as clicking Fork).

### Steps

1. On `/library/browse`, find a non-owned effect, click **Load into
   build** on its preview card (NOT the Fork button — click the
   "Load into build" button at the bottom of the preview).
2. **Verify**: URL is `?build=effect&edit=<id>&intent=load`.
3. **Verify**: gray chip "Working on <name>".
4. Change a field, save.
5. **Verify**: URL swaps to `?edit=<NEW_ID>` (fork path).
6. **Verify**: `/creations` **Effects** count went **up by 1**.
7. **Verify**: source effect's fork count incremented.

### Expected matrix cell

> intent=load + non-owner → fork-create.

### If it fails

- **Treated as version-update?** → server saw caller as the owner.
  Check the source row's `userId` and the Clerk id on the request.
- **No fork created?** → dispatch went down `version-update` path.
  Inspect the request body — `intent` should be `"load"` and
  `sourceId` set.

---

## Test 6: Capability cross-check (one pass through the matrix)

Walk capability through one full matrix pass:

1. `/library/browse` → filter to Type: Capability, find a non-owned
   capability, click Fork → URL `?build=capability&intent=fork`,
   blue chip, save with a change, URL swaps, **Capabilities** count
   in `/creations` goes up by 1, **no other entity-type count moves**.
2. Same source, click Fork again, change nothing, save → inline
   error (no row), count unchanged.
3. Open one of your own capabilities from `/creations`, click Load
   into build, change a field, save → URL stays same, count
   unchanged, field persisted.
4. Find a non-owned capability, click Load into build, change,
   save → URL swaps, **Capabilities** count up by 1.

If all 4 sub-steps pass, capabilities are working. If any fail, the
likely culprit is the `/api/capabilities` route's dispatch wiring
(missing the `decideSaveOutcome` call or wrong `targetType`).

---

## Test 7: Item cross-check (one pass through the matrix)

Same shape as Test 6 but for items:

1. Fork non-owned item, save with change → URL swaps, **Items**
   count up by 1, no other entity-type count moves.
2. Same source, Fork again, save with no change → inline error.
3. Load into build on your own item, change, save → URL stays, no
   new row, field persisted.
4. Load into build on non-owned item, change, save → URL swaps,
   new row.

---

## Test 8: Template cross-check (one pass through the matrix)

Same shape but for templates. Templates cover race/background/
archetype — they share a single table and single API, so this is
one test not three.

1. Fork non-owned template (any kind), save with change → URL
   swaps, **Templates** count up by 1, no other entity-type count
   moves.
2. Same source, Fork again, save with no change → inline error.
3. Load into build on your own template, change, save → URL stays,
   no new row, field persisted.
4. Load into build on non-owned template, change, save → URL swaps,
   new row.

If templates are broken, check `/api/templates` route's dispatch
wiring and confirm the `kind` enum (RACE / BACKGROUND / ARCHETYPE)
is preserved on fork.

---

## Test 9: Entry-point coverage (the "where" test)

The doc says: "same matrix applies at every entry point where these
buttons appear." Verify by clicking each surface at least once:

- [ ] **Library browse card** — Fork → navigate, no row.
- [ ] **Library item detail page** (`/library/item/EFFECT:42`) —
      Fork → navigate, no row.
- [ ] **Creations page** — Edit in sandbox (your own row) → navigate
      with `?intent=load`, no chip (intent=null defaults), save
      updates in place.
- [ ] **Source page** (`/sources/<slug>`) — Fork on an entry →
      navigate.
- [ ] **Modal preview** (open any effect, click "Load into build" at
      the bottom of the preview) → navigate + drawer opens.
- [ ] **Sandbox menu** (if there's a "browse library" link that
      surfaces a Fork button) — Fork → navigate.

If any surface still uses the old `POST /api/fork` or
`router.push` without `?intent=`, that's a Phase 2 bug.

### If it fails

- Check the surface's Fork/Load-into-build handler. Per
  `edit-creates-fork.md` §6.7: "same things apply wether I use
  button load into build or the fork button anywhere they are in
  library, in sandbox, my creations, source page, modal preview,
  whatever."
- Common miss: `flag-and-fork-footer.tsx` Fork button may not
  thread `intent=fork` into the URL. Or
  `creations-client.tsx`'s Edit-in-sandbox may not append
  `&intent=load`.

---

## Test 10: No-changes message on every entity type

OQ5 closed 2026-07-08: a save with zero content changes returns
`kind: "no-op"` with the right user message instead of forking.

| Path                                              | Expected message                                                                  |
|---------------------------------------------------|-----------------------------------------------------------------------------------|
| Owner + intent=load, no changes                   | Toast: "Nothing to save."                                                         |
| Non-owner + intent=load, no changes               | Inline error: "You can't save something you're not the owner of. Try slotting it into another build instead." |
| Any + intent=fork, no changes                     | Inline error: same as non-owner-load above.                                       |

Verify on **at least one of each entity type** (effect, capability,
item, template) that the message matches the matrix above. If the
message is "Primitive saved" on an effect save, the wording
dispatch is wrong.

### If it fails

- Check `decideSaveOutcome` returns the right `userMessage` for the
  no-op branch. Tests live in
  `src/lib/__tests__/dispatch-save.test.ts`.

---

## What's NOT in Phase 2 (explicitly out of scope)

The following behaviours **look related** but ship in later phases.
Don't report these as bugs:

- **Schema changes (Phase 3)**: `source_origin` on primitives,
  `version_id` on character junctions, `slot_source` enum. None of
  this lands in Phase 2.
- **Content-addressed version rows (Phase 4)**: every save creating
  a `*_versions` row. Phase 2 only changes the *entity* row, not
  the version history table.
- **Build pinning (Phase 4/5)**: character slots capturing
  `version_id` from a slot event. Phase 2 leaves build slotting
  alone.
- **Slot-source badges (Phase 5)**: the OWNED / FORKED / PINNED
  badges in the build preview.
- **Transitive update (Phase 5)**: the `/api/entities/update-from-source`
  endpoint that walks the dependency graph.
- **Slotting-rules enforcement**: `T2.7` (sandbox menu threading
  intent) and the full slotting system in §6.5 are still in
  flight; don't expect slot-source UI yet.

---

## Quick smoke (90 seconds, optional)

If you don't want to walk every test, do this:

1. Pick **one** non-owned effect, click Fork, change a field, save
   → URL swaps, new effect row in `/creations`.
2. Same source, Fork again, no changes, save → inline error.
3. Pick **one** of your own capabilities, click Load into build,
   change a field, save → URL stays, no new row, field persisted.
4. Pick **one** non-owned item, click Load into build, change a
   field, save → URL swaps, new item row.
5. Pick **one** non-owned template, click Fork, change a field,
   save → URL swaps, new template row.

If those five entity types behave correctly, Phase 2 is working.

---

## Reporting feedback

When you report back, please distinguish:

- **Phase 2 bugs**: anything in Tests 1–10 fails.
- **Cross-realm regressions**: an entity type broke that was
  working in Phase 1. (e.g. primitive Fork now no-ops on save.)
- **Out-of-scope observations**: anything else you noticed (slot
  UX, content hashing, version rows, etc.). I'll log these but not
  act until their phase.

---

## Phase 2 patch — 2026-07-08 (commit 51568b7 + 7bb6e9f)

Three live-UI bugs surfaced after the initial Phase 2 ship:

### Bug A: "Save with no edits" still forked legacy source rows

**Symptom**: Mashu forked Blind Stun (a pre-hash system row, `contentHash=null`),
hit Save without changing anything, and got a new fork row.

**Two-part root cause**:

1. `decideSaveOutcome` deliberately treats `contentHash === null` on the
   source row as "always changed" (designed in Phase 1 as a fallback for
   legacy rows that hadn't been hashed yet). This made the no-op short
   circuit unreachable for any source row without a hash.
2. The Phase 2 forms (`effect-form`, `capability-form`) silently dropped
   fields that go into the canonical hash: per-slot `notes`. The form
   loaded the source's primitive links WITHOUT notes, then submitted
   without notes. The route's `s.notes ?? ""` produced empty notes
   while the source's stored hash had the real notes. Hash mismatch →
   dispatcher said "forked".

**Fix**:

1. New `backfillSourceHash()` in `src/lib/publishing/dispatch-save.ts`,
   called inside `dispatchEntitySave` BEFORE `loadEntityOwner`. Reads
   the source row's current state (with all its slot links per entity
   type), computes the canonical hash, writes it back. Idempotent.
   After backfill, the normal `sourceHash === draftHash` comparison
   works correctly:
   - "open + save with no edits" → no-op ✓
   - "open + add a primitive + save" → fork ✓
   - second save with no edits → no-op ✓
2. `effect-form.tsx` + `effect-form-preview.tsx` — `EffectFormSlot` and
   `EffectRow.primitiveLinks[].notes` added. The form loads notes from
   `initialEffect.primitiveLinks[].notes`, sends them in the body. Same
   pattern for `capability-form.tsx` + `capability-form-preview.tsx`.
3. `hash-content.ts` — capability's canonical effectSlots were
   `{effectId, slotLabel, notes}` but the form's `effectIds` is a flat
   `string[]` with no per-slot metadata. Same root cause: form can't
   round-trip the metadata, so the hash always sees a change. Fix:
   flatten to `effectIds: string[]` in the canonical payload (matching
   item + template patterns). Per-effect slotLabel/notes are still
   stored in the DB; the hash just doesn't read them. Comment in the
   interface declaration notes that future PRs can surface them in the
   UI and re-introduce them in the hash.

**Verified live** (Mashu's account, on phone + via this assistant's
headless browser session):
- `?build=effect&edit=8b27f420-...&intent=fork` + Save (no edits) →
  "Nothing to fork — make a change first.", URL unchanged.
- `?build=capability&edit=eb167a4e-...&intent=fork` + Save (no edits) →
  "Nothing to fork — make a change first.", URL unchanged.
- `?build=effect&edit=<owned-id>&intent=load` + Save (no edits) →
  "Nothing to save.", URL unchanged.

### Bug B1: intent chip missing on the 4 Phase 2 forms

**Symptom**: only `primitive-form.tsx` showed the "Forking X" / "Working on X"
chip (Round 6). The effect, capability, item, template forms had no chip.

**Fix**: copied the same `saveIntentLabel()` + `<span data-testid="save-intent-chip">`
block from primitive-form into all 4 Phase 2 form headers. Blue chip for
`intent=fork`, gray for `intent=load`. Title tooltips match primitive-form.

**Verified live**:
- `?intent=fork` on any entity → "Forking <name>" blue chip.
- `?intent=load` on any entity → "Working on <name>" gray chip.

### Bug B2: preview modal stays open after /creations → Edit in sandbox

**Symptom**: clicking "Edit in sandbox" from the Creations page preview
modal called `router.push(...)` to the sandbox, but the preview modal
stayed overlaid on top of the new sandbox page.

**Root cause**: `ModalStackHost` is mounted at the app-shell level, so
it outlives page navigations. The stack from the preview modal
persisted.

**Fix**: `usePathname()` + `useEffect` inside `ModalStackHost` that
clears the stack when the route changes. Ref-comparison against the
last-seen pathname so the initial mount doesn't clear a freshly opened
modal.

**Verified live**: /creations → click Strike (Copy) → modal opens →
"Edit in sandbox" → sandbox opens, preview modal is gone, no overlay.
